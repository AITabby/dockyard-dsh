# Dockyard DSH

**A native account-pool and provider plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).**

[中文](#中文) · [English](#english)

> Developer preview · 插件版本 **0.1.21** · macOS 与 Windows 均已验证 · Provider 逻辑全部留在各 provider 模块里

---

## 中文

### 这是什么

Dockyard DSH 把多个官方 OAuth 授权和官方客户端会话接入 DeepSeek Harness，提供**一个共享的账号池、模型目录、额度视图和 provider-native 请求链路**。它是 DSH 的原生 bundle/plugin：不需要另起代理网关，也不把 provider 逻辑写进 DSH 核心。

### 支持的 provider

| Provider | 账号来源 | 请求链路 |
|---|---|---|
| **Codex** | 官方浏览器 OAuth（loopback PKCE），CLI 作为兼容 fallback | 原生 Responses |
| **Antigravity** | Google 官方浏览器 OAuth，**沿用官方客户端身份**（免费档位可用）；每个账号独立 refresh token | 原生 Gemini SSE |
| **Grok** | xAI 官方浏览器 OAuth，CLI fallback | 原生流式；额度取官方 credits |
| **Claude** | 官方浏览器 OAuth，支持带 `state` 的手动回调地址 | 原生请求适配 |
| **Cursor** | 官方登录轮询（`loginDeepControl` + `/auth/poll`） | 原生请求适配 |
| **WorkBuddy** | **仅 macOS**：读取官方桌面端已保存的会话。没有授权页，也没有可填写的 Key | 官方端点原生流式 |
| **Command Code** | 本地认证文件，或在面板里粘贴 API Key | 官方网关，原生流式 + tool calling |
| **Hermes** | 本地会话文件，或在面板里粘贴 API Key | 原生流式 |
| **OpenRouter Free** | 从 DSH 凭据或环境变量发现 API Key | 官方端点，`:free` 目录动态拉取 |

官方客户端、CLI 或 OAuth 源缺失时，Dockyard 明确返回 `unavailable` / `degraded`；**不会用硬编码的账号、模型、版本、套餐或额度伪造可用结果**。

> OpenCode 与 Kilo 在早期版本里出现过，现已移出插件：两者的免费额度不对第三方客户端开放（OpenCode 的免费档位只认官方客户端身份），留着只会给出不可用的假象。

### 关键能力

- **统一账号池**：五种策略——手动选择、会话粘性、轮询、故障转移、**额度最充足优先**（按各账号最紧窗口的剩余比例选号，无额度数据时回落轮询）。
- **失效账号不丢弃**：授权过期后进入冷却（默认 30 分钟），冷却结束自动重试刷新，成功即重新进入可用池。
- **按账号的模型目录**：Antigravity 等 provider 的模型表随账号不同（同一 provider 的付费档和免费档看到的模型就不一样），目录按账号分别缓存与展示。
- **额度是活的**：窗口剩余 ≤15% 时提示偏低；**6 小时内要重置却还剩 ≥50%** 时提醒（这条最容易白白浪费）；provider 上报余额时一并显示。
- **面板不打扰**：模型列表默认折叠、点开才读取一次；后台只静默刷新额度数字，不把面板切成加载态。
- 所有命令、模型选择和生成共用同一个 runtime，不存在第二套账号池或额度缓存。

### 平台支持

| | macOS | Windows |
|---|---|---|
| 浏览器 OAuth（Codex / Antigravity / Grok / Claude / Cursor） | ✅ | ✅ 同一套 loopback 链路 |
| 凭据存储 | macOS Keychain + Swift helper | 宿主 DSH 的 Credentials 服务 |
| CLI fallback | ✅ | ✅ 解析 `.cmd` shim 并经 `%ComSpec%` 启动，停止时 `taskkill` 清理进程树 |
| 本机会话扫描 | ✅ | ❌ 按不可用降级，请改用浏览器 OAuth |
| WorkBuddy | ✅ | ❌ 只能读 macOS 桌面端会话 |

Windows 上如果宿主 DSH 没有 Credentials 服务，插件会**明确报错**，不会静默丢登录态。

### 安装

#### 方式一：插件市场索引（DSH v0.2.1+）

设置 → **插件** → **发现** → **管理索引源…**，添加：

```
https://raw.githubusercontent.com/AITabby/dockyard-dsh/main/market/index.json
```

在列表里找到 **Dockyard DSH** 点安装即可。

#### 方式二：一条命令

已有 DSH CLI 和 pnpm 时：

```sh
dsh plugin --profile web add github:AITabby/dockyard-dsh
dsh web
```

默认地址 `http://127.0.0.1:3080`。仓库已提交构建产物（`dist/index.mjs`、`lib/client.js`），安装时不执行 `prepare`，装完重启 DSH Web 即可。

要固定版本就 pin 到已验证的 commit：

```sh
dsh plugin --profile web add github:AITabby/dockyard-dsh#<commit-sha>
```

> **pnpm 10+ 的拦截**：传递依赖 `@google/genai` 与 `protobufjs` 带构建脚本，默认被拦，首次安装可能以 `ERR_PNPM_IGNORED_BUILDS` 结束且不会进入 profile 的 bundle 列表。处理方式二选一：
>
> - GUI 安装时按提示点 **Allow these scripts and retry**；
> - 命令行安装时先在 profile 的 `pnpm-workspace.yaml` 写入，再重跑命令：
>
> ```yaml
> allowBuilds:
>   '@google/genai': true
>   protobufjs: true
> ```

#### 方式三：克隆后安装（需要改代码时）

```sh
git clone https://github.com/AITabby/dockyard-dsh.git
cd dockyard-dsh
npm install
npm run build            # 改了 source 或产物过期时才需要
dsh plugin --profile web add .
dsh web
```

隔离测试、不影响默认 DSH home：

```sh
DSH_HOME=/tmp/dockyard-dsh-home dsh plugin --profile web add .
DSH_HOME=/tmp/dockyard-dsh-home dsh web
```

#### 可选：独立应用

不想自己装 Node.js / pnpm / DSH 时，[Releases](https://github.com/AITabby/dockyard-dsh/releases) 页面提供自带完整运行时的 macOS DMG 和 Windows EXE。**注意这些是较早版本的打包产物，可能落后于仓库里的插件版本**；需要最新功能请用上面三种方式之一。

### 在 DSH 里使用

```text
/dockyard status
/dockyard scan [provider]
/dockyard add [provider] [candidateId]
/dockyard login <provider>
/dockyard refresh [provider]
/dockyard models <provider>
/dockyard policy <provider> <manual|sticky_session|round_robin|failover|allowance_fullest> [accountId]
/dockyard use <provider> <accountId>
/dockyard remove <provider> <accountId>
```

- **加新账号**：`/dockyard login <provider>` 直接打开官方浏览器授权页。
- **导入已有登录态**：先 `/dockyard scan <provider>`，再 `/dockyard add <provider>`。扫描和新增是两个独立操作，已有账号不会被"新增"静默重复导入。

### Antigravity 说明

它是目前最需要解释的一个：

- 授权走 Google 官方浏览器 OAuth，用的是**官方客户端自己的 OAuth client**。client id 是公开标识，client secret 在首次授权时**从本机已安装的官方客户端或 `agy` 二进制里读取**并缓存在本地，仓库内不保存任何凭据。
- 想覆盖的话可以设置 `DOCKYARD_ANTIGRAVITY_CLIENT_ID` / `DOCKYARD_ANTIGRAVITY_CLIENT_SECRET`，自有 client 优先生效。
- 账号拿到的 Code Assist 项目由插件按官方客户端的流程自动解析，必要时自动开通；**不需要你自己准备 Google Cloud 项目**。
- 每个账号有独立的 refresh token 和独立的模型目录，因此可以多账号共存、切换、轮询。
- 授权全程不调用 `agy`，所以不会触发 macOS 那个"找不到钥匙串"的系统弹窗。

### 凭据与安全

- 原始 OAuth token / secret 不进入 Git、账号池快照或页面状态；运行时只传递 opaque credential reference。
- refresh token 存在安全凭据存储里，重启后自动续期；只有 provider 撤销或改变协议时才需要重新授权。
- macOS 默认 Keychain；Windows 走宿主 Credentials 服务。宿主没有该服务时 fail closed，不退回不安全的内存存储。
- 额度、模型、套餐、身份、过期时间都来自 provider 的实时结果；provider 不返回就保持 `unknown`/`null`。
- 提 issue 前请读 [`SECURITY.md`](SECURITY.md)，不要提交 token、OAuth 文件、Keychain 值或含敏感信息的日志。

### 开发

```sh
npm install
npm test
npm run build          # 重建 host bundle 与 client bundle
npm pack --dry-run
```

发布包的关键内容：

```text
packages/dsh-plugin/dist/index.mjs    # Node/host bundle
packages/dsh-plugin/lib/client.js     # 浏览器 client bundle
packages/dsh-plugin/cordis.patch.yml  # DSH bundle 层
```

改动 provider source 后必须重新 `npm run build` 并一起提交产物。

### 项目结构

```text
packages/core/          模块生命周期、契约、事件、DSH route
packages/account-pool/  账号发现、选择策略、健康与冷却、credential reference
packages/runtime/       共享的 Dockyard runtime
packages/dsh-bridge/    DSH 注入桥与 LLM adapter
packages/dsh-plugin/    DSH bundle、命令、面板 UI
packages/vault/         macOS Keychain 后端
modules/provider-*/     各 provider 自己的 OAuth、目录、额度和 native transport
tests/                  安全、生命周期、provider 与 runtime 测试
```

核心原则：**provider 特定逻辑留在 provider module，账号选择留在 runtime，host 只消费稳定契约。** 不要在 host 里加 provider 特判，也不要把动态 provider 数据写成常量。

### 已知限制

- DSH 本身仍是 developer preview，上游可能有 breaking changes。
- provider 的 CLI、客户端路径、OAuth 返回字段和额度接口都可能变；缺失字段保持未知，不做猜测。
- 浏览器多账号依赖 provider 官方授权页与 token response；对方改了流程就需要重新验证，而不是猜协议。
- Windows 上的本机会话扫描与 WorkBuddy 不可用。
- **首字延迟主要不在插件**：实测直连上游首包约 2.8s，经插件约 2.6s（预热后几乎不额外增加）。界面上更长的等待通常来自 DSH 侧的上下文组装，以及切换模型后该模型的提示缓存需要重建；长会话定期开新会话、减少切换模型都能明显改善。

---

## English

### What it is

Dockyard DSH connects official OAuth authorizations and official client sessions to one shared account pool, model catalog, quota view, and provider-native request path inside DeepSeek Harness. It is a native DSH bundle/plugin: no side-car gateway, and no provider logic pushed into the DSH core.

### Supported providers

| Provider | Account source | Transport |
|---|---|---|
| **Codex** | Official browser OAuth (loopback PKCE); CLI as compatibility fallback | Native Responses |
| **Antigravity** | Google browser OAuth using the **official client identity** (so the free tier works); one refresh token per account | Native Gemini SSE |
| **Grok** | xAI browser OAuth, CLI fallback | Native streaming; quota from official credits |
| **Claude** | Official browser OAuth, plus state-bound manual callback entry | Native request adapter |
| **Cursor** | Official login polling (`loginDeepControl` + `/auth/poll`) | Native request adapter |
| **WorkBuddy** | **macOS only**: reads the session the official desktop client stored. No OAuth page, no key field | Official streaming |
| **Command Code** | Local auth file, or paste an API key in the panel | Official gateway, streaming with tool calling |
| **Hermes** | Local session file, or paste an API key in the panel | Native streaming |
| **OpenRouter Free** | Discovers an API key from DSH credentials or the environment | Official endpoint, live `:free` catalog |

When an official client, CLI, or OAuth source is missing, Dockyard reports an explicit `unavailable` / `degraded` state. It never invents accounts, models, versions, plans, or quota values.

> OpenCode and Kilo appeared in early builds and have been removed: neither free tier is open to third-party clients (OpenCode grants it to the official client identity only), so keeping them would only promise something unusable.

### What you get

- **One account pool, five policies**: manual, sticky session, round robin, failover, and **most allowance left** — which picks the account with the largest remaining share of its tightest window, falling back to round robin when nothing reports quota.
- **Expired accounts are parked, not dropped**: they get a cooldown (30 minutes by default) and are retried automatically, returning to the pool as soon as a refresh succeeds.
- **Per-account model catalogs**: providers such as Antigravity expose different models per account (a paid tier and a free tier see different lists), so discovery and caching are account-scoped.
- **Live quota awareness**: a window below 15% is flagged low, and a window that **resets within 6 hours while at least 50% unused** is flagged as about to be wasted. A reported balance is shown alongside.
- **A panel that stays out of the way**: the model list is collapsed and read once when opened; background polls refresh only the quota numbers instead of flipping the panel into a loading state.
- Commands, model selection, and generation all read the same runtime — there is no second pool or quota cache.

### Platform support

| | macOS | Windows |
|---|---|---|
| Browser OAuth (Codex / Antigravity / Grok / Claude / Cursor) | ✅ | ✅ same loopback flow |
| Credential storage | macOS Keychain + Swift helper | Host DSH Credentials service |
| CLI fallback | ✅ | ✅ resolves `.cmd` shims through `%ComSpec%`, stops the tree with `taskkill` |
| Local session scanning | ✅ | ❌ degrades to unavailable; use browser OAuth |
| WorkBuddy | ✅ | ❌ it can only read a macOS desktop session |

On Windows, a host without the Credentials service produces a clear error rather than silently dropping the login.

### Install

#### Option 1: marketplace index (DSH v0.2.1+)

Settings → **Plugins** → **Discover** → **Manage index sources…**, add:

```
https://raw.githubusercontent.com/AITabby/dockyard-dsh/main/market/index.json
```

Then find **Dockyard DSH** and install.

#### Option 2: one command

With the DSH CLI and pnpm already installed:

```sh
dsh plugin --profile web add github:AITabby/dockyard-dsh
dsh web
```

The default URL is `http://127.0.0.1:3080`. The runnable bundles are committed, so nothing is built at install time; restart DSH Web afterwards.

Pin a verified commit for a reproducible install:

```sh
dsh plugin --profile web add github:AITabby/dockyard-dsh#<commit-sha>
```

> **pnpm 10+ blocks build scripts.** The transitive dependencies `@google/genai` and `protobufjs` ship them, so a first install can end with `ERR_PNPM_IGNORED_BUILDS` without registering the bundle. Either click **Allow these scripts and retry** in the GUI, or add them to the profile's `pnpm-workspace.yaml` first:
>
> ```yaml
> allowBuilds:
>   '@google/genai': true
>   protobufjs: true
> ```

#### Option 3: clone and install (when you need changes)

```sh
git clone https://github.com/AITabby/dockyard-dsh.git
cd dockyard-dsh
npm install
npm run build            # only after source or bundle changes
dsh plugin --profile web add .
dsh web
```

Isolated install that leaves your default DSH home alone:

```sh
DSH_HOME=/tmp/dockyard-dsh-home dsh plugin --profile web add .
DSH_HOME=/tmp/dockyard-dsh-home dsh web
```

#### Optional: standalone app

[Releases](https://github.com/AITabby/dockyard-dsh/releases) carries a self-contained macOS DMG and a Windows EXE. **Those are older packaging builds and may lag the plugin version in this repository**; use one of the three options above for the current code.

### Using it in DSH

```text
/dockyard status
/dockyard scan [provider]
/dockyard add [provider] [candidateId]
/dockyard login <provider>
/dockyard refresh [provider]
/dockyard models <provider>
/dockyard policy <provider> <manual|sticky_session|round_robin|failover|allowance_fullest> [accountId]
/dockyard use <provider> <accountId>
/dockyard remove <provider> <accountId>
```

- **Add an account**: `/dockyard login <provider>` opens the official browser authorization page.
- **Import an existing login**: `/dockyard scan <provider>` then `/dockyard add <provider>`. Scanning and adding are separate, so an existing account is never silently re-imported.

### About Antigravity

- Authorization uses Google browser OAuth with the **OAuth client the official build ships**. The client id is a public identifier; the matching secret is read at first authorization from the official client or `agy` binary installed on the machine and cached locally. The repository stores no credentials.
- `DOCKYARD_ANTIGRAVITY_CLIENT_ID` / `DOCKYARD_ANTIGRAVITY_CLIENT_SECRET` override it with your own client.
- The Code Assist project is resolved the way the official client does it, and provisioned when the account has none — **you do not need to prepare a Google Cloud project**.
- Each account keeps its own refresh token and its own model catalog, so several accounts can coexist, be switched, and be rotated.
- Authorization never invokes `agy`, which is why the macOS "keychain not found" dialog no longer appears.

### Credentials and security

- Raw OAuth tokens and secrets are not stored in Git, account-pool snapshots, or page state; the runtime passes opaque credential references.
- Refresh tokens live in secure credential storage and renew access tokens after a restart; only provider revocation or protocol changes require reauthorization.
- macOS uses the Keychain; Windows delegates to the host Credentials service. Without that service the plugin fails closed instead of falling back to an unsafe in-memory store.
- Models, plans, quotas, identities, and expiry come from live provider responses; missing values stay `unknown`/`null`.
- Read [`SECURITY.md`](SECURITY.md) before filing issues. Never commit tokens, OAuth files, Keychain values, or sensitive logs.

### Development

```sh
npm install
npm test
npm run build          # rebuild the host and client bundles
npm pack --dry-run
```

Distributable entry points:

```text
packages/dsh-plugin/dist/index.mjs    # Node/host bundle
packages/dsh-plugin/lib/client.js     # browser client bundle
packages/dsh-plugin/cordis.patch.yml  # DSH bundle layer
```

After changing provider source, run `npm run build` and commit the refreshed artifacts with the change.

### Project layout

```text
packages/core/          lifecycle, contracts, events, DSH routes
packages/account-pool/  account discovery, selection policies, health and cooldown, references
packages/runtime/       the shared Dockyard runtime
packages/dsh-bridge/    DSH injection bridge and LLM adapter
packages/dsh-plugin/    DSH bundle, commands, and the panel UI
packages/vault/         macOS Keychain backend
modules/provider-*/     provider OAuth, catalog, quota, and native transport
tests/                  security, lifecycle, provider, and runtime tests
```

The rule is simple: provider-specific logic stays in provider modules, account selection stays in the runtime, and hosts consume stable contracts. Do not add provider-specific branches to a host or hard-code dynamic provider data.

### Known limitations

- DeepSeek Harness is still a developer preview and may introduce breaking changes.
- Provider CLIs, desktop paths, OAuth fields, and quota APIs can change; missing fields stay unknown rather than guessed.
- Multi-account browser flows depend on each provider's official authorization page and token response; a changed flow has to be re-verified, not guessed.
- On Windows, local session scanning and WorkBuddy are unavailable.
- **Time to first token is mostly not the plugin**: a direct upstream call starts streaming in about 2.8s, and through the plugin in about 2.6s once warm. Longer waits in the UI usually come from DSH assembling the context, plus the prompt cache being rebuilt after a model switch; starting a fresh session and switching models less often both help.
