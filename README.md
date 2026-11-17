# Zotero 阅读配置 · Zotero Reading Setup

[下载配置包](https://github.com/JinPengLGM/zotero-reading-setup/releases/download/v1.1.0/zotero-reading-setup-1.1.0.zip) · [安装教程](docs/INSTALL.md) · [版本发布](https://github.com/JinPengLGM/zotero-reading-setup/releases) · [故障排查](docs/TROUBLESHOOTING.md)

把 Zotero 配成一个可以精读论文、写思路、引用选文与 AI 对话、按需翻译和阅读代码的工作台。

这是从日常使用配置中整理出的可复现版本：**源码 + 版本锁定 + 安装准备脚本 + 自动配置预设**。使用者登录自己的 Codex 账号、填写自己的翻译 API，即可复制同样的阅读工作流。

**已验证平台：Windows / Zotero 10。** 阅读功能基线为 10.0.7；共享预设在 10.0.8 完成原生验证（2026-11-17）。扩展依赖 Zotero 10 的内部阅读器接口；Zotero 7/8/9/11、macOS、Linux 尚未验证，不能保证直接可用。

## 最快开始

1. 从本仓库 **Releases** 下载 `zotero-reading-setup-1.1.0.zip` 并完整解压。也可点 **Code → Download ZIP** 下载源码，操作相同。
2. 双击 **`Start-Full.cmd`**，准备完整的 5 个插件；只需要阅读、AI、翻译、代码功能时，双击 **`Start-Here.cmd`**，只准备 3 个核心插件。脚本会构建阅读随想、从作者官方地址下载其他插件，并验证 SHA256；不需要 Git、Node.js、Python 或管理员权限。
3. 在 Zotero 打开 **工具 → 插件**，按 `01 → 02 → 03` 顺序安装 `dist` 内的核心 `.xpi`；完整配置再安装 `04` 和 `05`。可把文件拖进插件窗口，或使用齿轮菜单的“从文件安装插件”。然后重启 Zotero。
4. 首次启动会应用共享预设，并备份被修改的设置。在 LLM 插件的 Agent 设置页测试 Codex 连接；使用者需登录自己的 Codex 账号，见 [安装指南](docs/INSTALL.md)。翻译默认选择 Google，DeepSeek 是可选配置。
5. 打开文档，选中文字，按 **Alt+Q**。

本项目复制阅读体验与设置，不复制账号授权、订阅额度、文献库、同步账号或聊天记录。安装准备脚本只在当前文件夹生成文件；配置由阅读随想在 Zotero 内首次启动时应用。

## 可以做什么

| 使用方式 | 效果 |
| --- | --- |
| 选文 → **Alt+Q** | 手动展开选区菜单；选中文字时不自动弹框；Esc 收起 |
| **写思路** | 原文加紫色下划线，在旁边写 Zotero 原生批注，随输入保存 |
| **添加到对话** | 把选文与页码加入右侧 AI 上下文，聚焦提问框；不会自动发送问题 |
| **翻译** | 仅点击后请求翻译；译文显示在独立的右侧翻译面板 |
| 翻译状态栏 | 显示连接、等待、思考、输出、完成、耗时；可停止、重试或使用 Google 快译 |
| **文件 → 新建代码文档…** | 输入 `.py`、`.cpp`、`.c++` 等文件名，粘贴代码，创建并打开阅读版 |
| **文件 → 导入代码阅读…** | 导入已有源码，生成离线语法高亮、行号、目录和可批注阅读文档，同时保留源码 |
| 复制带审稿行号的 PDF | 按页面边缘位置识别连续行号并过滤，保留正文年份、百分比与引用 |

阅读器右侧只显示 LLM 与翻译入口，两者采用独立侧栏布局。翻译面板隐藏“自动翻译、拼接模式、复制原文/结果”等底部控制组；界面参数可在 Zotero 设置中调整。侧栏样式内置在扩展中，不需要复制 `userChrome.css` 或开启旧版样式开关。

代码阅读内置 highlight.js 的 42 个语法模块，覆盖 Python、C/C++/CUDA、JS/TS、Java、Rust、Go、R、MATLAB、Julia、Shell、PowerShell、SQL 等。只展示源码，不执行代码；每个文件最多 2 MiB / 20,000 行。

## 组成与版本

| 插件 | 版本 | 用途 |
| --- | --- | --- |
| 阅读随想（本仓库） | **1.1.0** | 阅读交互、翻译反馈、代码阅读、行号过滤、配置预设 |
| LLM for Zotero | **3.9.17** | AI 对话与 Codex App Server |
| Translate for Zotero | **2.4.8** | 右侧翻译面板、Google / DeepSeek 配置 |
| Better Notes（可选） | **3.3.5** | 笔记增强 |
| Ethereal Style（可选） | **6.0.110** | 批注颜色名称与界面增强 |

版本和校验值锁定在 [dependencies.lock.json](dependencies.lock.json)。其中 Style 使用固定的上游提交地址，避免 `master` 更新后下载到其他版本。上游插件可自动更新，更新后应重新检查兼容性；需要维持基线时，可在 Zotero 插件管理器关闭对应插件的自动更新。

## 配置与恢复

- 精确预设见 [preset-config.json](src/reading-thoughts/preset-config.json)：独立侧栏、字体、行距、Google 默认翻译、DeepSeek 模型名、Codex 模式和批注颜色。
- **工具 → 阅读配置预设 → 应用共享阅读配置**：重新应用预设。
- **工具 → 阅读配置预设 → 恢复应用前的设置**：恢复第一次应用前的这些设置，然后重启 Zotero。
- 卸载扩展不会删除原生批注、源码附件与已经生成的代码阅读文档。要恢复设置，请先使用恢复菜单，再停用或卸载。

个人 API 密钥和端点不在预设内；配置预设不会覆盖它们。Codex 路径在每台机器上自行检测，已有有效路径保留。[配置说明](docs/CONFIGURATION.md) · [故障排查](docs/TROUBLESHOOTING.md)

## 开发与验证

零 npm 依赖。开发测试需要 Node.js 20+；Windows 构建仅用系统 PowerShell / .NET：

```powershell
npm run check
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare.ps1 -IncludeOptional -NoOpen
```

维护者在 Git checkout 中执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package.ps1` 可生成发布 ZIP、XPI 和 SHA256 清单；ZIP 仅包含本仓库文件与阅读随想，不再分发上游插件二进制。

测试覆盖翻译流、分段、取消、缓存、错误状态、缺失 Codex 路径修复、代码内容保真、HTML 转义、稿件行号识别及配置的备份/恢复。源码的原生阅读交互已在基线机器上实际使用；自动测试不等于对所有操作系统和 Zotero 版本的兼容保证。详细范围见 [验证记录](docs/VALIDATION.md)。

首次共享版由本地 1.0.14 整理而来；1.1.0 新增可复现安装与可恢复预设。见 [CHANGELOG](CHANGELOG.md)。

## 隐私与许可

仓库不包含个人文献、PDF、笔记、密钥、Codex 凭据或量化学习计划。运行时，主动触发翻译会向所选翻译服务发送选文；AI 功能遵循 LLM 插件与 Codex 的数据流程。使用自己的服务与额度。

本项目代码采用 [MIT](LICENSE)；内置 highlight.js 为 BSD-3-Clause，其他插件遵循各自许可。感谢所有上游作者，详见 [第三方说明](THIRD_PARTY_NOTICES.md)。
