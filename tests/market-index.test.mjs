import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function loadMarketParser() {
  try {
    const mod = await import("@deepseek-ai/dsh-plugin-market-index");
    return { parseMarketIndex: mod.parseMarketIndex, marketInstallTarget: mod.marketInstallTarget };
  } catch {}

  const dshBin = execSync("which dsh", { encoding: "utf8" }).trim();
  const dshReal = execSync(`node -e "console.log(require('fs').realpathSync('${dshBin}'))"`, { encoding: "utf8" }).trim();
  const dshPkgDir = resolve(dirname(dshReal), "..");
  const candidate = resolve(dshPkgDir, "node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js");
  const mod = await import(candidate);
  return { parseMarketIndex: mod.parseMarketIndex, marketInstallTarget: mod.marketInstallTarget };
}

test("market/index.json conforms strictly to DSH plugin market format 1", async () => {
  const { parseMarketIndex, marketInstallTarget } = await loadMarketParser();
  const indexPath = resolve(rootDir, "market/index.json");
  assert.ok(existsSync(indexPath), "market/index.json must exist");

  const raw = readFileSync(indexPath, "utf8");
  const doc = JSON.parse(raw);

  const canonicalUrl = "https://raw.githubusercontent.com/AITabby/dockyard-dsh/main/market/index.json";
  const parsed = parseMarketIndex(doc, canonicalUrl);

  assert.equal(parsed.format, 1);
  assert.ok(parsed.title);
  assert.ok(parsed.plugins.length >= 1);

  const dockyard = parsed.plugins.find((p) => p.name === "@dockyard-dsh/plugin");
  assert.ok(dockyard, "@dockyard-dsh/plugin must be listed");
  assert.ok(dockyard.versions.length >= 1);

  const defaultVersion = dockyard.versions[0];
  assert.equal(defaultVersion.version, "0.1.2");
  assert.equal(defaultVersion.source.type, "git");
  assert.equal(defaultVersion.source.url, "https://github.com/AITabby/dockyard-dsh");
  assert.match(defaultVersion.source.commit, /^[0-9a-f]{40}$/);

  const target = marketInstallTarget(dockyard.name, defaultVersion);
  assert.ok(target.spec.startsWith("git+https://github.com/AITabby/dockyard-dsh.git#"));
});
