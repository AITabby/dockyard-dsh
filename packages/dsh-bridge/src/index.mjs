import { createProviderRoute } from "../../core/src/dsh-route.mjs";
import { ValidationError } from "../../core/src/errors.mjs";

export class DshInjectionBridge {
  #routes = new Map();

  constructor({ runtime, adapter = null, contextWindowOverrides = null } = {}) {
    if (!runtime) throw new ValidationError("DSH runtime is required");
    this.runtime = runtime;
    this.adapter = adapter;
    this.contextWindowOverrides = contextWindowOverrides;
  }

  async mountProvider(providerModule, accountPool) {
    const providerId = providerModule?.manifest?.id;
    if (!providerId) throw new ValidationError("Provider module is required");
    if (!this.runtime.has(providerId)) await this.runtime.register(providerModule);

    const previous = this.#routes.get(providerId) ?? null;
    const route = createProviderRoute({
      providerModule,
      accountPool,
      contextWindowOverrides: this.contextWindowOverrides,
    });
    let adapterMounted = false;
    try {
      if (this.adapter?.registerProviderRoute) {
        await this.adapter.registerProviderRoute(route, providerModule.manifest);
        adapterMounted = true;
      }
      this.#routes.set(providerId, route);
      await this.runtime.events.emit("dsh/provider-mounted", {
        providerId,
        manifest: { ...providerModule.manifest },
      });
      return route;
    } catch (error) {
      if (this.#routes.get(providerId) === route) this.#routes.delete(providerId);
      // Only unwind the adapter side when the adapter actually mounted AND
      // exposes an unregister hook. Without the hook there is nothing safe to
      // call: restoring a previous route blindly would leave both mounted.
      if (adapterMounted && this.adapter?.unregisterProviderRoute) {
        await this.adapter.unregisterProviderRoute(providerId).catch(() => {});
        if (previous) {
          await this.adapter.registerProviderRoute(previous, providerModule.manifest).catch(() => {});
          this.#routes.set(providerId, previous);
        }
      }
      throw error;
    }
  }

  async unmountProvider(providerId) {
    const route = this.#routes.get(providerId);
    if (!route) return false;
    if (this.adapter?.unregisterProviderRoute) await this.adapter.unregisterProviderRoute(providerId);
    this.#routes.delete(providerId);
    await this.runtime.events.emit("dsh/provider-unmounted", { providerId });
    return true;
  }

  getRoute(providerId) {
    return this.#routes.get(providerId) ?? null;
  }

  listRoutes() {
    return [...this.#routes.keys()];
  }
}

export function createDshBridgeModule(bridge) {
  if (!bridge) throw new ValidationError("DSH injection bridge is required");
  return {
    manifest: {
      id: "dockyard-dsh",
      kind: "integration",
      capabilities: ["dsh_injection", "provider_routes"],
    },
    activate(context) {
      context.registerService("dsh:bridge", bridge);
    },
  };
}

export { createDockyardLlmAdapter, defaultCatalogCachePath } from "./llm-adapter.mjs";
