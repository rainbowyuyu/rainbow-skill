import assert from 'node:assert/strict';
import fs from 'node:fs';
import {content,directions,normalizeState,filterProjects,buildSelection,cssTokens,designPrompt,artwork} from '../lab/modules/web-aesthetic.js';
const root=new URL('../',import.meta.url);let checks=0;
const ok=(test,message)=>{assert.ok(test,message);checks++;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const original={directionId:'unknown',selectedId:'missing',favorites:['water','water','unknown'],category:'bad',title:'长'.repeat(300)};
const s=normalizeState(original);equal(s.favorites,['water'],'Only unique existing favorites retained');equal(s.title.length,180);equal(original.favorites,['water','water','unknown'],'Input not mutated');equal(s.directionId,'editorial');equal(s.selectedId,'tower');equal(s.category,'全部');
equal(filterProjects({query:' NS '}).map(p=>p.id),['water'],'Search is case insensitive and trimmed');equal(filterProjects({query:'水面',category:'控制'}),[],'Filters intersect');equal(filterProjects({onlyFavorites:true,favorites:['control','chip'],query:'反馈'}).map(p=>p.id),['control']);equal(filterProjects({onlyFavorites:true}),[]);equal(filterProjects({query:'does-not-exist'}),[]);
const shared=normalizeState({title:'中文标题\n<em>仍然是文本</em>',query:'水面',selectedId:'chip',favorites:['water'],onlyFavorites:true,rationale:'当前任务需要阅读'});
for(const d of directions){
 const current=normalizeState({...shared,directionId:d.id});for(const key of ['title','query','selectedId','favorites','onlyFavorites','rationale'])equal(current[key],shared[key],`${d.id} preserves ${key}`);
 const out=buildSelection(current);equal(out.state,current);equal(out.currentTitle,shared.title);equal(out.reason,shared.rationale);ok(out.layout.sectionOrder.length>=3);ok(cssTokens(d.id).includes('--page-surface: '+d.tokens.surface));ok(designPrompt(current).includes(shared.title));ok(designPrompt(current).includes(d.tradeoff));
 out.content.projects[0].title='mutated export';out.tokens.ink='bad';out.layout.sectionOrder.push('bad');ok(content.projects[0].title!=='mutated export');ok(d.tokens.ink!=='bad');ok(!d.layout.sectionOrder.includes('bad'));
 for(const p of content.projects)ok(artwork(p.art,d.id).includes('<svg'),'Original SVG exists');
}
assert.throws(()=>cssTokens('missing'),RangeError);checks++;
const channel=x=>{const c=parseInt(x,16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const lum=h=>.2126*channel(h.slice(1,3))+.7152*channel(h.slice(3,5))+.0722*channel(h.slice(5,7));
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const contrast=directions.map(d=>{const values={id:d.id,body:ratio(d.tokens.ink,d.tokens.surface),muted:ratio(d.tokens.muted,d.tokens.surface),accent:ratio(d.tokens.accent,d.tokens.surface)};ok(values.body>=4.5,`${d.id} body contrast`);ok(values.muted>=4.5,`${d.id} muted contrast`);ok(values.accent>=4.5,`${d.id} accent text contrast`);return values;});
const result={passed:true,checks,scope:'Pure content/state/export and declared token contrast; no browser or aesthetic certification',contrast,browserReviewed:false};
fs.mkdirSync(new URL('qa/',root),{recursive:true});fs.writeFileSync(new URL('qa/web-aesthetic-data.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
