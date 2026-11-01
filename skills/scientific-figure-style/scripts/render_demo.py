"""Render explicitly synthetic style examples; requires numpy and matplotlib."""
import argparse
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import numpy as np
from figure_style import PALETTE_FILE, palette, category_map, style_context, diverging, export_figure

def render(output, palette_name, mode):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    p = palette(palette_name)
    rng = np.random.default_rng(20261021)
    groups = ["Reference", "Variant A", "Variant B", "Variant C"]
    colors = category_map(groups, palette_name)
    with style_context(palette_name, mode):
        fig, axes = plt.subplots(2, 2, figsize=(7.08, 5.9), layout="constrained")
        fig.suptitle("SYNTHETIC STYLE DEMO | No experimental results", fontsize=10,
                     color=p["ocean"], fontweight="bold")
        t = np.linspace(0, 10, 51)
        curves = 1 + 0.08*t + 0.15*np.sin(t)[None, :] + rng.normal(0, 0.14, (60, 51))
        lo, mid, hi = np.quantile(curves, [0.1, 0.5, 0.9], axis=0)
        axes[0, 0].fill_between(t, lo, hi, color=p["ocean"], alpha=.18, label="10–90% of synthetic draws")
        axes[0, 0].plot(t, mid, color=p["ocean"], label="Synthetic median")
        axes[0, 0].plot(t, 1+.08*t, color=p["terracotta"], ls="--", label="Synthetic comparison")
        axes[0, 0].set(xlabel="Time (s)", ylabel="Velocity (m s$^{-1}$)")
        axes[0, 0].legend(fontsize=6, loc="upper left")

        vals = [rng.normal(m, .07, 24) for m in [.62,.70,.77,.83]]
        for i, (g, data) in enumerate(zip(groups, vals), 1):
            axes[0, 1].boxplot([data], positions=[i], widths=.45, showfliers=False,
                              patch_artist=True, boxprops={"facecolor":colors[g],"alpha":.4},
                              medianprops={"color":p["charcoal"]})
            axes[0, 1].scatter(i+rng.uniform(-.13,.13,len(data)), data, s=8,
                               color=colors[g], edgecolors=p["charcoal"], linewidths=.2)
        axes[0, 1].set(xticks=range(1,5), xticklabels=["Ref.","A","B","C"], ylabel="Synthetic score")
        axes[0, 1].text(.04,.95,"24 synthetic draws / group",transform=axes[0,1].transAxes,va="top",fontsize=6)

        field = rng.uniform(-1, 1, (9, 12))
        field[2, 3] = np.nan
        cmap, norm = diverging(-1, 0, 1, palette_name)
        im = axes[1, 0].imshow(field, cmap=cmap, norm=norm, origin="lower", aspect="auto")
        axes[1, 0].set(xlabel="Grid x index", ylabel="Grid y index")
        fig.colorbar(im, ax=axes[1,0], shrink=.86, label="Synthetic residual (a.u.)", ticks=[-1,0,1])

        scatter_data = []
        for g, mu, marker in zip(groups, [(-1,0),(1,0),(0,1),(0,-1)], ["o","s","^","D"]):
            xy = rng.normal(mu, .3, (25,2))
            scatter_data.append(xy)
            axes[1,1].scatter(xy[:,0],xy[:,1],label=g,color=colors[g],marker=marker,s=12,alpha=.85)
        axes[1,1].set(xlabel="Synthetic coordinate 1",ylabel="Synthetic coordinate 2",ylim=(-1.85,2.45))
        axes[1,1].legend(fontsize=6, ncol=2, loc="upper center")
        for ax, title, letter in zip(axes.flat,
                ["Time series and sample interval", "Distribution with individual points", "Signed field with explicit range", "Groups distinguished by shape"], "abcd"):
            ax.set_title(title, loc="left", pad=8, fontsize=8)
            ax.text(-.17,1.08,letter,transform=ax.transAxes,fontweight="bold",fontsize=10,color=p["ocean"])
        export_figure(fig, output / "figure-demo", width_mm=180, height_mm=150)
        plt.close(fig)

        cfg = json.loads(PALETTE_FILE.read_text(encoding="utf-8"))
        fig, ax = plt.subplots(figsize=(10, 3.8))
        fig.subplots_adjust(left=.025,right=.985,top=.82,bottom=.12)
        ax.set(xlim=(0,7),ylim=(0,2.7)); ax.axis("off")
        fig.suptitle("SCIENTIFIC FIGURE STYLE | Reference palette comparison",fontsize=13,color=p["ocean"],y=.96)
        for row, name in enumerate(["reference-labels","reference-sampled"]):
            y = 1.65 - row*1.35
            pp = palette(name)
            for i, (key, label) in enumerate(cfg["display_names"].items()):
                ax.add_patch(Rectangle((i+.06,y),.86,.56,facecolor=pp[key],edgecolor="#BBBBBB",linewidth=.4))
                ax.text(i+.49,y-.08,label,ha="center",va="top",fontsize=8)
                ax.text(i+.49,y-.31,pp[key],ha="center",va="top",fontsize=8,fontfamily="monospace")
            ax.text(.06,y+.66,"Printed labels (Steel Blue provisional)" if row==0 else "Sampled appearance (approximate)",fontsize=9,color=p["ocean"])
        fig.text(.03,.025,"Inspired by the user-specified Douyin post. Not an official Nature palette. No scientific data shown.",fontsize=7)
        export_figure(fig, output / "palette-card",width_mm=240,height_mm=95)
        plt.close(fig)
    manifest = {"palette":palette_name,"mode":mode,"seed":20261021,"data":"synthetic only",
                "numpy":np.__version__,"matplotlib":matplotlib.__version__,"group_colors":colors,
                "interval":"pointwise 10th to 90th percentile of 60 synthetic draws; not a confidence interval",
                "accessibility":"shape redundancy; full color-vision simulation not performed"}
    (output/"demo-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    np.savez(output/"synthetic-demo-data.npz",time=t,curves=curves,group_values=np.array(vals),field=field,scatter=np.array(scatter_data))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--palette",choices=["reference-labels","reference-sampled"],default="reference-labels")
    parser.add_argument("--mode",choices=["paper","editorial"],default="paper")
    args=parser.parse_args()
    render(args.output,args.palette,args.mode)
