"""Generate editable SVG template assets from the saved university style preset.

No network calls. The emblem must already be present; its provenance is retained
in assets/zju-group-meeting/manifest.json. The grid is a teaching Gaussian model.
"""
from pathlib import Path
from copy import deepcopy
import math, json, hashlib
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parent.parent/'assets'/'zju-group-meeting'
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
def el(tag, **attrs):return ET.Element('{'+NS+'}'+tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def add(parent,tag,**attrs):e=el(tag,**attrs);parent.append(e);return e
def text(parent,value,x,y,size=50,fill='#080080',anchor='start'):
    e=add(parent,'text',x=x,y=y,fill=fill,font_size=size,font_weight=800,text_anchor=anchor,font_family='Microsoft YaHei, PingFang SC, sans-serif');e.text=value;return e
def svg(w,h):return el('svg',viewBox=f'0 0 {w} {h}',width=w,height=h)
def save(name,s):ET.ElementTree(s).write(ROOT/name,encoding='utf-8',xml_declaration=True)
def emblem(parent,x,y,size):
    source=ET.parse(ROOT/'zju-emblem.svg').getroot()
    group=add(parent,'g',transform=f'translate({x} {y}) scale({size/160})')
    for child in source:group.append(deepcopy(child))
def top(parent,title='章节标题',cover=False):
    add(parent,'rect',width=1920,height=1080,fill='white')
    defs=add(parent,'defs');grad=add(defs,'linearGradient',id='chapter-rule',x1='0%',y1='0%',x2='100%',y2='0%')
    for pos,col in [('0%','#080080'),('43%','#7e75c7'),('100%','#ffffff')]:add(grad,'stop',offset=pos,stop_color=col)
    text(parent,title,42,87,52 if cover else 65)
    add(parent,'rect',x=0,y=135 if cover else 120,width=1810 if cover else 1920,height=13,fill='url(#chapter-rule)')
    emblem(parent,1750 if cover else 1790,5 if cover else 12,135 if cover else 105)
    if not cover:text(parent,'1',1740,86,52,'black','middle')
def probability_grid():
    result=svg(1140,480)
    add(result,'title').text='Probability density evolution — illustrative Gaussian model'
    add(result,'desc').text='State z, process s, density p. Mean 0.55−0.1s, variance 0.035+0.04s, s∈[0,4]. No empirical LLM data.'
    def project(z,s,p):
        x=(z-.1)*275;y=(s-2)*66;a=x*math.cos(-.48)-y*math.sin(-.48);b=x*math.sin(-.48)+y*math.cos(-.48)
        return 580+a*1.05,260+(b*math.sin(.68)-p*75*math.cos(.68))*1.05
    def path(points,color,width=1.6,opacity=1):
        d='M '+' L '.join(f'{x:.3f} {y:.3f}' for x,y in points)
        add(result,'path',d=d,fill='none',stroke=color,stroke_width=width,opacity=opacity)
    for j in range(9):path([project(-1.25,j*.5,0),project(1.45,j*.5,0)],'#97bbd8',1,.35)
    for j in range(14):path([project(-1.2+j*.2,0,0),project(-1.2+j*.2,4,0)],'#97bbd8',1,.35)
    for j in range(27,-1,-1):
        s=j*4/27;var=.035+.04*s;mu=.55-.1*s
        path([project(z:=-1.25+i*2.7/90,s,math.exp(-(z-mu)**2/(2*var))/math.sqrt(2*math.pi*var)) for i in range(91)],'#c5def1',1.7,.32+j/28*.55)
    s=3.2;var=.035+.04*s;mu=.55-.1*s
    path([project(z:=-1.25+i*2.7/90,s,math.exp(-(z-mu)**2/(2*var))/math.sqrt(2*math.pi*var)) for i in range(91)],'#ffdf6c',4)
    return result

grid=probability_grid();save('probability-grid.svg',grid)
cover=svg(1920,1080);top(cover,'研究领域与组会系列',True)
add(cover,'rect',x=0,y=273,width=1920,height=388,fill='#076fb6')
text(cover,'研究主题的大标题',95,425,88,'white');text(cover,'清晰说明核心问题',95,545,88,'white')
g=add(cover,'g',transform='translate(1110 301) scale(.693)')
for child in grid:g.append(deepcopy(child))
text(cover,'汇报人　姓名　　指导教师　姓名',960,816,49,'black','middle');text(cover,'汇报日期',960,930,44,'black','middle')
save('cover-template.svg',cover)
body=svg(1920,1080);top(body,'一、章节标题')
add(body,'rect',x=48,y=170,width=29,height=29,fill='none',stroke='black',stroke_width=8)
text(body,'一句话说明本页的核心判断',112,207,49,'black')
for i,(label,col) in enumerate([('观测','#0874bc'),('模型','#008689'),('预测','#7863ad')]):
    x=420+i*540
    add(body,'circle',cx=x,cy=510,r=118,fill=col)
    text(body,label,x,528,55,'white','middle')
    if i<2:
        add(body,'path',d=f'M {x+155} 510 H {x+385} l -25 -16 M {x+385} 510 l -25 16',fill='none',stroke='#184b79',stroke_width=6)
text(body,'主视觉、数据与坐标放在这里',960,775,42,'black','middle')
add(body,'rect',x=0,y=940,width=1920,height=140,fill='#2877b6')
text(body,'本页结论：用大字突出核心信息',960,1029,50,'#fff200','middle')
save('content-template.svg',body)
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
manifest['generated_assets']=[{'file':n,'role':r,'sha256':hashlib.sha256((ROOT/n).read_bytes()).hexdigest()} for n,r in [('probability-grid.svg','teaching Gaussian density; editable vector paths'),('cover-template.svg','editable cover structure, generic identity fields'),('content-template.svg','editable content structure, generic labels'),('theme.css','16:9 HTML projection theme')]]
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated 3 SVG assets and updated provenance manifest.')
