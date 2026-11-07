import { defineProviderModule } from "../../../packages/core/src/provider-module.mjs";

export function createTraeCnModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "trae-cn",
    displayName: "Trae CN",
    // Trae CN has its own authorization page, so the panel offers a real
    // "log in" button: the plugin runs the loopback callback and takes the
    // credential from the page, exactly as the IDE itself does.
    capabilities: [
      "oauth_authorization",
      "oauth_import",
      "quota",
      "catalog",
      "invoke",
      "stream",
    ],
    driver,
  });
}

export {
  TraeCnSubscriptionDriver,
  createTraeCnDriver,
  parseTraeCnCatalog,
  mergeTraeCnRoster,
  summarizeTraeCnCandidate,
} from "./driver.mjs";

export {
  PROVIDER_ID,
  TRAE_CN_CHAT_FUNCTION,
  TRAE_CN_CONTEXT_FALLBACK,
  TRAE_CN_MODELS,
  TRAE_CN_SITE,
  createTraeNativeExecutor,
  newTraeDevice,
  readTraeCallback,
  readTraeCredits,
  startTraeSignIn,
  traeAuthorizationUrl,
  traeChatBody,
  traeTools,
  traeRequestError,
  traeHeaders,
  traeMessages,
  traeSseEvents,
  traeWhen,
} from "./native-transport.mjs";
