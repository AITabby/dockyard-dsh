import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SEMVER_RE =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

function validateFormat1SelfContained(doc) {
  assert.equal(doc.format, 1, "format must be 1");
  assert.ok(
    typeof doc.title === "string" ||
      (typeof doc.title === "object" && doc.title !== null && typeof doc.title.en === "string"),
    "title must have 'en' or be a string"
  );
  assert.ok(Array.isArray(doc.plugins) && doc.plugins.length > 0, "plugins must be a non-empty array");

  for (const plugin of doc.plugins) {
    assert.match(plugin.name, PACKAGE_NAME_RE, "plugin name must be a valid package name");
    assert.ok(Array.isArray(plugin.versions) && plugin.versions.length > 0, "versions must be non-empty");

    for (const v of plugin.versions) {
      assert.match(v.version, SEMVER_RE, "version must follow SemVer 2.0.0");
      assert.ok(
        Number.isInteger(v.publishTimestamp) && v.publishTimestamp >= 0 && v.publishTimestamp < 1e11,
        "publishTimestamp must be a valid Unix timestamp in seconds"
      );
      assert.ok(v.source && (v.source.type === "git" || v.source.type === "npm"), "source must be git or npm");

      if (v.source.type === "git") {
        assert.ok(v.source.url.startsWith("https://"), "git source url must use https");
        assert.match(v.source.commit, COMMIT_RE, "git source commit must be 40-char lowercase hex SHA");
      }
    }
  }

  return doc;
}

function selfContainedMarketInstallTarget(name, version) {
  if (version.source.type === "git") {
    const gitUrl = version.source.url.endsWith(".git") ? version.source.url : `${version.source.url}.git`;
    const pathSuffix = version.source.path ? `&path:/${version.source.path}` : "";
    return { spec: `git+${gitUrl}#${version.source.commit}${pathSuffix}` };
  }
  return { spec: `${name}@${version.version}` };
}

async function loadMarketParser() {
  try {
    const mod = await import("@deepseek-ai/dsh-plugin-market-index");
    return { parseMarketIndex: mod.parseMarketIndex, marketInstallTarget: mod.marketInstallTarget };
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
        return { parseMarketIndex: mod.parseMarketIndex, marketInstallTarget: mod.marketInstallTarget };
      }
    }
  } catch {}

  return {
    parseMarketIndex: (doc) => validateFormat1SelfContained(doc),
    marketInstallTarget: selfContainedMarketInstallTarget,
  };
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
  assert.match(defaultVersion.source.commit, COMMIT_RE);

  const target = marketInstallTarget(dockyard.name, defaultVersion);
  assert.ok(target.spec.startsWith("git+https://github.com/AITabby/dockyard-dsh.git#"));
});
