import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createKiloModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "kilo",
    displayName: "Kilo Free",
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
  KiloDriver,
  createKiloCatalogLoader,
  createKiloDriver,
  parseKiloCatalog,
  summarizeKiloCandidate,
  BUILTIN_KILO_FREE_MODELS,
  DEFAULT_KILO_REASONING,
  DEFAULT_KILO_REASONING_EFFORTS,
} from "./driver.mjs";

export {
  DEFAULT_KILO_ENDPOINT,
  buildKiloMessages,
  createKiloNativeExecutor,
} from "./native-transport.mjs";
