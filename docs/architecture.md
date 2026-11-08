# Dockyard DSH architecture

## Non-negotiable rule

Dockyard DSH is a module runtime. Provider-specific logic must live in provider modules, and host applications must consume stable contracts rather than branching on provider names.

The core only owns:

- module lifecycle and service registration;
- typed event boundaries;
- account and quota data contracts;
- account-pool selection;
- DSH route injection contracts.

The core does not own provider versions, model catalogs, plan names, quota amounts, reset times, account identities, OAuth token values, or provider endpoints.

## Live data flow

```text
Provider OAuth / native app state
        |
        v
Provider module discovery
        |
        v
Official OAuth authorization -> secure credential reference
        |
        v
Live account metadata, quota, refresh state, catalog
        |
        v
AccountPool -> DSH provider route -> native provider invocation
```

Every provider response is allowed to be partial. Missing values stay `null` or `unknown`; the runtime never invents a quota, refresh time, model, or version.

## Module boundaries

### `dockyard-core`

Defines `ModuleRuntime`, `EventBus`, provider contracts, account contracts, and DSH route contracts.

### `dockyard-account-pool`

Stores account metadata without raw credentials, resolves `credentialRef` values through a secure provider-owned resolver, and applies manual, sticky-session, round-robin, failover, or most-allowance-left selection.

Selection happens in the runtime, not in the menu bar, so concurrent DSH sessions follow the same policy.

### Provider modules

The registered modules (see `packages/runtime/src/dockyard-runtime.mjs`) are `provider-codex` (id `openai-codex`), `provider-antigravity`, `provider-grok`, `provider-claude`, `provider-cursor`, `provider-commandcode`, `provider-hermes`, and `provider-openrouter-free`. `provider-opencode` and `provider-kilo` still exist and are validated by `scripts/build.mjs`, but they are no longer registered: neither free tier is open to third-party clients. Each module receives a provider driver for:

- OAuth discovery and provider-native official authorization;
- refresh and re-authentication;
- live quota and reset-time retrieval;
- live model/catalog retrieval;
- native request invocation.

The module manifest contains only stable technical identity and capabilities. It contains no provider version or account data.

### Host modules

The macOS menu bar is a host. It presents live state and sends commands, but it does not implement provider OAuth or account selection. A future CLI or web host can consume the same runtime services.

## Implemented surface

The first slice (Codex + Antigravity OAuth, `AccountPool` import, DSH route
mounting, and the macOS menu bar host) is long complete. The current runtime
registers nine provider modules (listed above); the DSH Web plugin is the
primary host and the macOS menu bar remains an optional host. The
`host consumes stable contracts` rule still applies: provider-specific
behavior belongs in each module's manifest/capabilities, not in host-side
`providerId === ...` branches. Security-relevant invariants (no embedded
OAuth client credentials, fail-closed credential storage when neither the host
Credentials service nor the macOS Keychain is available, HTTPS-only remote
endpoints) are enforced by `tests/security-regression.test.mjs` and
`tests/security.test.mjs`.
