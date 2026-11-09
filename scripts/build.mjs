import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ModuleRuntime } from "../packages/core/src/index.mjs";
import { createCodexModule } from "../modules/provider-codex/src/index.mjs";
import { createAntigravityModule } from "../modules/provider-antigravity/src/index.mjs";
import { createGrokModule } from "../modules/provider-grok/src/index.mjs";
import { createClaudeModule } from "../modules/provider-claude/src/index.mjs";
import { createCursorModule } from "../modules/provider-cursor/src/index.mjs";
import { createOpencodeModule } from "../modules/provider-opencode/src/index.mjs";
import { createKiloModule } from "../modules/provider-kilo/src/index.mjs";
import { createCommandCodeModule } from "../modules/provider-commandcode/src/index.mjs";
import { createHermesModule } from "../modules/provider-hermes/src/index.mjs";
import { createOpenRouterFreeModule } from "../modules/provider-openrouter-free/src/index.mjs";
import { createTraeCnModule } from "../modules/provider-trae-cn/src/index.mjs";
import { createNvidiaModule } from "../modules/provider-nvidia/src/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

const files = await walk(root);
for (const file of files.filter((candidate) => candidate.endsWith(".mjs"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

for (const file of files.filter((candidate) => candidate.endsWith("module.json"))) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (!manifest.id || !manifest.kind) throw new Error(`Invalid module manifest: ${relative(root, file)}`);
  if (Object.hasOwn(manifest, "version")) {
    throw new Error(`Provider/module version must be discovered at runtime: ${relative(root, file)}`);
  }
}

const runtime = new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } });
await runtime.register(createCodexModule());
await runtime.register(createAntigravityModule());
await runtime.register(createGrokModule());
await runtime.register(createClaudeModule());
await runtime.register(createCursorModule());
await runtime.register(createOpencodeModule());
await runtime.register(createKiloModule());
await runtime.register(createCommandCodeModule());
await runtime.register(createHermesModule());
await runtime.register(createOpenRouterFreeModule());
await runtime.register(createTraeCnModule());
await runtime.register(createNvidiaModule());

const ids = runtime.list().map((module) => module.id);
if (!ids.includes("openai-codex") || !ids.includes("antigravity") || !ids.includes("grok") || !ids.includes("claude") || !ids.includes("cursor") || !ids.includes("opencode") || !ids.includes("kilo") || !ids.includes("commandcode") || !ids.includes("hermes") || !ids.includes("openrouter-free") || !ids.includes("trae-cn") || !ids.includes("nvidia")) {
  throw new Error("Initial provider modules are not registered");
}

console.log(`Dockyard DSH build OK: ${files.length} files checked, modules=${ids.join(",")}`);
