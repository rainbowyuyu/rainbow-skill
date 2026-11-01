# 文件夹与执行记录

用户只需提供发布文件夹路径，不必先整理成下列固定名称。常见布局可以是：

```text
本期发布/
  成片.mp4
  发布文案.md
  封面_16x9.jpg
  封面_3x4.jpg
  封面_9x16.jpg
```

Codex 阅读平台分节文案，按本次页面的封面要求选图。如果文件夹里有多期视频或多套版本，先消歧。为同一视频有意准备的平台专用编码、标题、封面可以分别指定。

## 本地准备

```powershell
python -X utf8 'C:/Users/USER/.codex/skills/rainbow-publish/scripts/publish_bundle.py' prepare 'D:/videos/本期发布'
```

只扫描该目录内有限深度，跳过临时目录和链接，不上传。输出路径在 `.publish-runs/<unique>/bundle.json`，不覆盖原视频／文案／封面。`ready_for_review` 表示可检查本地素材，不表示账号、合集或网页已验证；`needs_input` 和退出码 2 表示还有待解析／选择项，通常由 Codex 从现有文案自行解决，而非直接要求用户填写全部字段。退出码 1 是输入或运行错误。

helper 不做语义改写、联网解析或远端发布。扫描发现多个封面不是要求用户重做封面：Codex 阅读文件名、尺寸并查看图片后选择现有适配图。涉及旧项目格式时先读 platforms.md 的“本项目历史材料的读取”。

## 可选清单

用户已有明确配置时可在发布文件夹放 `publish.json`；否则 Codex 可以将解析结果写在本次 run 下的 `resolved.json`，再以 `--manifest` 传入。所有素材路径相对用户提供的发布文件夹，必须位于该目录内；清单自己位于 run 子目录也不改变素材路径的基准。

```json
{
  "video": "成片.mp4",
  "cover": "封面_16x9.jpg",
  "copy": "发布文案.md",
  "title": "已选定的通用标题",
  "description": "发布正文，不包含编辑说明或首评",
  "tags": ["科普", "科学"],
  "platforms": {
    "wechat": {"collection": "已核实的视频号合集名称"},
    "douyin": {"cover": "封面_9x16.jpg", "collection": "已核实的抖音合集名称"},
    "bilibili": {"title": "B站专用标题", "category": "已核实的分区", "collection": "已核实的B站合集名称"},
    "xiaohongshu": {"cover": "封面_3x4.jpg", "title": "小红书专用标题", "collection": "已核实的小红书合集名称"}
  }
}
```

这些只是字段示例，不是用户实际合集。`account`、`category`、`collection` 等信息保留在计划里，远端有效性必须从网页核实。`description` 和 `body` 可表示正文。`platforms.<平台>.enabled:false` 可禁用本次不发布的平台；用户未选择子集时启用四平台。平台级字段覆盖通用值。

已存在的 `source/publish/{wechat,douyin,bilibili,xiaohongshu}.json` 中的 title/body/tags 可自动读取。数组式 `copy-data.json` 和迁移的 `publish-manifest.json` 由 Codex 按 references/platforms.md 转为明确计划；不要把历史 `source` 地址当当前素材。

计划已明确后，可执行 `verify <bundle.json> --platform <平台>` 复查视频、封面和源文案 SHA256、尺寸、修改时间及未解决项。退出码 2 表示需要处理。`claim --bundle` 会自动执行同样的单平台复查，避免其他平台的缺项阻塞已经就绪的平台。源文案或封面变更后重新 prepare，保留旧运行证据。

## 全局去重记录

默认 ledger：`C:/Users/USER/.codex/state/rainbow-publish/ledger.json`。把发布文件夹复制到其他位置后仍使用这份全局记录；测试必须用 `--ledger` 指向临时文件。

```powershell
python -X utf8 'C:/Users/USER/.codex/skills/rainbow-publish/scripts/publish_bundle.py' status
```

身份键为平台、固定格式的稳定账号标识和视频 SHA256。使用 `uid:<值>` 或经 profiles.json 映射的规范化主页标识，不能使用昵称、unknown 或临时随机字符串。

提交证据写入 JSON 文件，使用文件参数传递，避免在 shell 中拼接文案。例：

```json
{
  "text": "当前页面观察到的账号、标题、封面、合集和可提交状态；填写真实观察内容",
  "url": "https://member.bilibili.com/platform/upload",
  "screenshot": "D:/videos/本期发布/.publish-runs/本次运行/bilibili-before.png"
}
```

证据至少需要观察说明及官方 HTTPS URL 或已存在的截图。不要编造凭据，URL 本身也不能证明提交成功。

1. 本地计划核对后，提交前用 `claim --platform <平台> --account-id <稳定ID> --sha256 <视频SHA256> --bundle <bundle.json> --evidence <提交前证据.json>`。保存返回的 `attempt_token`。
2. **只有 claim 成功才点击发布**。并发进程无法重复 claim；任何中断留下 `submitting` 即阻止再次提交。
3. 点击后用 `record` 加相同身份参数、`--attempt-token`、`--state` 和 `--evidence` 保存实际状态。状态包括 submission_unknown、submitted、reviewing、scheduled、published、failed。除截图和 URL 外，证据 JSON 可保存作品 ID、实际标题和页面时间等字段。
4. 用 `collection` 加相同身份参数、`--attempt-token`、`--status pending|verified|unavailable`、`--target <合集名>`、`--evidence <证据.json>` 保存归集状态。它不改变投稿状态。续跑已投稿作品时只补归集／查回执。
5. `failed` 也不会自动放开重投。只有后台有明确的“未创建作品”证据，且旧提交已终止，才可 record 为 `confirmed_absent`；证据还需 `checked_no_existing_item:true`。这不是默认重试按钮。暂时查不到作品、缺少公开链接或审核拒绝均不能当成未创建。

helper 使用原子写入和进程锁，保留状态历史及每次提交 token。不要直接编辑 ledger 来绕过去重。页面和素材校验仍由 Codex 完成；不要把 helper 验证当成平台投稿测试。
