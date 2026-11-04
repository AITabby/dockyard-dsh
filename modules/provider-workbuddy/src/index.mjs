import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";
import { PROVIDER_BEHAVIOR_CAPABILITIES } from "../../../packages/core/src/contracts.mjs";

export function createWorkbuddyModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "workbuddy",
    displayName: "WorkBuddy",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
    ],
    driver,
  });
}

export {
  WorkbuddyDriver,
  createWorkbuddyCatalogLoader,
  createWorkbuddyDriver,
  parseWorkbuddyCatalog,
  summarizeWorkbuddyCandidate,
  BUILTIN_WORKBUDDY_FREE_MODELS,
} from "./driver.mjs";

export {
  DEFAULT_WORKBUDDY_ENDPOINT,
  buildWorkbuddyMessages,
  createWorkbuddyNativeExecutor,
  extractWorkbuddySession,
  findWorkbuddyAuthFilePath,
  findWorkbuddyConfigDir,
  findWorkbuddyElectronPath,
} from "./native-transport.mjs";
