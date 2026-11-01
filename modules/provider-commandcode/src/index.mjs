import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createCommandCodeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "commandcode",
    displayName: "Command Code",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream",
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
