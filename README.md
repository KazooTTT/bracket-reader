# 括号法阅读助手 (BracketReader)

[![CI](https://github.com/KazooTTT/bracket-reader/actions/workflows/ci.yml/badge.svg)](https://github.com/KazooTTT/bracket-reader/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Install](https://img.shields.io/badge/install-Tampermonkey-green.svg)](https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js)

一个油猴脚本，把英文长难句里的**介词短语、从句、非谓语短语**括起来，露出主干。

灵感来自新东方网课的「括号法」——把所有修饰成分括掉，剩下的就是主干：

```
(After chatting) (with Laura) (on this matter) (for two hours), I returned (to my office).
                                                            └────── 主干 ──────┘
```

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey
2. 打开以下链接，Tampermonkey 会自动弹出安装界面：

   ```
   https://raw.githubusercontent.com/KazooTTT/bracket-reader/main/dist/bracket-reader.user.js
   ```

   或者下载 `dist/bracket-reader.user.js` 拖进浏览器窗口。

脚本带 `@updateURL`，之后有新版本 Tampermonkey 会自动检查更新。

## 用法

### 划词分析

选中一段英文 → 浮出「括号法」按钮 → 点击，右下角弹出面板。

### 全页自动标注

面板右上角点 **本站** → 当前网站所有段落自动加括号。

| 特性 | 说明 |
|---|---|
| 按域名独立 | 开关存在 localStorage，不会串到别的网站 |
| 视口优先 | 滚动时优先处理屏幕内的内容 |
| 动态内容 | MutationObserver 监听，无限滚动、SPA 路由都能跟上 |
| 一键还原 | 再点一次完全还原，DOM 恢复到标注前 |

左下角徽标显示进度：`括号法 42 段（队列 8）`。

## 两种模式

面板 ⚙ 里切换：

| 模式 | 主干准确率 | 速度 | 依赖 |
|---|---|---|---|
| **离线规则** | 简单句好，真实长难句 **40%** | 即时 | 无 |
| **AI 精修** | 实测 **10/10** | 2–30 秒/句 | 任意 OpenAI 兼容接口 |

> **关于 40%**：这是实测数字，不是保守估计。括号法要求每个修饰成分的**边界都对**，而长句通常有 5–8 个修饰成分。单类规则 75% 准确率，复合到整句就只剩 20–40%。要读真实长难句，用 AI 模式。

## AI 模式

默认走本地 [magpie](https://github.com/) 网关，也支持任何 OpenAI 兼容接口。

```
API URL : http://127.0.0.1:3425/v1
API Key : （本地网关留空）
Model   : group/deepseek-free
```

### ⚠️ 关掉思考模式

设置里的「关闭思考模式」**必须勾上**。实测对比：

| 参数 | 耗时 | 真的关掉了吗 |
|---|---|---|
| 不设 | 43s | — |
| `enable_thinking: false` | 42s | ❌ 无效 |
| `chat_template_kwargs: {thinking: false}` | 41s | ❌ 无效 |
| **`reasoning_effort: "none"`** | **2.1s** | ✅ |

脚本用的是最后一种。

### 并发

多句时会并发请求。实测本地网关：

| 并发 | 每句均摊 | 8 句总耗时 |
|---|---|---|
| 1（串行） | 9.6s | 76.5s |
| 3 | 3.8s | 30.7s |
| **5（默认）** | **2.3s** | **18.6s** |
| 8 | 1.6s | 13.0s |
| 12 | 2.1s | 16.7s |

并发 12 反而变慢，说明 8 附近是网关饱和点。默认 5 留有余量，可在 ⚙ 里调 1–16。

用固定延迟的 mock 端点验证过客户端实现本身：5 句 × 1.5s，串行 7.7s、并发 5 时 1.7s，加速 4.5 倍。

## 视觉约定

| 颜色 | 括号 | 类型 |
|---|---|---|
| 橙 | `( )` | 介词短语 |
| 蓝 | `[ ]` | 从句 |
| 紫 | `‹ ›` | 非谓语短语 |

样式规则：

- **括号内留 padding**，文字不贴括号
- **长片段（>60 字符）不上底色**，只留括号和淡色文字 —— 整段涂色反而比不标更难读
- **嵌套时内层不上底色**，避免颜色叠成一片；内层括号字重更细，用来和外面区分
- 半透明的表示规则引擎置信度低，建议用 AI 复核

面板底部显示**主干**。如果出现黄色的「N 句结构可疑」标签，说明那句主干不像完整小句，需要人工核对。

## 防幻觉

AI 返回的每个片段会被拼回去做**硬性重建校验**：必须和原句逐字符一致（空白归一化后）。不一致直接判定幻觉，回退到离线结果并提示。

这拦不住「边界划错但文字没丢」——比如模型把 `out that the gap` 全当成介词短语。那种情况只能靠主干可疑提示发现。

## 已知限制

- 离线规则在嵌套从句、并列结构、省略关系词的长句上不可靠
- AI 模式每句一次请求，全页标注会很慢（所以全页模式只用离线规则）
- 全页标注会修改 DOM，极少数网站（React 受控输入等）可能受影响

## 开发

```
├── content/engine.js    规则引擎（零依赖，Node 与浏览器通用）
├── src/app.js           油猴外壳（面板、LLM、全页标注）
├── build.js             内联 engine → dist/bracket-reader.user.js
├── test/
│   ├── run.js           基础用例
│   ├── holdout.js       泛化测试
│   ├── accuracy.js      真实长句准确率（人工标注 gold）
│   ├── bottleneck.js    瓶颈测量（span F1 / 主谓识别）
│   ├── harness.js       DOM 桩冒烟测试
│   └── e2e/
│       ├── accept.mjs          端到端验收（主流程）
│       ├── concurrency.mjs     并发实现验证（固定延迟 mock）
│       ├── sites-headless.mjs  真实站点冒烟（headless + MV3 扩展）
│       ├── mock-llm.mjs        可控假 LLM
│       └── extension/          模拟 Tampermonkey 的 MV3 扩展
└── dist/                构建产物（已提交，供 @updateURL 拉取）
```

```bash
npm run build           # 构建
npm test                # 单元测试
npm run test:accuracy   # 真实长难句准确率
npm run test:bottleneck # 瓶颈测量
npm run test:e2e        # 浏览器验收 + 并发验证（需先 build；无本地网关时自动跳过 AI 部分）
npm run test:sites      # 真实站点冒烟（headless + 扩展，覆盖 CSP 严格站点；需联网）
```

### 当前测试结果

```
基础用例      10/10
泛化用例      19/20
真实长句      8/20 主干完全正确（40%）
e2e 主流程     12/12
e2e 并发        5/5
真实站点        3/3（Wikipedia / MDN / GitHub）
```

## License

MIT
