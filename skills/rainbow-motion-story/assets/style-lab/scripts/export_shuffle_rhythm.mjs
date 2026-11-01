/** Export and independently decode the actual 18-second WAV files.
 * No BGM, normalization, sample downloads, microphone input or listening claims.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {duration,modes,renderAudio,readHolds} from '../lab/shuffle-rhythm.js';
import {encodeWav,measureSignal} from '../lab/sound-design.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'examples/shuffle-rhythm'),reportPath=path.join(root,'qa/shuffle-rhythm-media.json');
const sampleRate=48000,overwrite=process.argv.includes('--overwrite');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(command,args,{binary=false,maxBuffer=16*1024*1024}={}){
    const result=spawnSync(command,args,{encoding:binary?null:'utf8',maxBuffer,timeout:60000,windowsHide:true});
    if(result.error||result.status!==0)throw Error(`${command} failed: ${result.error?.message||String(result.stderr).slice(-1800)}`);
    return result;
}
function save(file,bytes){
    const data=typeof bytes==='string'?Buffer.from(bytes):Buffer.from(bytes);
    if(fs.existsSync(file)){
        if(fs.readFileSync(file).equals(data))return;
        if(!overwrite)throw Error(`Different existing output: ${file}. Preserve it or explicitly rerun with --overwrite for generated study outputs.`);
    }
    fs.writeFileSync(file,data);
}
const version=run('ffmpeg',['-version']).stdout.split(/\r?\n/)[0];
run('ffprobe',['-version']);
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(path.dirname(reportPath),{recursive:true});
const manifest={schema:'motion-atelier.shuffle-rhythm-media/v1',sampleRate,channels:2,duration,encoding:'PCM signed 16-bit little endian',
    source:'Original deterministic synthesis; no third-party recordings, voice, music or source-video assets.',
    level:'Module render gain 1.0; plan masterGain is retained. No UI volume scaling, normalization, compressor or limiter. Modes are not loudness matched.',
    sourceHashes:Object.fromEntries(['lab/shuffle-rhythm.js','lab/sound-design.js'].map(file=>[file,hash(fs.readFileSync(path.join(root,file)))])),files:[]};

for(const mode of modes){
    const audio=renderAudio(mode.id,sampleRate),filename=`shuffle-${mode.id}-48k.wav`,wavPath=path.join(output,filename),planFilename=`shuffle-${mode.id}.plan.json`;
    save(wavPath,encodeWav(audio));
    save(path.join(output,planFilename),JSON.stringify({...audio.plan,export:{sampleRate,channels:2,encoding:'pcm_s16le',gain:1,wav:filename}},null,2)+'\n');
    const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',wavPath]).stdout);
    const streams=probe.streams.filter(s=>s.codec_type==='audio');
    if(streams.length!==1)throw Error(`Expected one audio stream in ${filename}`);
    const stream=streams[0],decoded=run('ffmpeg',['-v','error','-i',wavPath,'-map','0:a:0','-c:a','pcm_f32le','-f','f32le','pipe:1'],{binary:true}).stdout;
    if(decoded.length%8)throw Error(`Invalid decoded stereo frame size in ${filename}`);
    const samples=decoded.length/8,left=new Float32Array(samples),right=new Float32Array(samples);
    let maxQuantizationError=0;
    for(let i=0;i<samples;i++){
        left[i]=decoded.readFloatLE(i*8);right[i]=decoded.readFloatLE(i*8+4);
        maxQuantizationError=Math.max(maxQuantizationError,Math.abs(left[i]-audio.left[i]),Math.abs(right[i]-audio.right[i]));
    }
    const metrics=measureSignal(left,right,sampleRate);
    const quiet=readHolds.map(hold=>{
        let peak=0,sum=0,count=0;
        for(let i=Math.ceil(hold.start*sampleRate);i<Math.min(samples,Math.floor(hold.end*sampleRate));i++){
            peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;count++;
        }
        return {...hold,checkedSamples:count,peak,rms:count?Math.sqrt(sum/(count*2)):0,passed:count>0&&peak===0};
    });
    const loudnessOutput=run('ffmpeg',['-hide_banner','-nostats','-i',wavPath,'-af','loudnorm=I=-23:TP=-1:LRA=7:print_format=json','-f','null','-']).stderr;
    const blocks=[...loudnessOutput.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];
    if(!blocks.length)throw Error(`FFmpeg input loudness report unavailable for ${filename}`);
    const loudness=JSON.parse(blocks.at(-1)[0]);
    const levels={integratedLUFS:Number(loudness.input_i),truePeakDbTP:Number(loudness.input_tp),loudnessRangeLU:Number(loudness.input_lra)};
    const checks={fullDecode:true,pcm16:stream.codec_name==='pcm_s16le'&&stream.bits_per_sample===16,stereo:stream.channels===2,
        sampleRate48000:Number(stream.sample_rate)===sampleRate,exactSampleCount:samples===duration*sampleRate,
        duration18:Math.abs(Number(stream.duration??probe.format.duration)-18)<1/sampleRate,
        unclipped:metrics.clippedSamples===0&&metrics.samplePeak<.5,conservativeTruePeak:levels.truePeakDbTP<=-1,
        finiteLoudness:Number.isFinite(levels.integratedLUFS),readWindowsSilent:quiet.every(w=>w.passed),quantizationError:maxQuantizationError<=1/32768,
        zeroEdges:left[0]===0&&right[0]===0&&left.at(-1)===0&&right.at(-1)===0};
    const bytes=fs.readFileSync(wavPath);
    manifest.files.push({mode:mode.id,filename,planFilename,bytes:bytes.length,sha256:hash(bytes),
        codec:stream.codec_name,sampleRate:Number(stream.sample_rate),channels:stream.channels,samples,durationSeconds:samples/sampleRate,
        metrics,levels,maxQuantizationError,readHolds:quiet,checks,passed:Object.values(checks).every(Boolean)});
}
manifest.totalWavBytes=manifest.files.reduce((n,f)=>n+f.bytes,0);
save(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const report={passed:manifest.files.every(f=>f.passed),ffmpegVersion:version,
    method:'Actual exported WAV -> ffprobe -> complete FFmpeg float32 decode -> sample/read-window checks; FFmpeg loudnorm INPUT measurement only, null output discarded.',
    listeningPerformed:false,limits:'No timbre preference, human synchrony judgement, device latency or speech intelligibility tested. Short-file LRA is descriptive, not a compliance claim.',
    ...manifest};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,files:manifest.files.length,totalWavBytes:manifest.totalWavBytes,
    output,report:reportPath,maxTruePeakDbTP:Math.max(...manifest.files.map(f=>f.levels.truePeakDbTP)),readWindows:manifest.files.map(f=>({mode:f.mode,passed:f.checks.readWindowsSilent}))},null,2));
if(!report.passed)process.exitCode=1;
