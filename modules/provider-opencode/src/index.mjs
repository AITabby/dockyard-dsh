import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createOpencodeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "opencode",
    displayName: "OpenCode",
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
  OpencodeDriver,
  createOpencodeCatalogLoader,
  createOpencodeDriver,
  parseOpencodeCatalog,
  summarizeOpencodeCandidate,
  BUILTIN_OPENCODE_FREE_MODELS,
} from "./driver.mjs";

export {
  buildOpencodeMessages,
  createOpencodeNativeExecutor,
} from "./native-transport.mjs";
