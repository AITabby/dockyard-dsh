import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createWorkbuddyModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "workbuddy",
    displayName: "WorkBuddy",
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
