# 安装指南

## 1. 准备 Zotero

本配置面向 **Windows / Zotero 10**；阅读功能在 10.0.7 使用验证，共享预设在 10.0.8 完成原生验证。请先从 [Zotero 官网](https://www.zotero.org/download/) 安装兼容的 Zotero 10，再下载本仓库的 Release ZIP 或源码 ZIP 并完整解压。其他主版本尚未验证。

双击 `Start-Full.cmd` 准备全部 5 个插件，或双击 `Start-Here.cmd` 准备 3 个核心插件。PowerShell 的 ExecutionPolicy Bypass 只对这次准备进程生效，不会修改系统策略。准备脚本只在仓库的 `dist` 文件夹生成或下载文件，不会修改 Zotero 个人资料目录。

若公司策略禁止运行脚本，可分别从 [依赖锁文件](../dependencies.lock.json) 中的官方地址下载插件，并从本仓库 Release 下载阅读随想 XPI，按下一步安装。

## 2. 安装扩展

在 **工具 → 插件** 安装下面的文件（拖入插件窗口或使用“从文件安装插件”）：

1. `01-llm-for-zotero-3.9.17.xpi`
2. `02-translate-for-zotero-2.4.8.xpi`
3. `03-reading-thoughts-1.1.0.xpi`
4. `04-better-notes-3.3.5.xpi`（完整配置）
5. `05-zotero-style-6.0.110.xpi`（完整配置）

重启 Zotero。阅读随想第一次启动会应用预设。若分批安装后面板仍未更新，选择 **工具 → 阅读配置预设 → 应用共享阅读配置** 再重启。官方安装说明见 [Zotero Plugins](https://www.zotero.org/support/plugins)。

## 3. 使用自己的 Codex 订阅

推荐按 [LLM for Zotero 的 Codex 配置指南](https://github.com/yilewang/llm-for-zotero#codex-setup-chatgpt-plus-subscribers) 安装 Windows 本机 Codex CLI。在 PowerShell 中执行：

```powershell
winget install OpenAI.Codex
codex --version
codex login
```

已有 Node.js 的使用者也可按上游指南执行 `npm install -g @openai/codex`。安装后若当前终端找不到命令，请新开 PowerShell。若使用桌面应用内置程序，则在 LLM 设置中选择这台电脑实际存在的 `codex.exe`，不要复制别人的版本目录。

通过 **ChatGPT 登录** 使用自己的可用订阅，具体权限和限额由账号决定。ChatGPT 登录与 API key 登录属于不同的接入方式，见 [OpenAI 身份验证说明](https://learn.chatgpt.com/docs/auth)。不要导入他人的 `auth.json`。

进入 Zotero **设置 → llm-for-zotero → Agent**：

1. 确认 Codex App Server 集成启用；可执行文件路径留空让插件检测，或选择本机有效文件。
2. 点击测试连接。
3. 预设模型为 `gpt-6.1-sol`、推理强度 `high`。若账号没有该模型，改选测试连接返回的可用模型。
4. 打开 PDF，进入右侧 LLM 面板，确认对话系统为 Codex。

模型权限、批准方式和文库操作权限由使用者自行选择；预设不复制作者机器上的授权。此功能由上游 LLM 插件通过本地 `codex app-server` 提供，详见 [App Server 官方说明](https://learn.chatgpt.com/docs/app-server)。

## 4. 翻译

默认服务为 **Google API**（Translate 插件的 `googleapi` 服务，使用 Google 公共翻译接口，并非 Google Cloud 计费项目）。需要能访问该接口；此接口可用性和限流由服务决定。选文后 Alt+Q → 翻译，才开始请求。只选文、打开菜单不会发请求。

使用自己的 DeepSeek 或兼容网关时，在 **设置 → Translate for Zotero** 配置 **自定义 GPT 1 / Custom GPT 1**：

| 字段 | 填写内容 |
| --- | --- |
| 显示名称 | DeepSeek Flash |
| API 协议 | OpenAI 兼容 |
| Endpoint | 你自己的完整 `/v1/chat/completions` 地址 |
| API Key / Secret | 你自己的密钥，仅保存在本机插件配置中 |
| Model | 网关实际支持的模型；本配置基线使用 `deepseek-flash` |
| Stream | 开启 |
| Temperature | 0.2 |

`deepseek-flash` 是基线网关提供的模型名，不保证其他服务使用同一名称。本仓库不提供该网关、密钥、额度或模型权限。不要把它当成 DeepSeek 官方 API 必然支持的模型名。

配置后把翻译服务切换到 DeepSeek Flash。共享扩展会为 `customgpt1` 中以 `deepseek` 开头的模型启用流式反馈与分段。会发送关闭 thinking 的参数，但网关可能忽略它；如果状态显示“服务正在思考”，延迟来自该服务，客户端不能保证秒回。Google 快译需要主动点击，不会静默切换提供商。

## 5. 验证工作流

- 打开任意 PDF，选文后应保持安静；按 Alt+Q 才展开菜单。
- 点击“写思路”，输入批注；关闭再打开文档，批注仍在。
- 点击“添加到对话”，右侧出现选文引用；填写问题后才发送。
- 点击“翻译”，右侧显示翻译状态；检查停止与重试按钮。
- **文件 → 新建代码文档…**，命名 `hello.py` 或 `hello.c++`，粘贴 [示例代码](../examples)，点击“创建并阅读”或按 Ctrl+Enter。条目下应有原始源码和高亮阅读版两个附件。
- 对有连续边缘行号的稿件复制正文，确认边缘行号被滤掉，正文数字仍保留。识别不适用时，可用 **工具 → 复制时忽略稿件行号** 关闭。

## 升级与撤回

升级阅读随想时安装同一 ID 的新 XPI。首次预设只应用一次；升级不会反复覆盖自己后来调整的设置。本版使用保留的 `.invalid` HTTPS 更新地址占位，不提供自动更新服务，请通过 GitHub Release 手动升级。

撤回配置：先使用 **工具 → 阅读配置预设 → 恢复应用前的设置**，重启，再停用或卸载阅读随想。只恢复预设涉及的设置，不清除其他插件配置；已创建的原生批注与代码文档保留。
