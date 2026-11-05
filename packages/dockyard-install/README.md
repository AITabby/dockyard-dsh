# @dockyard-dsh/install

One-command installer for Dockyard DSH.

> **Not published to npm yet.** `@dockyard-dsh/install` returns 404 on the
> registry, so this installer cannot be used today. Install the plugin with
> DSH's own command instead:
>
> ```sh
> dsh plugin --profile web add github:AITabby/dockyard-dsh
> ```

## What it does once published

It checks for `dsh` and `pnpm`, installs the verified DSH runtime when `dsh` is
missing, then installs the prebuilt `@dockyard-dsh/plugin` package into the
`web` profile. Restart the running DSH Web profile afterwards so its bundle
layer is loaded.

The plugin runs on macOS and Windows and requires Node.js 22.19+ on the 22.x
line, or Node.js 24+.
