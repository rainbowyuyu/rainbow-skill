/** Dependency-free local Markdown reader. Raw HTML is always escaped. */
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resolveReaderLink(raw,base){
    const value=String(raw??'').trim();if(!value||/[\u0000-\u001f\u007f]/.test(value))return null;
    try{const url=new URL(value,base),origin=new URL(base).origin;
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
        return {href:url.href,local:url.origin===origin,markdown:url.origin===origin&&/\.md$/i.test(url.pathname),hash:url.hash};
    }catch{return null;}
}
const slug=value=>'doc-'+String(value).replace(/[`*_]/g,'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\p{L}\p{N}_-]/gu,'');
function inline(value,base,allowLinks=true){
    const source=String(value),token=/`([^`\n]+)`|(!?)\[([^\]\n]+)\]\((<[^>\n]+>|[^\s)]+)(?:\s+"[^"\n]*")?\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*/g;
    let result='',last=0;
    for(const match of source.matchAll(token)){
        result+=escapeHTML(source.slice(last,match.index));last=match.index+match[0].length;
        if(match[1]!==undefined){result+=`<code>${escapeHTML(match[1])}</code>`;continue;}
        if(match[3]!==undefined){
            const label=inline(match[3],base,false),link=allowLinks?resolveReaderLink(match[4].replace(/^<|>$/g,''),base):null;
            if(!link){result+=label;continue;}
            if(match[2]&&link.local&&/\.(?:png|jpe?g|webp|gif|avif)$/i.test(new URL(link.href).pathname))
                result+=`<a class="reader-image" href="${escapeHTML(link.href)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(link.href)}" alt="${escapeHTML(match[3])}" loading="lazy" decoding="async"></a>`;
            else result+=`<a href="${escapeHTML(link.href)}"${link.markdown?' data-reader-document="true"':' target="_blank" rel="noopener noreferrer"'}>${label}${link.local?'':' ↗'}</a>`;
            continue;
        }
        result+=match[5]!==undefined||match[6]!==undefined?`<strong>${escapeHTML(match[5]??match[6])}</strong>`:`<em>${escapeHTML(match[7])}</em>`;
    }
    return result+escapeHTML(source.slice(last));
}
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
const divider=line=>/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
/** Conservative subset: headings, paragraphs, lists, tables, code, images and links. */
export function renderMarkdown(markdown,base){
    const lines=String(markdown).replace(/\r\n?/g,'\n').split('\n'),out=[],ids=new Map();let paragraph=[],list=null,code=null;
    const flush=()=>{if(paragraph.length){out.push(`<p>${inline(paragraph.join('\n'),base).replaceAll('\n','<br>')}</p>`);paragraph=[];}};
    const closeList=()=>{if(list){out.push(`</${list}>`);list=null;}};
    for(let i=0;i<lines.length;i++){
        const value=lines[i],fence=/^\s*(`{3,}|~{3,})(.*)$/.exec(value);
        if(code){if(fence&&fence[1][0]===code.char&&fence[1].length>=code.length){out.push(escapeHTML(code.lines.join('\n'))+'</code></pre>');code=null;}else code.lines.push(value);continue;}
        if(fence){flush();closeList();out.push('<pre><code>');code={char:fence[1][0],length:fence[1].length,lines:[]};continue;}
        if(!value.trim()){flush();closeList();continue;}
        const heading=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(value);
        if(heading){flush();closeList();const level=heading[1].length,key=slug(heading[2]),n=ids.get(key)||0;ids.set(key,n+1);out.push(`<h${level} id="${escapeHTML(key+(n?'-'+n:''))}">${inline(heading[2],base)}</h${level}>`);continue;}
        if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(value)){flush();closeList();out.push('<hr>');continue;}
        if(i+1<lines.length&&value.includes('|')&&divider(lines[i+1])){
            flush();closeList();out.push('<div class="reader-table"><table><thead><tr>'+cells(value).map(cell=>`<th>${inline(cell,base)}</th>`).join('')+'</tr></thead><tbody>');i++;
            while(i+1<lines.length&&lines[i+1].trim()&&lines[i+1].includes('|')){i++;out.push('<tr>'+cells(lines[i]).map(cell=>`<td>${inline(cell,base)}</td>`).join('')+'</tr>');}
            out.push('</tbody></table></div>');continue;
        }
        const item=/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/.exec(value);
        if(item){flush();const type=item[1]?'ul':'ol';if(list!==type){closeList();list=type;out.push(`<${type}>`);}out.push(`<li>${inline(item[3],base)}</li>`);continue;}
        if(/^\s*>\s?/.test(value)){flush();closeList();out.push(`<blockquote>${inline(value.replace(/^\s*>\s?/,''),base)}</blockquote>`);continue;}
        closeList();paragraph.push(value);
    }
    if(code)out.push(escapeHTML(code.lines.join('\n'))+'</code></pre>');flush();closeList();return out.join('\n');
}
/** Tokens protect responses even when fetch or response.text ignores cancellation. */
export function createDocumentLoader({fetchText,onStart=()=>{},onSuccess=()=>{},onError=()=>{}}){
    let generation=0,controller=null;
    return {async load(url){const mine=++generation;controller?.abort();const active=new AbortController();controller=active;onStart(url);
        try{const result=await fetchText(url,active.signal);if(mine!==generation)return false;onSuccess(result,url);return true;}
        catch(error){if(mine!==generation)return false;onError(error,url);return false;}},
        cancel(){generation++;controller?.abort();controller=null;}};
}
export function attachDocumentReader({document:doc=globalThis.document,window:win=globalThis.window,fetch:fetcher=globalThis.fetch}={}){
    if(!doc||!win||doc.querySelector('[data-document-reader]'))return null;
    const dialog=doc.createElement('dialog');dialog.dataset.documentReader='true';dialog.className='document-reader';dialog.setAttribute('aria-labelledby','document-reader-title');
    dialog.innerHTML='<div class="reader-top"><div class="reader-heading"><span>研究与复用</span><h2 id="document-reader-title">文档阅读</h2><p class="reader-path"></p></div><button class="reader-close" type="button" aria-label="关闭阅读，返回动画">关闭 <kbd>Esc</kbd></button></div><div class="reader-toolbar"><button class="reader-back" type="button" disabled>← 返回上一页</button><span class="reader-hint">动画已暂停，关闭后保留原位置</span><a class="reader-native" data-reader-native href="#" target="_blank" rel="noopener noreferrer">直接打开 ↗</a></div><div class="reader-content" tabindex="0" aria-live="polite"></div>';
    doc.body.append(dialog);
    const content=dialog.querySelector('.reader-content'),title=dialog.querySelector('h2'),path=dialog.querySelector('.reader-path'),back=dialog.querySelector('.reader-back'),native=dialog.querySelector('.reader-native'),closeButton=dialog.querySelector('.reader-close');
    let isOpen=false,currentUrl=null,returnFocus=null,history=[],scrollPosition=0,ready=false;
    const fragment=url=>{const hash=new URL(url).hash;if(!hash)return false;let raw;try{raw=decodeURIComponent(hash.slice(1));}catch{return false;}
        const target=[...content.querySelectorAll('[id]')].find(node=>node.id===raw||node.id===`doc-${raw}`||node.id===slug(raw));if(target){target.scrollIntoView({block:'start',behavior:'instant'});return true;}return false;};
    const loader=createDocumentLoader({
        fetchText:async(url,signal)=>{const response=await fetcher(url,{signal,credentials:'same-origin',redirect:'error'});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.text();},
        onStart(url){ready=false;title.textContent='正在打开文档…';path.textContent=new URL(url).pathname;native.href=url;content.setAttribute('aria-busy','true');content.innerHTML='<p class="reader-loading">正在读取研究记录…</p>';back.disabled=history.length===0;content.scrollTop=0;},
        onSuccess(markdown,url){if(!isOpen)return;ready=true;content.innerHTML=renderMarkdown(markdown,url);content.setAttribute('aria-busy','false');title.textContent=content.querySelector('h1,h2,h3')?.textContent||new URL(url).pathname.split('/').pop();if(!fragment(url))content.scrollTop=scrollPosition;},
        onError(){if(!isOpen)return;ready=false;title.textContent='这份文档暂时无法打开';content.setAttribute('aria-busy','false');content.innerHTML='<p>没有读取到文档。可以返回上一页，或用上方“直接打开”查看原文件。</p>';}
    });
    function open(raw,{from=win.location.href,push=true,restoreScroll=0}={}){
        const link=resolveReaderLink(raw,from);if(!link?.markdown)return false;
        if(isOpen&&ready&&currentUrl&&currentUrl.split('#')[0]===link.href.split('#')[0]&&link.hash){currentUrl=link.href;fragment(link.href);return true;}
        if(!isOpen){if(typeof dialog.showModal!=='function')return false;returnFocus=doc.activeElement;history=[];dialog.showModal();isOpen=true;doc.documentElement.classList.add('document-reader-open');win.dispatchEvent(new CustomEvent('document-reader:open'));closeButton.focus();}
        else if(push&&currentUrl)history.push({url:currentUrl,scrollTop:content.scrollTop});
        currentUrl=link.href;scrollPosition=restoreScroll;void loader.load(link.href);return true;
    }
    function close(){if(!isOpen)return;isOpen=false;loader.cancel();dialog.close();doc.documentElement.classList.remove('document-reader-open');win.dispatchEvent(new CustomEvent('document-reader:close'));returnFocus?.focus?.({preventScroll:true});}
    closeButton.onclick=close;back.onclick=()=>{const previous=history.pop();if(previous)open(previous.url,{push:false,restoreScroll:previous.scrollTop});};
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
    const onClick=event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.hasAttribute('download')||anchor.hasAttribute('data-reader-native'))return;
        if(open(anchor.getAttribute('href'),{from:dialog.contains(anchor)?currentUrl:win.location.href}))event.preventDefault();};
    doc.addEventListener('click',onClick);
    return {open,close,dialog,destroy(){close();doc.removeEventListener('click',onClick);dialog.remove();}};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')attachDocumentReader();
