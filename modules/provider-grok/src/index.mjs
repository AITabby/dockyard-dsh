import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createGrokModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "grok",
    displayName: "Grok",
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
  GrokOAuthDriver,
  createGrokCliExecutor,
  createGrokCatalogLoader,
  createGrokDriver,
  grokRequestPromptBlocks,
  isGrokCliAuthFailure,
  parseGrokAuth,
  parseGrokCreditsConfig,
  parseGrokModelCatalog,
  summarizeGrokCandidate,
} from "./driver.mjs";

export {
  buildGrokRequest,
  createGrokNativeExecutor,
  grokNativeTransportConstants,
} from "./native-transport.mjs";
