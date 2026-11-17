# 配置边界

可共享配置源为 [preset-config.json](../src/reading-thoughts/preset-config.json)。它是人工选择的设置清单，不是个人资料目录导出。

| 类别 | 共享值 |
| --- | --- |
| 选文菜单 | Alt+Q 打开、Esc 关闭，由阅读随想实现 |
| LLM | `conversationSystem=codex`、启用 App Server、独立侧栏、字体缩放 110、行距 160 |
| Codex | 基线模型 `gpt-6.1-sol`、推理 `high`；使用者可按账号可用模型更改 |
| 翻译 | 默认 `googleapi`、目标简体中文、关闭自动翻译/词典/选区弹出翻译 |
| 翻译排版 | 字号 16、行高 1.7、隐藏底部自动翻译/拼接/复制控制组 |
| DeepSeek | 仅预置显示名、`deepseek-flash` 模型名、温度与 thinking 选项，不包含端点和密钥 |
| 稿件 | 默认启用连续边缘行号过滤 |
| Style | 论文精读颜色组与颜色名称显示；安装 Style 后生效 |

论文精读颜色：黄=关键结论，红=疑问与局限，绿=方法与实现，蓝=数据与证据，紫=我的想法，粉=相关工作，橙=术语与定义，灰=背景与待核。

未迁移：API keys、provider/model profile 对象、MCP bearer token、Codex 登录凭据、二进制绝对路径、聊天线程关联、Agent 权限、文库/分类/条目 ID、Better Notes 个人笔记同步关系、文件路径与文献内容。每位使用者自行配置这些内容。

预设首次应用前，在本机 `extensions.zotero.readingThoughts.setupBackup` 保存清单内设置原来的用户值和“原先没有用户值”的状态。恢复时会还原用户值，或清除对应覆盖值以回到插件默认值。重复应用不会覆盖第一次备份。备份不写入仓库或上传服务器。

其余设置保留插件自己的默认值。上游扩展自行管理的后台更新、账户登录、服务授权和缓存不由本项目打包。

## 实现说明

- 使用 Zotero 原生批注与附件存储；代码阅读版是本地 HTML 快照，使用 CSP 禁用外部资源与脚本。
- 原配置的 `userChrome.css` 侧栏规则已内置到扩展，只作用于阅读器；文库元数据面板仍可使用。无需启用 `toolkit.legacyUserProfileCustomizations.stylesheets`。
- 原始源码字节作为独立附件保留；阅读版按文本编码解码、统一换行并转义 HTML。超 30 万字符回退为无着色文本。
- 稿件行号识别使用 PDF 字符坐标、字号、字体和连续编号，按同一 PDF 复用可靠列模板，不按全局数字正则删除。非标准行号、图像扫描件和复杂表格可能无法可靠识别，可关闭开关核对。
- 翻译加速覆盖 Google 与自定义 GPT 1 中的 DeepSeek 模型。其他翻译服务仍由原插件处理。
- Google 分段约 4,000 字符，DeepSeek 约 2,000 字符，最多 2 段同时请求；无数据 20 秒或单段 60 秒时停止等待。缓存仅在内存中，不写入项目。
- Codex 路径修复只处理已经失效的 Windows `OpenAI/Codex/bin/<hash>/codex.exe` 路径；保留有效路径、自定义路径和留空自动检测。
- 阅读器 DOM 与私有 API 可能随 Zotero/上游插件更新而变化。遇到兼容问题时先回到锁定版本，再附不含文献与凭据的错误信息反馈。
