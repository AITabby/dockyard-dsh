import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createNvidiaModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "nvidia-nim",
    displayName: "NVIDIA NIM",
    capabilities: [
      "api_key_auth",
      "catalog",
      "quota",
      "invoke",
      "stream",
    ],
    driver,
  });
}

export {
  NvidiaDriver,
  createNvidiaCatalogLoader,
  createNvidiaDriver,
  parseNvidiaCatalog,
  summarizeNvidiaCandidate,
} from "./driver.mjs";

export {
  DEFAULT_NVIDIA_CHAT_ENDPOINT,
  DEFAULT_NVIDIA_MODELS_ENDPOINT,
  buildNvidiaRequest,
  createNvidiaNativeExecutor,
  nvidiaNativeTransportConstants,
} from "./native-transport.mjs";
