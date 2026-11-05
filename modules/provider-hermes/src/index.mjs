import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";
import { PROVIDER_BEHAVIOR_CAPABILITIES } from "../../../packages/core/src/contracts.mjs";

export function createHermesModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "hermes",
    displayName: "Hermes (Nous Research)",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
      // Authenticates with a static API Key; the panel renders a key field for it.
      PROVIDER_BEHAVIOR_CAPABILITIES.API_KEY_AUTH,
    ],
    driver,
  });
}

export {
  HermesDriver,
  createHermesCatalogLoader,
  createHermesDriver,
  parseHermesCatalog,
  summarizeHermesCandidate,
  BUILTIN_HERMES_MODELS,
} from "./driver.mjs";

export {
  DEFAULT_HERMES_API_URL,
  DEFAULT_HERMES_CHAT_ENDPOINT,
  DEFAULT_HERMES_MODELS_ENDPOINT,
  buildHermesMessages,
  createHermesNativeExecutor,
  extractHermesAuth,
  findHermesAuthFilePath,
} from "./native-transport.mjs";
