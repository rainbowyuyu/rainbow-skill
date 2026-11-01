"""Local matplotlib style helpers. Requires matplotlib; never changes data."""
import json
import re
from pathlib import Path
import matplotlib as mpl
from cycler import cycler
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm

PALETTE_FILE = Path(__file__).resolve().parents[1] / "assets" / "palettes.json"

def palette(name="reference-labels"):
    data = json.loads(PALETTE_FILE.read_text(encoding="utf-8"))
    colors = data["palettes"][name]["colors"]
    if not all(re.fullmatch(r"#[0-9A-Fa-f]{6}", c) for c in colors.values()):
        raise ValueError("Invalid hex color in palette")
    return dict(colors)

def category_map(labels, name="reference-labels"):
    """Pass the same complete ordered group list to every panel."""
    labels = list(labels)
    if len(labels) != len(set(labels)):
        raise ValueError("Group names must be unique")
    order = json.loads(PALETTE_FILE.read_text(encoding="utf-8"))["categorical_order"]
    if len(labels) > len(order):
        raise ValueError("More than five groups: use facets or an explicit extended mapping")
    p = palette(name)
    return dict(zip(labels, (p[k] for k in order)))

def style_context(name="reference-labels", mode="paper", font=None):
    if mode not in ("paper", "editorial"):
        raise ValueError("mode must be paper or editorial")
    p = palette(name)
    bg = "white" if mode == "paper" else p["ivory"]
    return mpl.rc_context({
        "font.family": font or "DejaVu Sans", "font.size": 8,
        "axes.titlesize": 9, "axes.labelsize": 8, "legend.fontsize": 7,
        "xtick.labelsize": 7, "ytick.labelsize": 7,
        "text.color": p["charcoal"], "axes.labelcolor": p["charcoal"],
        "xtick.color": p["charcoal"], "ytick.color": p["charcoal"],
        "axes.edgecolor": p["charcoal"], "axes.linewidth": 0.6,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": False, "lines.linewidth": 1.2, "lines.markersize": 3.5,
        "legend.frameon": False, "figure.facecolor": bg, "axes.facecolor": bg,
        "savefig.facecolor": bg, "savefig.transparent": False,
        "pdf.fonttype": 42, "ps.fonttype": 42, "svg.fonttype": "none",
        "axes.prop_cycle": cycler(color=list(category_map(range(5), name).values())),
    })

def diverging(vmin, center, vmax, name="reference-labels"):
    """Style-derived, NOT perceptually certified. Set scientific range explicitly."""
    if not vmin < center < vmax:
        raise ValueError("Require vmin < center < vmax")
    p = palette(name)
    cmap = LinearSegmentedColormap.from_list(
        "reference_diverging", [p["ocean"], p["ivory"], p["terracotta"]])
    cmap.set_bad("#D0D0D0")
    return cmap, TwoSlopeNorm(vmin=vmin, vcenter=center, vmax=vmax)

def export_figure(fig, stem, width_mm=180, height_mm=120, dpi=300):
    """Exact canvas size; caller owns layout. Refuse to overwrite deliverables."""
    if width_mm <= 0 or height_mm <= 0 or dpi <= 0:
        raise ValueError("Dimensions and dpi must be positive")
    stem = Path(stem)
    stem.parent.mkdir(parents=True, exist_ok=True)
    paths = [Path(str(stem) + "." + ext) for ext in ("pdf", "svg", "png")]
    if any(p.exists() for p in paths):
        raise FileExistsError("Choose a fresh figure stem to preserve existing exports")
    fig.set_size_inches(width_mm / 25.4, height_mm / 25.4)
    for path in paths:
        fig.savefig(path, dpi=dpi, bbox_inches=None, facecolor=fig.get_facecolor())
    return paths
