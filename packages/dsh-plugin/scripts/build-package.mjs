import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const entryPoint = resolve(packageRoot, "src/index.mjs");
const outputPath = resolve(packageRoot, "dist/index.mjs");
const keychainHelperSource = resolve(repositoryRoot, "packages/vault/src/macos-keychain-helper.swift");
const keychainHelperOutput = resolve(packageRoot, "dist/macos-keychain-helper.swift");

await mkdir(dirname(outputPath), { recursive: true });
await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node20"],
  outfile: outputPath,
  absWorkingDir: repositoryRoot,
  external: [
    "@deepseek-ai/*",
    "@earendil-works/*",
    "react",
    "react/*",
    "zod",
  ],
  sourcemap: false,
  legalComments: "none",
});

await import("./build-client.mjs");
await copyFile(keychainHelperSource, keychainHelperOutput);
for (const name of [
  "dockyard-typert-shared.mjs",
  "dockyard-typert.host.mjs",
  "dockyard-typert.remote.mjs",
]) {
  await copyFile(resolve(packageRoot, "src", name), resolve(packageRoot, "dist", name));
}
console.log(`Dockyard DSH plugin bundle written: ${outputPath}`);
