import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

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
