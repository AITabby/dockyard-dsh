import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createHermesModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "hermes",
    displayName: "Hermes (Nous Research)",
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
