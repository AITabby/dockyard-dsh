import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function loadMarketIndexParser() {
  try {
    const mod = await import("@deepseek-ai/dsh-plugin-market-index");
    return mod.parseMarketIndex;
  } catch {}

  try {
    const dshBin = execSync("which dsh", { encoding: "utf8" }).trim();
    const dshReal = execSync(`node -e "console.log(require('fs').realpathSync('${dshBin}'))"`, { encoding: "utf8" }).trim();
    const dshPkgDir = resolve(dirname(dshReal), "..");
    const candidate = resolve(dshPkgDir, "node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js");
    const mod = await import(candidate);
    return mod.parseMarketIndex;
  } catch (err) {
    throw new Error("Could not find @deepseek-ai/dsh-plugin-market-index: " + err.message);
  }
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
        en: "Native account-pool and provider plugin for DeepSeek Harness (Codex, Antigravity, Grok, Claude, Cursor, OpenCode).",
        zh: "DeepSeek Harness 原生账号池与官方 Provider 插件（支持 Codex、Antigravity、Grok、Claude、Cursor、OpenCode）。",
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
        ],
        sortKeys: {},
      },
      versions: [
        {
          version: "0.1.2",
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
