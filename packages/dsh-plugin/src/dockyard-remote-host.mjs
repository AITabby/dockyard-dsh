import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

export function publicAuthResult(result) {
  if (!result || typeof result !== "object") return result;
  return {
    status: result.status,
    ...(result.providerId ? { providerId: result.providerId } : {}),
    ...(result.sessionId ? { sessionId: result.sessionId } : {}),
    ...(result.authorizationUrl ? { authorizationUrl: result.authorizationUrl } : {}),
    ...(result.instructions ? { instructions: result.instructions } : {}),
    ...(result.browserOpened ? { browserOpened: true } : {}),
    ...(result.inputRequired ? { inputRequired: true } : {}),
    ...(result.authorizationCodeRequired ? { authorizationCodeRequired: true } : {}),
    ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
    ...(Array.isArray(result.accounts) ? { accounts: result.accounts } : {}),
  };
}

function envelope(result, snapshot) {
  return { result, snapshot };
}

/**
 * Host-side RPC surface for the native Dockyard composer control.
 *
 * The service intentionally returns the existing provider-neutral snapshot and
 * never exposes the credential store. OAuth login is started by the provider
 * module itself; this layer only forwards its public status to the browser.
 */
export class DockyardRemoteService extends TypertRemoteService {
  static inject = [];

  constructor(ctx, config = {}) {
    super(ctx, "dockyardRemote", { namespace: "dockyard" });
    if (!config.service) throw new Error("Dockyard remote service requires DockyardDshService");
    this.dockyard = config.service;
    this.nativeKeyPool = config.nativeKeyPool ?? null;
  }

  async snapshot() {
    return this.dockyard.snapshot();
  }

  async refresh(request = {}) {
    const providerId = request?.providerId ?? null;
    const result = await this.dockyard.refresh(providerId);
    return envelope(result, await this.dockyard.snapshot());
  }

  async refreshCatalog(request = {}) {
    const providerId = request?.providerId ?? null;
    const result = await this.dockyard.refreshCatalog(providerId);
    return envelope(result, await this.dockyard.snapshot());
  }

  async scan(request = {}) {
    const result = await this.dockyard.scan(request?.providerId ?? null);
    return envelope(result, await this.dockyard.snapshot());
  }

  async add(request = {}) {
    const result = await this.dockyard.add(request?.providerId ?? null, request?.candidateId ?? null);
    return envelope(result, await this.dockyard.snapshot());
  }

  async login(request) {
    // The browser client opens a synchronous popup before this RPC call;
    // suppress the host-level `open` fallback to avoid a duplicate tab.
    const result = publicAuthResult(await this.dockyard.startAuthorization(request.providerId, { openBrowser: false }));
    return envelope(result, await this.dockyard.snapshot());
  }

  async poll(request) {
    const result = publicAuthResult(await this.dockyard.pollAuthorization(request.providerId, request.sessionId));
    return envelope(result, await this.dockyard.snapshot());
  }

  async submitAuthorizationCode(request) {
    const result = publicAuthResult(await this.dockyard.submitAuthorizationCode(
      request.providerId,
      request.sessionId,
      request.code,
    ));
    return envelope(result, await this.dockyard.snapshot());
  }

  async cancel(request) {
    const result = publicAuthResult(await this.dockyard.cancelAuthorization(request.providerId, request.sessionId));
    return envelope(result, await this.dockyard.snapshot());
  }

  async setPolicy(request) {
    const result = await this.dockyard.setPolicy(request.providerId, request.policy, request.defaultAccountId);
    return envelope(result, await this.dockyard.snapshot());
  }

  async use(request) {
    const result = await this.dockyard.setDefaultAccount(request.providerId, request.accountId);
    return envelope(result, await this.dockyard.snapshot());
  }

  async removeAccount(request) {
    const result = await this.dockyard.removeAccount(request.providerId, request.accountId);
    return envelope(result, await this.dockyard.snapshot());
  }

  async nativeKeyStatus(request = {}) {
    if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
    return this.nativeKeyPool.status(request.providerId);
  }

  async nativeKeyRefresh(request = {}) {
    if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
    return this.nativeKeyPool.refreshUsage(request.providerId);
  }

  async nativeKeyRegister(request = {}) {
    if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool 尚未挂载");
    return this.nativeKeyPool.register(request.providerId, request.ref, request.label);
  }

  async nativeKeyUnregister(request = {}) {
    if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool 尚未挂载");
    return this.nativeKeyPool.unregister(request.providerId, request.ref);
  }

  async nativeKeySetPolicy(request = {}) {
    if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool 尚未挂载");
    return this.nativeKeyPool.setPolicy(request.providerId, request.policy);
  }

  async getContextWindowOverride(request = {}) {
    return this.dockyard.getContextWindowOverride(request);
  }

  async setContextWindowOverride(request = {}) {
    return this.dockyard.setContextWindowOverride(request, request.value);
  }
}

function markRemoteMethods() {
  const target = Object.create(DockyardRemoteService.prototype);
  for (const name of [
    "snapshot", "refresh", "refreshCatalog", "scan", "add", "login", "poll", "submitAuthorizationCode", "cancel", "setPolicy", "use", "removeAccount",
    "nativeKeyStatus", "nativeKeyRefresh", "nativeKeyRegister", "nativeKeyUnregister", "nativeKeySetPolicy",
    "getContextWindowOverride", "setContextWindowOverride",
  ]) {
    let initializer;
    Remote(name)(undefined, {
      kind: "method",
      name,
      static: false,
      private: false,
      addInitializer(callback) {
        initializer = callback;
      },
    });
    initializer?.call(target);
  }
}

markRemoteMethods();
