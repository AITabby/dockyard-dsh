import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  createCodexCatalogLoader,
  createCodexPiAiExecutor,
  codexModelToDshCatalog,
  parseCodexReasoning,
} from "../../../modules/provider-codex/src/index.mjs";

export { codexModelToDshCatalog, parseCodexReasoning };

const activeCodexModels = new Map();

function recordCodexModels(models) {
  if (Array.isArray(models)) {
    for (const m of models) {
      if (m?.id) activeCodexModels.set(m.id, m);
    }
  }
}

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

function resolveDshLlmPath(moduleAnchor) {
  const anchors = [
    moduleAnchor,
    process.env.DOCKYARD_DSH_CLI_PATH,
    process.argv[1],
    process.env.DSH_INSTALL_DIR ? join(process.env.DSH_INSTALL_DIR, "package.json") : null,
  ].filter((value) => typeof value === "string" && value.length > 0);
  for (const anchor of anchors) {
    try {
      const target = anchor.startsWith("file://") ? anchor : resolve(anchor);
      return createRequire(target).resolve(DSH_LLM_PI_AI);
    } catch {
      // Try the next anchor if this entry point sits outside the DSH install.
    }
  }
  if (typeof import.meta.resolve === "function") {
    try {
      const resolved = import.meta.resolve(DSH_LLM_PI_AI);
      if (resolved.startsWith("file://")) return fileURLToPath(resolved);
    } catch {
      // Fall back to resolving relative to this plugin module below.
    }
  }
  return createRequire(import.meta.url).resolve(DSH_LLM_PI_AI);
}

async function importFromDshInstall(moduleAnchor) {
  const dshLlmPath = resolveDshLlmPath(moduleAnchor);
  const dshPackageRoot = dirname(dshLlmPath);
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

async function loadDependencies(moduleAnchor) {
  // Always pair @deepseek-ai/dsh-llm-pi-ai with the @earendil-works/pi-ai
  // installed beside it in the host DSH runtime. Resolving bare `@earendil-works/pi-ai`
  // from the plugin's own dependencies can mix a newer host dsh-llm-pi-ai
  // (e.g. string system messages in 0.2.x) with an older pi-ai (0.82.x).
  try {
    return await importFromDshInstall(moduleAnchor);
  } catch {
    return importBareDependencies();
  }
}

async function loadExecutor(moduleAnchor) {
  const { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider } = await loadDependencies(moduleAnchor);
  const models = openaiCodexProvider().getModels();
  const modelById = new Map(models.map((model) => [model.id, model]));
  return createCodexPiAiExecutor({
    PiAiAdapter,
    createProvider,
    openAICodexResponsesApi,
    modelResolver: (modelId) => modelById.get(modelId) ?? activeCodexModels.get(modelId) ?? null,
  });
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

/** Read the current Codex catalog with live API, local cache, and pi-ai fallback. */
export function createCodexDshCatalogLoader({ moduleAnchor = null, ...options } = {}) {
  let dependenciesPromise;
  const fallbackLoader = async () => {
    dependenciesPromise ??= loadDependencies(moduleAnchor);
    const { openaiCodexProvider } = await dependenciesPromise;
    const models = openaiCodexProvider().getModels();
    return {
      models: models.map(codexModelToDshCatalog),
      source: "dsh_pi_ai_provider_catalog",
    };
  };

  const loader = createCodexCatalogLoader({
    fallbackLoader,
    ...options,
  });

  return async (context = {}) => {
    const result = await loader(context);
    recordCodexModels(result?.models);
    return result;
  };
}
