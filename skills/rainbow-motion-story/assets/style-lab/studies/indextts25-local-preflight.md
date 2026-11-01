# IndexTTS 2.5 本地升级前置核查

核查日期：2026-10-24。仅下载官方小型代码、配置和文件尺寸元数据；未下载模型权重，未安装依赖，未加载或合成。当前结论是安装方案与资源估算，不是通过了本机听感/性能验证。

## 精确版本与证据

- 官方源码：`https://github.com/index-tts/index-tts`
- 本次固定 commit：`d9e41aac89fd00b3d71497fddb287b7f24613712`
- 模型：`IndexTeam/IndexTTS-2.5`
- 模型固定 revision：`c39ce5ba981572cb187443877ff559dfb246ce63`
- 官方下载源与完整尺寸记录：size-manifest.json（外部或本机资源，未随公开包收录）
- 已保存原始文件：pyproject.toml（外部或本机资源，未随公开包收录）、infer_v2_5.py（外部或本机资源，未随公开包收录）、model_download.py（外部或本机资源，未随公开包收录）、config.yaml（外部或本机资源，未随公开包收录）、uv.lock（外部或本机资源，未随公开包收录）。

注意：仓库的 pyproject 项目 version 仍写 2.0.0，但当前 README 明确介绍 2.5，2.5 实际入口为 `indextts.infer_v2_5.IndexTTS2`，模型 config version 为 2.5；不要仅用 pip version 判断实际版本。

## 是否符合需求

2.5 的真实接口将音色参考、情绪与时长控制分开：

```python
from indextts.infer_v2_5 import IndexTTS2

tts = IndexTTS2(
    cfg_path="checkpoints/config.yaml",
    model_dir="checkpoints",
    device="cuda:0",
    use_bf16=True,
    use_cuda_kernel=False,
    use_deepspeed=False,
    use_accel=False,
    use_torch_compile=False,
    use_qwen_emo=False,
)
tts.infer(
    spk_audio_prompt="D:/projects/tts/work/clone-reference.wav",
    text="两边压强不一样，水就被推着走。",
    lang="ZH",
    output_path="<当前项目的新候选路径>.wav",
    emo_vector=[0.12, 0, 0, 0, 0, 0, 0.12, 0.20],
    emo_alpha=0.6,
    use_random=False,
    duration_factor=1.0,
    interval_silence=200,
)
```

这只是 API 示例与待试听的起始参数，不能把数值称为已确认的“自然好听”。情绪顺序：happy、angry、sad、afraid、disgusted、melancholic、surprised、calm。

- `emo_vector` 不要求加载 QwenEmotion，适合导演层显式编排。`use_emo_text=True` 必须初始化 `use_qwen_emo=True`；否则抛错。
- `emo_text` 经 QwenEmotion 转成八维情绪，不是无限自由的声音导演指令，不能声称它精确理解所有气声/重音/断句要求。
- `duration_factor > 1` 较慢，`< 1` 较快。官方 README 范围 0.5–2.0；初期应在较小区间试听，而不是把极值当制作默认。
- 2.5 的时长控制在 `target_lengths=int(S_infer.shape[1]*1.72*duration_factor)` 进入 length regulator，再做声学扩散和 vocoder；不是成品 WAV 的 rubberband 拉伸，也不是保证每个词精准时长的 API。
- 源码支持 `<行|XING2>` 这样的发音标注，适合后续语境纠音；字幕仍保留规范汉字。
- 输出采样率 22050 Hz。可接当前 `master_voice` 转 48 kHz，但应保留原始源与真实时长。

## 隔离要求：不能直接复用当前 TTS 环境

官方项目要求 Python `>=3.10,<3.12`，固定 torch/torchaudio `2.8.*`、transformers `4.52.1`、tokenizers `0.21.0`、numpy `2.2.6`。现有 Qwen 环境是 Python 3.12.10 / torch 2.11.0+cu128 / transformers 4.57.3。

因此不要在原 `.venv` 内执行 pip upgrade/downgrade，也不要将旧 site-packages 直接注入新环境。Python ABI 和依赖版本均不同，共用当前 torch 安装不是受支持方案。可以使用 uv 的包缓存/同盘链接节省空间，但仅限**相同版本、相同 ABI** 的文件。

本机已有 `C:/Users/USER/AppData/Local/Programs/Python/Python310/python.exe`；Python 3.11 未在 `py -0p` 列表中。最短方案可直接使用 3.10，避免另装 Python。当前 PATH 与几个常见位置未找到 uv；若后续安装，优先独立工具路径，勿改 Qwen 环境。官方 lock 提供 CUDA12.8 的 Windows torch/torchaudio 轮子；已核对 cp310、cp311 两种 ABI 均有 `win_amd64` wheel。

## 模型实际体积与节省办法

| 范围 | 字节 | 说明 |
|---|---:|---|
| IndexTTS-2.5 主仓库全部文件 | 5,491,182,363 | 含 QwenEmotion 与元数据 |
| 可选 QwenEmotion 目录 | 1,208,014,946 | emo_vector 模式不加载，可不下载 |
| 主仓库去掉 QwenEmotion | 4,283,167,417 | GPT、codec、s2mel、矩阵与配置 |
| w2v-bert 必需文件 | 2,322,065,885 | model.safetensors + config + preprocessor_config |
| CAMPPlus | 28,036,335 | campplus_cn_common.bin |
| BigVGAN 必需文件 | 449,229,576 | config.json + bigvgan_generator.pt |
| **显式情绪向量最小运行文件合计** | **7,082,499,213** | 约 6.60 GiB，不含 Python/包/下载缓存/输出 |
| 加 QwenEmotion 的完整运行文件 | 8,290,514,159 | 约 7.72 GiB |

避免直接运行上游 `ensure_models_available()` 自动补全：它会整个下载 w2v 仓库，其中另有 `conformer_shaw.pt`（2,329,131,983 字节），还下载 2.5 实际 loader 不使用的旧 MaskGCT semantic codec（177,183,712 字节）。默认主模型 + 自动辅助下载约 **10,796,829,854 字节**，多约 2.51 GB。

按以下目录预置**已完整校验**的必需文件，可避免 2.5 loader 触发自动下载；目录只有空壳不算完成：

```text
checkpoints/
  config.yaml, gpt.pth, codec.pth, s2mel.pth
  feat1.pt, feat2.pt, wav2vec2bert_stats.pt
  multilingual_zh_ja_yue_char_del.tiktoken
  hf_cache/
    w2v-bert-2.0/model.safetensors
    w2v-bert-2.0/config.json
    w2v-bert-2.0/preprocessor_config.json
    campplus_cn_common.bin
    bigvgan/config.json
    bigvgan/bigvgan_generator.pt
```

保留各来源 LICENSE/README 等小型文档。模型下载固定 revision，逐文件核对大小和已提供的 LFS SHA256；不能为了节省空间删旧项目模型。

## 最短可执行安装路线（本次未执行）

1. 将官方源码放到独立目录，例如 `D:/projects/tts/backends/indextts25`，checkout 上述 commit。保留源码许可。
2. 在该独立目录使用 uv 与已有 Python3.10：`uv sync --frozen --python C:/Users/USER/AppData/Local/Programs/Python/Python310/python.exe`。先不加 `--all-extras`、webui、deepspeed、accel 或 torch_compile。`uv sync` 会在该目录创建独立 `.venv`。
3. 使用 huggingface_hub 的 `snapshot_download(repo_id, revision=..., local_dir=..., allow_patterns=...)` 精选下载上表文件；修订与路径已在 size-manifest 中，勿调用上游自动全下载。主模型 `ignore_patterns=['qwen0.6bemo4-merge/*']` 可用于初期 emo_vector 模式。
4. 运行 `pip check`、版本检查、`import torch; import torchaudio; import transformers; from indextts.infer_v2_5 import IndexTTS2`。确认 CUDA 与 BF16，检查所有模型文件、剩余内存/磁盘后再加载。
5. 用上面的禁编译、单句、BF16、无 QwenEmotion 配置生成一个新路径短句。先验证音色与字音，再对同一句尝试三种意图和温和时长变化。进入现有 raw/clean/A-B/ASR 工作流。
6. 合成器退出后释放显存再做视频渲染；不要让 Qwen、IndexTTS 与大场景模型同时抢占这张 8GB GPU。

## 8GB 与 Windows 风险

- 官方 2.5 源码检测总显存 `<10GB` 后自动对超过 40 字的非流式文本按标点分段，说明有低显存适配；这**不能证明本机一定不会 OOM**。
- BF16 主要用于 GPT；semantic encoder、codec、s2mel 与 vocoder 仍会常驻设备。GPT 权重约减半后，静态权重粗估约 5.45 GB，此外还有 KV cache、s2mel 预分配、参考特征和中间激活。必须真实短句测峰值；不要直接启动五分钟整片。
- 默认 `use_qwen_emo=False`，否则 QwenEmotion 会以 FP16、device_map=auto 额外加载；对 8GB 优先使用向量。
- Windows 不先启用 DeepSpeed、flash-attn/Triton、BigVGAN CUDA 扩展或 torch.compile，可减少编译工具链风险。
- 锁文件中 opencv-python4.9 与 numpy2.2.6 是潜在旧二进制 ABI 风险点，应通过 import smoke 查证，而不是预先宣称兼容或盲目升级全环境。
- 上游文件在 import 时写 `HF_HUB_CACHE='./checkpoints/hf_cache'`。用独立进程和明确工作目录，避免污染现有 Qwen 进程环境。
- 本次仅取元数据，没有实测延迟、完整声音保真或许可适用性。正式使用应保留源码和模型各自许可文件。
