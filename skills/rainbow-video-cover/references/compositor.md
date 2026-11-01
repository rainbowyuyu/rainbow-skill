# 离线排版工具

`scripts/compose_cover.py` 只负责已有底图的精确排版，不提供生图、网络、发布、字体下载或自动安装。依赖 Pillow；SVG Logo 另需 PyMuPDF（模块 `fitz`）。先使用已有环境；模板中的文件名按实际目录修改。

```powershell
python <skill>/scripts/compose_cover.py --config <project>/cover/layout.json --out-dir <project>/cover/covers
```

配置文件路径为相对资源的基准。复制模板到项目后，图片、字体和 Logo 都按新位置解析；建议把随附 SVG 复制到项目 `brand/`。字体带上许可，或显式填写已有授权字体的绝对路径。

| 字段 | 用途 |
|---|---|
| `name` | 输出文件名，不含扩展名或目录符号 |
| `size` | 最终像素宽高，可用 1920×1080、1440×1080（4:3 横版）、1080×1920、1080×1440（3:4 竖版）、1080×1080 等 |
| `supersample` | 1–3，默认 2；仅提高排版抗锯齿，不恢复源图细节 |
| `background` | 已生成或授权的栅格图 |
| `fonts` | 字体键至 TTF／OTF 路径映射；没有字体则报错 |
| `crop` | 可选 `[left,top,right,bottom]`，源图归一化 0–1 裁切框 |
| `allow_center_crop` | 默认为 false；跨比例未明确裁切时拒绝，人工确认后才可设 true |
| `texts` | 每项有 text、font、size、weight、x、y，可用换行、spacing、align |
| `anchor` | Pillow 文本锚点，常用左上 `lt`、中上 `mt` |
| `gradient` | 可选两个颜色的轻微纵向渐变 |
| `logo` | path、x、y、height，可选 color；保持源宽高比，不拉伸 |
| `rules` | 脚本支持的可选装饰线列表；本系列默认 `[]`。只有当前用户明确采用其他含线条布局时使用；每项 id、x、y、width、height、color |
| `shades` | 可选轴向暗部，axis 为 x/y，range 为归一化渐变区间，opacity 为起止透明度 |
| `protected_regions` | 实际主体在目标画布的像素矩形，与文字／Logo／装饰线交叉时报错；可设非负 `clearance` 像素间距，检查时向四周扩大；`allow` 为允许覆盖的元素 ID |

文字／Logo 互相重叠默认报错。只有确有设计用途时才为相应元素设 `allow_overlap: true`，不能用它绕过不合理遮挡。模板保护区来自示例图片，换底图要重新标注。字体边界检查无法自动识别缺字方块，必须实际看图。

阴影、背景高光和真实主体不由自动布局检查理解。先看原图再填保护区，最终仍要检查原尺寸和手机缩略图。脚本不会自动缩小过长标题；应缩短文案、手动分行或重新构图。

本系列四比例的精确坐标见 [系列结构规范](series-layout.md)。四版全部使用有效 `anchor: "lt"`、`align: "left"`，品牌位于左上、`rules: []`；不要从旧的居中竖版模板反推当前结构。四个模板的 `protected_regions` 为待标注的空列表，输出前必须按真实底图填入主体和机制框；它不是免检查。常见 1080 基准的局部 `clearance` 可从 16–24 px 起，标题旁较大主体还应扩大可见留白。

输出：正式 PNG、JPG、`-review.jpg` 联系表（大预览＋320／160 px 缩略图）、`-layout-report.json` 尺寸与包围盒报告。已有同名结果默认拒绝覆盖，明确重排才使用 `--overwrite`。失败时先修配置；不能把模板跑通当成新封面已通过审美检查。
