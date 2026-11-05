import { ProviderCapabilityError, ValidationError } from "./errors.mjs";

function missingDriver(providerId, capability) {
  return async () => {
    throw new ProviderCapabilityError(providerId, capability);
  };
}

export function defineProviderModule({
  id,
  displayName,
  capabilities = [],
  driver = {},
}) {
  if (!id) throw new ValidationError("Provider module id is required");

  const module = {
    manifest: {
      id,
      kind: "provider",
      displayName: displayName ?? id,
      capabilities: [...capabilities],
      dataSource: "live_oauth",
    },

    async activate(context) {
      context.registerService(`provider:${id}`, module);
      await context.emit("provider/registered", { providerId: id });
    },

    async deactivate(context) {
      await context.emit("provider/unregistered", { providerId: id });
    },

    async discover(context) {
      return driver.discover ? driver.discover(context) : missingDriver(id, "oauth_discovery")(context);
    },

    async importAccount(candidate, context) {
      return driver.importAccount
        ? driver.importAccount(candidate, context)
        : missingDriver(id, "oauth_import")(candidate, context);
    },

    async importSource(source, context) {
      return driver.importSource
        ? driver.importSource(source, context)
        : missingDriver(id, "oauth_source_import")(source, context);
    },

    // A provider may expose an already authenticated official CLI, desktop
    // client, browser, or OAuth-file session. Returning null keeps the normal
    // provider-owned authorization flow unchanged.
    async getActiveSession(context) {
      return typeof driver.getActiveSession === "function"
        ? driver.getActiveSession(context)
        : null;
    },

    /**
     * What the user has to do for a provider that has no authorization entry
     * point of its own (a desktop-session provider, for example). Returning
     * null leaves the host's generic message in place, so a provider that does
     * not care keeps working without a new branch here.
     */
    async authorizationInstructions(context) {
      return typeof driver.authorizationInstructions === "function"
        ? driver.authorizationInstructions(context)
        : null;
    },

    async startAuthorization(context) {
      return driver.startAuthorization
        ? driver.startAuthorization(context)
        : missingDriver(id, "oauth_authorization")(context);
    },

    async pollAuthorization(sessionId, context) {
      return driver.pollAuthorization
        ? driver.pollAuthorization(sessionId, context)
        : missingDriver(id, "oauth_authorization")(sessionId, context);
    },

    async cancelAuthorization(sessionId, context) {
      return driver.cancelAuthorization
        ? driver.cancelAuthorization(sessionId, context)
        : missingDriver(id, "oauth_authorization")(sessionId, context);
    },

    async submitAuthorizationCode(sessionId, code, context) {
      return driver.submitAuthorizationCode
        ? driver.submitAuthorizationCode(sessionId, code, context)
        : missingDriver(id, "oauth_authorization")(sessionId, code, context);
    },

    async refreshAccount(account, context) {
      return driver.refreshAccount
        ? driver.refreshAccount(account, context)
        : missingDriver(id, "oauth_refresh")(account, context);
    },

    async getQuota(account, context) {
      return driver.getQuota
        ? driver.getQuota(account, context)
        : missingDriver(id, "quota")(account, context);
    },

    async getCatalog(context) {
      return driver.getCatalog ? driver.getCatalog(context) : missingDriver(id, "catalog")(context);
    },

    async invoke(request, invocation, context) {
      return driver.invoke
        ? driver.invoke(request, invocation, context)
        : missingDriver(id, "invoke")(request, invocation, context);
    },

    async stream(request, invocation, context) {
      if (driver.stream) return driver.stream(request, invocation, context);
      if (driver.invoke) return driver.invoke(request, invocation, context);
      return missingDriver(id, "stream")(request, invocation, context);
    },
  };

  return Object.freeze(module);
}
