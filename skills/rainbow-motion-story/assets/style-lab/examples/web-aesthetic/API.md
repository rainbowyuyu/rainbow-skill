# 网页审美选型：一份内容，三种页面结构

[工作台](../../lab/web-aesthetic.html)使用真实 HTML、CSS 和 DOM 交互，比较页面的信息组织。三种结构为本库原创设计，参考入口来自见构 UI 视频与源铺，未复制第三方模板代码、图片或品牌。所有研究项目都是固定演示内容；这里不播放、编辑或连接用户的视频工程。

## 文件与接口

```js
import {
  content, directions, normalizeState, filterProjects,
  buildSelection, cssTokens, designPrompt, artwork
} from './lab/modules/web-aesthetic.js';

const state = normalizeState({
  directionId: 'editorial', // editorial | console | gallery
  title: '把复杂的世界，拆开看。',
  query: '水面',
  category: '全部',
  selectedId: 'tower',
  favorites: ['water'],
  onlyFavorites: false,
  rationale: '先让人理解一个问题，再进入研究目录。',
});
const visible = filterProjects(state);
const json = buildSelection(state);
const css = cssTokens(state.directionId);
const prompt = designPrompt(state);
```

`content` 提供共同标题、引子和四个项目，`directions` 提供用途、取舍、内容顺序、窄屏顺序与设计变量。纯数据模块没有 DOM、网络、存储或计时器依赖。

`normalizeState` 会处理未知方向、未知项目、重复收藏、无效分类和过长输入，不会修改传入对象。`filterProjects` 同时考虑搜索、领域和只看收藏，返回共同数据中的项目。`buildSelection` 导出当前标题、输入、选择、收藏、理由、变量、布局和代码入口；导出对象与模块的定义分离，修改导出对象不会反向修改候选。

`cssTokens(id)` 导出一份作用于 `.world-page[data-direction="…"]` 的 CSS 变量。变量只负责颜色、字体、圆角与过渡；它不是完整页面。实际布局在 [web-aesthetic.css](../../lab/web-aesthetic.css)，控制器在 [web-aesthetic-studio.js](../../lab/web-aesthetic-studio.js)。三种布局不能仅通过替换变量获得。

`designPrompt(state)` 把选择转成可读制作约定：用途、读者、主操作、顺序、理由、取舍、真实状态、窄屏和减少动态效果。它不打审美分数，也不保证换成其他内容仍然适合。

`artwork(kind, directionId)` 返回原创程序化 SVG，`kind` 为 `tower / water / control / chip`。SVG内部仅使用固定代码和受验证的枚举，不接收用户文本。插画表达主题，不是精确结构、流体或控制仿真。

## 三种布局的区别

| 方向 | 结构 | 用途与代价 |
|---|---|---|
| `editorial` 纸上观察 | 不对称标题与引子；左侧重点作品，右侧紧凑目录 | 适合建立一个问题再阅读；重点作品占用空间较大 |
| `console` 工作中的秩序 | 紧凑标题与筛选；项目行配当前项目侧栏 | 适合反复查找、操作；情绪铺陈少 |
| `gallery` 有棱角的档案 | 海报式大字；青蓝朱红、大编号与错位网格 | 适合作品集与探索；详细说明需打开卡片 |

小于720px的预览容器会真正改变布局，不缩放整个桌面：编辑版变顺序目录；工具台当前项目放到行列表前；画廊变顺序海报。工作台的“窄屏预览”将内容容器限制为420px。实际手机仍须用最终设备尺寸检查。

## 已接通的交互

- 修改标题、搜索、领域选择、只看收藏；无结果时清除筛选。
- 收藏与取消收藏；切换三种方向后仍保留输入、当前项目和收藏。
- 打开研究卡片、关闭弹窗并回到来源按钮；Escape关闭，点击弹窗外关闭。
- 窄屏预览、减少动态效果；系统 `prefers-reduced-motion` 也生效。
- 导出设计 JSON、设计变量 CSS、制作约定 TXT；复制提示词失败时保留选中文本与下载路径。

状态只保存在本页面内存，刷新后恢复默认值。标题和搜索文本通过 `textContent/value` 进入 DOM；不把用户输入拼进 HTML。原型没有后台、账号、请求、异步加载或付款功能，不应增加假的在线状态掩盖这些边界。

## 验证

`node scripts/test_web_aesthetic.mjs` 覆盖复合搜索、收藏归一、候选切换保留状态、导出隔离、颜色文本对比与变量一致性。它不证明页面美感、响应式或键盘交互正确；浏览器检查由主任务单独记录。

在自己的工程复用时，先替换固定项目数据和目标任务，再决定三种结构中的哪一种合适。参考的真实观察与独立归纳见 [研究](../../studies/jiangou-ui.md)，选法见 [指南](../../guides/web-aesthetic-direction.md)。
