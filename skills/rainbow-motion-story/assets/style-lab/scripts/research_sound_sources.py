"""Public document research only. No audio retrieval, playback, or provider calls."""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import sys

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence' / 'sound-design'
OUT.mkdir(parents=True, exist_ok=True)
SNAPSHOTS = ROOT / 'work' / 'sound-design-sources'
SNAPSHOTS.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')

SOURCES = [
    ('adobe-foley', 'https://www.adobe.com/creativecloud/video/discover/foley-sound-effects.html', 'professional-explainer'),
    ('ase-whoosh', 'https://www.asoundeffect.com/whoosh-sound-design/', 'professional-publication'),
    ('murch-dense-clarity', 'https://filmsound.org/murch/dense.htm', 'practitioner-essay'),
    ('adobe-j-l-cuts', 'https://www.adobe.com/creativecloud/video/discover/j-cut-and-l-cut.html', 'professional-explainer'),
    ('studiobinder-j-cut', 'https://www.studiobinder.com/blog/what-is-a-j-cut/', 'professional-publication'),
    ('studiobinder-l-cut', 'https://www.studiobinder.com/blog/what-is-an-l-cut/', 'professional-publication'),
    ('adobe-ducking', 'https://helpx.adobe.com/premiere-pro/using/auto-ducking.html', 'official-product-documentation'),
    ('izotope-dialogue-mix', 'https://www.izotope.com/en/learn/how-to-mix-dialogue.html', 'professional-audio-publication'),
    ('ebu-r128', 'https://tech.ebu.ch/docs/r/r128.pdf', 'broadcast-recommendation'),
    ('itu-bs1770', 'https://www.itu.int/rec/R-REC-BS.1770/en', 'measurement-standard-landing-page'),
    ('webdev-two-clocks', 'https://web.dev/articles/audio-scheduling', 'browser-engineering-article'),
    ('mdn-buffer-start', 'https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start', 'web-api-documentation'),
    ('mdn-automation', 'https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setValueCurveAtTime', 'web-api-documentation'),
    ('w3c-web-audio', 'https://www.w3.org/TR/webaudio-1.1/', 'web-specification'),
]

def fetch(item):
    id_, url, kind = item
    entry = {'id': id_, 'requestedUrl': url, 'sourceType': kind,
             'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
             'method': 'Public HTTP document retrieval; no audio listening or video playback',
             'reviewStatus': 'retrieved-not-yet-reviewed', 'excerpts': []}
    try:
        r = requests.get(url, timeout=(12, 30), headers={'User-Agent': 'Mozilla/5.0 (compatible; document-research/1.0)'})
        entry.update(finalUrl=r.url, httpStatus=r.status_code, receivedBytes=len(r.content),
                     bodySha256=hashlib.sha256(r.content).hexdigest(), contentType=r.headers.get('Content-Type',''))
        pdf = 'pdf' in entry['contentType'] or r.content.startswith(b'%PDF')
        extension = '.pdf' if pdf else '.html'
        raw = SNAPSHOTS / (id_ + extension)
        raw.write_bytes(r.content)
        entry['bodyFile'] = '../../work/sound-design-sources/' + raw.name
        if pdf:
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(r.content))
                text = '\n\n'.join('PAGE ' + str(i + 1) + '\n' + (p.extract_text() or '') for i,p in enumerate(reader.pages))
                entry['title'] = str((reader.metadata or {}).get('/Title',''))
                entry['pageCount'] = len(reader.pages)
            except Exception as exc:
                text = ''
                entry['extractionError'] = str(exc)
        else:
            soup = BeautifulSoup(r.content, 'html.parser')
            entry['title'] = soup.title.get_text(' ',strip=True) if soup.title else ''
            for el in soup(['script','style','noscript','svg']):
                el.decompose()
            main = soup.find('main') or soup.find('article') or soup.body or soup
            text = '\n'.join(main.stripped_strings)
        target = SNAPSHOTS / (id_ + '.txt')
        target.write_bytes(text.encode('utf-8'))
        entry.update(textFile='../../work/sound-design-sources/' + target.name, textSha256=hashlib.sha256(text.encode()).hexdigest(), textCharacters=len(text))
        if r.status_code != 200:
            entry['reviewStatus'] = 'http-error-no-substantive-claim'
        print(json.dumps({'id':id_,'status':r.status_code,'title':entry['title'],'chars':len(text)},ensure_ascii=False),flush=True)
    except Exception as exc:
        entry.update(reviewStatus='fetch-failed',error=str(exc),httpStatus=None)
        print(json.dumps({'id':id_,'error':str(exc)},ensure_ascii=False),flush=True)
    return entry

if __name__ == '__main__':
    old = json.loads((OUT/'sources.json').read_text(encoding='utf-8')) if (OUT/'sources.json').exists() else {'sources':[]}
    source_items = [(s['id'],s['requestedUrl'],s['sourceType']) for s in old['sources']] or SOURCES
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(fetch,source_items))
    merged={s['id']:s for s in old['sources']}
    for entry in results:
        previous=merged.get(entry['id'])
        if previous and previous.get('bodySha256')==entry.get('bodySha256'):
            for key in ['reviewStatus','readScope','excerpts','supports','limitations']:
                if key in previous: entry[key]=previous[key]
        merged[entry['id']]=entry
    manifest={'schemaVersion':1,'date':dt.date.today().isoformat(),
              'scope':'Sound design document research. Documents and excerpts only; no listening claims.',
              'sources':list(merged.values())}
    (OUT/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
