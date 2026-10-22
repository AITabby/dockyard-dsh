import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

import { createBrowserOAuthAuthorizer } from "../../../packages/oauth/src/browser-oauth-authorizer.mjs";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  contentHasImageInCurrentTurn,
  unsupportedContentError,
} from "../../../packages/providers/src/cli-agent-transport.mjs";
import {
  addSecondsIso,
  assertSecureEndpointUrl,
  finiteNumber,
  isoFromEpoch,
  recursiveQuotaWindows,
  redactError,
  selectPrimaryQuotaWindow,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  OFFICIAL_SESSION_AUTH_KIND,
  OFFICIAL_SESSION_SOURCE_KINDS,
  isOfficialSessionAuthKind,
  officialSessionResources,
} from "../../../packages/providers/src/session-source.mjs";
import {
  createAntigravityNativeQuotaReader,
  readAntigravityTokenFile,
  resolveAntigravityAccessToken,
} from "./native-transport.mjs";

const PROVIDER_ID = "antigravity";
const DEFAULT_CLI = "agy";

export function resolveAgyCliPath(configured, { env = process.env, home = homedir() } = {}) {
  const envPath = configured ?? env.DOCKYARD_ANTIGRAVITY_CLI;
  if (envPath && envPath !== "agy" && envPath !== DEFAULT_CLI) {
    return envPath;
  }
  const candidates = [
    join(home, ".local", "bin", "agy"),
    join(home, ".gemini", "antigravity", "bin", "agy"),
    "/usr/local/bin/agy",
    "/opt/homebrew/bin/agy",
    "/usr/bin/agy",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return envPath || DEFAULT_CLI;
}

function augmentPathWithUserBins(env = process.env, home = homedir()) {
  const extraPaths = [
    join(home, ".local", "bin"),
    join(home, ".gemini", "antigravity", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const currentPath = env?.PATH || "";
  const parts = currentPath.split(":");
  const toPrepend = extraPaths.filter((p) => existsSync(p) && !parts.includes(p));
  if (toPrepend.length === 0) return currentPath;
  return [...toPrepend, currentPath].filter(Boolean).join(":");
}
const DEFAULT_CATALOG_TTL_MS = 60_000;
const DEFAULT_AUTH_TIMEOUT_MS = 10 * 60 * 1000;
const CREDENTIAL_SLOT = Symbol("dockyard-antigravity-session");
const ANTIGRAVITY_CREDENTIAL_REFRESH_MODES = Object.freeze({
  DSH_BROWSER_OAUTH: "dockyard_browser_oauth",
  AGY_SESSION: "agy_session",
});
// Antigravity's CLI keeps OAuth in the OS keyring by default. That is a poor
// boundary for a host process that also needs the rotated bearer token: the
// keyring can refresh successfully while the legacy token file stays stale.
// The official CLI supports this switch for a file-backed session, allowing
// DSH to mirror the same rotation into its own secure credential store.
const AGY_FILE_STORAGE_ENV = "GEMINI_FORCE_FILE_STORAGE";
const ANTIGRAVITY_BROWSER_CLIENT_ID = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || "";
const ANTIGRAVITY_BROWSER_CLIENT_SECRET = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || "";
const ANTIGRAVITY_BROWSER_AUTHORIZATION_URL = process.env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL
  || "https://accounts.google.com/o/oauth2/v2/auth";
const ANTIGRAVITY_BROWSER_TOKEN_URL = process.env.DOCKYARD_ANTIGRAVITY_TOKEN_URL
  || "https://oauth2.googleapis.com/token";
const ANTIGRAVITY_BROWSER_USERINFO_URL = process.env.DOCKYARD_ANTIGRAVITY_USERINFO_URL
  || "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const ANTIGRAVITY_BROWSER_REDIRECT_URI = process.env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI
  || "http://localhost:51121/oauth-callback";
const ANTIGRAVITY_BROWSER_SCOPES = process.env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE
  || [
    // The same OAuth token is used both for userinfo and Google's Code Assist
    // endpoints. Keep the upstream API scope instead of authorizing a token
    // that can identify the user but cannot call streamGenerateContent.
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

// agy models currently returns only id/name rows. These pinned capacities
// mirror Google's published model card and act purely as a capacity overlay:
// mergedAntigravityRegistry attaches them only when the live directory itself
// references the id, so the fallback can never invent a callable model.
// Source: https://deepmind.google/models/model-cards/
const OFFICIAL_ANTIGRAVITY_MODEL_METADATA = Object.freeze([
  Object.freeze({
    id: "gemini-3.8-flash",
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  }),
  Object.freeze({
    id: "gemini-3.8-pro",
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  }),
  Object.freeze({
    id: "gemini-3.7-flash",
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  }),
  Object.freeze({
    id: "gemini-3.7-pro",
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  }),
]);

// agy checks for a real TTY before it starts its first-party OAuth bootstrap.
// This tiny hidden helper gives agy a PTY and keeps DSH's pipe on the outside;
// it does not open Terminal or expose a command window to the user.
const ANTIGRAVITY_PTY_SCRIPT = String.raw`
import os
import pty
import select
import signal
import sys

command = sys.argv[1]
command_args = sys.argv[1:]
child_pid, pty_fd = pty.fork()
if child_pid == 0:
    os.execvpe(command, command_args, os.environ)

def terminate(_signum, _frame):
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
    os._exit(143)

signal.signal(signal.SIGTERM, terminate)
signal.signal(signal.SIGINT, terminate)
stdin_open = True
exit_code = 1
try:
    while True:
        inputs = [pty_fd]
        if stdin_open:
            inputs.append(0)
        ready, _, _ = select.select(inputs, [], [], 0.25)
        if pty_fd in ready:
            try:
                data = os.read(pty_fd, 8192)
            except OSError:
                data = b""
            if not data:
                break
            os.write(1, data)
        if stdin_open and 0 in ready:
            data = os.read(0, 8192)
            if data:
                os.write(pty_fd, data)
            else:
                stdin_open = False
        waited_pid, status = os.waitpid(child_pid, os.WNOHANG)
        if waited_pid:
            exit_code = os.waitstatus_to_exitcode(status)
            break
finally:
    try:
        os.close(pty_fd)
    except OSError:
        pass
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
sys.exit(exit_code)
`;

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeEmail(value) {
  const email = String(value ?? "").trim();
  return email.match(EMAIL_PATTERN)?.[0] ?? null;
}

function findEmailField(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (/email/i.test(key)) {
      const direct = normalizeEmail(nested);
      if (direct) return direct;
    }
    const child = findEmailField(nested, depth + 1, seen);
    if (child) return child;
  }
  return null;
}

/**
 * Antigravity's local token file has no account profile. The official CLI may
 * still return the authenticated email in its structured/status output or
 * stderr. Read only that identity field; never scrape or expose token text.
 */
export function extractAntigravityAccountEmail(...values) {
  for (const value of values) {
    const direct = normalizeEmail(
      value?.email
        ?? value?.account?.email
        ?? value?.user?.email
        ?? value?.identity?.email
        ?? value?.accountEmail
        ?? value?.userEmail
        ?? value?.email_address
        ?? value?.command?.data?.email
        ?? value?.command?.data?.email_address,
    );
    if (direct) return direct;
    const nested = findEmailField(value);
    if (nested) return nested;
    const text = typeof value === "string" ? value : "";
    const explicit = text.match(
      /(?:applyAuthResult:\s*)?email\s*=\s*([^\s,;]+)|authenticated\s+successfully\s+as\s+([^\s,;]+)/i,
    );
    const matched = normalizeEmail(explicit?.[1] ?? explicit?.[2]);
    if (matched) return matched;
  }
  return null;
}

function sessionFingerprint(session) {
  // Prefer a stable identity (email) when the local session exposes one so a
  // token rotation by the official client does not invalidate the fingerprint.
  // The raw token hash remains the fallback for sessions without identity.
  const email = typeof session?.email === "string" && session.email.length > 0
    ? session.email
    : null;
  const token = typeof session?.token === "string" && session.token.length > 0
    ? session.token
    : null;
  if (email) return hash(`antigravity-session:email:${email.toLowerCase()}`).slice(0, 10).toUpperCase();
  return token ? hash(`antigravity-session:${token}`).slice(0, 10).toUpperCase() : null;
}

function activeSessionError(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}

function sameEmail(left, right) {
  const a = normalizeEmail(left)?.toLowerCase();
  const b = normalizeEmail(right)?.toLowerCase();
  return Boolean(a && b && a === b);
}

function tokenExpiresAt(tokens, now = new Date()) {
  return isoFromEpoch(tokens?.expiresAt ?? tokens?.expires_at)
    ?? addSecondsIso(tokens?.expires_in ?? tokens?.expiresIn, now);
}

function tokenNeedsRefresh(credential, now, leewayMs = 60_000) {
  if (!credential?.refresh) return false;
  if (!credential.expiresAt) return true;
  const expiresAt = Date.parse(credential.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime() + leewayMs;
}

function officialAntigravityTokenPath(environment) {
  const home = environment?.HOME || homedir();
  return environment?.DOCKYARD_ANTIGRAVITY_TOKEN_FILE
    || join(home, ".gemini", "antigravity-cli", "antigravity-oauth-token");
}

function agyRefreshEnvironment(environment, tokenPath) {
  return {
    ...environment,
    DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath,
    [AGY_FILE_STORAGE_ENV]: "true",
    AGY_CLI_HIDE_ACCOUNT_INFO: "1",
  };
}

function credentialRefreshMode(account) {
  const explicit = account?.resources?.credentialRefreshMode;
  if (explicit) return explicit;
  // Accounts imported before credentialRefreshMode was persisted still carry
  // the captured marker from agy's isolated browser profile. Treat those
  // legacy records as agy sessions instead of attempting a DSH OAuth refresh
  // with the wrong client credentials.
  return account?.resources?.sessionPersistence === "captured"
    ? ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION
    : null;
}

function cliFailure(code, signal, output, errorOutput) {
  const error = new Error(`Antigravity CLI failed (${signal ?? code})`);
  error.code = code;
  const structured = parseJsonOutput(output);
  const structuredDetail = structured?.error
    ?? structured?.response
    ?? structured?.result?.error
    ?? structured?.result?.response;
  error.detail = String(errorOutput || structuredDetail || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return error;
}

function runCommand(command, args, {
  env = process.env,
  timeoutMs = 30_000,
  signal,
  includeAccountInfo = false,
} = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...env };
    if (includeAccountInfo) delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    else childEnv.AGY_CLI_HIDE_ACCOUNT_INFO ??= "1";
    childEnv.PATH = augmentPathWithUserBins(childEnv, childEnv.HOME || homedir());
    const resolvedCommand = (command === DEFAULT_CLI || command === "agy")
      ? resolveAgyCliPath(command, { env: childEnv, home: childEnv.HOME || homedir() })
      : command;
    const child = spawn(resolvedCommand, args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(signal ? { signal } : {}),
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch { /* process is already gone */ }
      // A CLI that ignores SIGTERM must not leave this promise pending forever;
      // escalate to SIGKILL after a short grace period.
      killTimer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* process is already gone */ }
      }, 2_000);
      killTimer.unref?.();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code, closeSignal) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8");
      if (!timedOut && code === 0) {
        resolve({ output, errorOutput });
        return;
      }
      const failure = cliFailure(code, closeSignal, output, errorOutput);
      if (timedOut) failure.message = `Antigravity CLI timed out after ${timeoutMs}ms`;
      reject(failure);
    });
  });
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    // The official CLI normally emits one JSON document. If a launcher adds
    // an informational line, accept the last complete JSON line without
    // weakening the structured response contract.
    for (const line of String(output).split(/\r?\n/).reverse()) {
      if (!line.trim()) continue;
      try {
        return JSON.parse(line);
      } catch {
        // Keep looking for the structured document.
      }
    }
    return null;
  }
}

function runStreamingCommand(command, args, { env = process.env, timeoutMs = 300_000, signal } = {}) {
  return (async function* lines() {
    const childEnv = { ...env, AGY_CLI_HIDE_ACCOUNT_INFO: "1" };
    childEnv.PATH = augmentPathWithUserBins(childEnv, childEnv.HOME || homedir());
    const resolvedCommand = (command === DEFAULT_CLI || command === "agy")
      ? resolveAgyCliPath(command, { env: childEnv, home: childEnv.HOME || homedir() })
      : command;
    const child = spawn(resolvedCommand, args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(signal ? { signal } : {}),
    });
    const stdout = [];
    const stderr = [];
    let spawnError = null;
    let timedOut = false;
    let closedResult = null;
    let forceTimer = null;
    let timer = null;
    let terminationRequested = false;
    const terminate = () => {
      if (closedResult || terminationRequested) return;
      terminationRequested = true;
      try { child.kill("SIGTERM"); } catch { /* process is already gone */ }
      forceTimer = setTimeout(() => {
        if (!closedResult) {
          try { child.kill("SIGKILL"); } catch { /* process is already gone */ }
        }
      }, 1_000);
      forceTimer.unref?.();
    };
    timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      spawnError = error;
    });
    const closed = new Promise((resolve) => {
      child.once("close", (code, closeSignal) => {
        closedResult = { code, signal: closeSignal };
        clearTimeout(timer);
        if (forceTimer) clearTimeout(forceTimer);
        resolve(closedResult);
      });
    });
    const reader = createInterface({ input: child.stdout });
    try {
      for await (const line of reader) {
        stdout.push(line);
        yield line;
      }
    } finally {
      reader.close();
      terminate();
      clearTimeout(timer);
    }
    const result = await closed;
    const output = stdout.join("\n");
    const errorOutput = Buffer.concat(stderr).toString("utf8");
    if (spawnError) throw spawnError;
    if (result.code !== 0) {
      throw cliFailure(result.code, timedOut ? "SIGTERM" : result.signal, output, errorOutput);
    }
  })();
}

function normalizeToken(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function modelTier(model) {
  const labelMatch = /\(([^()]+)\)\s*$/.exec(model.name ?? "");
  if (!labelMatch) return null;
  const idParts = model.id.split("-");
  const id = idParts.at(-1);
  const label = labelMatch[1].trim();
  if (!id || !label || normalizeToken(id) !== normalizeToken(label)) return null;
  return { id, name: label };
}

/**
 * Convert the provider's exact model rows into DSH model metadata. A reasoning
 * selector is added only when the provider actually returned multiple rows in
 * one dynamically discovered family; no model names or tier vocabulary are
 * embedded in Dockyard.
 */
export function parseAntigravityModelCatalog(output) {
  const rows = String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^fetching available models/i.test(line))
    .map((line) => {
      const [id, ...nameParts] = line.split("\t");
      return { id, name: nameParts.join("\t") || id };
    })
    .filter((model) => model.id);

  const families = new Map();
  for (const model of rows) {
    const tier = modelTier(model);
    if (!tier) continue;
    const familyId = model.id.slice(0, -(tier.id.length + 1));
    const family = families.get(familyId) ?? new Map();
    family.set(tier.id, tier);
    families.set(familyId, family);
  }

  return rows.map((model) => {
    const tier = modelTier(model);
    if (!tier) return model;
    const familyId = model.id.slice(0, -(tier.id.length + 1));
    const family = families.get(familyId);
    if (!family || family.size < 2) return model;
    const efforts = [...family.values()];
    return {
      ...model,
      reasoning: {
        efforts: efforts.map((effort) => ({ id: effort.id, name: effort.name })),
        defaultEffort: tier.id,
      },
    };
  });
}

function registryModels(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.models)) return value.models;
  return [];
}

function mergedAntigravityRegistry(registry, liveModelIds = []) {
  const byId = new Map();
  for (const candidate of registryModels(registry)) {
    if (!candidate || typeof candidate.id !== "string" || candidate.id.length === 0) continue;
    const defined = Object.fromEntries(Object.entries(candidate).filter(([, value]) => value !== undefined && value !== null));
    byId.set(candidate.id, { ...(byId.get(candidate.id) ?? {}), ...defined });
  }
  // The pinned model card is supplemental metadata, never a source of model
  // ids: attach a pinned row only when the live directory lists the id itself
  // or returns a reasoning tier of that family. Otherwise a retired upstream
  // model would stay callable on paper while the provider no longer serves it.
  for (const official of OFFICIAL_ANTIGRAVITY_MODEL_METADATA) {
    const referenced = byId.has(official.id)
      || liveModelIds.some((id) => id === official.id || id.startsWith(`${official.id}-`));
    if (!referenced) continue;
    byId.set(official.id, { ...official, ...(byId.get(official.id) ?? {}) });
  }
  return [...byId.values()];
}

function catalogScopeKey(accounts) {
  const accountIds = (Array.isArray(accounts) ? accounts : [])
    .map((account) => typeof account?.accountId === "string" ? account.accountId : "")
    .filter(Boolean)
    .sort();
  return accountIds.length > 0
    ? `accounts:${hash(accountIds.join("\n")).slice(0, 32)}`
    : "unscoped";
}

function defaultAntigravityCatalogCachePath({ env = process.env, home = homedir() } = {}) {
  const dockyardHome = env.DOCKYARD_DSH_HOME || join(home, ".dockyard-dsh");
  return join(dockyardHome, "antigravity-catalog.json");
}

function persistableCatalog(value) {
  return {
    models: Array.isArray(value?.models) ? value.models : [],
    source: typeof value?.source === "string" ? value.source : "official_antigravity_cli",
  };
}

async function readAntigravityCatalogCache(filePath) {
  if (!filePath) return { schema: 1, entries: {} };
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return {
      schema: 1,
      entries: parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch {
    return { schema: 1, entries: {} };
  }
}

async function writeAntigravityCatalogCache(filePath, cache) {
  if (!filePath) return;
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const entries = Object.entries(cache.entries ?? {}).slice(-8);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify({ schema: 1, entries: Object.fromEntries(entries) }), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

function registryMatch(model, registry) {
  const candidates = registryModels(registry)
    .filter((candidate) => candidate && typeof candidate.id === "string" && candidate.id.length > 0)
    .filter((candidate) => model.id === candidate.id || model.id.startsWith(`${candidate.id}-`))
    .sort((left, right) => right.id.length - left.id.length);
  const exact = candidates.find((candidate) => candidate.id === model.id);
  if (exact) return exact;

  // A live provider row may encode a returned reasoning tier in its model id
  // (for example, a family row ending in the provider-returned effort id).
  // Only use a registry family match when that suffix is itself present in
  // the live catalog's effort set; this avoids guessing across unrelated ids.
  const family = candidates[0];
  if (!family || !model.reasoning?.efforts?.length) return null;
  const suffix = model.id.slice(family.id.length + 1);
  return model.reasoning.efforts.some((effort) => normalizeToken(effort.id) === normalizeToken(suffix))
    ? family
    : null;
}

/**
 * Fill only metadata absent from the provider's live model rows. The live
 * Antigravity catalog remains authoritative for ids, names, and reasoning
 * tiers; a registry is used solely as a second, inspectable source for
 * capacities/modalities when the CLI omits them.
 */
export function enrichAntigravityModelCatalog(models, registry) {
  return (Array.isArray(models) ? models : []).map((model) => {
    const match = registryMatch(model, registry);
    if (!match) return model;
    const contextWindow = finiteNumber(model.contextWindow ?? match.contextWindow ?? match.context_window ?? match.context_length);
    const maxTokens = finiteNumber(model.maxTokens ?? match.maxTokens ?? match.max_tokens ?? match.max_output_tokens);
    const inputModalities = Array.isArray(model.inputModalities)
      ? model.inputModalities
      : Array.isArray(match.input) ? match.input : undefined;
    return {
      ...model,
      ...(Number.isInteger(contextWindow) ? { contextWindow } : {}),
      ...(Number.isInteger(maxTokens) ? { maxTokens } : {}),
      ...(inputModalities?.length ? { inputModalities: [...inputModalities] } : {}),
    };
  });
}

/** Cache live provider output, persist account-scoped metadata, and collapse concurrent reads. */
export function createAntigravityCatalogLoader({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  env = process.env,
  home = homedir(),
  cacheFilePath = env.DOCKYARD_ANTIGRAVITY_CATALOG_CACHE
    ?? defaultAntigravityCatalogCachePath({ env, home }),
  timeoutMs = 30_000,
  cacheTtlMs = Number(process.env.DOCKYARD_ANTIGRAVITY_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS,
  commandRunner = runCommand,
  registryLoader = null,
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env, home });
  const cached = new Map();
  const pending = new Map();
  const pendingRefreshes = new Set();
  let persistentPromise = null;
  let persistentCache = null;
  let persistWrite = Promise.resolve();

  const loadPersistent = () => {
    persistentPromise ??= readAntigravityCatalogCache(cacheFilePath).then((value) => {
      persistentCache = value;
      return value;
    });
    return persistentPromise;
  };

  const persist = (scope, value) => {
    if (!cacheFilePath || !Array.isArray(value?.models) || value.models.length === 0) return Promise.resolve();
    persistWrite = persistWrite.then(async () => {
      const cache = await loadPersistent();
      cache.entries[scope] = {
        fetchedAt: new Date().toISOString(),
        value: persistableCatalog(value),
      };
      const scopes = Object.keys(cache.entries);
      if (scopes.length > 8) {
        for (const staleScope of scopes.slice(0, scopes.length - 8)) delete cache.entries[staleScope];
      }
      await writeAntigravityCatalogCache(cacheFilePath, cache);
    }).catch(() => {});
    return persistWrite;
  };

  const refresh = (scope) => {
    if (pending.has(scope)) return pending.get(scope);
    const promise = Promise.resolve(commandRunner(resolvedCliPath, ["models"], {
      env,
      timeoutMs,
    })).then(async (result) => {
      let registry = [];
      if (typeof registryLoader === "function") {
        try {
          registry = await registryLoader();
        } catch {
          // The optional registry must never prevent the official CLI catalog
          // from loading. The provider's own rows remain usable without it.
        }
      }
      const liveModels = parseAntigravityModelCatalog(result.output);
      const models = enrichAntigravityModelCatalog(
        liveModels,
        mergedAntigravityRegistry(registry, liveModels.map((model) => model.id)),
      );
      const enriched = models.some((model, index) => {
        const original = liveModels[index];
        return model.contextWindow !== original?.contextWindow || model.maxTokens !== original?.maxTokens;
      });
      const value = {
        models,
        source: enriched ? "official_antigravity_cli+model_registry" : "official_antigravity_cli",
      };
      cached.set(scope, { value, cachedAt: Date.now() });
      await persist(scope, value);
      return value;
    }).catch((error) => {
      const previous = cached.get(scope)?.value;
      if (previous?.models?.length) {
        return {
          ...previous,
          source: `${previous.source ?? "official_antigravity_cli"}_stale`,
          diagnostics: [redactError(error)],
        };
      }
      // A missing or unavailable optional CLI must not reject DSH's global
      // model directory. Keep the provider mounted with an empty live
      // catalog; invocation and account scanning can report the actionable
      // CLI error when the user actually selects Antigravity.
      const unavailable = {
        models: [],
        source: error?.code === "ENOENT"
          ? "antigravity_cli_not_found"
          : "antigravity_cli_unavailable",
        diagnostics: [redactError(error)],
      };
      cached.set(scope, { value: unavailable, cachedAt: Date.now() });
      return unavailable;
    }).finally(() => {
      pending.delete(scope);
    });
    pendingRefreshes.add(promise);
    promise.finally(() => pendingRefreshes.delete(promise)).catch(() => {});
    pending.set(scope, promise);
    return promise;
  };

  const loadCatalog = async function loadCatalog({ force = false, accounts = [] } = {}) {
    const scope = catalogScopeKey(accounts);
    let entry = cached.get(scope);
    if (!entry) {
      const persisted = await loadPersistent();
      const stored = persistentCache?.entries?.[scope] ?? persisted.entries?.[scope];
      if (stored?.value && Array.isArray(stored.value.models)) {
        entry = {
          value: {
            ...stored.value,
            source: `${stored.value.source ?? "official_antigravity_cli"}_persistent_cache`,
          },
          cachedAt: 0,
        };
        cached.set(scope, entry);
      }
    }

    const fresh = entry && entry.cachedAt > 0 && Date.now() - entry.cachedAt < cacheTtlMs;
    if (!force && fresh) return entry.value;
    if (!force && entry) {
      void refresh(scope).catch(() => {});
      return entry.value;
    }
    return refresh(scope);
  };
  // Background refreshes are intentionally fire-and-forget for the runtime.
  // Callers that need determinism (tests, shutdown) can await whenIdle() to
  // settle every in-flight refresh and its persisted catalog write.
  loadCatalog.whenIdle = async () => {
    await Promise.allSettled([...pendingRefreshes]);
    await persistWrite.catch(() => {});
  };
  return loadCatalog;
}

function familyPrefixForModel(model) {
  const defaultEffort = model?.reasoning?.defaultEffort;
  if (typeof defaultEffort !== "string" || defaultEffort.length === 0) return null;
  const suffix = `-${defaultEffort}`;
  return model.id.endsWith(suffix) ? model.id.slice(0, -suffix.length) : null;
}

/**
 * Antigravity exposes tiered Gemini rows as exact model IDs. Resolve a DSH
 * model+effort pair to the exact returned row and omit --effort; the CLI
 * rejects passing an encoded tier together with a different effort flag.
 */
export async function resolveAntigravityInvocationModel({ catalogLoader, model, reasoningEffort } = {}) {
  if (typeof model !== "string" || typeof reasoningEffort !== "string" || !catalogLoader) {
    return { model, reasoningEffort };
  }
  try {
    const catalog = await catalogLoader();
    const selected = catalog?.models?.find((candidate) => candidate?.id === model);
    const prefix = familyPrefixForModel(selected);
    if (!selected || !prefix) return { model, reasoningEffort };
    const target = catalog.models.find((candidate) => {
      return candidate?.id?.startsWith(`${prefix}-`)
        && candidate.reasoning?.defaultEffort === reasoningEffort;
    });
    if (!target) return { model, reasoningEffort };
    return { model: target.id, reasoningEffort: undefined };
  } catch {
    // Catalog discovery is advisory for invocation. Keep the exact caller
    // values if the live model directory is temporarily unavailable.
    return { model, reasoningEffort };
  }
}

/**
 * Keep the native invocation model exactly as discovered. CodexSplit sends
 * Antigravity's tier-suffixed model id unchanged to streamGenerateContent;
 * the transport must not invent a family-id/thinkingLevel translation.
 *
 * The helper remains exported for compatibility with callers that used the
 * earlier experimental mapping, but it is intentionally a no-op now.
 */
export async function resolveAntigravityNativeInvocationModel({ catalogLoader, model, reasoningEffort } = {}) {
  return { model, reasoningEffort };
}

function contentText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string" || Array.isArray(value.content)) return contentText(value.content);
  if (value.type === "image") return "[previous image attachment omitted by Antigravity CLI]";
  if (value.type === "tool-call") return `[tool call: ${value.name ?? "unknown"}] ${value.arguments ?? ""}`;
  if (value.type === "tool-result") return contentText(value.content);
  return "";
}

function estimatedTokens(value) {
  const text = String(value ?? "");
  if (!text) return 0;
  // This is a safety estimate used only to avoid sending an obviously
  // oversized transcript. The actual capacity always comes from provider or
  // registry metadata; this is not a model-specific context constant.
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

function messageText(message) {
  return contentText(message?.content ?? message?.text);
}

function messagesWithinContext(request) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const contextWindow = finiteNumber(request.modelContext?.contextWindow);
  if (!Number.isInteger(contextWindow) || contextWindow <= 0) return messages;
  const outputBudget = finiteNumber(request.maxTokens ?? request.modelContext?.maxTokens);
  const inputBudget = contextWindow - (Number.isInteger(outputBudget) ? outputBudget : 0);
  if (inputBudget <= 0) return messages.slice(-1);

  const systemMessages = messages.filter((message) => message?.role === "system");
  const otherMessages = messages.filter((message) => message?.role !== "system");
  let used = estimatedTokens(request.system);
  for (const message of systemMessages) used += estimatedTokens(messageText(message));
  if (used + otherMessages.reduce((sum, message) => sum + estimatedTokens(messageText(message)), 0) <= inputBudget) {
    return messages;
  }

  const selected = [];
  for (let index = otherMessages.length - 1; index >= 0; index -= 1) {
    const message = otherMessages[index];
    const cost = estimatedTokens(messageText(message));
    if (selected.length === 0 || used + cost <= inputBudget) {
      selected.unshift(message);
      used += cost;
    }
  }
  return [...systemMessages, ...selected];
}

export function antigravityRequestPrompt(request = {}) {
  const sections = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    sections.push(`system:\n${request.system}`);
  }
  for (const message of messagesWithinContext(request)) {
    const text = messageText(message);
    if (!text) continue;
    sections.push(`${message?.role ?? "message"}:\n${text}`);
  }
  return sections.join("\n\n") || "Continue the conversation.";
}

function usageFromResponse(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = Number(usage.input_tokens ?? usage.inputTokens);
  const outputTokens = Number(usage.output_tokens ?? usage.outputTokens);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
  return {
    inputTokens,
    outputTokens,
    ...(Number.isFinite(Number(usage.reasoning_tokens ?? usage.reasoningTokens))
      ? { reasoningTokens: Number(usage.reasoning_tokens ?? usage.reasoningTokens) }
      : {}),
  };
}

function streamEventTexts(payload) {
  if (!payload || typeof payload !== "object") return [];
  const eventName = String(payload.event ?? payload.type ?? "").toLowerCase();
  const allowText = /delta|message|text|content/.test(eventName)
    && !/command_result|result/.test(eventName);
  const texts = [];

  function visit(value, allowNestedText = false, key = "") {
    if (typeof value === "string") {
      if (allowNestedText && key !== "event" && key !== "type") texts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, allowNestedText, key);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [childKey, child] of Object.entries(value)) {
      const normalizedKey = childKey.toLowerCase().replace(/[-_]/g, "");
      if (normalizedKey === "textdelta" || normalizedKey === "contentdelta") {
        if (typeof child === "string") texts.push(child);
        else visit(child, true, childKey);
        continue;
      }
      if (normalizedKey === "delta") {
        if (typeof child === "string") texts.push(child);
        else visit(child, true, childKey);
        continue;
      }
      if (normalizedKey === "response" || normalizedKey === "error" || normalizedKey === "usage") continue;
      if (normalizedKey === "text" && (allowNestedText || allowText)) {
        if (typeof child === "string") texts.push(child);
        continue;
      }
      if (child && typeof child === "object") {
        visit(child, allowNestedText || normalizedKey.includes("content") || normalizedKey.includes("message"), childKey);
      }
    }
  }

  visit(payload, allowText);
  return texts;
}

function streamEventResult(payload) {
  if (!payload || typeof payload !== "object") return null;
  const result = payload.result ?? payload.response;
  if (typeof result === "string") return { text: result, usage: payload.usage };
  if (!result || typeof result !== "object") return null;
  return {
    text: typeof result.response === "string" ? result.response : contentText(result.response),
    usage: result.usage ?? payload.usage,
    status: result.status,
    error: result.error,
  };
}

function requestTool(request, providerToolName) {
  const tools = Array.isArray(request?.tools) ? request.tools : [];
  const exact = tools.find((tool) => tool?.name === providerToolName);
  if (exact) return { name: exact.name, definition: exact };
  // Antigravity calls its command tool `run_command`; DSH presents the same
  // capability as `bash`. Keep this translation at the protocol boundary so
  // the actual DSH tool registry remains the source of truth.
  if (providerToolName === "run_command") {
    const bash = tools.find((tool) => tool?.name === "bash");
    if (bash) return { name: bash.name, definition: bash };
  }
  return null;
}

function toolCallFromEvent(payload, request) {
  const update = payload?.step_update;
  if (!update || String(update.state ?? "").toUpperCase() !== "ACTIVE" || update.step_type !== "tool") return null;
  const providerName = String(update.tool_name ?? update.tool_info?.name ?? "");
  if (!providerName) return null;
  const target = requestTool(request, providerName);
  if (!target) return null;
  const raw = update.tool_info?.parameters;
  const parameters = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  if (providerName === "run_command" && target.name === "bash") {
    const command = parameters.command ?? parameters.CommandLine;
    if (typeof command === "string" && command.length > 0) {
      return {
        name: target.name,
        arguments: {
          command,
          description: parameters.description ?? parameters.Description ?? "Run the requested command",
          ...(parameters.workdir ?? parameters.Cwd ? { workdir: parameters.workdir ?? parameters.Cwd } : {}),
          ...(parameters.timeoutMs ?? parameters.TimeoutMs ? { timeoutMs: parameters.timeoutMs ?? parameters.TimeoutMs } : {}),
        },
        id: String(update.tool_info?.call_id ?? update.call_id ?? `agy-${hash(JSON.stringify({ update, requestId: request.requestId ?? "" })).slice(0, 20)}`),
      };
    }
  }
  return {
    name: target.name,
    arguments: parameters,
    id: String(update.tool_info?.call_id ?? update.call_id ?? `agy-${hash(JSON.stringify({ update, requestId: request.requestId ?? "" })).slice(0, 20)}`),
  };
}

function appendDelta(current, next) {
  if (!next) return "";
  if (!current) return next;
  if (next.startsWith(current)) return next.slice(current.length);
  if (current.endsWith(next)) return "";
  return next;
}

/** Execute text turns through the installed official Antigravity CLI. */
export function createAntigravityCliExecutor({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  env = process.env,
  home = homedir(),
  timeoutMs = 300_000,
  commandRunner = runCommand,
  catalogLoader = null,
  streamCommandRunner = runStreamingCommand,
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env, home });
  return async function executeAntigravity({ request = {} } = {}) {
    if (contentHasImageInCurrentTurn(request)) {
      throw unsupportedContentError(
        PROVIDER_ID,
        "Antigravity CLI 当前没有暴露可接收 DSH 图片附件的原生输入通道",
      );
    }
    const resolved = await resolveAntigravityInvocationModel({
      catalogLoader,
      model: request.model,
      reasoningEffort: request.reasoningEffort,
    });
    return (async function* responseStream() {
      const args = ["-p", antigravityRequestPrompt(request)];
      if (typeof resolved.model === "string" && resolved.model.length > 0) {
        args.push("--model", resolved.model);
      }
      if (typeof resolved.reasoningEffort === "string" && resolved.reasoningEffort.length > 0) {
        args.push("--effort", resolved.reasoningEffort);
      }
      // Print mode cannot open an interactive permission prompt. The sandbox
      // makes a native tool request deterministic; we translate its intent
      // into DSH's own tool loop before the CLI reaches its denial boundary.
      args.push("--sandbox", "--output-format", "stream-json");
      yield { type: "block-start", index: 0, blockType: "text" };
      let text = "";
      let usage = null;
      const handledTools = new Set();
      for await (const line of streamCommandRunner(resolvedCliPath, args, {
        env,
        timeoutMs,
        signal: request.signal,
      })) {
        const parsed = parseJsonOutput(line);
        if (!parsed) continue;
        const tool = toolCallFromEvent(parsed, request);
        if (tool) {
          const key = `${tool.id}:${tool.name}:${JSON.stringify(tool.arguments)}`;
          if (handledTools.has(key)) continue;
          handledTools.add(key);
          yield { type: "block-end", index: 0, block: { type: "text", text } };
          yield { type: "block-start", index: 1, blockType: "tool-call" };
          yield {
            type: "block-end",
            index: 1,
            block: {
              type: "tool-call",
              id: tool.id,
              name: tool.name,
              arguments: JSON.stringify(tool.arguments),
            },
          };
          yield { type: "finish", reason: { kind: "tool-calls" } };
          return;
        }
        for (const delta of streamEventTexts(parsed)) {
          const next = appendDelta(text, delta);
          if (!next) continue;
          text += next;
          yield { type: "text-delta", index: 0, text: next };
        }
        const final = streamEventResult(parsed);
        if (final) {
          if (final.status && final.status !== "SUCCESS") {
            const error = new Error("Antigravity CLI request did not complete");
            error.detail = final.error ?? final.text ?? null;
            throw error;
          }
          const next = appendDelta(text, final.text);
          if (next) {
            text += next;
            yield { type: "text-delta", index: 0, text: next };
          }
          usage = usageFromResponse(final.usage) ?? usage;
        }
        usage = usageFromResponse(parsed.usage) ?? usage;
      }
      yield { type: "block-end", index: 0, block: { type: "text", text } };
      if (usage) yield { type: "usage", usage };
      yield { type: "finish", reason: { kind: "stop" } };
    })();
  };
}

function quotaGroups(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.quota_groups)) return data.quota_groups;
  if (Array.isArray(data.quotaGroups)) return data.quotaGroups;
  return [];
}

function findQuotaData(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (quotaGroups(value).length > 0) return value;
  for (const key of ["command", "data", "response", "quota_summary", "quotaSummary", "result"]) {
    const found = findQuotaData(value[key], depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function findCreditsData(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (Object.hasOwn(value, "remaining_credits") || Object.hasOwn(value, "remainingCredits")) return value;
  for (const child of Object.values(value)) {
    const found = findCreditsData(child, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

/** Normalize the credits block; the CLI and native payloads use either naming. */
function creditsFromData(data) {
  if (!data || typeof data !== "object") return null;
  const remaining = finiteNumber(data.remaining_credits ?? data.remainingCredits);
  const upgradeUri = stringValue(data.upgrade_uri ?? data.upgradeUri);
  if (remaining === null && upgradeUri === null) return null;
  return { remaining, upgradeUri };
}

function parseQuotaData(data, now = new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const group of quotaGroups(data)) {
    for (const bucket of group?.buckets ?? []) {
      const fraction = finiteNumber(bucket.remaining_fraction ?? bucket.remainingFraction);
      const percent = finiteNumber(bucket.remaining_percent ?? bucket.remainingPercent);
      const remaining = fraction ?? (percent === null ? null : percent / 100);
      windows.push({
        id: stringValue(bucket.id) ?? `${group.name ?? "group"}:${bucket.name ?? "window"}`,
        name: [group.name, bucket.name].filter(Boolean).join(" / ") || null,
        remaining,
        limit: remaining === null ? null : 1,
        unit: remaining === null ? null : "fraction",
        resetAt: isoFromEpoch(bucket.reset_time ?? bucket.resetTime),
        updatedAt: now.toISOString(),
        source,
      });
    }
  }
  return windows;
}

function parseQuotaText(text, now = new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts.length < 3 || !/%$/.test(parts[2])) continue;
    const remaining = finiteNumber(parts[2].replace(/%$/, ""));
    if (remaining === null) continue;
    windows.push({
      id: `${parts[0]}:${parts[1]}`,
      name: `${parts[0]} / ${parts[1]}`,
      remaining,
      limit: 100,
      unit: "percent",
      resetAt: isoFromEpoch(parts[3]),
      updatedAt: now.toISOString(),
      source,
    });
  }
  return windows;
}

/** Normalize the live first-party quota summary without embedding its rows. */
export function parseAntigravityNativeQuota(value, now = new Date()) {
  const data = findQuotaData(value);
  let windows = parseQuotaData(data, now, "antigravity_native");
  if (windows.length === 0) {
    windows = recursiveQuotaWindows(value, { source: "antigravity_native", now, prefix: "antigravity" });
  }
  const credits = findCreditsData(value);
  return {
    windows,
    credits: credits
      ? {
        remaining: finiteNumber(credits.remaining_credits ?? credits.remainingCredits),
        upgradeUri: stringValue(credits.upgrade_uri ?? credits.upgradeUri),
      }
      : null,
  };
}

function candidate(now, {
  email = null,
  session = null,
  existingAccounts = [],
  source = "official_antigravity_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  credentialRefreshMode = null,
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const capturedSession = normalizedEmail && session && !session.email
    ? { ...session, email: normalizedEmail }
    : session;
  const fingerprint = sessionFingerprint(capturedSession);
  const stableAccountId = normalizedEmail
    ? `antigravity:google:${hash(`email:${normalizedEmail.toLowerCase()}`).slice(0, 20)}`
    : fingerprint
      ? `antigravity:session:${hash(`fingerprint:${fingerprint}`).slice(0, 20)}`
      : "antigravity:active";
  const known = existingAccounts.find((account) => (
    (fingerprint && account?.resources?.sessionFingerprint === fingerprint)
      || sameEmail(account?.email, normalizedEmail)
  ));
  const legacy = existingAccounts.find((account) => account?.accountId === "antigravity:active");
  // Migrate the account record created by the old single-session driver in
  // place. Once its fingerprint is recorded, the next switched session gets
  // a separate accountId and can be added to the pool independently.
  const accountId = known?.accountId
    ?? (legacy && !legacy.resources?.sessionFingerprint && stableAccountId !== "antigravity:active"
      ? legacy.accountId
      : stableAccountId);
  const identityLabel = normalizedEmail
    ?? (fingerprint ? `Antigravity 官方会话 · ${fingerprint}` : "Antigravity 官方当前会话");
  const identitySource = normalizedEmail
    ? "official_cli_auth_status"
    : fingerprint
      ? "local_oauth_session_fingerprint"
      : "official_active_session";
  const credentialRef = createCredentialRef(PROVIDER_ID, accountId);
  const value = {
    candidateId: `antigravity:${hash(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId,
    displayName: identityLabel,
    email: normalizedEmail,
    subscription: { plan: null, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: capturedSession?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: capturedSession?.lastRefreshedAt ?? null,
      refreshable: capturedSession?.refreshToken ? true : null,
    },
    imported: false,
    status: "available",
    diagnostic: null,
    credentialRef,
    resources: {
      ...officialSessionResources({ sourceKind, authSource: source }),
      ...(credentialRefreshMode ? { credentialRefreshMode } : {}),
      identitySource,
      identityLabel,
      ...(fingerprint ? { sessionFingerprint: fingerprint } : {}),
      identityNote: normalizedEmail
        ? "账号邮箱来自官方 Antigravity 登录态"
        : fingerprint
          ? "官方登录态未返回邮箱；使用会话指纹区分账号"
          : "官方只返回当前会话；切换账号后请重新扫描",
      sessionPersistence: capturedSession?.token ? "captured" : "active",
    },
  };
  Object.defineProperty(value, CREDENTIAL_SLOT, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID,
      ...(capturedSession?.token ? { access: capturedSession.token } : {}),
      ...(capturedSession?.refreshToken ? { refresh: capturedSession.refreshToken } : {}),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      ...(capturedSession?.expiresAt ? { expiresAt: capturedSession.expiresAt } : {}),
      ...(capturedSession?.lastRefreshedAt ? { lastRefreshedAt: capturedSession.lastRefreshedAt } : {}),
    },
    enumerable: false,
  });
  return value;
}

export function summarizeAntigravityCandidate(value) {
  return {
    providerId: PROVIDER_ID,
    candidateId: value.candidateId,
    source: value.source,
    accountId: value.accountId,
    displayName: value.displayName,
    email: value.email,
    subscription: { ...value.subscription },
    refresh: { ...value.refresh },
    resources: { ...value.resources },
    imported: Boolean(value.imported),
    status: value.status ?? "available",
    diagnostic: value.diagnostic ?? null,
  };
}

const ANTIGRAVITY_AUTH_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2\/(?:v2\/)?auth\?[^\s"'<>]+/i;

function cleanAntigravityAuthUrl(value) {
  return String(value ?? "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[),.;]+$/, "");
}

function publicAntigravityAuthSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: PROVIDER_ID,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    ...(session.browserOpened ? { browserOpened: true } : {}),
    ...(session.inputRequired ? { inputRequired: true } : {}),
    diagnostic: session.diagnostic ?? null,
  };
}

/**
 * Start agy's own Google OAuth flow in a temporary profile.
 *
 * agy has no separate login subcommand: its normal `agy -p` command starts
 * the official OAuth flow when that profile is unauthenticated. Running it
 * with an isolated HOME lets DSH add another Google account without touching
 * the user's active CLI session. The child is never attached to a terminal;
 * only the authorization URL and the resulting token are used.
 */
export function createAntigravityOAuthAuthorizer({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  environment = process.env,
  home = homedir(),
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  prompt = "Reply with OK",
  spawnImpl = spawn,
  tokenReader = readAntigravityTokenFile,
  usePty = process.platform === "darwin",
  ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
  instructions = "已打开 Google 官方验证页；选择账号并完成验证后，DSH 会自动接入。",
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env: environment, home });
  if (!resolvedCliPath) throw new Error("Antigravity OAuth authorizer requires an agy CLI path");
  if (typeof spawnImpl !== "function") throw new Error("Antigravity OAuth authorizer requires a process spawner");
  if (typeof tokenReader !== "function") throw new Error("Antigravity OAuth authorizer requires a token reader");

  const sessions = new Map();

  async function cleanup(session) {
    if (!session.profileDir) return;
    await rm(session.profileDir, { recursive: true, force: true }).catch(() => {});
    session.profileDir = null;
  }

  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32_000);
    if (!session.authorizationUrl) {
      const match = session.output.match(ANTIGRAVITY_AUTH_URL_PATTERN);
      if (match?.[0]) session.authorizationUrl = cleanAntigravityAuthUrl(match[0]);
    }
    if (/authorization code|redirect URL/i.test(session.output)) session.inputRequired = true;
  }

  function readToken(session) {
    try {
      return tokenReader({ env: session.childEnv, home: session.profileDir });
    } catch {
      return null;
    }
  }

  async function finalize(session, context, credential = null) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const auth = credential ?? readToken(session);
        if (!auth?.token) {
          if (session.exitCode === null) return publicAntigravityAuthSession(session);
          session.status = "failed";
          session.diagnostic = session.timedOut
            ? "Google 验证超时，请重新点击登录添加账号。"
            : session.launchError
              ? `无法启动 agy 官方验证：${session.launchError}`
              : `agy 官方验证未完成（退出码 ${session.exitCode ?? "unknown"}）。`;
          return publicAntigravityAuthSession(session);
        }

        // The prompt only bootstraps agy's official auth flow. Stop it as soon
        // as the OAuth token is persisted so DSH never spends a model request.
        if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
        const account = candidate(context?.now instanceof Date ? context.now : new Date(), {
          email: extractAntigravityAccountEmail(session.output),
          session: auth,
          existingAccounts: context?.accounts ?? [],
          // agy's isolated temporary profile is a browser OAuth session, not
          // the user's active local CLI session. Mark it accordingly so quota
          // refresh and request execution use the captured credential instead
          // of rejecting it as a session mismatch. Its refresh token belongs
          // to agy's own OAuth client, so DSH must not exchange it with an
          // unrelated/empty browser client.
          source: "official_antigravity_browser_oauth",
          sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
          credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION,
        });
        session.status = "completed";
        session.result = {
          ...publicAntigravityAuthSession(session),
          status: "completed",
          accounts: [account],
          diagnostic: null,
        };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicAntigravityAuthSession(session);
      } finally {
        if (session.status === "completed" || session.status === "failed") {
          if (session.timer) clearTimeout(session.timer);
          await cleanup(session);
        }
      }
    })();
    return session.finalizing;
  }

  async function begin() {
    const profileDir = await mkdtemp(join(tmpdir(), "dockyard-antigravity-oauth-"));
    const tokenPath = join(profileDir, ".gemini", "antigravity-cli", "antigravity-oauth-token");
    const childEnv = {
      ...environment,
      HOME: profileDir,
      XDG_CONFIG_HOME: join(profileDir, ".config"),
      DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath,
    };
    childEnv.PATH = augmentPathWithUserBins(childEnv, home);
    // Do not force AGY_CLI_HIDE_ACCOUNT_INFO here. In agy, the presence of
    // the variable is itself treated as enabled even when its value is "0";
    // that mode skips the browser OAuth bootstrap and only asks the user to
    // run agy manually. The official default is the desired browser flow.
    delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    const session = {
      sessionId: `${PROVIDER_ID}:${randomUUID()}`,
      providerId: PROVIDER_ID,
      profileDir,
      childEnv,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: new Date().toISOString(),
      // agy owns the official browser OAuth flow and opens this URL itself.
      // The DSH host must not open the captured URL a second time.
      browserOpened: true,
      exitCode: null,
      launchError: null,
      output: "",
      inputRequired: false,
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null,
    };
    sessions.set(session.sessionId, session);

    try {
      // agy refuses to bootstrap OAuth when stdin is a plain pipe. macOS's
      // built-in `script` gives it a hidden pseudo-terminal while DSH still
      // owns the pipe, so the user only sees the browser verification page.
      const command = usePty ? ptyPythonPath : resolvedCliPath;
      const args = usePty
        ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, resolvedCliPath, "-p", prompt, "--output-format", "json"]
        : ["-p", prompt, "--output-format", "json"];
      const child = spawnImpl(command, args, {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicAntigravityAuthSession(session);
  }

  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId: PROVIDER_ID,
        status: "missing",
        instructions,
        diagnostic: "验证会话不存在或已结束，请重新点击登录添加账号。",
      };
    }
    if (session.result) return session.result;
    const credential = readToken(session);
    if (!credential?.token && session.exitCode === null) return publicAntigravityAuthSession(session);
    const result = await finalize(session, context, credential);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }

  async function submitAuthorizationCode(sessionId, value) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("验证会话不存在或已结束，请重新点击登录添加账号");
    const code = String(value ?? "").trim();
    if (!code) throw new Error("请输入 Google 验证码或回调地址");
    if (code.length > 4096 || /[\u0000-\u001f\u007f]/.test(code)) {
      throw new Error("Google 验证码或回调地址格式无效");
    }
    if (!session.child || session.exitCode !== null || !session.child.stdin?.writable) {
      throw new Error("agy 验证进程已结束，请重新点击登录添加账号");
    }
    session.child.stdin.write(`${code}\n`);
    session.inputRequired = false;
    session.status = "processing";
    session.instructions = "授权码已提交，正在等待官方登录完成。";
    return publicAntigravityAuthSession(session);
  }

  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId: PROVIDER_ID, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId: PROVIDER_ID, status: "cancelled" };
  }

  return Object.freeze({ begin, poll, cancel, submitAuthorizationCode });
}

export class AntigravityOfficialSessionDriver {
  constructor({
    cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
    env = process.env,
    home = homedir(),
    cacheFilePath,
    timeoutMs = 30_000,
    commandRunner = runCommand,
    ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
    // Background refresh is a non-interactive `agy models` call. The PTY is
    // only needed for the browser bootstrap authorizer; wrapping this refresh
    // in a PTY makes agy report a false exit-code failure on macOS.
    usePtyForSessionRefresh = false,
    requestExecutor = null,
    catalogLoader = null,
    quotaReader = null,
    tokenResolver = resolveAntigravityAccessToken,
    identityFromOfficialCli = true,
    identityFromOfficialSession = identityFromOfficialCli,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_ANTIGRAVITY_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL || ANTIGRAVITY_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_ANTIGRAVITY_TOKEN_URL || ANTIGRAVITY_BROWSER_TOKEN_URL,
    userInfoUrl = env.DOCKYARD_ANTIGRAVITY_USERINFO_URL || ANTIGRAVITY_BROWSER_USERINFO_URL,
    clientId = env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || ANTIGRAVITY_BROWSER_CLIENT_ID,
    clientSecret = env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || ANTIGRAVITY_BROWSER_CLIENT_SECRET,
    oauthScope = env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE || ANTIGRAVITY_BROWSER_SCOPES,
    redirectUri = env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI || ANTIGRAVITY_BROWSER_REDIRECT_URI,
    fetchImpl = fetch,
    authorizationTimeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  } = {}) {
    // SECURITY.md: remote OAuth endpoints must be https (or loopback http)
    // even when they come from the environment.
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL");
    const resolvedCli = resolveAgyCliPath(cliPath, { env, home });
    this.cliPath = resolvedCli;
    this.env = env;
    this.home = home;
    this.timeoutMs = timeoutMs;
    this.commandRunner = commandRunner;
    this.ptyPythonPath = ptyPythonPath;
    this.usePtyForSessionRefresh = usePtyForSessionRefresh;
    this.fetchImpl = fetchImpl;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_ANTIGRAVITY_TOKEN_URL");
    this.browserUserInfoUrl = userInfoUrl
      ? assertSecureEndpointUrl(userInfoUrl, "DOCKYARD_ANTIGRAVITY_USERINFO_URL")
      : userInfoUrl;
    this.browserClientId = clientId;
    this.browserClientSecret = clientSecret;
    this.requestExecutor = requestExecutor;
    this.quotaReader = quotaReader;
    this.tokenResolver = tokenResolver;
    this.identityFromOfficialSession = identityFromOfficialSession;
    this.cliOAuthAuthorizer = createAntigravityOAuthAuthorizer({
      cliPath: resolvedCli,
      environment: env,
      home,
      timeoutMs: authorizationTimeoutMs,
    });
    const browserOAuthConfigured = Boolean(clientId && clientSecret);
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth && browserOAuthConfigured
      ? createBrowserOAuthAuthorizer({
        providerId: PROVIDER_ID,
        redirectUri,
        callbackPath: new URL(redirectUri).pathname,
        callbackHost: new URL(redirectUri).hostname,
        callbackPort: Number(new URL(redirectUri).port || 51121),
        instructions: "请在 Google 官方授权页面选择账号并完成授权；完成后会自动返回 Dockyard DSH。",
        authorizationUrlBuilder: ({ state, codeChallenge, redirectUri: callback }) => `${authorizationUrl}?${new URLSearchParams({
          access_type: "offline",
          client_id: clientId,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          prompt: "consent",
          redirect_uri: callback,
          response_type: "code",
          scope: oauthScope,
          state,
        })}`,
        exchangeCode: async ({ code, codeVerifier, redirectUri, context }) => {
          const response = await this.fetchImpl(tokenUrl, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              code_verifier: codeVerifier,
              grant_type: "authorization_code",
              redirect_uri: redirectUri,
            }),
            ...(context.signal ? { signal: context.signal } : {}),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.access_token) {
            throw new Error(`Antigravity Google token exchange failed (${response.status})`);
          }
          return body;
        },
        importCredentials: async (tokens, context) => {
          const access = tokens?.access_token ?? tokens?.accessToken;
          const refresh = tokens?.refresh_token ?? tokens?.refreshToken;
          if (!access) throw new Error("Antigravity Google OAuth did not return an access token");
          let profile = null;
          try {
            const response = await this.fetchImpl(userInfoUrl, {
              headers: { authorization: `Bearer ${access}` },
              ...(context.signal ? { signal: context.signal } : {}),
            });
            if (response.ok) profile = await response.json().catch(() => null);
          } catch {
            // Account import can still use the token fingerprint if profile lookup is unavailable.
          }
          const now = context.now instanceof Date ? context.now : new Date();
          const candidateValue = candidate(now, {
            email: profile?.email,
            session: {
               token: access,
               refreshToken: refresh,
               expiresAt: tokenExpiresAt(tokens, now),
               lastRefreshedAt: now.toISOString(),
             },
            existingAccounts: context.accounts ?? [],
            source: "official_antigravity_browser_oauth",
            sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
            credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.DSH_BROWSER_OAUTH,
          });
          return [await this.importAccount(candidateValue, context)];
        },
      })
      : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliOAuthAuthorizer;
    this.catalogLoader = catalogLoader ?? createAntigravityCatalogLoader({
      cliPath: resolvedCli,
      env,
      home,
      ...(cacheFilePath !== undefined ? { cacheFilePath } : {}),
      timeoutMs,
      commandRunner,
    });
  }

  async #slash(command, signal) {
    const result = await this.commandRunner(this.cliPath, ["-p", command, "--output-format", "json"], {
      env: this.env,
      timeoutMs: this.timeoutMs,
      includeAccountInfo: true,
      ...(signal ? { signal } : {}),
    });
    const parsed = parseJsonOutput(result.output);
    return { ...result, parsed };
  }

  async #resolveSessionEmail(session, context = {}) {
    const direct = extractAntigravityAccountEmail(session);
    if (direct) return direct;
    if (!session?.token || typeof this.fetchImpl !== "function" || !this.browserUserInfoUrl) return null;
    try {
      const response = await this.fetchImpl(this.browserUserInfoUrl, {
        headers: { authorization: `Bearer ${session.token}` },
        ...(context.signal ? { signal: context.signal } : {}),
      });
      if (!response?.ok) return null;
      return extractAntigravityAccountEmail(await response.json().catch(() => null));
    } catch {
      return null;
    }
  }

  async #assertActiveSession(account, context = {}) {
    if (!isOfficialSessionAuthKind(account?.auth?.kind)) return;
    if (account.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return;
    const expectedFingerprint = account.resources?.sessionFingerprint;
    if (expectedFingerprint) {
      let current;
      try {
        current = await this.tokenResolver({ env: this.env });
      } catch {
        throw activeSessionError("Antigravity OAuth session is unavailable; authorize again");
      }
      if (!current?.token || sessionFingerprint(current) !== expectedFingerprint) {
        if (current?.token && context.allowSessionTokenRotation === true) return;
        // A rotated access token legitimately changes the token-based
        // fingerprint even though the local session belongs to the same
        // account. When the current session exposes a stable identity, verify
        // it against the pooled account before rejecting the request.
        const currentEmail = await this.#resolveSessionEmail(current, context);
        if (currentEmail && account.email && sameEmail(currentEmail, account.email)) return;
        throw activeSessionError(
          "Antigravity selected account is not the active local session; authorize it again",
          { mismatch: true },
        );
      }
      return;
    }
    if (account.accountId === "antigravity:active" && !account.email) return;

    let result;
    try {
      result = await this.#slash("/quota", context.signal);
    } catch {
      throw activeSessionError("Antigravity active session could not be verified; authorize again");
    }
    const email = extractAntigravityAccountEmail(result.parsed, result.output, result.errorOutput);
    if (account.email && email && sameEmail(account.email, email)) return;
    throw activeSessionError(
      "Antigravity selected account is not the active local session; authorize it again",
      { mismatch: true },
    );
  }

  async #refreshOfficialCredential(account, context = {}) {
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    if (typeof this.tokenResolver !== "function") return null;

    let current;
    try {
      current = await this.tokenResolver({ env: this.env });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity official session could not be read: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    if (!current?.token) return null;

    const now = context.now instanceof Date ? context.now : new Date();
    const credential = {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID,
      access: current.token,
      ...(current.refreshToken ? { refresh: current.refreshToken } : {}),
      ...(current.expiresAt ? { expiresAt: current.expiresAt } : {}),
    };
    const rotated = current.source === "antigravity_keychain"
      && Boolean(account?.resources?.sessionFingerprint)
      && sessionFingerprint(current) !== account.resources?.sessionFingerprint;
    if (!tokenNeedsRefresh(credential, now)) {
      // When agy's Keychain has already rotated the session, keep DSH's own
      // secure copy aligned even though no second CLI refresh is necessary.
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (current.source === "antigravity_keychain"
        && credentialRef
        && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, credential);
      }
      return { session: current, credential, rotated };
    }
    if (!current.refreshToken) {
      throw activeSessionError("Antigravity official session has expired; authorize again");
    }

    // Refresh the real agy profile in place. agy's macOS keyring is global to
    // the user and does not provide a per-HOME profile boundary; putting the
    // child in a temporary HOME therefore caused the keychain lookup shown by
    // the user and left DSH with the old file token. Keep HOME/XDG untouched,
    // ask agy to use its supported file-backed session, then mirror the
    // rotated credential into DSH's own secure store below.
    const officialTokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir();
    const childEnv = agyRefreshEnvironment(this.env, officialTokenPath);
    try {
      await mkdir(dirname(officialTokenPath), { recursive: true, mode: 0o700 });
      const refreshCommand = this.usePtyForSessionRefresh ? this.ptyPythonPath : this.cliPath;
      const refreshArgs = this.usePtyForSessionRefresh
        ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, this.cliPath, "models"]
        : ["models"];
      await this.commandRunner(refreshCommand, refreshArgs, {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal,
      });
      let refreshed = null;
      try {
        // agy may refresh the keyring without rewriting its legacy file. Read
        // the provider-owned keyring again before accepting the file copy.
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
        // The file fallback below remains useful for older/headless agy builds.
      }
      refreshed = refreshed?.token
        ? refreshed
        : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) throw new Error("agy did not persist a refreshed OAuth token");
      const nextCredential = {
        ...credential,
        access: refreshed.token,
        ...(refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {}),
        ...(refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {}),
        lastRefreshedAt: now.toISOString(),
      };
      const expiry = nextCredential.expiresAt ? Date.parse(nextCredential.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 60_000;
      if (nextCredential.access === credential.access && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      await mkdir(dirname(officialTokenPath), { recursive: true, mode: 0o700 });
      const persistedPath = `${officialTokenPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(persistedPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: nextCredential.access,
            refresh_token: nextCredential.refresh,
            token_type: "Bearer",
            ...(nextCredential.expiresAt ? { expiry: nextCredential.expiresAt } : {}),
          },
        }), { encoding: "utf8", mode: 0o600 });
        await rename(persistedPath, officialTokenPath);
      } finally {
        await rm(persistedPath, { force: true }).catch(() => {});
      }
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, nextCredential);
      }
      return { session: refreshed, credential: nextCredential, rotated: true };
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity official session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async #refreshAgyCredential(credential, context = {}) {
    if (!credential?.refresh) {
      throw activeSessionError("Antigravity agy session has no refresh token; authorize again");
    }

    const tokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir();
    const childEnv = agyRefreshEnvironment(this.env, tokenPath);
    const now = context.now instanceof Date ? context.now : new Date();

    try {
      await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 });
      // A captured browser session may be the first DSH record and therefore
      // have no file in the official profile yet. Seed only that missing file;
      // an existing file remains authoritative for the active agy profile.
      if (!readAntigravityTokenFile({ env: childEnv, home: officialHome })?.token) {
        await writeFile(tokenPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: credential.access,
            refresh_token: credential.refresh,
            token_type: "Bearer",
            ...(credential.expiresAt ? { expiry: credential.expiresAt } : {}),
          },
        }), { encoding: "utf8", mode: 0o600 });
      }

      // `agy models` is a provider-owned authenticated command. It refreshes
      // the token file when the access token is stale without spending a
      // generation request, and keeps Google's client id/secret inside agy.
      await this.commandRunner(this.cliPath, ["models"], {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal,
      });

      let refreshed = null;
      try {
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
        // Fall back to the stable file for older/headless agy builds.
      }
      refreshed = refreshed?.token
        ? refreshed
        : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) {
        throw new Error("agy did not persist a refreshed OAuth token");
      }
      const next = {
        ...credential,
        access: refreshed.token,
        ...(refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {}),
        ...(refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {}),
        lastRefreshedAt: now.toISOString(),
      };
      const accessChanged = next.access !== credential.access;
      const expiry = next.expiresAt ? Date.parse(next.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 60_000;
      if (!accessChanged && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      return next;
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity agy session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async #refreshBrowserCredential(account, context = {}) {
    if (account?.resources?.sessionSource !== OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    if (!credentialRef || typeof context.secretStore?.read !== "function") {
      throw activeSessionError("Antigravity browser OAuth credential is unavailable; authorize again");
    }
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      throw activeSessionError("Antigravity browser OAuth credential is missing; authorize again");
    }
    const refreshMode = credentialRefreshMode(account);
    const dshManagedRefresh = refreshMode !== ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION;
    const now = context.now instanceof Date ? context.now : new Date();
    if (refreshMode === ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION) {
      if (!tokenNeedsRefresh(credential, now)) return credential;
      const updated = await this.#refreshAgyCredential(credential, context);
      await context.secretStore.write(credentialRef, updated);
      return updated;
    }
    // Accounts captured from agy's temporary browser profile carry agy's
    // refresh token, not a token issued for DSH's optional browser OAuth
    // client. The standard DSH launch agent also has no browser client
    // credentials. In either case the captured access token must be used as-is
    // for native quota/invocation instead of turning a successful login into
    // the misleading "订阅未返回" state with a blank client refresh call.
    if (!dshManagedRefresh || !this.browserClientId || !this.browserClientSecret) return credential;
    if (!tokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      throw activeSessionError("Antigravity browser OAuth token expired; authorize again");
    }
    let response;
    try {
      response = await this.fetchImpl(this.browserTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.browserClientId,
          client_secret: this.browserClientSecret,
          grant_type: "refresh_token",
          refresh_token: credential.refresh,
        }),
        ...(context.signal ? { signal: context.signal } : {}),
      });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity Google OAuth refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = activeSessionError("Antigravity Google OAuth refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: tokenExpiresAt(body, now) ?? credential.expiresAt ?? null,
      lastRefreshedAt: now.toISOString(),
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }

  async #nativeQuota(account, context, now) {
    if (typeof this.quotaReader !== "function") return null;
    let credential = null;
    const credentialRef = account?.auth?.credentialRef;
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) {
      credential = await this.#refreshBrowserCredential(account, context);
    } else if (context.officialCredential) {
      credential = context.officialCredential;
    } else if (credentialRef && context.secretStore && typeof context.secretStore.read === "function") {
      credential = await context.secretStore.read(credentialRef);
    }
    const value = await this.quotaReader({ account, credential, context });
    const parsed = parseAntigravityNativeQuota(value, now);
    if (parsed.windows.length === 0 && !parsed.credits) return null;
    return parsed;
  }

  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    try {
      let session = null;
      try {
        session = typeof this.tokenResolver === "function"
          ? await this.tokenResolver({ env: this.env })
          : null;
      } catch {
        // The official CLI can still be authenticated through a daemon or
        // another local source even when the token file is unavailable.
      }
      let windows = [];
      let source = "official_antigravity_cli";
      try {
        const native = await this.#nativeQuota(null, context, now);
        windows = native?.windows ?? [];
        if (windows.length > 0) source = "antigravity_native";
      } catch {
        // Discovery still falls back to the official CLI when the native
        // endpoint is unavailable or the local token needs reauthorization.
      }
      let result = null;
      let cliIdentityError = null;
      if (windows.length === 0 || this.identityFromOfficialSession) {
        try {
          result = await this.#slash("/quota", context.signal);
          const data = result.parsed?.command?.data;
          if (windows.length === 0) {
            windows = parseQuotaData(data, now);
            if (windows.length === 0) windows = parseQuotaText(result.parsed?.response ?? "", now);
          }
        } catch (error) {
          cliIdentityError = error;
          if (windows.length === 0) throw error;
        }
      }
      const email = extractAntigravityAccountEmail(
        result?.parsed,
        result?.output,
        result?.errorOutput,
      ) ?? await this.#resolveSessionEmail(session, context);
      const found = candidate(now, {
        email,
        session,
        existingAccounts: context.accounts ?? [],
        source,
        sourceKind: source === "antigravity_native"
          ? (session?.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE)
          : OFFICIAL_SESSION_SOURCE_KINDS.CLI,
      });
      found.status = windows.length ? "available" : "degraded";
      found.diagnostic = windows.length
        ? null
        : source === "antigravity_native"
          ? "官方会话已读取，但没有返回结构化 quota 窗口"
          : "官方 CLI 已启动，但没有返回结构化 quota 窗口";
      return {
        candidates: [found],
        source,
        diagnostics: [
          ...(result?.parsed?.status === "SUCCESS" || !result ? [] : ["Antigravity CLI 返回了非成功状态"]),
          ...(cliIdentityError && windows.length ? ["官方 CLI 账号身份暂未返回；已使用本地会话标识"] : []),
        ],
      };
    } catch (error) {
      return {
        candidates: [],
        source: "official_antigravity_cli",
        diagnostics: [`无法读取 Antigravity 官方会话：${redactError(error)}`],
      };
    }
  }

  async importAccount(value, context = {}) {
    const session = value?.[CREDENTIAL_SLOT];
    if (!session) throw new Error("Antigravity candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(value.credentialRef, session);
    return {
      providerId: PROVIDER_ID,
      accountId: value.accountId,
      credentialRef: value.credentialRef,
      displayName: value.displayName,
      email: value.email ?? null,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { plan: null, status: null, expiresAt: null },
      refresh: {
        accessTokenExpiresAt: session.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: session.lastRefreshedAt ?? null,
        refreshable: session.refresh ? true : null,
      },
      resources: {
        ...officialSessionResources({
          sourceKind: value.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: value.source ?? "official_antigravity_cli_session",
        }),
        transport: "gemini_stream_generate_content_sse",
        quotaSource: value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP
          ? "official_client_status"
          : value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
            ? "antigravity_browser_oauth"
            : "antigravity_cli_status",
        ...(value.resources ?? {}),
      },
    };
  }

  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      const candidateValue = discovered?.candidates?.[0];
      if (!candidateValue) return null;
      const account = await this.importAccount(candidateValue, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "已检测到 Antigravity 官方会话，当前账号已接入 Dockyard DSH。",
        accounts: [account],
        diagnostic: null,
      };
    } catch (error) {
      // Keep the no-session contract, but never swallow the cause silently:
      // the redacted failure rides along so callers can surface why the
      // official session could not be imported.
      return {
        status: "failed",
        providerId: PROVIDER_ID,
        instructions: "未能读取 Antigravity 官方会话，请重新扫描或登录。",
        accounts: [],
        diagnostic: redactError(error),
      };
    }
  }

  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliOAuthAuthorizer.begin(context);
    return started;
  }

  #authorizationAuthorizer(sessionId) {
    if (sessionId?.includes(":browser:")) return this.browserAuthorizer;
    return this.oauthAuthorizer === this.browserAuthorizer ? this.cliOAuthAuthorizer : this.oauthAuthorizer;
  }

  async pollAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).poll(sessionId, context);
  }

  async submitAuthorizationCode(sessionId, code, context = {}) {
    return this.#authorizationAuthorizer(sessionId).submitAuthorizationCode(sessionId, code, context);
  }

  async cancelAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).cancel(sessionId, context);
  }

  async refreshAccount(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...(officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}),
    });
    const now = context.now instanceof Date ? context.now : new Date();
    let session = officialCredential?.session ?? null;
    try {
      session = session ?? await this.tokenResolver({ env: this.env });
    } catch {
      // The fingerprint below stays absent when the local session cannot be
      // read; the account keeps its existing fingerprint.
    }
    const sessionEmail = await this.#resolveSessionEmail(session, context);
    const fingerprint = sessionFingerprint(sessionEmail && session && !session.email
      ? { ...session, email: sessionEmail }
      : session);
    const fingerprintResources = fingerprint ? { sessionFingerprint: fingerprint } : {};
    const persistedRefreshMode = account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
      ? credentialRefreshMode(account)
        ?? (!this.browserClientId || !this.browserClientSecret
          ? ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION
          : null)
      : null;
    const identityPatch = sessionEmail ? { email: sessionEmail } : {};
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...(officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}),
      }, now);
      if (native) {
        const primary = selectPrimaryQuotaWindow(native.windows);
        return {
          ...identityPatch,
          quota: {
            ...primary,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native",
          },
          credits: native.credits,
          resources: {
            quotaSource: "antigravity_native",
            ...(persistedRefreshMode ? { credentialRefreshMode: persistedRefreshMode } : {}),
            ...fingerprintResources,
          },
          refresh: {
            accessTokenExpiresAt: browserCredential?.expiresAt
              ?? officialCredential?.credential?.expiresAt
              ?? account.refresh?.accessTokenExpiresAt
              ?? null,
            nextRefreshAt: null,
            lastRefreshedAt: browserCredential?.lastRefreshedAt ?? account.refresh?.lastRefreshedAt ?? now.toISOString(),
            refreshable: browserCredential
              ? Boolean(browserCredential.refresh)
              : officialCredential?.credential
                ? Boolean(officialCredential.credential.refresh)
                : account.refresh?.refreshable ?? null,
          },
        };
      }
    } catch (error) {
      nativeError = error;
    }
    // Never use the process-wide `agy` session to refresh an imported
    // account. That makes separate Google accounts look identical.
    if (typeof this.quotaReader === "function" && account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [result, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null),
    ]);
    if (result.parsed?.status && result.parsed.status !== "SUCCESS") {
      throw new Error("Antigravity official quota command did not complete");
    }
    const windows = parseQuotaData(result.parsed?.command?.data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(result.parsed?.response ?? "", now);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      ...identityPatch,
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli",
      },
      credits: creditsFromData(creditsResult?.parsed?.command?.data),
      resources: fingerprintResources,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null,
      },
    };
  }

  async getQuota(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...(officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}),
    });
    const now = context.now instanceof Date ? context.now : new Date();
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...(browserCredential ? { browserCredential } : {}),
        ...(officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}),
      }, now);
      if (native) {
        const primary = selectPrimaryQuotaWindow(native.windows);
        return {
          quota: {
            ...primary,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native",
          },
          credits: native.credits,
          resources: { quotaSource: "antigravity_native" },
          refresh: {
            accessTokenExpiresAt: null,
            nextRefreshAt: null,
            lastRefreshedAt: now.toISOString(),
            refreshable: null,
          },
        };
      }
    } catch (error) {
      nativeError = error;
    }
    if (typeof this.quotaReader === "function" && account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [quotaResult, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null),
    ]);
    const data = quotaResult.parsed?.command?.data;
    const windows = parseQuotaData(data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(quotaResult.parsed?.response ?? "", now);
    const credits = creditsFromData(creditsResult?.parsed?.command?.data);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli",
      },
      credits,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null,
      },
    };
  }

  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts,
    });
  }

  async invoke(request, invocation, context = {}) {
    await this.#refreshBrowserCredential(invocation?.account, context);
    const officialCredential = await this.#refreshOfficialCredential(invocation?.account, context);
    await this.#assertActiveSession(invocation?.account, {
      ...context,
      ...(officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}),
    });
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") {
      throw new Error("Antigravity native invocation transport is not mounted");
    }
    return executor({ request, invocation, context });
  }

  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
}

// Backward-compatible export for integrations that used the old CLI-specific
// class name before official desktop/session sources were supported.
export const AntigravityOfficialCliDriver = AntigravityOfficialSessionDriver;

export function createAntigravityDriver(options = {}) {
  return new AntigravityOfficialSessionDriver(options);
}

export const antigravityDriverConstants = Object.freeze({ providerId: PROVIDER_ID });
