# DSH integration

Dockyard DSH is a DSH-native plugin. The source entry is `packages/dsh-plugin/src/index.mjs`; the release entry is the bundled `packages/dsh-plugin/dist/index.mjs`. Both expose one shared `DockyardDshService` as `ctx.dockyard`, register the provider-neutral LLM adapter, and add the `/dockyard` human command through `ctx.commands`.

There is one source of truth inside the DSH process. The command service, model picker, and generation adapter all read the same runtime; none of them owns a second credential store, model list, quota cache, or account selector. A DSH stream goes through:

```text
DSH GenerateOptions
  -> Dockyard DSH adapter
  -> AccountPool policy
  -> provider module
  -> provider-native request transport (after browser OAuth import)
```

The native command surface is:

```text
/dockyard status
/dockyard scan [provider]
/dockyard add [provider] [candidateId]
/dockyard login <provider>
/dockyard refresh [provider]
/dockyard models <provider>
/dockyard policy <provider> <manual|sticky_session|round_robin|failover> [accountId]
/dockyard use <provider> <accountId>
/dockyard remove <provider> <accountId>
```

`/dockyard login` opens the provider's official browser authorization page and imports the completed account into the pool without requiring a local CLI. Codex, Antigravity, Grok, Claude, and Cursor use provider-verified browser flows; CLI/desktop/OAuth-file sources remain compatibility or scan fallbacks. Claude can request a manual authorization-code paste when its official hosted callback does not return to localhost. The GUI Login/Add action always starts a new browser flow, even when accounts already exist, instead of silently re-importing the active account. Use `/dockyard scan` plus `/dockyard add` only when importing an existing local session. Completed credentials are written to the host DSH Credentials service (the macOS Keychain is the fallback on darwin) and only opaque references reach the account pool or page state.

`/dockyard status` reports `quota.updatedAt` for quota freshness and separately reports OAuth token refresh fields. The background refresh interval is configurable with `DOCKYARD_DSH_REFRESH_INTERVAL_MS`.

The Codex module uses the locally imported OAuth account and the native Codex Responses transport when the DSH pi-ai dependencies are present. Antigravity exposes official session discovery, quota, credits, and live model catalog, while generation uses the provider's native Gemini `streamGenerateContent?alt=sse` transport. Claude, Cursor, and Grok use their provider-native streaming adapters. Cursor browser accounts resolve identity through Cursor's official AuthService and load the account model catalog through its official AvailableModels RPC; the CLI remains a compatibility fallback. Claude/Cursor quota is only shown when their official session status contains real windows; Grok's public provider surface currently has no dependable subscription quota JSON, so Dockyard leaves that field unknown.

Browser-imported accounts are stored as provider-owned official OAuth sessions with opaque credential references. Refresh tokens remain in secure storage so providers with refresh support can renew short-lived access tokens after a DSH/computer restart; provider revocation or protocol changes still require reauthorization. Scanning an existing desktop/CLI session is separate from browser Add, and an existing account never causes Add to re-import the current active session. Provider changes to OAuth endpoints or token fields are treated as unavailable/degraded until verified.

## Isolated local Web profile test

Do not change the normal DSH profile while testing. Install the local bundle into a temporary Web profile/home, then boot the actual Web runner:

```sh
DSH_HOME=/tmp/dockyard-dsh-home dsh plugin --profile web add "$PWD"   # 仓库根目录
DSH_HOME=/tmp/dockyard-dsh-home dsh --profile web --dump-config
DSH_HOME=/tmp/dockyard-dsh-home dsh web
```

The repository root and `packages/dsh-plugin` both expose the same `@dockyard-dsh/plugin@0.1.18` bundle. `npm run build:plugin` produces the self-contained Node entry and browser client bundle; `npm pack --dry-run` should show only the release entry, client bundle, patch file, and package metadata. GitHub/npm installs use the prebuilt entry or the package `prepare` script.
