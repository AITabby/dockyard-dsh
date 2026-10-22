import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createAntigravityModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "antigravity",
    displayName: "Antigravity",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream",
    ],
    driver,
  });
}

export {
  AntigravityOfficialCliDriver,
  AntigravityOfficialSessionDriver,
  antigravityRequestPrompt,
  createAntigravityCliExecutor,
  createAntigravityCatalogLoader,
  createAntigravityDriver,
  createAntigravityOAuthAuthorizer,
  enrichAntigravityModelCatalog,
  extractAntigravityAccountEmail,
  parseAntigravityModelCatalog,
  parseAntigravityNativeQuota,
  resolveAntigravityInvocationModel,
  resolveAntigravityNativeInvocationModel,
  resolveAgyCliPath,
  summarizeAntigravityCandidate,
} from "./driver.mjs";

export {
  antigravityNativeTransportConstants,
  buildAntigravityRequest,
  createAntigravityNativeExecutor,
  createAntigravityNativeQuotaReader,
  createAntigravityProjectResolver,
  parseAntigravityKeychainValue,
  readAntigravityKeychainToken,
  readAntigravityTokenFile,
  resolveAntigravityAccessToken,
  resolveAntigravityThinkingConfig,
} from "./native-transport.mjs";
