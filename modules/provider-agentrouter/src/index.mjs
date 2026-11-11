import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createAgentRouterModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "agentrouter",
    displayName: "AgentRouter",
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
  AgentRouterDriver,
  BUILTIN_AGENTROUTER_MODELS,
  createAgentRouterCatalogLoader,
  createAgentRouterDriver,
  parseAgentRouterCatalog,
  summarizeAgentRouterCandidate,
} from "./driver.mjs";

export {
  DEFAULT_AGENTROUTER_ENDPOINT,
  DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  DEFAULT_AGENTROUTER_RESPONSES_ENDPOINT,
  DEFAULT_AGENTROUTER_USER_AGENT,
  agentRouterNativeTransportConstants,
  buildAgentRouterRequest,
  buildAgentRouterResponsesRequest,
  createAgentRouterNativeExecutor,
} from "./native-transport.mjs";
