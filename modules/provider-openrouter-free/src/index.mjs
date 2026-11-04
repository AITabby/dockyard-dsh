import { defineProviderModule, PROVIDER_CAPABILITIES, PROVIDER_BEHAVIOR_CAPABILITIES } from "../../../packages/core/src/index.mjs";
import {
  OpenRouterFreeDriver,
  createOpenRouterFreeCatalogLoader,
  createOpenRouterFreeDriver,
  parseOpenRouterFreeCatalog,
} from "./driver.mjs";
import {
  OPENROUTER_AGENTIC_HEADERS,
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_CREDITS_ENDPOINT,
  OPENROUTER_FREE_ROUTER_ID,
  OPENROUTER_KEY_ENDPOINT,
  OPENROUTER_MODELS_ENDPOINT,
  PRIORITIZED_FREE_MODELS,
  buildOpenRouterFreeCatalogFromRaw,
  clearOpenRouterFreeCache,
  createOpenRouterFreeNativeExecutor,
  discoverLocalOpenRouterKeys,
  extractOpenRouterFreeAuth,
  fetchLiveOpenRouterFreeModels,
  hashApiKeyFingerprint,
  isOpenRouterModelCoolingDown,
  isUsableOpenRouterFreeModel,
  markOpenRouterModelCooldown,
  maskApiKey,
  normalizeMessages,
  normalizeOpenRouterFreeModelEntry,
  selectOpenRouterFreeCandidateQueue,
} from "./native-transport.mjs";

export function summarizeOpenRouterFreeCandidate(candidate) {
  return {
    candidateId: candidate.candidateId,
    accountId: candidate.accountId,
    providerId: candidate.providerId ?? "openrouter-free",
    displayName: candidate.displayName ?? null,
    email: candidate.email ?? null,
    status: candidate.status ?? "available",
    source: candidate.source ?? "openrouter_local_credentials",
    resources: candidate.resources ?? {},
  };
}

export function createOpenRouterFreeModule(options = {}) {
  const driver = options.driver ?? createOpenRouterFreeDriver(options);
  return defineProviderModule({
    id: "openrouter-free",
    displayName: "OpenRouter Free",
    capabilities: [
      ...PROVIDER_CAPABILITIES,
      PROVIDER_BEHAVIOR_CAPABILITIES.API_KEY_AUTH,
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.FORCE_LIVE_CATALOG,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
    ],
    driver,
  });
}

export {
  OpenRouterFreeDriver,
  createOpenRouterFreeCatalogLoader,
  createOpenRouterFreeDriver,
  parseOpenRouterFreeCatalog,
  OPENROUTER_AGENTIC_HEADERS,
  OPENROUTER_API_ENDPOINT,
  OPENROUTER_CREDITS_ENDPOINT,
  OPENROUTER_FREE_ROUTER_ID,
  OPENROUTER_KEY_ENDPOINT,
  OPENROUTER_MODELS_ENDPOINT,
  PRIORITIZED_FREE_MODELS,
  buildOpenRouterFreeCatalogFromRaw,
  clearOpenRouterFreeCache,
  createOpenRouterFreeNativeExecutor,
  discoverLocalOpenRouterKeys,
  extractOpenRouterFreeAuth,
  fetchLiveOpenRouterFreeModels,
  hashApiKeyFingerprint,
  isOpenRouterModelCoolingDown,
  isUsableOpenRouterFreeModel,
  markOpenRouterModelCooldown,
  maskApiKey,
  normalizeMessages,
  normalizeOpenRouterFreeModelEntry,
  selectOpenRouterFreeCandidateQueue,
};
