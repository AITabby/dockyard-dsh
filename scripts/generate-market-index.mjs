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

// Determine commit for 0.1.2: use current HEAD
const currentCommit = execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
const v011Commit = "f2d4642bbe4815d8b7d0c4cdc95652c8ff62477e";

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
        en: "Native account-pool and provider plugin for DeepSeek Harness (Codex, Antigravity, Grok, Claude, Cursor, OpenCode, WorkBuddy).",
        zh: "DeepSeek Harness 原生账号池与官方 Provider 插件（支持 Codex、Antigravity、Grok、Claude、Cursor、OpenCode、WorkBuddy）。",
      },
      icon: iconDataUrl,
      author: "AITabby",
      homepage: "https://github.com/AITabby/dockyard-dsh",
      repository: {
        url: "https://github.com/AITabby/dockyard-dsh",
      },
      metadata: {
        category: "providers",
        labels: ["macos", "oauth", "account-pool", "free-tier"],
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
          "opencode",
          "workbuddy",
        ],
        sortKeys: {},
      },
      versions: [
        {
          version: "0.1.3",
          publishTimestamp: Math.floor(Date.now() / 1000),
          source: {
            type: "git",
            url: "https://github.com/AITabby/dockyard-dsh",
            commit: currentCommit,
          },
          engines: {
            dsh: ">=0.1.0",
          },
        },
        {
          version: "0.1.2",
          publishTimestamp: 1793187638,
          source: {
            type: "git",
            url: "https://github.com/AITabby/dockyard-dsh",
            commit: "f9af7d99dc501d0489200d16cd1dcd177016fce3",
          },
          engines: {
            dsh: ">=0.1.0",
          },
        },
        {
          version: "0.1.1",
          publishTimestamp: 1787059239,
          source: {
            type: "git",
            url: "https://github.com/AITabby/dockyard-dsh",
            commit: v011Commit,
          },
          engines: {
            dsh: ">=0.1.0",
          },
        },
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
