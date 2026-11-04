import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { patchConversationSource, patchPiAiSource } from "../scripts/patch-dsh-latency.mjs";

function resolveSourceFile(relativeSubpath) {
  const candidates = [
    new URL(`../node_modules/${relativeSubpath}`, import.meta.url),
    new URL(`../packages/dsh-plugin/node_modules/${relativeSubpath}`, import.meta.url),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

test("third-party adapter starts API-key and context work together", async () => {
  const file = resolveSourceFile("@deepseek-ai/dsh-llm-pi-ai/lib/index.js");
  const source = await readFile(file, "utf8");
  const patched = patchPiAiSource(source);

  assert.match(patched, /const apiKeyPromise = Promise\.resolve\(\)\.then\(\(\) => this\.config\.resolveApiKey/);
  assert.match(patched, /const contextPromise = Promise\.resolve\(\)\.then\(\(\) =>/);
  assert.match(patched, /const \[apiKey, context\] = await Promise\.all\(\[apiKeyPromise, contextPromise\]\);/);
  assert.equal(patchPiAiSource(patched), patched);
});

test("conversation clock is visible before the first provider event", async () => {
  const file = resolveSourceFile("@deepseek-ai/dsh-client-ui-conversation/lib/client.js");
  const source = await readFile(file, "utf8");
  const patched = patchConversationSource(source);

  if (source.includes("const showClock = elapsedMs >= 15e3;")) {
    assert.match(patched, /const showClock = true;/);
    assert.doesNotMatch(patched, /const showClock = elapsedMs >= 15e3;/);
  }
  assert.equal(patchConversationSource(patched), patched);
});
