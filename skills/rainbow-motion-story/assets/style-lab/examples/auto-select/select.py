#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""选型器：把一份视频 brief 变成分镜级技法计划。

用法：
    python select.py --brief brief.json
    python select.py --brief - < brief.json
    python select.py --technique mf-trace-assembly
    python select.py --list
    python select.py --schema
    python select.py --self-test

只依赖标准库。输入 JSON，输出 JSON。不做事实判断，不改写数值。
规则表 RULES 中每条规则都带 refs（研究文件路径 + 该文件支持的结论），
可用 --technique 反查某条技法支撑哪些段类型。
"""

import argparse
import json
import os
import sys
import textwrap

SCHEMA = "auto-select/plan@1"
BRIEF_SCHEMA = "auto-select/brief@1"

# 段类型与默认时间占比。占比是起点，不是规范。
SEGMENTS = [
    ("hook", "钩子", 0.12),
    ("explain", "解释", 0.52),
    ("contrast", "对照", 0.14),
    ("reveal", "揭示", 0.14),
    ("close", "收束", 0.08),
]

SEG_NAMES = {sid: name for sid, name, _ in SEGMENTS}

# 每段最多拆几拍。钩子拆太多会变成四个开场，收束拆太多会拖尾。
BEAT_LIMITS = {"hook": 2, "explain": 6, "contrast": 3, "reveal": 3, "close": 2}

# 单段秒数上限：钩子拖过 12 秒就变成正文，收束过 10 秒会散。
# 超出的秒数并入解释段，不丢时间。
MAX_SEGMENT_SECONDS = {"hook": 12.0, "close": 10.0, "contrast": 20.0}

# 短片的段预算会重排：低于这个秒数时，对照段没有空间，份额并入解释与揭示。
SHORT_BRIEF_SECONDS = 45

# 单拍秒数上限。超过它，观众已经看不到一次完整动作的起落。
MAX_BEAT_SECONDS = {
    "hook": 8.0, "explain": 30.0, "contrast": 12.0,
    "reveal": 15.0, "close": 6.0,
}

# 解释段超过这个秒数时，按 MAX_BEAT_SECONDS 拆出的拍数不够，
# 多出的秒数交给相邻段而不是堆在一个长镜里。
MAX_EXPLAIN_BEATS = 6

GENRES = {
    "science": "科普讲解",
    "mechanism": "机械原理",
    "product": "产品功能",
    "world": "世界观/概念片",
    "data": "数据与流程",
    "tutorial": "操作教程",
    "story": "人物与故事",
}

TONES = {
    "curious": "好奇",
    "calm": "冷静",
    "urgent": "紧迫",
    "warm": "温暖",
    "epic": "宏大",
    "brisk": "轻快",
}

ASPECTS = {
    "16:9": "横屏",
    "9:16": "竖屏",
    "1:1": "方形",
    "4:5": "竖版信息流",
}


def rule(rid, segment, technique, module_ids, genres, tones, keywords,
         duration, typical_beat, sound, params, refs, risk, aspects=None):
    """构造一条规则。refs 为 (路径, 该文件支持的结论) 列表。"""
    return {
        "id": rid,
        "segment": segment,
        "technique": technique,
        "module_ids": list(module_ids),
        "genres": list(genres),
        "tones": list(tones),
        "keywords": list(keywords),
        "aspects": list(aspects) if aspects else ["16:9", "9:16", "1:1", "4:5"],
        "duration": duration,           # 该规则期望的单镜时长区间（秒）
        "typical_beat": typical_beat,   # 拆拍时的目标拍长（秒）
        "sound": sound,
        "params": params,
        "refs": [{"path": p, "claim": c} for p, c in refs],
        "risk": risk,
    }


# ---------------------------------------------------------------------------
# 规则表。每条都指向真实文件；claim 是可核对的具体结论，不是风格形容词。
# 路径以 rainbow-motion-story 技能根目录为基准。
# ---------------------------------------------------------------------------

G = "assets/style-lab/guides/"
S = "assets/style-lab/studies/"
L = "assets/style-lab/lab/modules/"
E = "assets/style-lab/examples/"

RULES = [

    # ---------------- 钩子 ----------------
    rule(
        "hook-question-open", "hook", "问题先行：先给出一个能回答的问题",
        ["mofs-explanation.js"],
        ["science", "mechanism", "world"], ["curious", "calm"],
        ["为什么", "原理", "怎么", "科普", "是什么", "机制"],
        (3.0, 8.0), 5.0,
        {"layer": "silence", "detail": "开场不铺音乐，等第一句落定再进"},
        {"holdSeconds": 1.2, "textCase": "一句话问句", "maxWords": 14},
        [
            (G + "mofs-writing.md", "三种开场入口按观众已有什么判断来选，不强制先问问题"),
            (S + "mofs-script.md", "先操作方框再命名，术语出现时画面已经建立了对象"),
            (G + "script.md", "主题缩成一个能回答的问题，每段记录观众原先的判断"),
        ],
        "问句若在画面里没有对应对象，会变成空泛标题",
    ),
    rule(
        "hook-object-first", "hook", "物件先行：先给一个能指认、能追踪的对象",
        ["continuity.js", "mofs-explanation.js"],
        ["science", "mechanism", "tutorial", "data"], ["calm", "curious", "warm"],
        ["实物", "对象", "装置", "操作", "拆", "装"],
        (2.5, 7.0), 4.5,
        {"layer": "contact", "detail": "对象落定给一次短接触声，不用长 whoosh 开场"},
        {"holdSeconds": 1.5, "objectIdRequired": True, "enterScale": "mid"},
        [
            (G + "script.md", "开头先给观众一个能指认、能跟着操作或能作出判断的对象"),
            (G + "continuity.md", "给主角、轨迹、标签一个跨镜不变的 ID"),
            (S + "mofs-script.md", "几何通过与材料吸附分开解释"),
        ],
        "对象太多会失去主线，只保留一个主实体",
    ),
    rule(
        "hook-result-first", "hook", "结果先行：先看结果，再回头拆原因",
        ["storytelling.js", "shuffle-explanation.js"],
        ["science", "mechanism", "data"], ["curious", "urgent"],
        ["结果", "失败", "越线", "意外", "反直觉", "为什么"],
        (3.0, 9.0), 5.5,
        {"layer": "contact", "detail": "结果成立处一次确认声，随后让声音退场"},
        {"holdSeconds": 1.8, "showAnswerBeforeSetup": True},
        [
            (G + "script.md", "根据题材选择从搭建、结果、预测或具体失败进入"),
            (G + "shuffle-story.md", "对象落定后再提交公式和结论"),
            (E + "storyboard/cup-75s.json", "result 拍先给出越线结果，公式留到后面"),
        ],
        "结果先行时不能顺手把原因也说完，否则后续没有解释空间",
    ),
    rule(
        "hook-failure-first", "hook", "失败先行：从一次具体失败进入机制",
        ["switch-mechanism.js", "storytelling.js"],
        ["mechanism", "science", "tutorial"], ["curious", "urgent"],
        ["失败", "卡住", "装不上", "坏了", "误差", "故障"],
        (3.5, 10.0), 6.0,
        {"layer": "contact", "detail": "失败瞬间给一次短促接触声，尾音立刻收住"},
        {"holdSeconds": 1.6, "failureMustBeReal": True},
        [
            (G + "script.md", "从具体失败进入可以让观众先建立判断"),
            (G + "anatomy-mechanics.md", "先画出因果链，再设计镜头"),
            (G + "switch-anatomy.md", "按下与读数不同步是真实可复现的失败条件"),
        ],
        "失败必须是可核验的条件，不能为了戏剧性编造",
    ),
    rule(
        "hook-symbolic-objects", "hook", "象征物片头：一组物件替故事开门",
        ["symbolic-titles.js"],
        ["world", "story", "science"], ["epic", "curious", "calm"],
        ["片头", "概念", "世界观", "片名", "悬念", "美学"],
        (4.0, 12.0), 3.0,
        {"layer": "bed", "detail": "低频环境底压住，物件动作各自给极短接触声"},
        {"holdSeconds": 0.9, "transitionPerObject": True, "revealOrder": "object-then-shape"},
        [
            (G + "symbolic-title-sequence.md", "先把另一个世界放进形状里，再给一次认知停顿，最后才扩大"),
            (S + "magpie-title.md", "14.6s 下一场景已在盔面负形中，14.7–15.5s 保留辨认"),
            (S + "review-magpie.md", "静帧能支持的只有图形和构图，不含精确缓动"),
        ],
        "物件之间没有意义链时会变成素材拼贴；它不承担复杂机制的完整证明",
    ),
    rule(
        "hook-type-orbit", "hook", "环形字粒收束到一句可读标题",
        ["motionface-type.js"],
        ["product", "world", "story", "science"], ["brisk", "epic", "curious"],
        ["标题", "开场", "品牌", "口号", "片名"],
        (2.5, 6.0), 3.5,
        {"layer": "air", "detail": "字粒落下时一次短气流，收住后静音进正文"},
        {"holdSeconds": 1.4, "lockLayoutBeforeReveal": True, "maxCharsPerLine": 12},
        [
            (G + "motionface-type.md", "先把文字当作有身份的图形队列，再按既定目标位逐组落定"),
            (S + "motionface-focus.md", "环阵提供方向和速度感，阅读窗口中停止旋转和拖影"),
            (G + "motionface-type.md", "短句适合开场，长句先分语义组"),
        ],
        "长句不要塞进环阵；落定后必须停止位移",
    ),

    # ---------------- 解释 ----------------
    rule(
        "explain-trace-assembly", "explain", "按含义分组逐层生长：支架→路径→闭合→命名",
        ["type-semantic-emphasis", "visualization-flow-continuity"],
        ["mechanism", "science", "data", "tutorial"], ["calm", "curious"],
        ["结构", "流程", "装配", "拆解", "组成", "层次"],
        (6.0, 18.0), 12.0,
        {"layer": "contact", "detail": "每组线段闭合时一次轻接触声，命名时静音让位"},
        {"holdSeconds": 2.0, "groupOrder": ["support", "path", "closure", "label"],
         "curve": "minimum-jerk"},
        [
            (G + "motionface-type.md", "线条组装按含义分组：先参照或支架，再作用路径，再结构闭合，最后填色与说明"),
            (G + "anatomy-mechanics.md", "先画出因果链，再设计镜头"),
            (L + "visualization.js", "visualization-flow-continuity 保持同一路径跨镜"),
        ],
        "同一帧突然显示全部线条会让观众丢失装配顺序",
    ),
    rule(
        "explain-focus-handoff", "explain", "注意力窗口沿连续路径交接",
        ["focus-handoff"],
        ["science", "data", "product"], ["calm", "curious"],
        ["读数", "标注", "重点", "查看", "对比", "细节"],
        (5.0, 12.0), 8.0,
        {"layer": "air", "detail": "窗口移动时弱气流跟随，抵达后静音给阅读"},
        {"holdSeconds": 2.4, "windowPath": "continuous", "keepContext": True},
        [
            (G + "motionface-type.md", "让背景依然保留必要上下文，再把亮度、边框或遮罩中心沿连续路径移到下一个对象"),
            (G + "motionface-type.md", "标签跟同一锚点走；最终文字独立清晰渲染"),
        ],
        "不要把 Canvas 局部柔化说成真实摄影景深",
    ),
    rule(
        "explain-camera-focus", "explain", "移焦/追焦/视差揭示",
        ["camera-focus-handoff", "camera-focus-track", "camera-parallax-reveal"],
        ["mechanism", "science", "product"], ["calm", "epic"],
        ["运镜", "景深", "焦点", "特写", "空间", "前后关系"],
        (3.5, 9.5), 7.0,
        {"layer": "air", "detail": "抵达观察位前 0.15–0.45 秒起声，落定即收"},
        {"focalLengthMm": 50, "fNumber": 2.8, "focusMode": "directed",
         "manualFocusM": 8, "holdSeconds": 2.4},
        [
            (G + "camera-depth.md", "三个候选共用近景铜片、中景圆环和远景拱门，物体位置不变"),
            (S + "camera-depth-technical.md", "斜向推进时不能用欧氏斜距代替沿光轴的正深度"),
            (E + "camera-depth/API.md", "11.5–14 秒为稳定读图，末帧保持"),
        ],
        "景深过强会掩盖结构；曝光不变时小光圈数字反而更糊",
    ),
    rule(
        "explain-formula-link", "explain", "参数驱动实体：一个量同时决定图形与读数",
        ["visualization-entity-formula", "DerivativeLinkedView"],
        ["science", "data"], ["calm", "curious"],
        ["公式", "数值", "推导", "变化率", "曲线", "计算", "比表面积", "量级", "来源"],
        (5.0, 14.0), 9.0,
        {"layer": "sonification", "detail": "关键关系建立后保留安静窗口，读完再给下一次提示"},
        {"holdSeconds": 2.6, "quantityIdRequired": True, "unitOnLabel": True},
        [
            (G + "manim-formula-language.md", "每个符号记录 quantityId / occurrenceId / role / unit / color / sourceObject"),
            (S + "3b1b-manim-source.md", "研究范围是官方 ManimGL 示例的 12 个类与四组指定源码"),
            (G + "rate-curves.md", "时长减半时速度变 2 倍、加速度 4 倍"),
        ],
        "符号按字形自动匹配决定不了哪一处是复制，语义要显式记录",
    ),
    rule(
        "explain-mechanism-cutaway", "explain", "剖面与拆解：一个动作解释一套结构",
        ["mechanics-section-cut", "mechanics-axial-exploded", "mechanics-rotary-section"],
        ["mechanism"], ["calm", "curious", "urgent"],
        ["剖面", "内部", "齿轮", "转子", "机构", "拆开", "装配"],
        (4.0, 10.0), 7.0,
        {"layer": "contact", "detail": "接触帧起音，拆开时给一次低频，不每帧响"},
        {"holdSeconds": 2.0, "sharedAxis": True, "explodeDistance": "relative",
         "curve": "minimum-jerk"},
        [
            (G + "mechanics.md", "拆开后保持共同装配轴，切换视图后运动不跳位"),
            (G + "anatomy-mechanics.md", "让每次操作只有一个明确结果"),
            (S + "rotary-cutaway.md", "剖面开启到观察位的抵达是独立事件"),
        ],
        "拆开后杂乱、前后关系错、切换视图跳位是三个独立失败点",
    ),
    rule(
        "explain-rotary-interaction", "explain", "可操作机构：按下/拖动只产生一个确定结果",
        ["rotary-session.js", "switch-session.js"],
        ["mechanism", "tutorial"], ["curious", "brisk"],
        ["交互", "按下", "拖动", "操作", "转子", "开关"],
        (5.0, 14.0), 9.0,
        {"layer": "confirm", "detail": "commit 事件才响确认声，按下只给轻 click"},
        {"holdSeconds": 2.2, "singleResultPerAction": True, "curve": "spring-critical"},
        [
            (G + "rotary-interaction.md", "让每次操作只有一个明确结果"),
            (G + "ui-continuity.md", "按钮反馈与成功确认不是一个时刻"),
            (L + "switch-session.js", "按下与读数由同一状态驱动"),
        ],
        "按下声和确认声同时响，观众会以为操作已成功",
    ),
    rule(
        "explain-ui-relay", "explain", "界面对象接力：同一素材跨容器移动",
        ["ui-identity-relay", "ui-click-to-timeline"],
        ["product", "tutorial", "data"], ["brisk", "calm", "warm"],
        ["界面", "软件", "点击", "导入", "面板", "拖动",
         "素材", "选中", "时间线", "提交", "确认"],
        (4.0, 10.0), 7.0,
        {"layer": "contact", "detail": "到达与提交分开；commit 才响确认"},
        {"holdSeconds": 1.8, "assetIdRequired": True, "liftToOverlay": True},
        [
            (G + "ui-continuity.md", "先保存对象的屏幕矩形，提升到共同浮层，再交给目标容器"),
            (S + "max-ui-motion.md", "把找素材—导入—进入时间线连成一组明确动作"),
            (G + "ui-continuity.md", "大面板负责动，小文字负责读"),
        ],
        "跨容器直接跳坐标，原容器会留下第二张主卡片",
    ),
    rule(
        "explain-state-commit", "explain", "状态提交与确认：反馈和结果分两个时刻",
        ["ui-click-to-timeline", "type-anchored-label"],
        ["product", "tutorial", "data"], ["brisk", "calm", "warm"],
        ["确认", "提交", "结果", "完成", "反馈", "保存", "到达"],
        (3.0, 8.0), 5.5,
        {"layer": "confirm", "detail": "先给接收反馈，状态真正提交后才响确认声"},
        {"holdSeconds": 2.0, "feedbackBeforeCommit": True,
         "confirmOnce": True, "curve": "spring-critical"},
        [
            (G + "ui-continuity.md", "按钮反馈与成功确认不是一个时刻；按下时显示接收到操作，结果真实提交以后才出现确认"),
            (G + "ui-continuity.md", "声音接入 commit，不在素材还没到达时先响完成"),
            (G + "sound-design.md", "小状态确认约 0.08–0.25 秒的短声，状态提交时触发一次"),
        ],
        "每个数字刷新都响一次，会被误听成多次结论",
    ),
    rule(
        "explain-shuffle-beat", "explain", "多次重复动作的疏密与取样",
        ["storytelling-perfect-shuffle"],
        ["science", "data", "story"], ["curious", "brisk"],
        ["重复", "多次", "概率", "统计", "取样", "洗牌"],
        (5.0, 14.0), 9.0,
        {"layer": "bed", "detail": "不要每次重复都配声；只在关键反转给一次重音"},
        {"holdSeconds": 1.8, "repeatCompress": True, "keyTurnHold": 2.5},
        [
            (G + "shuffle-rhythm.md", "先画出动作阶段，再决定哪几次配声"),
            (G + "shuffle-story.md", "重复过程可压缩，关键反转要留观察时间"),
            (S + "shuffle-rhythm.md", "多次微动作配声太满会盖住结果"),
        ],
        "把参考片的特定概率条件或洗牌次数当成通用结论",
    ),
    rule(
        "explain-transmission", "explain", "高速传输：跟随曝光与窗口接力",
        ["look-tracking-exposure", "visualization-window-relay"],
        ["data", "product", "science"], ["urgent", "brisk"],
        ["传输", "数据包", "网络", "发送", "速度", "模糊"],
        (5.0, 12.0), 8.0,
        {"layer": "air", "detail": "掠过声在最近点前 0.15–0.45 秒进入，随后回落"},
        {"shutterAngle": 180, "fps": 30, "holdSeconds": 2.0, "keepBackgroundRef": True},
        [
            (G + "transmission-effects.md", "T = angle / (360 × fps)；30fps、180° 约 16.67ms"),
            (S + "motion-blur-technical.md", "原片具体引擎和模糊算法未确认"),
            (G + "transmission-effects.md", "保留两端或尺的一部分，同一个窗口框进入特写"),
        ],
        "只对主体加糊、不给背景参照，就看不出速度",
    ),
    rule(
        "explain-blender", "explain", "三维场景内完成装配与镜头",
        ["examples/blender-flow"],
        ["mechanism", "product", "world"], ["calm", "epic"],
        ["3D", "blender", "建模", "场景", "渲染", "水流"],
        (6.0, 20.0), 12.0,
        {"layer": "contact", "detail": "零件入位的接触声跟随真实接触帧，不跟关键帧"},
        {"holdSeconds": 2.2, "cameraAndWorldSeparate": True, "fps": 24},
        [
            (G + "blender-model-motion.md", "把零件、装配与镜头放进同一个场景"),
            (S + "blender-flow.md", "上槽、水帘与下盆共用一套世界坐标"),
            (E + "blender-flow/API.md", "presentation.json 保存镜头与场景参数"),
        ],
        "世界运动与相机运动要分别求值，不能一起变速",
    ),
    rule(
        "explain-water", "explain", "水体与环境：复用已验收的成熟方案",
        ["examples/blender-flow"],
        ["world", "science"], ["calm", "epic", "warm"],
        ["水", "流体", "波纹", "水面", "瀑布", "环境"],
        (5.0, 16.0), 10.0,
        {"layer": "bed", "detail": "连续水流读取同一运动状态，不每帧启动新声"},
        {"holdSeconds": 2.5, "readMotionState": True, "preserveSourceHash": True},
        [
            (G + "production-toolkit.md", "旧工程成熟方案按问题复用，先选水体与环境路线"),
            (S + "production-water-lessons.md", "水体方案保留原文件与哈希"),
            (S + "waterpro-local-audit.md", "WaterPro 本地可用范围需先核对"),
        ],
        "连续水声若逐帧重启会变成噪声，必须读同一状态曲线",
    ),
    rule(
        "explain-spatial-data", "explain", "从实体到数据再回到动作",
        ["visualization-entity-formula"],
        ["science", "mechanism", "data"], ["calm", "curious"],
        ["机器人", "空间", "坐标", "传感", "数据", "动作"],
        (5.0, 14.0), 9.0,
        {"layer": "sonification", "detail": "数据变化用稳定映射，注明是 sonification"},
        {"holdSeconds": 2.2, "worldAnchorRequired": True,
         "separateDataClock": True},
        [
            (G + "robot-spatial-explainer.md", "先约定一个可追踪的世界，再从实体到数据再回到动作"),
            (S + "robocup-blender-technical.md", "世界坐标与镜头分别保存"),
        ],
        "位置若代表真实数值，不能为了配乐改排名或相交点",
    ),
    rule(
        "explain-linework", "explain", "线稿的体积、材料与过程",
        ["engraved-flow-path", "engraved-orthographic-assembly"],
        ["world", "science", "story"], ["epic", "calm", "warm"],
        ["线稿", "版画", "手绘", "轮廓", "材料", "质感"],
        (4.0, 12.0), 8.0,
        {"layer": "contact", "detail": "线条生长时极轻的摩擦声，落定后消失"},
        {"holdSeconds": 2.0, "solidBeforeLine": True, "lineWeightUnit": "mm"},
        [
            (G + "linework-language.md", "让实体成立，再决定画哪些线"),
            (S + "qinyulian-linework.md", "线宽与实体尺度绑定"),
        ],
        "先画线再补体积，会让线稿浮在表面",
    ),

    # ---------------- 对照 ----------------
    rule(
        "contrast-rate-ab", "contrast", "同画面换曲线：只改时间分配",
        ["rate-curves-ab"],
        ["science", "mechanism", "product"], ["calm", "curious"],
        ["对比", "差别", "更快", "更慢", "性格", "缓动"],
        (4.0, 10.0), 7.0,
        {"layer": "silence", "detail": "对照段先静音，让观众只看运动差别"},
        {"fixedPath": True, "fixedDuration": True, "curve": "ease-in-out",
         "holdSeconds": 1.5},
        [
            (G + "rate-curves.md", "先固定同一个物体、同一段距离和同一总时长，只换曲线做 A/B"),
            (S + "rate-curves.md", "三张图分别是进度、速度、加速度，不是同一条曲线"),
            (E + "rate-curves/API.md", "sampleCurve / sampleMotion 从绝对时间求值"),
        ],
        "同时改颜色和曲线，就无法判断差别来自哪里",
    ),
    rule(
        "contrast-motion-voice", "contrast", "四种动作语气：快/慢/停/弹",
        ["emotion-motion.js"],
        ["science", "story", "product"], ["curious", "warm", "urgent"],
        ["情绪", "语气", "急切", "从容", "犹豫", "果断"],
        (3.0, 8.0), 5.0,
        {"layer": "contact", "detail": "每种语气配一种短声；弹用接触次数决定声音次数"},
        {"holdSeconds": 1.6, "matchSoundPerTone": True,
         "curve": "minimum-jerk"},
        [
            (G + "emotion-motion.md", "四种动作语气：快、慢、停、弹，各自有不同的声音安排"),
            (S + "emotion-motion.md", "15 秒组合是四种动作的比较样片，段落间有明确剪辑"),
            (G + "emotion-motion.md", "只把动作整体放慢会像卡顿"),
        ],
        "快速也可能表示恐惧，缓慢也可能表示疲惫，不能一对一映射情绪",
    ),
    rule(
        "contrast-aesthetic-3way", "contrast", "三种视觉方向对照，不只换配色",
        ["aesthetic-direction.js"],
        ["science", "product", "world"], ["calm", "epic", "warm"],
        ["配色", "风格", "方向", "方案", "视觉", "质感"],
        (4.0, 10.0), 6.0,
        {"layer": "bed", "detail": "三方案共用同一条音床，避免声音差异干扰判断"},
        {"fixedContent": True, "holdSeconds": 1.8, "threeDirections": True},
        [
            (G + "aesthetic-direction.md", "先写观察任务，再选视觉方向；不能仅换颜色就算多方案"),
            (S + "aesthetic.md", "按观察任务选择视觉方向"),
            (G + "aesthetic-direction.md", "三方案工作台固定内容，只比较方向"),
        ],
        "只换颜色会被误认成三个方案",
    ),
    rule(
        "contrast-card-convergence", "contrast", "三卡汇聚成一个关系",
        ["mf-card-convergence"],
        ["data", "science"], ["calm", "curious"],
        ["汇总", "合并", "三条", "汇聚", "关系", "对比"],
        (4.0, 9.0), 6.0,
        {"layer": "confirm", "detail": "只在最终关系成立时给一次确认音"},
        {"holdSeconds": 2.0, "identityPersist": True, "curve": "ease-out"},
        [
            (G + "motionface-type.md", "三张卡的身份、汇聚方向、最终关系要可追踪"),
            (G + "motionface-type.md", "连接线等节点停稳后再绘制"),
        ],
        "没有实际汇聚关系却把任意三个词连线",
    ),
    rule(
        "contrast-style-atlas", "contrast", "从风格图谱选主风格并比较局部",
        ["examples/lemo-opuscar/API.md"],
        ["world", "story", "product"], ["epic", "warm", "brisk"],
        ["风格", "参考", "电影", "动画", "图谱", "美术"],
        (3.0, 8.0), 5.0,
        {"layer": "bed", "detail": "比较风格时先统一音轨，不让配乐差异冒充视觉差异"},
        {"holdSeconds": 1.5, "pickOneMainStyle": True, "retainAttribution": True},
        [
            (G + "lemo-opuscar.md", "图谱收录 59 种现成风格、98 份电影风格档案和 14 项原创局部试作"),
            (S + "lemo-analysis-a.md", "157 张来源缩略帧已观察，原片完整播放仍为 0"),
            (G + "lemo-opuscar.md", "保留 LemoLab 署名、MIT/CC BY 4.0 与第三方素材许可"),
        ],
        "不能把看图谱当成看过原片；正式制作要用自己的 TTS、音乐与真实数据",
    ),
    rule(
        "contrast-type-color", "contrast", "文字、颜色与画面分层解释",
        ["type-palette-attention", "type-anchored-label"],
        ["science", "product", "data"], ["calm", "brisk"],
        ["文字", "排版", "色彩", "标注", "层次", "标题"],
        (3.5, 9.0), 6.0,
        {"layer": "silence", "detail": "读字段落不做音效，留安静窗口"},
        {"holdSeconds": 2.2, "titleVsBodySplit": True, "colorRolesMax": 3},
        [
            (G + "type-color.md", "标题可以快进慢收，正文需要稳定阅读"),
            (S + "type-color.md", "颜色承担语义角色，不作装饰渐变"),
        ],
        "正文已经高速变化时再加彩色渐变，会让阅读失去落点",
    ),

    # ---------------- 揭示 ----------------
    rule(
        "reveal-window-relay", "reveal", "窗口接力：局部放大后仍知道自己在哪",
        ["visualization-window-relay"],
        ["data", "science", "product"], ["curious", "urgent"],
        ["放大", "细节", "窗口", "局部", "特写", "揭示"],
        (4.0, 10.0), 7.0,
        {"layer": "air", "detail": "窗口框进入特写时起声，抵达后静音"},
        {"holdSeconds": 2.4, "keepEdgeAnchor": True, "arriveThenHold": True},
        [
            (G + "transmission-effects.md", "保留两端或尺的一部分，同一个窗口框进入特写"),
            (G + "transmission-effects.md", "抵达后保持结果；下一次运动由新的解释任务触发"),
        ],
        "数字还没读完镜头就走，会把揭示变成闪过",
    ),
    rule(
        "reveal-shape-into-world", "reveal", "形状里先放进另一个世界，再停顿、再扩大",
        ["symbolic-titles.js"],
        ["world", "story", "science"], ["epic", "curious"],
        ["揭示", "转折", "另一个", "负形", "轮廓", "变形"],
        (4.0, 12.0), 6.0,
        {"layer": "bed", "detail": "辨认阶段撤掉瞬态，只留和声底，扩大时再进"},
        {"holdSeconds": 2.2, "recognizeBeforeExpand": True, "order": ["insert", "hold", "expand"]},
        [
            (G + "symbolic-title-sequence.md", "14.6s 下一场景已在盔面负形中，14.7–15.5s 保留辨认，15.6–16.2s 再扩大"),
            (S + "review-magpie.md", "静帧审阅支持图形与构图，不支持精确缓动"),
        ],
        "跳过辨认停顿直接扩大，观众只会看到一次闪白",
    ),
    rule(
        "reveal-camera-move", "reveal", "镜头运动揭示空间关系",
        ["camera-first-person", "camera-hitchcock-zoom", "camera-bullet-time"],
        ["mechanism", "world", "science"], ["epic", "urgent", "curious"],
        ["运镜", "推近", "穿梭", "第一人称", "变焦", "子弹"],
        (3.0, 9.0), 6.0,
        {"layer": "air", "detail": "穿梭声跟随相机真实速度，不是固定包络"},
        {"focalLengthMm": 50, "fNumber": 4, "holdSeconds": 2.0,
         "worldClockSeparate": True},
        [
            (G + "camera.md", "运镜按观察任务选择：穿梭、第一人称、离体、子弹时刻"),
            (S + "camera-moves.md", "相机运动曲线与物体物理时间分别保存"),
            (G + "rate-curves.md", "子弹时刻中相机可以继续绕行，世界只前进一点"),
        ],
        "整段变慢会把旁白一起拖慢；世界与相机要分开",
    ),
    rule(
        "reveal-lattice-growth", "reveal", "结构生长：从一个单元长成整体",
        ["visualization-lattice-growth"],
        ["science", "mechanism", "world"], ["calm", "epic"],
        ["晶体", "生长", "晶格", "分子", "结构", "放大"],
        (5.0, 14.0), 9.0,
        {"layer": "sonification", "detail": "生长进度映射到脉冲稀疏度，注明是 sonification"},
        {"holdSeconds": 2.6, "unitToWhole": True, "scaleLabelVisible": True},
        [
            (G + "visualization.md", "公式与可视化共用一个可追踪对象"),
            (G + "mofs-writing.md", "重复、缩小并映射到化学结构，之后命名并交代意义"),
            (S + "mofs.md", "几何通过与材料吸附分开解释"),
        ],
        "不能把位置示意说成吸附仿真或实际晶体",
    ),

    # ---------------- 收束 ----------------
    rule(
        "close-question-return", "close", "旧轨迹变形成新问题",
        ["symbolic-titles.js", "continuity.js"],
        ["science", "mechanism", "world"], ["curious", "calm"],
        ["结尾", "下一步", "回到", "问题", "收尾"],
        (3.0, 8.0), 5.0,
        {"layer": "bed", "detail": "结尾保留环境底，不突然全静音"},
        {"holdSeconds": 2.4, "reuseExistingObject": True},
        [
            (G + "syy-rhythm.md", "结尾由旧轨迹继续变形，新问题才有来处"),
            (G + "continuity.md", "让下一镜接住上一镜的问题"),
        ],
        "凭空换一个新对象提问，会让前文白讲",
    ),
    rule(
        "close-prediction", "close", "让观众用刚学的关系做一次预测",
        ["storytelling.js"],
        ["science", "mechanism", "tutorial"], ["curious", "warm"],
        ["预测", "下次", "你来", "想一想", "练习", "复现"],
        (4.0, 10.0), 6.0,
        {"layer": "silence", "detail": "提问后留 1.5–2 秒空镜，不急着给答案"},
        {"holdSeconds": 2.5, "pauseBeforeAnswer": 2.0, "newSituation": True},
        [
            ("SKILL.md", "讲完之后安排一个新情境，让观众用刚学的关系做一次预测"),
            (G + "script.md", "对照只听旁白、静音看画面和正常播放的断点"),
        ],
        "新情境必须换条件，不能只是把原例重播一遍",
    ),
    rule(
        "close-title-hold", "close", "结论/片名稳定阅读收住",
        ["symbolic-titles.js", "type-anchored-label"],
        ["product", "world", "story", "science"], ["epic", "calm", "warm"],
        ["片名", "结论", "落版", "品牌", "slogan", "结尾"],
        (2.0, 6.0), 3.5,
        {"layer": "bed", "detail": "落版时让声音收住，不要再多一次 whoosh"},
        {"holdSeconds": 2.5, "noMotionAfterLock": True, "maxLines": 2},
        [
            (G + "symbolic-title-sequence.md", "红字黑场片名稳定；连续转换后留一次完整阅读"),
            (G + "rate-curves.md", "抵达之后让字体稳定，别靠不断抖动维持注意力"),
        ],
        "标题落定后还在漂移，观众会以为片子没结束",
    ),
]

RULES_BY_ID = {r["id"]: r for r in RULES}

MODULE_INDEX = {}
for _r in RULES:
    for _m in _r["module_ids"]:
        MODULE_INDEX.setdefault(_m, []).append(_r["id"])


# ---------------------------------------------------------------------------
# 打分与选型
# ---------------------------------------------------------------------------

def normalize_brief(raw):
    """把用户 brief 归一化，缺项给默认值，未知值记入 notes 而不是报错。"""
    if not isinstance(raw, dict):
        raise ValueError("brief 必须是 JSON 对象")

    notes = []
    genre = str(raw.get("genre", "science")).strip()
    if genre not in GENRES:
        notes.append("未知 genre=%r，按 science 处理；可选：%s"
                     % (genre, ", ".join(GENRES)))
        genre = "science"

    aspect = str(raw.get("aspect", "16:9")).strip()
    if aspect not in ASPECTS:
        notes.append("未知 aspect=%r，按 16:9 处理；可选：%s"
                     % (aspect, ", ".join(ASPECTS)))
        aspect = "16:9"

    tones = raw.get("tones") or []
    if isinstance(tones, str):
        tones = [tones]
    clean_tones = []
    for t in tones:
        t = str(t).strip()
        if t in TONES:
            clean_tones.append(t)
        elif t in TONES.values():
            clean_tones.append([k for k, v in TONES.items() if v == t][0])
        else:
            notes.append("未知 tone=%r，已忽略；可选：%s" % (t, ", ".join(TONES)))
    if not clean_tones:
        clean_tones = ["curious"]

    try:
        duration = float(raw.get("duration", 60))
    except (TypeError, ValueError):
        raise ValueError("duration 必须是数字（秒）")
    if duration <= 0:
        raise ValueError("duration 必须大于 0")
    if duration < 15:
        notes.append("时长 %.1f 秒短于 15 秒：每个段类型只能分到一拍，"
                     "钩子与收束会挤压解释段" % duration)

    must_explain = raw.get("must_explain") or []
    if isinstance(must_explain, str):
        must_explain = [must_explain]

    need_sound = raw.get("need_sound", True)
    if not isinstance(need_sound, bool):
        need_sound = str(need_sound).lower() in ("1", "true", "yes", "是")

    overrides = raw.get("overrides") or {}
    if not isinstance(overrides, dict):
        notes.append("overrides 必须是对象，已忽略")
        overrides = {}

    return {
        "title": str(raw.get("title", "") or "").strip(),
        "topic": str(raw.get("topic", "") or "").strip(),
        "duration": duration,
        "aspect": aspect,
        "genre": genre,
        "tones": clean_tones,
        "need_sound": need_sound,
        "must_explain": [str(x).strip() for x in must_explain if str(x).strip()],
        "audience": str(raw.get("audience", "") or "").strip(),
        "overrides": overrides,
        "notes": notes,
    }


def text_blob(brief):
    parts = [brief["title"], brief["topic"]]
    parts.extend(brief["must_explain"])
    parts.append(brief["audience"])
    return " ".join(parts).lower()


def score(rule_, brief, blob):
    """特征匹配打分。每个加分项都对应一个可指认的需求特征。"""
    pts = 0
    why = []

    if brief["genre"] in rule_["genres"]:
        # 第一个 genre 是该技法的主用途，命中的分更高
        pts += 5 if rule_["genres"][0] == brief["genre"] else 4
        why.append("genre=%s" % brief["genre"])
    else:
        pts -= 2

    tone_hits = [t for t in brief["tones"] if t in rule_["tones"]]
    if tone_hits:
        pts += 2 * len(tone_hits)
        why.append("tone=" + "/".join(tone_hits))
    else:
        pts -= 1

    if brief["aspect"] in rule_["aspects"]:
        pts += 2
        why.append("aspect=%s" % brief["aspect"])

    kw_hits = [k for k in rule_["keywords"] if k.lower() in blob]
    if kw_hits:
        pts += 2 * len(kw_hits)
        why.append("关键词命中：" + "、".join(kw_hits[:4]))

    lo, hi = rule_["duration"]
    if lo <= brief["duration"] <= hi * 6:
        pts += 1
    if brief["duration"] < lo:
        pts -= 1
        why.append("时长短于该技法常见下界 %.1fs" % lo)

    if not brief["need_sound"]:
        pts += 1  # 便于选出静音友好的规则

    return pts, why


def ordered_candidates(segment, brief, blob):
    pool = [r for r in RULES if r["segment"] == segment]
    scored = []
    for r in pool:
        pts, why = score(r, brief, blob)
        scored.append((pts, r["id"], r, why))
    scored.sort(key=lambda x: (-x[0], x[1]))

    pinned = brief["overrides"].get(segment)
    if pinned:
        ids = pinned if isinstance(pinned, list) else [pinned]
        chosen = []
        for pid in ids:
            r = RULES_BY_ID.get(str(pid))
            if r is None:
                brief["notes"].append(
                    "overrides.%s 指定了不存在的规则 %r，已忽略" % (segment, pid))
                continue
            if r["segment"] != segment:
                brief["notes"].append(
                    "overrides.%s 指定的 %r 属于 %s 段，已忽略"
                    % (segment, pid, r["segment"]))
                continue
            chosen.append((999, r["id"], r, ["手工覆盖"]))
        rest = [s for s in scored if s[1] not in {c[1] for c in chosen}]
        scored = chosen + rest

    return scored


def beats_for(segment, seconds, rule_, brief, available=1):
    """按规则的目标拍长把一段拆成若干拍。

    拍数同时受该段拍数上限、技法时长域和单拍上限约束；候选不够时循环复用。
    """
    if seconds <= 0:
        return 1
    limit = BEAT_LIMITS.get(segment, 4)
    target = max(1.0, rule_["typical_beat"])
    lo, hi = rule_["duration"]
    cap = MAX_BEAT_SECONDS.get(segment, hi)

    best = None
    for n in range(1, limit + 1):
        per = seconds / n
        if per > cap:
            continue
        if per < lo * 0.6:
            continue
        # 偏好：单拍落进技法时长域 > 接近目标拍长
        in_range = lo <= per <= hi
        err = abs(per - target) + (0 if in_range else 4.0)
        if best is None or err < best[0]:
            best = (err, n)

    if best is None:
        # 无论怎么拆都超出单拍上限：用最多拍数，剩余交给调用方记入 unresolved
        return limit

    n = best[1]
    if brief["aspect"] == "9:16" and seconds < 12:
        n = 1  # 竖屏短段不拆，避免每拍只剩 2 秒
    return n


def segment_budget(duration, brief):
    """段预算：短片的对照段并入解释；单段超过上界时溢出的秒数并入解释。"""
    budget = []
    for sid, name, w in SEGMENTS:
        if duration < SHORT_BRIEF_SECONDS and sid == "contrast":
            continue
        budget.append([sid, name, duration * w])

    if duration < SHORT_BRIEF_SECONDS:
        dropped = duration * next(w for s, _, w in SEGMENTS if s == "contrast")
        for row in budget:
            if row[0] == "explain":
                row[2] += dropped * 0.6
            elif row[0] == "reveal":
                row[2] += dropped * 0.4
        brief["notes"].append(
            "时长 %.0f 秒 < %d 秒：已去掉对照段，其份额 60%% 并入解释、40%% 并入揭示。"
            "需要 A/B 对照时用 overrides 手工加回。"
            % (duration, SHORT_BRIEF_SECONDS))

    spill = 0.0
    for row in budget:
        cap = MAX_SEGMENT_SECONDS.get(row[0])
        if cap and row[2] > cap:
            spill += row[2] - cap
            brief["notes"].append(
                "%s 段预算 %.1f 秒超过 %.0f 秒上界，溢出 %.1f 秒并入解释段。"
                % (SEG_NAMES[row[0]], row[2], cap, row[2] - cap))
            row[2] = cap
    if spill:
        for row in budget:
            if row[0] == "explain":
                row[2] += spill

    # 解释段也有上限：6 拍 × 30 秒。超出的秒数分给揭示与对照，
    # 否则会出现一条 100 秒的长镜。
    explain_cap = MAX_EXPLAIN_BEATS * MAX_BEAT_SECONDS["explain"]
    for row in budget:
        if row[0] == "explain" and row[2] > explain_cap:
            over = row[2] - explain_cap
            brief["notes"].append(
                "解释段超过 %d 拍 × %.0f 秒 = %.0f 秒的上限，溢出 %.1f 秒分给揭示段。"
                % (MAX_EXPLAIN_BEATS, MAX_BEAT_SECONDS["explain"],
                   explain_cap, over))
            row[2] = explain_cap
            for other in budget:
                if other[0] == "reveal":
                    other[2] += over
                    break

    total = sum(r[2] for r in budget)
    return [(sid, name, round(sec / total, 6)) for sid, name, sec in budget]


def build_plan(raw_brief):
    brief = normalize_brief(raw_brief)
    blob = text_blob(brief)
    duration = brief["duration"]

    timeline = []
    used = []
    index = 0
    budget = segment_budget(duration, brief)

    for sid, sname, weight in budget:
        sec = duration * weight
        cands = ordered_candidates(sid, brief, blob)
        if not cands:
            continue
        n = beats_for(sid, sec, cands[0][2], brief, len(cands))
        per = sec / n

        for i in range(n):
            if i == 0:
                pts, rid, r, why = cands[0]
            elif i < len(cands):
                pts, rid, r, why = cands[i]
            else:
                pts, rid, r, why = cands[0]

            start = round(index_start(timeline), 2)
            end = round(start + per, 2)
            timeline.append({
                "beat": len(timeline) + 1,
                "segment": sid,
                "segmentName": sname,
                "start": start,
                "end": end,
                "duration": round(per, 2),
                "techniqueId": r["id"],
                "technique": r["technique"],
                "moduleIds": r["module_ids"],
                "params": dict(r["params"]),
                "sound": sound_for(r, brief),
                "why": "；".join(why) if why else "该段默认候选",
                "risk": r["risk"],
                "refs": r["refs"],
            })
            used.append(r)
            index += 1

    # 修正累计误差，让时间轴正好落在 duration 上
    if timeline:
        drift = round(duration - timeline[-1]["end"], 2)
        if abs(drift) >= 0.01:
            timeline[-1]["end"] = round(timeline[-1]["end"] + drift, 2)
            timeline[-1]["duration"] = round(
                timeline[-1]["end"] - timeline[-1]["start"], 2)

    technique_set = []
    seen = set()
    for r in used:
        if r["id"] not in seen:
            seen.add(r["id"])
            technique_set.append({
                "id": r["id"],
                "segment": r["segment"],
                "technique": r["technique"],
                "moduleIds": r["module_ids"],
                "refs": [x["path"] for x in r["refs"]],
            })

    unresolved = list(brief["notes"])
    unresolved.extend(check_coverage(brief, blob))

    return {
        "schema": SCHEMA,
        "brief": {k: brief[k] for k in
                  ("title", "topic", "duration", "aspect", "genre", "tones",
                   "need_sound", "must_explain", "audience")},
        "segmentBudget": [
            {"segment": sid, "name": sname,
             "seconds": round(duration * w, 2), "share": w}
            for sid, sname, w in budget
        ],
        "timeline": timeline,
        "techniqueSet": technique_set,
        "soundPlan": summarize_sound(timeline, brief),
        "unresolved": unresolved,
        "limits": [
            "选型器只安排技法与时长，不生成事实、公式结果、数值或科学结论。",
            "params 是起点值，须按当前对象尺度与旁白重新调；不是验收标准。",
            "refs 表示该文件支持这条技法，不代表已完成主观听审或全片验收。",
            "参考作品的配乐、水印、人物与第三方代码不可直接进入交付包。",
        ],
    }


def index_start(timeline):
    return timeline[-1]["end"] if timeline else 0.0


def sound_for(rule_, brief):
    if not brief["need_sound"]:
        return {"layer": "off", "detail": "brief 声明不需要音效，保留旁白与音乐两条轨"}
    return dict(rule_["sound"])


def summarize_sound(timeline, brief):
    if not brief["need_sound"]:
        return {"enabled": False,
                "note": "不做音效层；仍建议旁白/音乐分轨，读公式处留安静窗口。"}
    counts = {}
    for b in timeline:
        layer = b["sound"]["layer"]
        counts[layer] = counts.get(layer, 0) + 1
    return {
        "enabled": True,
        "layerCounts": counts,
        "note": ("接触声跟接触帧，确认声跟状态提交，掠过声在最近点前 0.15–0.45 秒进入；"
                 "旁白活动窗口内先避让，再考虑减小增益。"),
        "refs": [G + "sound-design.md", G + "emotion-motion.md"],
    }


def check_coverage(brief, blob):
    """检查 must_explain 中的每一项是否有规则能接住。"""
    out = []
    for term in brief["must_explain"]:
        low = term.lower()
        hits = [r["id"] for r in RULES
                if any(k.lower() in low or low in k.lower() for k in r["keywords"])]
        if not hits:
            out.append("讲解项 %r 没有直接匹配的技法规则：需要手工选段或补一条规则，"
                       "选型器不会替它编造解释结构。" % term)
    return out


# ---------------------------------------------------------------------------
# 反查
# ---------------------------------------------------------------------------

def reverse_lookup(query):
    q = query.strip().lower()
    hits = []
    for r in RULES:
        hay = [r["id"].lower(), r["technique"].lower()] + \
              [m.lower() for m in r["module_ids"]]
        if q in hay or any(q in h for h in hay):
            hits.append(r)
    if not hits:
        for mid, rids in MODULE_INDEX.items():
            if q in mid.lower():
                hits.extend(RULES_BY_ID[x] for x in rids)

    if not hits:
        return {
            "query": query,
            "found": False,
            "suggestion": "未匹配。用 --list 查看全部规则 id，或按段类型前缀查："
                          "hook- / explain- / contrast- / reveal- / close-",
        }

    out = []
    for r in hits:
        out.append({
            "id": r["id"],
            "technique": r["technique"],
            "segment": r["segment"],
            "segmentName": SEG_NAMES[r["segment"]],
            "moduleIds": r["module_ids"],
            "typicalParams": r["params"],
            "durationRange": list(r["duration"]),
            "typicalBeat": r["typical_beat"],
            "sound": r["sound"],
            "risk": r["risk"],
            "refs": r["refs"],
        })
    return {"query": query, "found": True, "count": len(out), "matches": out}


def list_rules():
    return {
        "segments": [{"id": s, "name": n, "defaultShare": w}
                     for s, n, w in SEGMENTS],
        "genres": GENRES,
        "tones": TONES,
        "aspects": ASPECTS,
        "rules": [{"id": r["id"], "segment": r["segment"],
                   "technique": r["technique"],
                   "moduleIds": r["module_ids"]} for r in RULES],
    }


# ---------------------------------------------------------------------------
# 自检
# ---------------------------------------------------------------------------

def self_test():
    checks = []

    # 1. 每个段类型至少有一条规则
    for sid, _, _ in SEGMENTS:
        checks.append(("segment %s has rules" % sid,
                       any(r["segment"] == sid for r in RULES)))

    # 2. 规则 id 唯一
    checks.append(("unique ids", len(RULES_BY_ID) == len(RULES)))

    # 3. 每条规则都有 refs，且路径形如 assets/... 或 SKILL.md
    bad_refs = []
    for r in RULES:
        if not r["refs"]:
            bad_refs.append(r["id"] + ":no-refs")
        for x in r["refs"]:
            p = x["path"]
            if not (p.startswith("assets/") or p == "SKILL.md"):
                bad_refs.append(r["id"] + ":" + p)
    checks.append(("every rule traceable to a research file",
                   not bad_refs))
    if bad_refs:
        checks.append(("bad refs: " + ", ".join(bad_refs), False))

    # 4. 两档时长都能出合法计划，时间轴首尾闭合
    for dur, aspect, genre in ((180, "16:9", "science"),
                               (30, "9:16", "product")):
        plan = build_plan({"topic": "自检", "duration": dur,
                           "aspect": aspect, "genre": genre})
        tl = plan["timeline"]
        ok = (tl and abs(tl[0]["start"]) < 1e-9
              and abs(tl[-1]["end"] - dur) < 0.02)
        checks.append(("timeline closes at %ss" % dur, ok))
        # 每个镜头至少 1 秒
        checks.append(("%ss no sub-second beat" % dur,
                       all(b["duration"] >= 0.9 for b in tl)))

    # 5. 反查能命中
    checks.append(("reverse lookup hits", reverse_lookup("mf-card-convergence")["found"]))

    failed = [name for name, ok in checks if not ok]
    return {"ok": not failed, "checks": [{"name": n, "ok": o} for n, o in checks],
            "failed": failed}


# ---------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(
        description="把视频 brief 变成分镜级技法计划")
    ap.add_argument("--brief", help="brief JSON 文件路径，或 - 表示 stdin")
    ap.add_argument("--technique", help="反查：技法名 / 规则 id / 模块 id / 子串")
    ap.add_argument("--list", action="store_true", help="列出段类型、特征枚举与全部规则")
    ap.add_argument("--schema", action="store_true", help="输出 brief 字段说明")
    ap.add_argument("--self-test", action="store_true", help="跑内置自检")
    args = ap.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False, indent=2))
        return 0

    if args.schema:
        print(json.dumps(brief_schema_doc(), ensure_ascii=False, indent=2))
        return 0

    if args.list:
        print(json.dumps(list_rules(), ensure_ascii=False, indent=2))
        return 0

    if args.technique:
        print(json.dumps(reverse_lookup(args.technique),
                         ensure_ascii=False, indent=2))
        return 0

    if not args.brief:
        ap.error("需要 --brief，或使用 --technique / --list / --schema / --self-test")

    if args.brief == "-":
        raw = json.load(sys.stdin)
    else:
        with open(args.brief, "r", encoding="utf-8-sig") as fh:
            raw = json.load(fh)

    plan = build_plan(raw)
    print(json.dumps(plan, ensure_ascii=False, indent=2))
    return 0


def brief_schema_doc():
    return {
        "briefSchema": BRIEF_SCHEMA,
        "required": {},
        "fields": {
            "title": "文档标题，可空",
            "topic": "一句话说清主题；用于关键词匹配",
            "duration": "成片秒数，数字；必填",
            "aspect": {"values": list(ASPECTS), "default": "16:9"},
            "genre": {"values": list(GENRES), "default": "science"},
            "tones": {"values": list(TONES), "default": ["curious"]},
            "need_sound": {"type": "bool", "default": True},
            "must_explain": ["必须讲清的点，逐项检查是否被规则接住"],
            "audience": "观众已有知识，可空",
            "overrides": {
                "说明": "手工覆盖，键为段类型，值为规则 id 或 id 列表",
                "例如": {"explain": ["explain-blender", "explain-water"],
                         "hook": "hook-symbolic-objects"},
            },
        },
        "outputSchema": SCHEMA,
    }


if __name__ == "__main__":
    sys.exit(main())
