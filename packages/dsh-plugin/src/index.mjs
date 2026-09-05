import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultProviderEntries, DockyardRuntime } from "../../runtime/src/dockyard-runtime.mjs";
import { createDockyardLlmAdapter } from "../../dsh-bridge/src/index.mjs";
import {
  createAntigravityCatalogLoader,
  createAntigravityNativeExecutor,
  createAntigravityNativeQuotaReader,
  createAntigravityProjectResolver,
} from "../../../modules/provider-antigravity/src/index.mjs";
import { createGrokCatalogLoader, createGrokNativeExecutor } from "../../../modules/provider-grok/src/index.mjs";
import { createClaudeCatalogLoader, createClaudeNativeExecutor } from "../../../modules/provider-claude/src/index.mjs";
import { createCursorCatalogLoader, createCursorNativeExecutor } from "../../../modules/provider-cursor/src/index.mjs";
import { runCliCommand } from "../../providers/src/cli-agent-transport.mjs";
import {
  createCodexDshCatalogLoader,
  createCodexDshRequestExecutor,
  createPiAiModelRegistryLoader,
} from "./codex-transport.mjs";
import { createDockyardCommand, DockyardDshService } from "./dockyard-service.mjs";
import { createDockyardCredentialStore } from "./dockyard-credential-store.mjs";
import { NativeKeyPoolHost } from "./native-key-pool-host.mjs";

export const name = "dockyard-dsh";
export const inject = ["llm", "commands", "credentials", "settings", "webServer"];

function contextLogger(ctx, name) {
  try {
    const factory = typeof ctx?.get === "function" ? ctx.get("logger") : null;
    if (typeof factory === "function") return factory(name);
  } catch {
    // Logger is optional; plugin diagnostics must never prevent DSH boot.
  }
  return console;
}

/**
 * DSH Cordis plugin entry.
 *
 * Provider modules are composed by DockyardRuntime. This plugin only exposes
 * their provider-neutral routes to DSH, so adding a future provider does not
 * require another branch in the DSH integration.
 */
export function apply(ctx, config = {}) {
  const runtimeOptions = { ...(config.runtimeOptions ?? {}) };
  let catalogWarmers = [];
  if (!config.runtime && !runtimeOptions.providers) {
    const antigravityOptions = {
      ...(runtimeOptions.antigravity ?? {}),
    };
    // Resolve the Code Assist project for the selected OAuth account before
    // native requests. A configured project remains an explicit fast path;
    // otherwise loadCodeAssist supplies the account-scoped project instead of
    // sending a fabricated default envelope.
    antigravityOptions.projectResolver = antigravityOptions.projectResolver
      ?? createAntigravityProjectResolver(antigravityOptions);
    antigravityOptions.quotaReader = runtimeOptions.antigravity?.quotaReader
      ?? createAntigravityNativeQuotaReader(antigravityOptions);
    runtimeOptions.antigravity = antigravityOptions;
    const modelRegistryLoader = runtimeOptions.modelRegistryLoader
      ?? createPiAiModelRegistryLoader();
    const antigravityCatalogLoader = runtimeOptions.catalogLoaders?.antigravity
      ?? createAntigravityCatalogLoader({ ...antigravityOptions, registryLoader: modelRegistryLoader });
    runtimeOptions.requestExecutors = {
      ...(runtimeOptions.requestExecutors ?? {}),
      "openai-codex": runtimeOptions.requestExecutors?.["openai-codex"] ?? createCodexDshRequestExecutor(),
      antigravity: runtimeOptions.requestExecutors?.antigravity ?? createAntigravityNativeExecutor({
        ...antigravityOptions,
      }),
      claude: runtimeOptions.requestExecutors?.claude ?? createClaudeNativeExecutor(runtimeOptions.claude ?? {}),
      cursor: runtimeOptions.requestExecutors?.cursor ?? createCursorNativeExecutor(runtimeOptions.cursor ?? {}),
      grok: runtimeOptions.requestExecutors?.grok ?? createGrokNativeExecutor(runtimeOptions.grok ?? {}),
    };
    runtimeOptions.catalogLoaders = {
      ...(runtimeOptions.catalogLoaders ?? {}),
      "openai-codex": createCodexDshCatalogLoader(),
      antigravity: antigravityCatalogLoader,
      grok: runtimeOptions.catalogLoaders?.grok ?? createGrokCatalogLoader({
        ...(runtimeOptions.grok ?? {}),
        commandRunner: runtimeOptions.grok?.commandRunner ?? runCliCommand,
      }),
      claude: runtimeOptions.catalogLoaders?.claude ?? createClaudeCatalogLoader({ registryLoader: modelRegistryLoader }),
      cursor: runtimeOptions.catalogLoaders?.cursor ?? createCursorCatalogLoader(runtimeOptions.cursor ?? {}),
    };
    runtimeOptions.providers = createDefaultProviderEntries(runtimeOptions);
    catalogWarmers = Object.entries(runtimeOptions.catalogLoaders)
      .filter(([, loader]) => typeof loader === "function");
  }
  const runtime = config.runtime ?? new DockyardRuntime(runtimeOptions);

  // Initialize the account pools before warming only providers that are
  // actually connected. This keeps optional vendors out of the model menu and
  // prevents their official session sources from competing for startup/network time.
  if (catalogWarmers.length > 0 && typeof runtime.init === "function") {
    void (async () => {
      await runtime.init();
      const providers = runtime.snapshot?.().providers ?? [];
      const connected = new Set(
        providers
          .filter((provider) => Array.isArray(provider.accounts) && provider.accounts.length > 0)
          .map((provider) => provider.providerId),
      );
      const accountsByProvider = new Map(providers.map((provider) => [provider.providerId, provider.accounts ?? []]));
      await Promise.all(catalogWarmers
        .filter(([providerId]) => providerId === "openai-codex" || connected.has(providerId))
        .map(([providerId, loader]) => loader({ accounts: accountsByProvider.get(providerId) ?? [] }).catch(() => null)));
    })().catch((error) => {
      contextLogger(ctx, "dockyard-dsh").warn?.(error);
    });
  }

  const adapter = createDockyardLlmAdapter({
    runtime,
    providerIds: config.providers ?? runtime.listProviderIds(),
    // Resolve this only when a request is actually streamed. The attachment
    // service is installed by DSH's base profile after plugin composition;
    // reading it while the plugin graph is being composed breaks boot.
    attachmentsResolver: () => {
      try {
        return typeof ctx.get === "function" ? ctx.get("attachments") : ctx.attachments;
      } catch {
        return undefined;
      }
    },
  });
  const installAdapter = () => {
    const result = ctx.llm.registerAdapter(adapter.providers(), adapter);
    // DSH may hand back a disposer for hot reload/unplug; keep it so the
    // effect can unregister instead of leaving a stale adapter behind.
    return typeof result?.dispose === "function" ? result.dispose.bind(result)
      : typeof result === "function" ? result : null;
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(() => {
      const disposeAdapter = installAdapter();
      return () => {
        try { disposeAdapter?.(); } catch { /* one failing dispose must not break teardown */ }
      };
    }, "dockyard-dsh: llm adapter");
  } else {
    installAdapter();
  }

  // The runtime is the source of truth for DSH itself. Commands, the native
  // control surface, and generation all consume this same in-process runtime.
  if (typeof runtime.init === "function") {
    const service = config.service ?? new DockyardDshService({
      runtime,
      ...(config.serviceOptions ?? {}),
      catalogAdapter: adapter,
      onCatalogUpdated: () => {
        try {
          ctx.emit?.("llm/adapters-updated");
        } catch {
          // Catalog refresh must still succeed if the host event bus is unavailable.
        }
      },
      logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
    });
    if (typeof ctx.provide === "function") ctx.provide("dockyard", service);
    // Cordis only makes the injected credential/settings services available
    // after this effect enters the active plugin fiber. Do not construct the
    // host during apply(), or a missing service can abort the entire DSH boot.
    let nativeKeyPool = config.nativeKeyPool ?? null;
    const install = () => {
      try {
        const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : ctx.credentials;
        if (credentials && typeof runtime.setSecretStore === "function") {
          runtime.setSecretStore(createDockyardCredentialStore(credentials, runtime.secretStore));
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`DSH Credentials 接入失败，将保留原有安全存储：${error.message}`);
      }
      // Start after the Cordis effect enters the active plugin fiber. Native
      // key-pool wiring is optional and must never prevent the DSH web host
      // from booting while the service graph is still settling.
      nativeKeyPool ??= new NativeKeyPoolHost(ctx, {
        logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
        contextWindowOverrides: runtime.contextWindowOverrides,
      });
      const nativeKeyPoolReady = nativeKeyPool.start();
      void nativeKeyPoolReady.catch((error) => {
        contextLogger(ctx, "dockyard-dsh").warn?.(error);
      });
      const unregister = ctx.commands?.register?.(createDockyardCommand(service));
      void service.start().catch((error) => {
        contextLogger(ctx, "dockyard-dsh").error?.(error);
      });

      // The native composer UI talks to the service through DSH's typed
      // Gateway. Keep this import lazy so the local runtime/tests remain
      // independent from a DSH installation, while a real DSH host gets the
      // visual account/quota controls mounted beside the model selector.
      let remoteFiberPromise;
      if (typeof ctx.plugin === "function") {
        remoteFiberPromise = import("./dockyard-remote-host.mjs")
          .then(({ DockyardRemoteService }) => ctx.plugin(DockyardRemoteService, { service, nativeKeyPool }))
          .catch((error) => {
            contextLogger(ctx, "dockyard-dsh").error?.(error);
            return null;
          });
      }
      let unregisterArtifactsRoute;
      try {
        const webServer = ctx.webServer ?? (typeof ctx.get === "function" ? ctx.get("webServer") : null);
        if (webServer && typeof webServer.register === "function") {
          unregisterArtifactsRoute = webServer.register({
            kind: "prefix",
            path: "/artifacts",
            handler: async (req, res) => {
              try {
                const url = new URL(req.url, "http://127.0.0.1");
                const cleanPath = url.pathname.replace(/^\/artifacts\/?/, "");
                if (!cleanPath || cleanPath.includes("..")) {
                  res.writeHead(403);
                  res.end("Forbidden");
                  return;
                }
                const filePath = join(process.cwd(), "artifacts", cleanPath);
                if (!existsSync(filePath)) {
                  res.writeHead(404);
                  res.end("Not Found");
                  return;
                }
                const ext = cleanPath.split(".").pop()?.toLowerCase();
                const mimeTypes = {
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  webp: "image/webp",
                  gif: "image/gif",
                  svg: "image/svg+xml",
                };
                const contentType = mimeTypes[ext] ?? "application/octet-stream";
                const content = readFileSync(filePath);
                res.writeHead(200, {
                  "Content-Type": contentType,
                  "Content-Length": content.length,
                  "Cache-Control": "public, max-age=3600",
                });
                res.end(content);
              } catch (err) {
                res.writeHead(500);
                res.end("Internal Server Error");
              }
            },
          });
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`Failed to register /artifacts/ route: ${error.message}`);
      }

      return async () => {
        // Isolate every cleanup step: one failing dispose must not prevent
        // the remaining teardown (command unregister, service dispose), which
        // would leave a stale `dockyard` command registered on hot reload.
        try { unregisterArtifactsRoute?.(); } catch { /* ignore */ }
        try { await remoteFiberPromise?.catch?.(() => null); } catch { /* ignore */ }
        try { await nativeKeyPoolReady.catch?.(() => null); } catch { /* ignore */ }
        try { nativeKeyPool?.dispose?.(); } catch { /* ignore */ }
        try { unregister?.(); } catch { /* ignore */ }
        try { await service.dispose(); } catch { /* ignore */ }
      };
    };
    if (typeof ctx.effect === "function") {
      ctx.effect(install, "dockyard-dsh: service and commands");
    } else {
      install();
    }
  }
}

export { DockyardRuntime };
export { createDockyardLlmAdapter };
export { NativeKeyPoolHost } from "./native-key-pool-host.mjs";
export { DockyardDshService, createDockyardCommand } from "./dockyard-service.mjs";
