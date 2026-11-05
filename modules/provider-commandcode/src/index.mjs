import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";
import { PROVIDER_BEHAVIOR_CAPABILITIES } from "../../../packages/core/src/contracts.mjs";

export function createCommandCodeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "commandcode",
    displayName: "Command Code",
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
  CommandCodeDriver,
  createCommandCodeCatalogLoader,
  createCommandCodeDriver,
  parseCommandCodeCatalog,
  summarizeCommandCodeCandidate,
  formatCommandCodePlan,
  BUILTIN_COMMANDCODE_MODELS,
} from "./driver.mjs";

export {
  DEFAULT_COMMANDCODE_API_URL,
  DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT,
  DEFAULT_COMMANDCODE_CREDITS_ENDPOINT,
  DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT,
  DEFAULT_COMMANDCODE_MODELS_ENDPOINT,
  buildCommandCodeMessages,
  createCommandCodeNativeExecutor,
  extractCommandCodeAuth,
  findCommandCodeAuthFilePath,
  toWireTools,
} from "./native-transport.mjs";
