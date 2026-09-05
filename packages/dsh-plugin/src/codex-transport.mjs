import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createCodexPiAiExecutor } from "../../../modules/provider-codex/src/index.mjs";

const DSH_LLM_PI_AI = "@deepseek-ai/dsh-llm-pi-ai";
const PI_AI = "@earendil-works/pi-ai";
const PI_AI_CODEX_API = "@earendil-works/pi-ai/api/openai-codex-responses.lazy";
const PI_AI_CODEX_PROVIDER = "@earendil-works/pi-ai/providers/openai-codex";
const PI_AI_BUILTIN_PROVIDERS = "@earendil-works/pi-ai/providers/all";

async function importBareDependencies() {
  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders] = await Promise.all([
    import(DSH_LLM_PI_AI),
    import(PI_AI),
    import(PI_AI_CODEX_API),
    import(PI_AI_CODEX_PROVIDER),
    import(PI_AI_BUILTIN_PROVIDERS),
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders };
}

function exportTarget(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  for (const condition of ["import", "node", "default"]) {
    const target = exportTarget(value[condition]);
    if (target) return target;
  }
  return null;
}

async function isFile(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findPackageRoot(startDirectory, packageName) {
  const packageParts = packageName.split("/");
  let current = resolve(startDirectory);
  while (true) {
    const candidate = join(current, "node_modules", ...packageParts);
    if (await isFile(join(candidate, "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function packageImportUrl(packageRoot, subpath = null) {
  const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const exports = packageJson.exports;
  let target = null;
  if (!subpath) {
    target = exportTarget(exports?.["."] ?? exports) ?? packageJson.module ?? packageJson.main;
  } else {
    const key = `./${subpath}`;
    target = exportTarget(exports?.[key]);
    if (!target && exports && typeof exports === "object") {
      for (const [pattern, value] of Object.entries(exports)) {
        if (!pattern.includes("*")) continue;
        const prefix = pattern.slice(0, pattern.indexOf("*"));
        const suffix = pattern.slice(pattern.indexOf("*") + 1);
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        target = exportTarget(value)?.replace("*", key.slice(prefix.length, key.length - suffix.length));
        break;
      }
    }
  }
  if (typeof target !== "string") {
    throw new Error(`Cannot resolve ${subpath ?? "."} from ${packageRoot}`);
  }
  return pathToFileURL(join(packageRoot, target)).href;
}

async function importFromDshInstall(moduleAnchor) {
  const anchor = moduleAnchor
    ?? process.env.DOCKYARD_DSH_CLI_PATH
    ?? process.argv[1]
    ?? import.meta.url;
  const dshRequire = createRequire(anchor);
  const dshLlmPath = dshRequire.resolve(DSH_LLM_PI_AI);
  const dshPackageRoot = dirname(dirname(dshLlmPath));
  const piRoot = await findPackageRoot(dshPackageRoot, PI_AI);
  if (!piRoot) throw new Error(`Cannot find ${PI_AI} beside ${DSH_LLM_PI_AI}`);

  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders] = await Promise.all([
    import(pathToFileURL(dshLlmPath).href),
    import(await packageImportUrl(piRoot)),
    import(await packageImportUrl(piRoot, "api/openai-codex-responses.lazy")),
    import(await packageImportUrl(piRoot, "providers/openai-codex")),
    import(await packageImportUrl(piRoot, "providers/all")),
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders };
}

async function loadExecutor(moduleAnchor) {
  let dependencies;
  try {
    dependencies = await importBareDependencies();
  } catch {
    // A local DSH plugin is commonly linked into the profile, so its source
    // file is outside the profile node_modules tree. Resolve the same
    // dependencies from the DSH executable's installation in that case.
    dependencies = await importFromDshInstall(moduleAnchor);
  }
  const { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider } = dependencies;
  const models = openaiCodexProvider().getModels();
  const modelById = new Map(models.map((model) => [model.id, model]));
  return createCodexPiAiExecutor({
    PiAiAdapter,
    createProvider,
    openAICodexResponsesApi,
    modelResolver: (modelId) => modelById.get(modelId),
    // Live slugs the static registry does not know yet (e.g. a brand-new
    // GPT release) are synthesized from the closest registry template so a
    // freshly fetched catalog stays invokable.
    registryModels: models,
  });
}

async function loadDependencies(moduleAnchor) {
  try {
    return await importBareDependencies();
  } catch {
    return importFromDshInstall(moduleAnchor);
  }
}

/** Resolve DSH's installed pi-ai dependencies from the plugin package. */
export function createCodexDshRequestExecutor({ moduleAnchor = null } = {}) {
  let executorPromise;
  return (envelope) => {
    executorPromise ??= loadExecutor(moduleAnchor);
    return executorPromise.then((executor) => executor(envelope));
  };
}

/**
 * Read the active pi-ai built-in registry without embedding provider model
 * ids or capacities in Dockyard. Providers such as Antigravity expose a live
 * model id list but may omit context metadata; this registry is an optional
 * second source for exact/family metadata enrichment.
 */
export function createPiAiModelRegistryLoader({ moduleAnchor = null } = {}) {
  let registryPromise;
  return async () => {
    registryPromise ??= loadDependencies(moduleAnchor).then(({ builtinProviders }) => {
      if (typeof builtinProviders?.getBuiltinModels !== "function"
        || typeof builtinProviders?.getBuiltinProviders !== "function") return [];
      return builtinProviders.getBuiltinProviders().flatMap((provider) => builtinProviders.getBuiltinModels(provider));
    });
    return registryPromise;
  };
}

function reasoningFromThinkingLevelMap(thinkingLevelMap) {
  if (!thinkingLevelMap || typeof thinkingLevelMap !== "object") return undefined;
  const efforts = Object.entries(thinkingLevelMap)
    .filter(([id, providerValue]) => id !== "off" && typeof providerValue === "string" && providerValue.length > 0)
    .map(([id, providerValue]) => ({
      id,
      name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      ...(providerValue === id ? {} : { description: `provider value: ${providerValue}` }),
    }));
  return efforts.length > 0 ? { efforts } : undefined;
}

export function codexModelToDshCatalog(model) {
  const reasoning = reasoningFromThinkingLevelMap(model?.thinkingLevelMap);
  return {
    id: model.id,
    name: model.name,
    ...(Array.isArray(model.input) ? { inputModalities: [...model.input] } : {}),
    ...(Number.isInteger(model.contextWindow) ? { contextWindow: model.contextWindow } : {}),
    ...(Number.isInteger(model.maxTokens) ? { maxTokens: model.maxTokens } : {}),
    ...(reasoning ? { reasoning } : {}),
  };
}

/** Read the current Codex catalog shipped by the active DSH pi-ai install. */
export function createCodexDshCatalogLoader({ moduleAnchor = null } = {}) {
  let dependenciesPromise;
  return async function loadCatalog(_context = {}) {
    dependenciesPromise ??= loadDependencies(moduleAnchor);
    const { openaiCodexProvider } = await dependenciesPromise;
    const models = openaiCodexProvider().getModels();
    return {
      models: models.map(codexModelToDshCatalog),
      source: "dsh_pi_ai_provider_catalog",
    };
  };
}
