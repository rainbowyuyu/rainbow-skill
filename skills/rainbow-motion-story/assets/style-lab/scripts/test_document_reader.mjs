import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {escapeHTML,resolveReaderLink,renderMarkdown,createDocumentLoader,attachDocumentReader} from '../lab/document-reader.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://localhost:8000/studies/shuffle-story.md';
let checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
equal(escapeHTML('<script x="&">\''),'&lt;script x=&quot;&amp;&quot;&gt;&#39;','raw markup escaped');
for(const url of ['javascript:alert(1)','data:text/html,test','file:///D:/secret','mailto:a@b.com','vbscript:msgbox(1)','java\nscript:alert(1)','https://user:password@example.com/'])check(resolveReaderLink(url,base)===null,'unsafe or unsupported link rejected');
check(resolveReaderLink('../guides/shuffle-story.md',base).markdown,'relative local document stays in reader');
check(!resolveReaderLink('https://example.com/story.md',base).markdown,'remote markdown not fetched by local reader');
check(resolveReaderLink('https://example.com/',base).href==='https://example.com/','external https link retained');
check(resolveReaderLink('#观察',base).markdown,'local heading remains in document');
const malicious=renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=evil()>\n\n[bad](javascript:alert) [bad](data:x) [ok](https://example.com/?a=1&b=2)\n\n`<img onerror=evil()>`\n\n```html\n<script>bad</script>\n```',base);
check(!/<(?:script|img)\b/i.test(malicious),'raw HTML cannot create elements');
check(!/href="(?:javascript|data):/i.test(malicious),'unsafe links absent');
check(malicious.includes('rel="noopener noreferrer"'),'external links isolate opener');
check(malicious.includes('a=1&amp;b=2'),'href attribute escaped');
const sample=renderMarkdown('# 观察\n\n## 关系\n\n## 关系\n\n**实体** 与 *公式* 和 `6!`\n\n| 位置 | 选择 |\n| --- | --- |\n| 1 | 6 |\n\n- 一项\n- 二项\n\n[继续](../guides/shuffle-story.md#方法)\n\n![样图](../evidence/a.jpg)\n\n[原片](https://example.com/)',base);
for(const piece of ['<h1 id="doc-观察">','id="doc-关系-1"','<strong>实体</strong>','<em>公式</em>','<code>6!</code>','<table>','<ul>','data-reader-document="true"','loading="lazy"'])check(sample.includes(piece),'render supported document structure '+piece);
const renderedDocuments=[];
for(const path of ['studies/shuffle-story.md','guides/shuffle-story.md','examples/shuffle-story/API.md']){
    check(existsSync(resolve(root,path)),'referenced document exists');const source=readFileSync(resolve(root,path),'utf8'),html=renderMarkdown(source,'http://localhost:8000/'+path);
    check(html.includes('<h1'),'actual document gets a heading');check(!/<script\b/i.test(html),'actual document cannot inject a script');renderedDocuments.push({path,sourceBytes:Buffer.byteLength(source),htmlBytes:Buffer.byteLength(html)});
}

// Race test deliberately uses a fetcher which ignores AbortSignal.
const pending=[],seen=[],errors=[];
const loader=createDocumentLoader({fetchText:(url,signal)=>{const d=deferred();pending.push({url,signal,...d});return d.promise;},onSuccess:(text,url)=>seen.push({text,url}),onError:(error,url)=>errors.push({message:error.message,url})});
const old=loader.load('old.md'),fresh=loader.load('fresh.md');check(pending[0].signal.aborted,'new navigation aborts old request');
pending[1].resolve('NEW');check(await fresh,'fresh request applies');pending[0].resolve('OLD');check(!(await old),'late old result ignored');equal(seen,[{text:'NEW',url:'fresh.md'}],'stale content never replaces current document');
const closed=loader.load('closed.md');loader.cancel();pending[2].resolve('CLOSED');check(!(await closed),'response after close ignored');
const bad=loader.load('bad.md'),good=loader.load('good.md');pending[3].reject(Error('late error'));await bad;pending[4].resolve('GOOD');await good;check(errors.length===0,'old request error cannot replace newer document');
const failure=loader.load('failure.md');pending[5].reject(Error('HTTP 404'));check(!(await failure),'current error handled');check(errors.length===1&&errors[0].url==='failure.md','error belongs to active request');

// Minimal DOM exercises open, focus return, history and delegated local links.
const events=new Map(),windowEvents=[],fetches=[],classSet=new Set();let restoreFocus=0;
function node(){return {dataset:{},attributes:{},innerHTML:'',textContent:'',scrollTop:0,disabled:false,
    setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;},addEventListener(k,v){this.handlers??=new Map();this.handlers.set(k,v);},querySelector(){return null;},querySelectorAll(){return [];}};}
const children=Object.fromEntries(['.reader-content','h2','.reader-path','.reader-back','.reader-native','.reader-close'].map(key=>[key,node()]));
const dialog={...node(),querySelector:key=>children[key],showModal(){this.open=true;},close(){this.open=false;},contains:el=>el.inside===true,getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100}),remove(){this.removed=true;}};
const doc={querySelector:()=>null,createElement:()=>dialog,body:{append(){}},activeElement:{focus(){restoreFocus++;}},documentElement:{classList:{add:key=>classSet.add(key),remove:key=>classSet.delete(key)}},addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
const win={location:{href:'http://localhost:8000/lab/shuffle-story.html'},dispatchEvent:event=>windowEvents.push(event.type)};
const reader=attachDocumentReader({document:doc,window:win,fetch:async(url,options)=>{fetches.push({url,options});return {ok:true,text:async()=>`# ${url}\n\nBody`};}});
check(reader.open('../studies/shuffle-story.md'),'local document opens');await settle();
check(dialog.open&&classSet.has('document-reader-open'),'modal opens and background scroll locks');check(children['.reader-close'].focused,'close button receives initial focus');check(windowEvents[0]==='document-reader:open','reader emits pause event');
check(fetches[0].options.redirect==='error'&&fetches[0].options.credentials==='same-origin','local fetch does not follow remote redirect');
children['.reader-content'].scrollTop=240;
check(reader.open('../guides/shuffle-story.md'),'second document opens');await settle();check(!children['.reader-back'].disabled,'local history available');
children['.reader-back'].onclick();await settle();check(children['.reader-content'].scrollTop===240,'back restores previous reading position');
let prevented=false;const link={inside:true,closest(){return this;},hasAttribute:()=>false,getAttribute:()=> '../guides/shuffle-story.md'};
events.get('click')({target:link,button:0,preventDefault(){prevented=true;}});await settle();check(prevented,'ordinary local markdown click intercepted');
prevented=false;events.get('click')({target:link,button:0,ctrlKey:true,preventDefault(){prevented=true;}});check(!prevented,'modified clicks retain browser fallback');
check(!reader.open('https://example.com/remote.md'),'external document retains direct browser navigation');
let cancelPrevented=false;dialog.handlers.get('cancel')({preventDefault(){cancelPrevented=true;}});check(cancelPrevented&&!dialog.open&&!classSet.has('document-reader-open'),'Escape closes and unlocks');check(restoreFocus===1,'close returns focus to launch link');check(windowEvents.at(-1)==='document-reader:close','close event emitted without auto-play');
reader.destroy();check(dialog.removed&&!events.has('click'),'reader removes delegated listener on destroy');
const report={passed:true,checks,renderedDocuments,verified:['HTML and attributes escaped','Only HTTP(S) links','Local Markdown navigation','External links use isolated tab','Generation-token race rejection','Close cancellation','Current-error handling','Modal focus and Escape return','Back restores document scroll','Modified-click direct-link fallback'],notVerified:['Real browser layout and focus trapping','Screen reader output']};
writeFileSync(resolve(root,'qa/document-reader.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
