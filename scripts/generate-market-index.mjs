import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_RE =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

function validateFormat1SelfContained(doc) {
  if (doc.format !== 1) throw new Error("$.format must be 1");
  if (!doc.title || (typeof doc.title !== "string" && typeof doc.title.en !== "string")) {
    throw new Error("$.title must have 'en' or be a string");
  }
  if (!Array.isArray(doc.plugins) || doc.plugins.length === 0) {
    throw new Error("$.plugins must be a non-empty array");
  }

  for (const [i, plugin] of doc.plugins.entries()) {
    if (!PACKAGE_NAME_RE.test(plugin.name)) {
      throw new Error(`$.plugins[${i}].name must be a valid package name`);
    }
    if (!Array.isArray(plugin.versions) || plugin.versions.length === 0) {
      throw new Error(`$.plugins[${i}].versions must be non-empty`);
    }

    for (const [j, v] of plugin.versions.entries()) {
      if (!SEMVER_RE.test(v.version)) {
        throw new Error(`$.plugins[${i}].versions[${j}].version must follow SemVer 2.0.0`);
      }
      if (!Number.isInteger(v.publishTimestamp) || v.publishTimestamp < 0 || v.publishTimestamp >= 1e11) {
        throw new Error(`$.plugins[${i}].versions[${j}].publishTimestamp must be a Unix seconds integer`);
      }
      if (!v.source || (v.source.type !== "git" && v.source.type !== "npm")) {
        throw new Error(`$.plugins[${i}].versions[${j}].source must be git or npm`);
      }
      if (v.source.type === "git") {
        if (!v.source.url.startsWith("https://")) {
          throw new Error(`$.plugins[${i}].versions[${j}].source.url must use https`);
        }
        if (!COMMIT_RE.test(v.source.commit)) {
          throw new Error(`$.plugins[${i}].versions[${j}].source.commit must be 40-char lowercase hex SHA`);
        }
      }
    }
  }

  return doc;
}

async function loadMarketIndexParser() {
  try {
    const mod = await import("@deepseek-ai/dsh-plugin-market-index");
    return mod.parseMarketIndex;
  } catch {}

  try {
    const dshBin = execSync("which dsh", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (dshBin) {
      const dshReal = execSync(`node -e "console.log(require('fs').realpathSync('${dshBin}'))"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const dshPkgDir = resolve(dirname(dshReal), "..");
      const candidate = resolve(dshPkgDir, "node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js");
      if (existsSync(candidate)) {
        const mod = await import(candidate);
        return mod.parseMarketIndex;
      }
    }
  } catch {}

  return (doc) => validateFormat1SelfContained(doc);
}

const parseMarketIndex = await loadMarketIndexParser();

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const marketDir = resolve(rootDir, "market");
const outputPath = resolve(marketDir, "index.json");

// Read AppIcon for self-contained base64 data URL
const iconBuf = readFileSync(resolve(rootDir, "apps/macos/assets/AppIcon.iconset/icon_128x128.png"));
const iconDataUrl = `data:image/png;base64,${iconBuf.toString("base64")}`;

// The current release points at the commit that is about to be pushed. Every
// historical version keeps its own immutable SHA: never reuse `currentCommit`
// for past versions, or the market installs old code for a newer version.
const packageVersion = JSON.parse(
  readFileSync(resolve(rootDir, "packages/dsh-plugin/package.json"), "utf8"),
).version;
// During a release the index is generated from the just-created release commit
// and amended into it, so allow pinning the exact final SHA explicitly.
const currentCommit = (process.env.DOCKYARD_RELEASE_COMMIT || execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim());

const RELEASE_HISTORY = [
  // 0.1.17 was never published: its local commit embedded OAuth credentials and
  // was rewritten into the 0.1.18 release before being pushed. Do not list a
  // version whose commit does not exist on the remote.
  { version: "0.1.34", publishTimestamp: 1794466766, commit: "120b9dc1d00ccc5a567a7e785748a2636a7b0583" },
  { version: "0.1.33", publishTimestamp: 1794192598, commit: "b5d4d511f6d3fa1cb2e7c7ff265ac4d284ffc019" },
  { version: "0.1.32", publishTimestamp: 1794144750, commit: "dc0c09be91984a28ab35106c2e1d3c4e6015861a" },
  { version: "0.1.31", publishTimestamp: 1794144248, commit: "102b13c321894fe18a036509f93eaaf0e3771b04" },
  { version: "0.1.30", publishTimestamp: 1794143148, commit: "373582a4341897cf134bc48b6429cd916a9fc240" },
  { version: "0.1.29", publishTimestamp: 1794140952, commit: "aaa203c808cc72b412764cb3a22639c16b37fdac" },
  { version: "0.1.28", publishTimestamp: 1794043352, commit: "642e974f4dd09a6c85114464b0d6604d00b8401e" },
  { version: "0.1.27", publishTimestamp: 1794040160, commit: "ebf3c3b44bbbf05c027f0405b0f4bf0ee170beda" },
  { version: "0.1.26", publishTimestamp: 1794030302, commit: "426a4923387e558db92781699e16f2697054146b" },
  { version: "0.1.25", publishTimestamp: 1793976223, commit: "0ae37da8b8b6c5401ec9e9961d4ddde3b4f81c55" },
  { version: "0.1.24", publishTimestamp: 1793975079, commit: "78b05a0d7bbc3cdb787110bdf103c69348256d88" },
  { version: "0.1.23", publishTimestamp: 1793973526, commit: "414a742e9333271a0f591858951f8af81d612854" },
  { version: "0.1.22", publishTimestamp: 1793970828, commit: "dfea0a9f8e79d309e505ab53c987076a7f635f3e" },
  { version: "0.1.21", publishTimestamp: 1793951130, commit: "3344f18ea5892a4fc888dde26986b4c57b8a0b8d" },
  { version: "0.1.20", publishTimestamp: 1793916000, commit: "c37d664ed1c13c3fac1866fd311beab3a2b235ed" },
  { version: "0.1.19", publishTimestamp: 1793914032, commit: "9f3ec105f660076887540a47e9b343844970be9e" },
  { version: "0.1.18", publishTimestamp: 1793875877, commit: "0946249978067bea1bed0c0ae350512d9e1ab762" },
  { version: "0.1.16", publishTimestamp: 1793776800, commit: "28ef85a09aff6cd0f2077e2681f8b8f2d6f06408" },
  { version: "0.1.15", publishTimestamp: 1793629755, commit: "c4a6d34ce823d6f93b0539e1b58b2b73114330d5" },
  { version: "0.1.11", publishTimestamp: 1793547152, commit: "62e4ee0e4f6891e3788a4872b67e057e0c41253f" },
  { version: "0.1.10", publishTimestamp: 1793545916, commit: "c7db0594420fe491445a243fab3ff4ec49393951" },
  { version: "0.1.9", publishTimestamp: 1793545166, commit: "bbd66239eedba9e9e4e29dd09c1ba4b2e99f8fcd" },
  { version: "0.1.8", publishTimestamp: 1793514548, commit: "ff39f7c643b6e22c6a791884b76ddfd37eefcaf2" },
  { version: "0.1.7", publishTimestamp: 1793475442, commit: "8c49cdac8a3fad23e829d938e992f7d40dcf6a59" },
  { version: "0.1.6", publishTimestamp: 1793421167, commit: "32af138d0d60027fe1d518f4f722c9b7b35c853b" },
  { version: "0.1.5", publishTimestamp: 1793417682, commit: "8279e8d41803262b3e3403a55fb2ba1ffa656f56" },
  { version: "0.1.4", publishTimestamp: 1793416447, commit: "ee5136e45c38cdd271813e2d680c26df053cb1e1" },
  { version: "0.1.2", publishTimestamp: 1793187638, commit: "f9af7d99dc501d0489200d16cd1dcd177016fce3" },
  { version: "0.1.1", publishTimestamp: 1787059239, commit: "f2d4642bbe4815d8b7d0c4cdc95652c8ff62477e" },
];

function marketVersion({ version, publishTimestamp, commit }) {
  return {
    version,
    publishTimestamp,
    source: {
      type: "git",
      url: "https://github.com/AITabby/dockyard-dsh",
      commit,
    },
    engines: { dsh: ">=0.1.0" },
  };
}

const indexDocument = {
  format: 1,
  title: {
    en: "Dockyard DSH Marketplace",
    zh: "Dockyard DSH 插件市场",
  },
  description: {
    en: "Official plugin marketplace catalog for Dockyard DSH and multi-account provider bundles.",
    zh: "Dockyard DSH 官方插件市场索引，提供多账号与原生 Provider 扩展组合包。",
  },
  metadata: {
    categories: {
      providers: {
        title: {
          en: "Providers & Models",
          zh: "模型与 Provider",
        },
      },
    },
    labels: {
      macos: {
        title: {
          en: "macOS",
          zh: "macOS 原生",
        },
      },
      windows: {
        title: {
          en: "Windows",
          zh: "Windows 原生",
        },
      },
      oauth: {
        title: {
          en: "Official OAuth",
          zh: "官方 OAuth",
        },
      },
      "account-pool": {
        title: {
          en: "Account Pool",
          zh: "多账号池",
        },
      },
      "free-tier": {
        title: {
          en: "Free Models",
          zh: "免费模型",
        },
      },
    },
    sortKeys: {},
  },
  plugins: [
    {
      name: "@dockyard-dsh/plugin",
      title: {
        en: "Dockyard DSH",
        zh: "Dockyard 账号池与原生 Provider",
      },
      description: {
        en: "Native account-pool and provider plugin for DeepSeek Harness — Codex, Antigravity, Grok, Claude, Cursor, Command Code, Hermes, OpenRouter Free and AgentRouter, on macOS and Windows.",
        zh: "DeepSeek Harness 原生账号池与官方 Provider 插件——支持 Codex、Antigravity、Grok、Claude、Cursor、Command Code、Hermes、OpenRouter Free 与 AgentRouter，macOS 与 Windows 均可使用。",
      },
      icon: iconDataUrl,
      author: "AITabby",
      homepage: "https://github.com/AITabby/dockyard-dsh",
      repository: {
        url: "https://github.com/AITabby/dockyard-dsh",
      },
      metadata: {
        category: "providers",
        labels: ["macos", "windows", "oauth", "account-pool", "free-tier"],
        keywords: [
          "dsh",
          "deepseek-harness",
          "dockyard",
          "account-pool",
          "providers",
          "codex",
          "antigravity",
          "grok",
          "claude",
          "cursor",
          "commandcode",
          "command-code",
          "hermes",
          "nous",
          "free-tier",
          "agentrouter",
        ],
        sortKeys: {},
      },
      versions: [
        marketVersion({ version: packageVersion, publishTimestamp: Math.floor(Date.now() / 1000), commit: currentCommit }),
        // The current version is generated from HEAD; past versions use their
        // own immutable SHAs from RELEASE_HISTORY so they can never drift.
        ...RELEASE_HISTORY
          .filter((entry) => entry.version !== packageVersion)
          .map(marketVersion),
      ],
    },
  ],
};

const canonicalUrl = "https://raw.githubusercontent.com/AITabby/dockyard-dsh/main/market/index.json";
const validated = parseMarketIndex(indexDocument, canonicalUrl);

mkdirSync(marketDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(indexDocument, null, 2), "utf8");
console.log(`Generated and validated format-1 market index: ${outputPath}`);
console.log(`Verified ${validated.plugins.length} plugin(s), default version: ${validated.plugins[0].versions[0].version}`);
