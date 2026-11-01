import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Structural checks only. A tool cannot certify that an explanation is clear or true.
export function inspectStory(story){
 const issues=[],warnings=[],add=(code,beat,message)=>issues.push({code,beat,message});
 const beats=story.beats??[],allIds=beats.map(b=>b.id),seen=new Set(),knownTerms=new Set(),terms=new Set((story.terms??[]).map(t=>t.id)),sources=new Set((story.sources??[]).map(s=>s.id));
 if(!Number.isFinite(story.duration)||story.duration<=0)add('duration',null,'总时长必须为正数');
 if(!story.centralQuestion?.trim()||!story.answer?.trim())add('promise',null,'写下中心问题与最后能回答的内容');
 let cursor=0;
 for(const [i,b]of beats.entries()){
  if(!b.id||seen.has(b.id))add('id',b.id,'段落ID缺失或重复');
  if(!Number.isFinite(b.start)||!Number.isFinite(b.end)||b.end<=b.start)add('time',b.id,'时间窗必须为有限正区间');
  if(Math.abs(b.start-cursor)>1/30)add('coverage',b.id,'时间线存在超过1帧的空隙或重叠');
  for(const key of ['question','beforeBelief','afterBelief','visual','anchorIn','anchorOut'])if(!b[key]?.trim())add('ledger',b.id,'缺少 '+key);
  if(b.beforeBelief===b.afterBelief)warnings.push({beat:b.id,message:'前后判断完全相同：人工检查这一段是否新增信息'});
  for(const d of b.dependsOn??[])if(!seen.has(d))add('dependency',b.id,'依赖必须是前面已出现的段落：'+d);
  for(const t of b.introduces??[]){if(!terms.has(t))add('term',b.id,'未登记术语：'+t);knownTerms.add(t)}
  for(const t of b.uses??[])if(!knownTerms.has(t))add('unintroduced',b.id,'使用前未建立术语对象：'+t);
  if(!['verified','derived','illustrative'].includes(b.evidence))add('evidence',b.id,'标明证据类型');
  if(['verified','derived'].includes(b.evidence)&&!b.sourceIds?.length)add('source',b.id,'事实或推导缺少来源引用');
  for(const s of b.sourceIds??[])if(!sources.has(s))add('source',b.id,'来源未登记：'+s);
  if(b.readingWindow){const {start,end}=b.readingWindow;if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<b.start||end>b.end)add('reading',b.id,'阅读停留必须完整位于该段内')}
  if(i&&beats[i-1].anchorOut!==b.anchorIn&&!b.handoff?.trim())warnings.push({beat:b.id,message:'锚点换了：补交接动作或明确剪辑理由'});
  if(!b.narration?.trim()&&!b.sound?.trim())warnings.push({beat:b.id,message:'无旁白段请确认声音与观察任务'});
  cursor=b.end;seen.add(b.id);
 }
 if(!beats.length||Math.abs(cursor-story.duration)>1/30)add('coverage',null,'最后一段与总时长不一致');
 if(new Set(allIds).size!==allIds.length)add('id',null,'段落ID必须唯一');
 return{passed:issues.length===0,title:story.title,beats:beats.length,duration:story.duration,issues,warnings,scope:'仅校验结构、引用和时间；不能代替事实核对、试讲、观众复述或审片。'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error('用法: node scripts/inspect_story.mjs 路径/story.json');
 const story=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),report=inspectStory(story);
 console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
