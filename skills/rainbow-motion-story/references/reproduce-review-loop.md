# 学到 → 复现 → 评价 → 调整：标准闭环

第一次看一个新参考片，不要直接写研究文档。先按本文走一遍五阶段，每阶段有产物和通过标准；达不到就不进下一阶段，或明确降级并标注。这套闭环用于以后所有新参考，也用于回看旧参考。

配套文件：单段验收细则见 [review.md](review.md)；研究条目怎么写见 [assets/style-lab/studies/README.md](../assets/style-lab/studies/README.md)；解码脚本在 [assets/style-lab/examples/reference-decode/](../assets/style-lab/examples/reference-decode/)。

## 路径约定

本文命令用绝对路径，Windows + Git Bash。变量先设一次：

```bash
REF=/d/Claude\ Project/video_project/research/douyin-batch2
DEC="C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/examples/reference-decode"
STU="C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/studies"
LAB="C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/lab"
```

| 阶段 | 产物 | 路径 |
|---|---|---|
| 采集 | 原片 + 双采样率音轨 + 元数据 | `$REF/videos/<key>.mp4`、`$REF/audio/<key>.{16k,44k}.wav`、`$REF/detail.json` |
| 解码 | 帧统计 + 音频事件 + 联系表 | `$REF/analysis/<key>/frames.json`、`<key>-audio.json`、`sheets/` |
| 研究 | 逐条研究文档 | `$STU/<topic>.md`（登记进 `$STU/README.md` 表格） |
| 复现 | 可操作复现页 | `$LAB/repro-<key>.html` |
| 评价 | 评价文档 + 原始数 | `$STU/review-<key>.md`、`$REF/work/review-<key>/` |

命名一律 `<key>`：短、唯一、与 `videos/` 文件名一致（`blend`、`camera38`、`magpie`、`shuffle`…）。评价文档与复现页都用同一个 key，便于机器对账。

---

## 阶段 A · 采集

目标：拿到**可播放、时长可信、音轨完整**的原片，并记下来源。这一阶段不产生任何视觉结论。

### 命令

```bash
# 1) 先把解析结果落到 detail.json（id / url / desc / dur / sizes / 各清晰度直链）
#    已有文件不要覆盖，新参考追加到同一 dict，key 用短名。

# 2) 按最高可用清晰度下载到 videos/<key>.mp4
curl -L --retry 3 -o "$REF/videos/$key.mp4" "<detail.json 里的 url>"

# 3) 抽两条音轨：16k 单声道给 ASR 与 librosa，44k 立体声给听审与频谱
ffmpeg -y -v error -i "$REF/videos/$key.mp4" -vn -ac 1 -ar 16000 "$REF/audio/$key.16k.wav"
ffmpeg -y -v error -i "$REF/videos/$key.mp4" -vn -ac 2 -ar 44100 "$REF/audio/$key.44k.wav"

# 4) 记指纹与流信息
sha256sum "$REF/videos/$key.mp4"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,duration \
        -show_entries format=duration,size,nb_streams -of json "$REF/videos/$key.mp4"
```

### 通过标准

- `format.duration` 与 `detail.json` 的 `dur` 差 ≤0.1 s；与音轨时长差 ≤1 帧。
- `nb_streams` ≥2（视频 + 音频）。**只有一个流就停下来查**，不要继续。
- 两条 wav 非空；16k 单声道、44k 立体声（`ffprobe` 核 `sample_rate` / `channels`）。
- 画幅与帧率已记录。竖屏常见 720×1280 或 1080×1440，与抖音页面显示不同，以 ffprobe 为准。
- `detail.json` 里保留 `desc` 原文与 `music` 字段；之后写讲稿研究时用得上。

### 陷阱（实测）

`ffmpeg -ss` **越过片尾时不报错**：退出码 0，产出 321 字节、`nb_streams` 为 0 的文件。所有切片命令之后必须回查 `duration` 和 `nb_streams`，别信退出码。上面这次是因为把 `-ss 12` 用在了 8.33 s 的 `blend.mp4` 上。

---

## 阶段 B · 解码

目标：把片子变成可查的表——逐帧像素统计、音频事件表、带时间码的联系表。**这一阶段产出的全部是测量，不是观感。**

### 命令

脚本都在 `$DEC`，签名固定：

```bash
# 逐帧视觉统计 → frames.json
python -P "$DEC/decode_video.py" "$REF/videos/$key.mp4" "$REF/analysis/$key"

# 音频事件统计 → <tag>-audio.json（第三参数是 tag，一般用 key）
python -P "$DEC/decode_audio.py" "$REF/audio/$key.16k.wav" "$REF/analysis/$key" "$key"

# 带时间码联系表，6×5=30 格/张
python -P "$DEC/contact_sheet.py" "$REF/videos/$key.mp4" "$REF/analysis/$key/sheets" "$key" 0 12 0.2
```

第三方脚本一律加 `-P`：它把脚本目录与当前目录从 `sys.path` 移除，避免下载目录里被塞进同名 `json.py` 之类的东西抢先加载。**不要用 `-I`**——本机 numpy/cv2/librosa 装在 user site，`-I` 会同时关掉 user site，直接 `ModuleNotFoundError`；`-I -E` 还会吞掉 `PYTHONPATH`，加回来也不生效。

提精确帧（逐帧核对、写评价用），用 `select` 定位而不是 `-ss` 跳转：

```bash
ffmpeg -y -v warning -i "$REF/videos/$key.mp4" \
       -vf "select='eq(n\,167)'" -fps_mode passthrough -frames:v 1 "$REF/work/review-$key/f167.png"
```

`-ss` 落在关键帧上会偏几帧；逐帧核对必须用 `select`（`review-rotor.md` 的参考帧就是这么取的）。帧号 `n` 从 0 起，`n = round(t*fps)`。

### 产物结构（照这个读，不要猜字段）

`frames.json` 顶层：

```json
{"fps": 24.0, "frames": 72, "size": [960, 540], "duration": 3.0,
 "cut_threshold": 0.35, "cuts": [1.25, 2.0], "frames_data": [ ... ]}
```

`frames_data[i]` 每帧一条：

| 字段 | 含义 | 口径 |
|---|---|---|
| `t` | 秒 | `i/fps` |
| `pix_diff` | 相邻帧差 | **160×90** 缩略图灰度绝对差均值，0–255 量纲 |
| `hist_diff` | 相邻帧直方图差 | 24×8 HSV 直方图，归一化 0–1 |
| `sat` / `val` | HSV 均值 | 同为 160×90 |
| `edges` | Canny 边缘密度 | 阈值 60/140 |
| `pal` | 前三主色 | k-means，`{hex, share}` |
| `grid` | 40 格差分 | 8 列 × 5 行，行优先 |
| `cells` | 同一 grid 的字符图 | `' .:-=+*#%@'`，一眼看运动在哪 |

`<key>-audio.json`：

```json
{"dur": 3.0, "onsets": [{"t":0.07,"strength":4.36,"rise":4.36,
   "flatness":0.002,"centroid":4088.0,"kind":"tonal"}],
 "silences": [[2.9,3.0]], "silence_ratio": 0.0,
 "harmonic_to_percussive": 0.52, "tempo": 117.5,
 "rms_db_curve": [[0.0,-25.9], [0.093,-22.6]]}
```

`rms_db_curve` 步长 0.093 s（hop 512 @ 22050）。

### 通过标准

- `frames` 与 `round(duration*fps)` 差 ≤1；差更多说明解码丢帧或可变帧率，先查 `-count_frames`。
- `frames_data` 长度等于 `frames`，首帧 `pix_diff` 为 0（无前帧，正常）。
- `onsets` 非空；若为空先查音轨是不是真的**无声**，而不是阈值太高。
- 联系表每张 30 格且时间码递增；步长按窗口长度选，1–2 s 窗口用 0.05–0.1 s，全片概览用 2–5 s。
- `cuts` 只是给参考的**候选**，不是结论。`review-mech` 的实测是阈值 `max(0.35, p92)` 漏掉了三处真切镜（`hist_diff` 0.134–0.348），要回看 `val` 跳变和内容换场补齐，并在文档里注明"补出"而非"检测出"。

### 这一步不能回答什么

`frames.json` 给的是数值。它不能告诉你"这一段好不好看""音乐是否舒服""音效是什么材质"。凡是要写进研究的形容词，必须另有阶段 E 的听审或播放记录。

---

## 阶段 C · 写研究

目标：写**可复用方法**，不是影评。一条参考一个文件，登记进 `$STU/README.md`。

### 结构（固定六段）

```markdown
# <参考标题> · <key>

## 观察范围
实际看了什么：哪段 1× 播放、哪几张联系表、多少 PTS 样本、是否听审。
没看的直接写"未看"，不要用"整体感觉"代替。

## 观察事实
每条带时间码 + 证据等级（见"证据分级"）。
格式：`12.30–13.05 s：<看到什么> [E1]`

## 动作相位
入口 / 动作 / 落定 / 交接，逐窗口写。窗口没覆盖到的阶段写"未覆盖"。

## 可复用规则
从事实里抽出的、换题材也成立的做法。只写能落到参数或判断上的。

## 实现建议
代码入口、状态来源、可以抄的结构；标明是原创实现还是照搬来源。

## 不能推断的内容
机制层结论 vs 像素层结论；哪些数字是等效值不是真实参数。
```

### 通过标准

- 每条"观察事实"都能指回一张联系表、一个帧号或一个 JSON 字段。
- "可复用规则"里不出现具体题材参数（"洗牌"、"转子"），出现就说明还没抽出来。
- "不能推断的内容"非空。空说明你还没分清楚自己看到了什么。

---

## 阶段 D · 复现

目标：做出**能被别人用同一套脚本量**的复现页，不是做得像。

### 页面契约

复现页放在 `$LAB/repro-<key>.html`，必须暴露一个机器可调用的接口。现在各页命名不统一（`__repro` / `__magpie` / `__api` / `__renderAt`），新页统一用 `window.__repro`：

```js
window.__repro = {
  duration,
  setTime(t),        // 定格，不播放
  canvas,
  toDataURL(),       // 全尺寸 PNG
  measureAt(t),      // 与 frames.json 同口径：{t, v, s, e, aniso, pd}
  measureAll()
};
```

`measureAt` 的 `v/s/e/pd` 必须用和 `decode_video.py` 相同的算法与同一缩略图尺寸（160×90），否则数字不可比。`t` 参数也能用 URL 传：`repro-<key>.html?t=12.3`。

### 导出与测量

导出走本机 Chrome，与 review-magpie / camera38 同一套 `@remotion/renderer`，`createRequire` 指向既有 runtime。骨架照 `$REF/work/review-magpie/scripts/export_repro.mjs` 改三处：`PAGE`、`times`、`outDir`。要点：

```js
await p.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
await p.goto({url: 'file:///' + PAGE.split(path.sep).join('/'), timeout: 60000});
await p.evaluate(() => new Promise(r => { const k = () => (window.__repro ? r(1) : requestAnimationFrame(k)); k(); }));
for (const t of times){
  const url = await p.evaluate(tt => { window.__repro.setTime(tt); return window.__repro.toDataURL(); }, t);
  fs.writeFileSync(path.join(outDir, t.toFixed(3) + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
```

改前版本另存 `repro-<key>.before.html`（现有命名还有 `.before-review2` / `.before-review` / `.bak-review`，新的一律 `.before.html`），这样"改前 vs 改后"能各量一遍。

### 通过标准

- 同一时间点，参考帧与复现帧**同分辨率**。不同分辨率要先证明指标可比，不能直接比。
- 导出脚本跑完，`times` 与输出文件数一致，每张非空。
- `measureAt` 在参考帧校准过：拿参考的原帧喂同一算法，`sat` 差 ≤1、`pd` 差在截断误差内。
- 播放可连续：`play()` 能从头跑到尾不报错，`seek` 后画面与 `measureAt` 一致。

### 分辨率这一关容易过不去

`review-blend.md` 测得：参考 `frames.json` 的 `pix_diff` 在高分辨率重算为 61.55 / 41.17，记录值 60.07 / 39.54，差 <3%。**`pd` 基本不受分辨率影响**，因为它先缩到 160×90。所以"pd 不可比"不成立——但也意味着 `pd` 看不出细节密度，细节要看 `edges` 和 1:1 重测。反过来，`edges` 和主色占比对分辨率敏感得多，跨分辨率必须重算。

---

## 阶段 E · 评价与回写

目标：把复现和参考放在同一把尺子上量，写清**哪几项成立、哪几项不成立、下轮先修什么**。

### 评价文档结构（与现有 9 份 review 一致）

```markdown
# 复现评价 · <key>

<一行口径：参考多少帧、复现什么尺寸、同尺寸还是重采样、脚本在哪>

## 结论
一句能判定的判断。不要"整体不错，略有差距"。

## 量到的差距
表格：项 / 参考 / 改前 / 改后。每行一个可直接量的量。

## 已修复
编号列出，写清手段与量值变化。

## 仍不合格
按严重度排。写明"属重画不是调参"这类性质判断。

## 下次改进
可执行的下一步，一条一个动作。

## 未测
音画同步、主观流畅度、听审、某个窗口——没测的必须列。
```

原始数据放 `$REF/work/review-<key>/`：`out-before.json`、`out-after.json`、`measure.py`、参考帧与复现帧截图。评价文档只放结论和关键数，全量数留在 work 目录。

### 通过标准

- 每一行"量到的差距"都有参考值、改造前值、改造后值三个数，或明确写"未测"。
- "已修复"每条的改动都能在复现页源码里找到位置。
- "仍不合格"至少一条，且不是"还可以更好"这类空话。
- "未测"非空。全部测完的复现基本不存在；空着多半是忘了。
- 参考数与复现数用**同一套脚本、同一缩略图尺寸**产出；换脚本要重跑参考侧。

---

## 证据分级

六个状态，逐条标注，**不许混写**。写在研究文档每条事实后面，也写在评价文档的口径行里。

| 代号 | 状态 | 含义 | 记录方式 | 不能推出 |
|---|---|---|---|---|
| **E0** | HTTP 成功 | 只拿到字节 | `status / bytes / duration / codec`；`sha256` | 画面内容、能不能播 |
| **E1** | 静帧看过 | 看过若干张静图或联系表 | 张数 + 时间码 + 是否全片覆盖 | 运动、节奏、连续性 |
| **E2** | 连续播放看过 | 按 1× 看过一段连续画面 | 起止时间 + 播放倍速 + 是否有声 | 精确帧号、逐帧量值 |
| **E3** | 逐帧量过 | `frames.json` 或逐帧脚本给出的数 | 字段名 + 时间码 + 脚本路径 | 观感、音色 |
| **E4** | 听审过 | 主观听过 | 时间段 + 设备 + 是否 AB 对比 | 频谱成分、精确 onset |
| **E5** | 数值已验证 | 同一量在参考与复现两侧用同口径各算一遍，且校准过 | 两侧数值 + 差值 + 校准帧 | 未测的量、主观评价 |

规则：

- **E0 不等于 E1。** 下载成功只证明文件在，不证明你看过。
- **E1 不等于 E2。** 静帧看再多也推不出运动。`review-magpie` 的 S4 是"五秒半是静帧（1% 运动）"，这个结论只能从 E3 的 `pix_diff` 得出，看静图看不出来。
- **E2 不等于 E3。** 1× 播放能判断"动作顺不顺"，不能给出帧号。写具体切点必须补 E3。
- **E3 不等于 E4。** `silence_ratio = 0.0` 只说明没有低于 −38 dB 的段，不说明"听着不空"。反过来 `silence_ratio = 0.163` 也不说明那 16% 是刻意留白。
- **E4 不覆盖 E5。** 听过能写"音效偏干"，写不出"harmonic_to_percussive 0.52"。要写数就单独跑。
- **E5 是最硬的一级，但只对它量过的那个量成立。** 一个量通过了，不代表同段别的量也对。
- 一条事实可以同时挂多个等级，写法是 `[E1+E3]`，但**每个等级各自对应它支撑的那半句**，不要用一个等级给整段话背书。

`studies/README.md` 现有的写法就是范例：`已复核8张全片稀疏概览、24组密集联系表，共711个精确PTS静态样本。旧1×静音播放范围单独列出。原声未主观实听，信号分析不代替听感判断。`——把 E1、E2、E3、E4 分开说，最后一句明确"没听"。

---

## 回写规则

研究结论不是都能进指南。按下面的门槛分流：

### 可以进指南 / 索引（`assets/style-lab/guides/`、`studies/README.md` 表格）

同时满足：

1. **E5**：参考侧与复现侧同口径量过，且参考侧数值在 `frames.json` 里能查到，或在 `work/` 里有原始输出。
2. **跨题材可迁移**：抽掉题材名之后规则仍成立。反例："洗牌窗口 1.2 s"不是规则，"信息量大的动作窗口压到 1.0–1.5 s 并留 ≥0.3 s 静止"才是。
3. **有实现入口**：能指到一个可以调用的代码文件或 API 字段。

只能进个案研究（`studies/<topic>.md`、`review-<key>.md`）：题材参数、单个镜头的构图描述、未复现的机制推断、只到 E1/E2 的观察。

### 硬性禁止

- **E1/E2 的结论不得写成指南条目。** 指南里出现的数字必须能追到 E3 或 E5。
- **未复现的机制结论不得以"可复用"名义回写。** 写"参考片这样做了，原理成立"可以，写"用这个参数"不行。
- **参考片的具体画面构图不得进指南。** 进 `studies/review-<key>.md`；指南只收回溯得到结构的部分。
- **原声未听审，不得在指南里写声音结论。** 信号分析的数可以进研究，语气归为"待听审"。
- 失败方向不改写为成功。`review-blend` 的 S2 明确写"属重画，不是调参"——这条留在 review 里，不进指南。

### 回写动作

1. 指南条目末尾附来源：`（<key>，E5，2026-10-27）`。
2. `studies/README.md` 表格加一行：参考标题 / 主要方法 / 研究链接。
3. 若与旧条目冲突，不删旧的，在旧条目上加"已被 X 取代（日期）"，保留证据链。
4. 回写只改结论，不改 `frames.json` 等测量产物。产物重跑要重新生成时间戳。

---

## 检查清单（可直接照抄）

### 采集
- [ ] `detail.json` 有 `id / url / desc / dur / music`
- [ ] `videos/<key>.mp4` 存在且 `sha256` 已记录
- [ ] `ffprobe` 显示 `nb_streams` ≥2
- [ ] `format.duration` 与 `detail.json` 的 `dur` 差 ≤0.1 s
- [ ] `audio/<key>.16k.wav` 单声道 16000 Hz，非空
- [ ] `audio/<key>.44k.wav` 立体声 44100 Hz，非空
- [ ] 画幅、帧率已写进研究文档"观察范围"

### 解码
- [ ] `analysis/<key>/frames.json` 存在，`frames` 与 `round(duration*fps)` 差 ≤1
- [ ] 首帧 `pix_diff` 为 0，`cells` 非空
- [ ] `analysis/<key>/<key>-audio.json` 存在，`onsets` 非空
- [ ] `cuts` 已人工复核：漏检的切镜按 `val` 跳变补出并标注"补出"
- [ ] 联系表覆盖全片，每张 30 格，时间码递增
- [ ] 精确帧用 `select='eq(n\,N)'` 提，不用 `-ss`
- [ ] 所有第三方脚本用 `python -P`，不用 `-I`

### 研究
- [ ] 六段结构齐全，`观察范围` 写明未看的部分
- [ ] 每条事实带时间码 + 证据等级
- [ ] "可复用规则"里没有题材名
- [ ] "不能推断的内容"非空
- [ ] 已登记进 `studies/README.md` 表格

### 复现
- [ ] `lab/repro-<key>.html` 暴露 `window.__repro.{setTime,toDataURL,measureAt}`
- [ ] `measureAt` 算法与 `decode_video.py` 同口径（160×90，`v/s/e/pd`）
- [ ] 参考侧喂同一算法校准过（`sat` 差 ≤1）
- [ ] 改前版本另存 `.before.html`
- [ ] 导出脚本 `times` 数与输出文件数一致
- [ ] 1× 连续播放无报错，`seek` 后画面与量值一致

### 评价
- [ ] 口径行写明参考帧数、复现尺寸、是否重采样、脚本路径
- [ ] "量到的差距"每行三列数或"未测"
- [ ] "已修复"每条能在源码定位
- [ ] "仍不合格"≥1 条且可判定
- [ ] "未测"非空
- [ ] 原始数在 `work/review-<key>/`，文档只放结论
- [ ] 分辨率不同的量已重算，没有直接跨尺寸比 `edges` / 主色占比

### 回写
- [ ] 进指南的每条都满足 E5 + 跨题材 + 有实现入口
- [ ] 指南条目带来源 `（<key>，E5，日期）`
- [ ] 冲突的旧条目加了"已被取代"标注，没有删
- [ ] 测量产物未改动

---

## 三个常见失败模式

### 1. 把静帧当动态

**表现**：看了几张联系表就写"这里在推进""这一段很快"。复现出来 `pix_diff` 只有参考的 1%–5%。

**实例**：`review-magpie` 的 S4 五秒半实际是静帧（结构运动只有参考的 1%），`review-ui` 的 0–8 s 与 17–22 s 复现是静帧，`review-gpt` 改前 5.6 s 前后两帧**字节完全相同**（`pix_diff` 0.000，参考 0.46）。

**为什么容易犯**：联系表每格间隔 0.1–2 s，一格看不出格与格之间的运动；静图也不显示缓动方向。

**防法**：任何"在动"的判断必须引 `pix_diff` 或 `grid` 的非零值，且给出参考侧同段的中位数。判断"够不够快"时，比的是**参考同段的 `pix_diff` 分布**，不是自己相邻两帧的差。

### 2. 把静音当无声

**表现**：`silences` 为空、`silence_ratio` 很低，就写"全程有声音、没有留白"。或者反过来，`silence_ratio` 高就写"这里有刻意的呼吸段"。

**为什么错**：阈值是 `rms_db < -38`，且 `rms_db` 用 `ref=np.max` **按每个文件自己的峰值归一**。同一段音乐在两条母带里会得到不同的 dB 值；一个很安静的床（整体 −30 dB）会被判成"全是声音"，一个响的床的弱段反而被判成静音。`review-mech` 的实测是 `silence_ratio 0.005`、只有片尾一处静音，因此结论是"声床恒密"，但那个结论同时还依赖 onset 密度 6.09/s 和 5 s 分箱方差——**单看 `silence_ratio` 得不出这个结论**。

**防法**：写声音结论前至少看三项：`onsets` 密度（个/秒）、`rms_db_curve` 的实际曲线形状、`harmonic_to_percussive`。涉及"有没有留白""响不响"的判断必须过 E4 听审。阈值是工具默认值，不是片子属性，写进文档时一并写出。

### 3. 把单帧当整段

**表现**：取一个关键帧，量了它的亮度/边缘/主色，就写"这一段偏亮""这一段细节不足"。

**实例**：`review-camera38` 的 S2 亮度"39.8 vs 78.8"是窗口均值，不是某一帧；`review-pieces` 的"世界 T 保留比"是在 369.333 s 这一帧量的，但结论限定在该帧。`review-rotor` 的 C 段写"复现 84°/2.1 s 仍在转"，是整段行为，不是终点帧。

**为什么容易犯**：单帧好看、好取、好复现；段内变化要跑脚本。

**防法**：凡写"段"，至少给出**段首、段中、段尾**三个点，或直接给全段逐帧的均值与分布（`p10/p50/p90`）。`review-gpt` 的做法是对的：15 个时间点最大偏差 5.1、均值 2.0，比"某帧对上了"强得多。另外记住缩略图口径会吃掉细节——`review-mech` 明确写了"160×90 口径会把 10px/帧抹掉；1:1 重测前记'未测'"。

---

## 一轮做完的最小动作

新参考进来，按这个顺序，不跳步：

```bash
# 1. 采集 + 校验
ffprobe ... ; ffmpeg 抽双音轨 ; sha256sum
# 2. 解码
python -P "$DEC/decode_video.py" "$REF/videos/$key.mp4" "$REF/analysis/$key"
python -P "$DEC/decode_audio.py" "$REF/audio/$key.16k.wav" "$REF/analysis/$key" "$key"
python -P "$DEC/contact_sheet.py" "$REF/videos/$key.mp4" "$REF/analysis/$key/sheets" "$key" 0 <end> <step>
# 3. 研究（E1 起步，逐步补 E2/E3）
# 4. 复现（$LAB/repro-<key>.html + 导出脚本）
# 5. 评价（$STU/review-<key>.md + $REF/work/review-<key>/）
# 6. 回写（门槛够了才进指南）
```
