import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {candidates,renderAudio,buildPlan,duration} from '../lab/modules/signal-relay.js';
import {encodeWav} from '../lab/sound-design.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'examples/signal-relay');
fs.mkdirSync(out,{recursive:true});const files=[];
for(const c of candidates){const audio=renderAudio(c.id,48000),name=`signal-${c.id}-48k.wav`,buffer=Buffer.from(encodeWav(audio));fs.writeFileSync(path.join(out,name),buffer);fs.writeFileSync(path.join(out,`signal-${c.id}.plan.json`),JSON.stringify(buildPlan(c.id),null,2)+'\n');
  const decode=spawnSync('ffmpeg',['-v','error','-i',path.join(out,name),'-f','null','-'],{encoding:'utf8'});if(decode.status!==0)throw new Error(decode.stderr||'Decode failed');
  files.push({id:c.id,name,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),sampleRate:48000,duration,channels:2,fullDecode:true,metrics:audio.metrics});
}
const manifest={schema:'motion-atelier.signal-relay-media/v1',source:'Original procedural music and SFX. No reference-media samples.',files,listeningPerformed:false};fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
