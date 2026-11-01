# 安装与使用

本仓库保存可阅读的技能与部分制作代码，不替代宿主智能体、渲染器或语音项目。

## 选择安装

```bash
python scripts/install.py --list
python scripts/install.py --skill rainbow-video-director --dry-run
python scripts/install.py --skill rainbow-video-director
python scripts/install.py --skill rainbow-motion-story --target /path/to/project/.agents/skills
```

没有 `--skill` 不进行复制。可多次传入 `--skill`。安装器按仓库内 Markdown 引用加入其他已打包技能；目录记录不当成可安装源码。`--no-deps` 只安装指定包，此时依赖需要自行补齐。

默认目标使用 `CODEX_HOME/skills`，未设置时为 `~/.codex/skills`。可以显式选 `~/.claude/skills`、`~/.cursor/skills` 或宿主支持的项目目录。传入 `~` 会在 Python 中展开。安装器不修改全局模型、提供方、权限或插件配置。

## 已有同名文件

完整内容一致就跳过；任何内容不同都停止并列出目录，先由你决定备份、合并或换目标。安装器没有覆盖和删除模式。先用 `--dry-run` 看清实际复制范围。

目录记录中的技能请从原渠道安装。来源缺失时保持未知，不运行猜测的下载命令。系统与插件技能使用各自提供方的更新机制。

## 运行环境

公开版把作者本机用户名替换为 `USER`，项目盘符路径替换为示例工作目录，内网地址使用文档保留地址。它们只是模板。运行代码前读取该技能实际说明和帮助，按当前机器设置入口与依赖。

- 视频：按项目需要配置 Blender、Manim 或浏览器/Canvas 渲染，FFmpeg 用于编码。
- 声音：个人 TTS 项目、模型与参考音频单独配置，不从仓库下载私人声音。
- 外部服务：使用各服务官方授权方式。不要把密钥写进技能目录。
- 授权资产：WaterPro、字体、音乐等按各自许可从自己的来源获取。

导演技能允许在本机添加 `references/runtime-profile.local.md`，记录工具路径和已验证入口；这个文件默认不入 Git。旧技能中的本地命令样例需自行适配，仓库未声称每个历史代码样例都能跨平台直接运行。

## 仓库检查

```bash
python scripts/validate.py
python -m unittest discover -s tests -v
```

检查结构、技能目录、公开文件类型和明确的敏感标记；这些结果不证明影片美感、科研正确性或所有上游脚本的运行效果。
