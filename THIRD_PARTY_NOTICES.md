# 第三方组件

本仓库自己的扩展、脚本和文档采用 [MIT](LICENSE)。其他项目仍遵循各自的许可；本项目不代表 Zotero、OpenAI 或以下插件作者。

内置 **highlight.js 11.11.1**，作者 Ivan Sagalaev 及贡献者，采用 BSD-3-Clause。完整许可保留在 [vendor/highlight-LICENSE](src/reading-thoughts/vendor/highlight-LICENSE)，发布的 XPI 也包含该文件。来源为官方 [highlight.js](https://github.com/highlightjs/highlight.js/tree/11.11.1) 与 [cdn-release](https://github.com/highlightjs/cdn-release/tree/11.11.1/build)。包含 common 构建及 matlab、julia、powershell、cmake、protobuf、dockerfile 语法。运行时不从 CDN 加载代码。

准备脚本从各作者发布地址下载下列扩展，不修改、不将这些扩展的二进制或源码纳入本仓库的发行包。版本、地址和 SHA256 见 [dependencies.lock.json](dependencies.lock.json)。

| 项目 | 作者/项目 | 用途 |
| --- | --- | --- |
| LLM for Zotero | [yilewang/llm-for-zotero](https://github.com/yilewang/llm-for-zotero) | AI 对话、Codex App Server、选文上下文 |
| Translate for Zotero | [windingwind/zotero-pdf-translate](https://github.com/windingwind/zotero-pdf-translate) | 翻译面板和服务配置 |
| Better Notes（可选） | [windingwind/zotero-better-notes](https://github.com/windingwind/zotero-better-notes) | 笔记增强 |
| Ethereal Style（可选） | [MuiseDestiny/zotero-style](https://github.com/MuiseDestiny/zotero-style) | 批注颜色名称与界面增强 |
