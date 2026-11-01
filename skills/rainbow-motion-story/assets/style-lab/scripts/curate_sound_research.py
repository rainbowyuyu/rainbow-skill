"""Attach explicitly reviewed document scopes and short quotations to source records."""
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'sound-design'
RAW=ROOT/'work'/'sound-design-sources'
RAW.mkdir(parents=True,exist_ok=True)
assert RAW.resolve().is_relative_to(ROOT.resolve())

# Move individual research snapshots, never recursively delete or touch video projects.
for p in list(OUT.iterdir()):
    if p.is_file() and p.suffix in {'.html','.txt','.pdf','.body'}:
        destination=RAW/p.name
        assert not destination.exists(), f'Existing snapshot: {destination}'
        p.replace(destination)

REVIEWED={
 'berklee-foley':('Foley definition, action synchronisation, props and physical performance paragraphs',
  ['particularly those that must perfectly match the action onscreen','matching the movements of on-screen actors']),
 'ase-whoosh-hahn':('Practitioner Q&A: development, typical usage, source/impact samplers, frequency-layering tips; no embedded audio/video played',
  ['All the Volume, Effects and Grain Playhead modulations are synced to the duration of the doppler path','combine sounds that feature different frequency bands']),
 'ase-prey':('Selected interview answers on sparse reactive backgrounds, hunter perspective, bear/percussion competition, and subjective silence around Taabe; not every interview section',
  ['specific and sparse','competition between the bear running and the percussion of the music','if you sit with silence in a movie']),
 'ase-game-mixing':('What is mixing; readability; pre-dubs; mix ownership; systemic prioritisation/sidechain passages; no claim of reading every linked book or video',
  ['carefully prioritizing sounds to maintain focus','clear and intelligible dialogue is generally a priority','side-chaining, ducking, HDR, and state mixing']),
 'ase-science-heart':('Selected interview sections Accuracy, Heart defects, Soundscapes, 3D audio tools, Biggest challenge; sound design methods only, no independent medical validation',
  ['parameters described one heart cycle','external POV has a more realistic approach','This is an educational app, so medical accuracy was extremely important']),
 'studiobinder-j-cut':('Definition, four described use cases and execution paragraph; embedded movie examples were not played',
  ['audio of the next scene or shot precedes the image change','use the J-cut with intention']),
 'studiobinder-l-cut':('Definition and main narrative/transition use paragraphs; embedded movie examples were not played',
  ['audio from a preceding scene carries over the image of the following scene','how far over you carry the audio can change']),
 'audacity-auto-duck':('Entire Auto Duck manual body, preparation and parameters',
  ['The control track should be properly synchronized','Avoids over-rapid volume changes','Fade Down Lengths']),
 'ebu-r128':('All five PDF pages, particularly recommendation items h–m and notes about short programmes; November 2023 version',
  ['Target Level of −23.0 LUFS','shall not exceed −1 dBTP','For programmes shorter than 1 minute']),
 'webdev-two-clocks':('Article text and scheduling examples: audio clock, JavaScript timer jitter, lookahead tradeoffs, rendering via audio clock; demos not run',
  ['it is a bad idea to use JavaScript’s setTimeout to directly start playing audio events','100ms of “lookahead” time','checking the audio system’s clock']),
 'mdn-buffer-start':('Entire start() method page: when, offset, duration, exceptions and example',
  ['You can only call this function once','natural sample rate','If when is less than']),
 'mdn-automation':('Entire setValueCurveAtTime() page: interpolation, parameter bounds, final value and example',
  ['linear interpolation','Every value in the array must be a finite number','guaranteed to match the last value']),
 'w3c-web-audio':('Selected normative sections: AudioScheduledSourceNode.start, getOutputTimestamp, AudioParam cancelScheduledValues/cancelAndHoldAtTime, OfflineAudioContext/control/render-thread distinction; not the whole specification',
  ['Schedules a sound to playback at an exact time','the automation value that would have happened at cancelTime','such cancellations may cause discontinuities','time of the sample frame which is currently being rendered']),
 'cc-by-4':('Complete official human-readable deed and footnotes, not the full legal code',
  ['provide a link to the license, and indicate if changes were made','even commercially','No warranties are given']),
 'cc-zero':('Complete official human-readable deed, not the full legal code',
  ['You can copy, modify, distribute and perform the work','patent or trademark rights','has not verified the copyright status']),
 'freesound-license-faq':('FAQ Licenses: legal use of individual files, attribution, uploader copyright responsibility and reused-file restrictions; other FAQ topics not used',
  ['freesound lets the user select one of three licenses','original creator can give you permission','there might be cases where the users of our site'])
}

m=json.loads((OUT/'sources.json').read_text(encoding='utf-8'))
for s in m['sources']:
    for field in ['bodyFile','textFile']:
        if field in s:s[field]='../../work/sound-design-sources/'+Path(s[field]).name
    if s['id'] in REVIEWED:
        scope,terms=REVIEWED[s['id']]
        text=(OUT/s['textFile']).read_text(encoding='utf-8')
        normalized=' '.join(text.split())
        excerpts=[]
        for term in terms:
            needle=' '.join(term.split())
            offset=normalized.lower().find(needle.lower())
            if offset<0:
                print('Missing selected excerpt:',s['id'],term)
                continue
            start=max(0,offset-55);end=min(len(normalized),offset+len(needle)+180)
            short=normalized[start:end]
            excerpts.append({'matchedText':needle,'normalizedTextOffset':offset,'text':short,
                             'sha256':hashlib.sha256(short.encode()).hexdigest()})
        s.update(reviewStatus='selected-text-reviewed',readScope=scope,excerpts=excerpts,
                 limitations='Document evidence only. No audio listening, video playback, asset download, or universal timing/gain claim.')
    elif s['id']=='itu-bs1770':
        s.update(reviewStatus='landing-page-only',readScope='Title and version/status list only; no algorithm clauses read',
                 limitations='Not used to claim a specific measurement algorithm implementation.')
    elif s['id']=='ase-whoosh-search':
        s.update(reviewStatus='search-page-only',readScope='Public publisher search returned category navigation only',
                 limitations='No substantive article evidence.')
    elif s.get('httpStatus')!=200:
        s.update(readScope='Error or access-denied page only',excerpts=[],
                 limitations='No claims derived; no access-control bypass attempted.')
m['scope']='Public sound-design document study with selected text reading and retained hashes. No reference audio heard; no third-party sound assets downloaded.'
m['rawSnapshots']='../../work/sound-design-sources/ (research cache; exclude from distributed skill package)'
m['reviewedSourceCount']=sum(s['reviewStatus']=='selected-text-reviewed' for s in m['sources'])
m['searchLimitations']=[
 'Initial Google HTTP search returned a redirect/help shell, not usable results; no claims derived.',
 'Four Bing searches returned irrelevant result sets; searches.json retains queries, response hashes and results; excluded as evidence.',
 'DuckDuckGo returned HTTP 202 human-verification challenge; stopped, no challenge bypass.',
 'Public A Sound Effect WordPress search and Sound On Sound publisher search produced relevant URLs; selected article bodies were separately retrieved and read.'
]
(OUT/'sources.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
print('Reviewed source count:',m['reviewedSourceCount'])
