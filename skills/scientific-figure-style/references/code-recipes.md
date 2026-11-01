# 代码用法

## Python

依赖 matplotlib（包含 numpy 依赖）。使用任务环境；缺少依赖则装入任务虚拟环境，不改其他项目依赖。把 scripts 加入 sys.path，或将 helper 和 assets 保持相对路径一起复制。

```python
import sys
sys.path.insert(0, r"C:/Users/USER/.agents/skills/scientific-figure-style/scripts")
import matplotlib.pyplot as plt
from figure_style import style_context, category_map, export_figure
# x, observed, predicted 必须由真实数据加载。
colors = category_map(["Observed", "Predicted"])
with style_context(mode="paper"):
    fig, ax = plt.subplots(layout="constrained")
    ax.plot(x, observed, color=colors["Observed"], marker="o", label="Observed")
    ax.plot(x, predicted, color=colors["Predicted"], ls="--", label="Predicted")
    ax.set(xlabel="Time (s)", ylabel="Velocity (m/s)")
    ax.legend()
    export_figure(fig, "outputs/velocity_comparison_v1", width_mm=90, height_mm=65)
```

复现原图视觉时给 `category_map` 与 `style_context` 同时传 `name="reference-sampled"`。所有面板使用完整组名列表构造映射。导出器拒绝覆盖同名文件，改用版本化名称。SVG 保留文字，接收端须具备字体；PDF 使用 TrueType 字体嵌入，提交前检查。

演示命令：

```text
python scripts/render_demo.py --output <task-output-dir> --palette reference-labels --mode paper
python scripts/render_demo.py --output <another-dir> --palette reference-sampled --mode editorial
```

演示固定 seed=20261021，图中标注 SYNTHETIC STYLE DEMO；不能删除标记后充当论文结果。

## R / ggplot2

需 jsonlite、ggplot2。本次创建环境未安装 R，未执行验证。读取同一 JSON 避免手抄色值漂移。按实际列名修改，不自动生成数据。

```r
library(jsonlite)
library(ggplot2)
cfg <- fromJSON("C:/Users/USER/.agents/skills/scientific-figure-style/assets/palettes.json")
pal <- unlist(cfg$palettes[["reference-labels"]]$colors)
group_cols <- c(Observed = pal[["ocean"]], Predicted = pal[["terracotta"]])
# df 需要 time, velocity, group 列，来源为用户数据。
p <- ggplot(df, aes(time, velocity, colour = group, linetype = group)) +
  geom_line(linewidth = 0.42) +
  scale_colour_manual(values = group_cols, limits = names(group_cols)) +
  labs(x = "Time (s)", y = "Velocity (m/s)") +
  theme_classic(base_size = 8, base_family = "sans") +
  theme(legend.title = element_blank(),
        text = element_text(colour = pal[["charcoal"]]),
        axis.line = element_line(linewidth = 0.21))
ggsave("outputs/velocity_v1.pdf", p, width = 90, height = 65, units = "mm")
ggsave("outputs/velocity_v1.png", p, width = 90, height = 65, units = "mm", dpi = 300)
```

ggsave 会覆盖同名文件，执行前选择新名称；需要 SVG 时检查 svglite 或本机 SVG device，并验证中文字体。
