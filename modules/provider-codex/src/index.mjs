import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";
import { PROVIDER_BEHAVIOR_CAPABILITIES } from "../../../packages/core/src/contracts.mjs";

export function createCodexModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "openai-codex",
    displayName: "Codex",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
    ],
    driver,
  });
}

export {
  CodexOAuthDriver,
  createCodexCatalogLoader,
  createCodexDriver,
  createCodexPiAiExecutor,
  codexModelToDshCatalog,
  parseCodexModelCatalog,
  parseCodexReasoning,
  summarizeCodexCandidate,
} from "./driver.mjs";
