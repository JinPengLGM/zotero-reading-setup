# 故障排查

## 准备脚本没有运行 / 下载失败

完整解压 ZIP 后再双击，不要在压缩文件预览窗口内运行。可以在文件夹里打开 PowerShell 执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare.ps1 -IncludeOptional -NoOpen
```

脚本不修改全局代理。GitHub/Gitee 无法访问时，先确认本机网络可访问依赖锁文件列出的官方地址。也可用浏览器下载这些文件，按锁文件中的 `file` 名保存到 `dist`，然后重试。校验成功的缓存不会重复下载。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare.ps1 -IncludeOptional -Offline -NoOpen
```

SHA256 不一致时脚本停止使用该文件，不会安装。检查下载是否被替换为登录页或错误页。不要直接删除校验逻辑；如作者替换了发布包，应由维护者复核版本、来源和校验值后更新锁文件。

## 插件不兼容 / 菜单没出现

当前扩展清单只允许 Zotero 10。确认三个核心插件均已启用，重启后再打开阅读器。不要强行修改 Zotero 11 的兼容标志。本项目没有验证 Zotero 11 的内部接口。

若先装了阅读随想、后装依赖，或 LLM 仍然堆叠显示，请使用 **工具 → 阅读配置预设 → 应用共享阅读配置** 后重启。此操作会重新应用清单中的 UI 值，但不会更改密钥或本机路径。

## `codex --version` 找不到命令

安装 Windows 本机 Codex CLI，关闭并新开 PowerShell，再运行 `Get-Command codex` 与 `codex --version`。确认 LLM 设置没有指向别人的用户目录或已删除的桌面应用版本目录。桌面程序与 npm/winget CLI 是不同的安装来源，使用实际存在且能运行的那个程序。

## `Failed to spawn codex app-server`

在 LLM 的 Agent 设置检查可执行文件路径。阅读随想只自动修复一种旧桌面目录失效情况；若 CLI 从未安装、路径指向其他程序或运行被系统阻止，需要使用者在本机处理。不要导入作者旧机器的路径。

## `missing required tools: task_update`

先确认正在使用锁定的 LLM **3.9.17**，关闭旧 Codex 会话，重启 Zotero 后新建会话并重新测试连接。本仓库不分发早期 3.9.10.1 临时补丁，不应把该旧补丁覆盖到新版本。仍失败时记录 Zotero、LLM 和 `codex --version`，向上游提供去除 token、路径和文献内容的错误信息。

## 翻译慢 / 显示思考 / 没有内容

观察右侧状态与耗时。停止按钮可取消当前任务，重试重新请求；Google 快译会主动改用 Google 处理这一段选文。Google 可用性取决于网络；网关的排队、thinking 与限流会影响 DeepSeek 速度，关闭 thinking 参数不保证网关遵守。

模型名必须由你的服务提供商支持。基线网关使用 `deepseek-flash`；其他端点可能要求别的名称。空结果、输出截断、429 和超时都会显示错误，不能把它们当作成功译文。

## 添加到对话失败

先打开当前文档右侧 LLM 面板，确认面板已经初始化，再重新选文并按 Alt+Q。已有引用达到上游插件限制时，先删除部分引用。引用选文只添加上下文，不会自动向模型发送消息。

## 写代码后没有保存

使用 **文件 → 新建代码文档…**，输入有效文件名与非空代码，再点击“创建并阅读”或 Ctrl+Enter。文件名不能包含目录、Windows 保留名称或非法字符。单文件限制为 2 MiB / 20,000 行。创建失败时不要关闭窗口，先复制保留草稿，检查当前文库和附件是否可写。

## 复制正文仍有行号 / 数字疑似被过滤

行号过滤只对可靠识别的页边连续数字生效。扫描 PDF、字体混乱或非连续编号可能无法识别。用 **工具 → 复制时忽略稿件行号** 开关对照检查；该功能不改原 PDF。反馈问题时使用可公开的最小示例，不上传未发表论文。
