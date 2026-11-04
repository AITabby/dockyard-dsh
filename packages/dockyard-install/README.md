# @dockyard-dsh/install

One-command installer for Dockyard DSH.

> **Not published to npm yet.** `@dockyard-dsh/install` returns 404 on the
> registry, so the command below does not work today. Until it is published,
> install the plugin with DSH's own command instead:
>
> ```sh
> dsh plugin --profile web add github:AITabby/dockyard-dsh
> ```

```sh
npx -y @dockyard-dsh/install@latest
```

The installer checks for `dsh` and `pnpm`, installs the currently verified DSH
runtime when `dsh` is missing, and then installs the prebuilt
`@dockyard-dsh/plugin` package into the `web` profile. Restart the running DSH
Web profile after installation so its bundle layer is loaded.

The plugin is macOS-only and requires Node.js 22.19+ or Node.js 24+.
