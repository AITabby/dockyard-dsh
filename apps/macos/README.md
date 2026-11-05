# Dockyard DSH macOS app

This directory builds a self-contained universal macOS app and DMG around the existing DSH Web profile. Users of the resulting DMG do not need to install Node.js, pnpm, or DSH separately.

## Build

Run from the repository root on macOS:

```sh
./apps/macos/build-dmg.sh
```

The build downloads and embeds:

- Node.js `22.19.0` for both `darwin-arm64` and `darwin-x64`;
- `@deepseek-ai/dsh@0.1.5-rc.2` and its runtime dependencies;
- the prebuilt Dockyard DSH plugin;
- a preassembled DSH `web` profile;
- the official DeepSeek favicon as the application icon.

Outputs are written to `dist/macos/`:

- `Dockyard DSH.app`
- `Dockyard-DSH-macos-universal.dmg`

The app launches the embedded DSH server on `127.0.0.1:3080` and displays it in a native WebKit window. OAuth authorization links are opened in the system default browser so provider account selection and callback handling work like the regular Web UI. `DOCKYARD_DSH_PORT` may be set for local testing when port 3080 is already occupied.

The current build is ad-hoc signed for local testing. Set `CODESIGN_IDENTITY` to a Developer ID identity for a distributable signed build, then notarize the resulting app/DMG through Apple.

## First-run data

User data is kept outside the app bundle under:

```text
~/Library/Application Support/Dockyard DSH/
```

The embedded DSH profile is copied there on first launch. Logs are written to its `Logs/` directory.

Provider OAuth still follows the provider's own authorization requirements.
Antigravity works out of the box: it authorizes with the OAuth client the
official Antigravity build ships, whose secret is read from that build on first
authorization and cached locally. `DOCKYARD_ANTIGRAVITY_CLIENT_ID` and
`DOCKYARD_ANTIGRAVITY_CLIENT_SECRET` override it when you want your own client;
no credential is embedded in the app or the repository.
