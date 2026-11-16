import test from "node:test";
import assert from "node:assert/strict";

import { DockyardRuntime, createDefaultProviderEntries } from "../packages/runtime/src/dockyard-runtime.mjs";

function memoryStateStore(initial = {}) {
  let state = structuredClone(initial);
  return {
    async load() { return structuredClone(state); },
    async update(mutator) { state = await mutator(structuredClone(state)); return structuredClone(state); },
    async save(next) { state = structuredClone(next); },
  };
}

test("OpenCode is registered as a provider again", () => {
  const entries = createDefaultProviderEntries();
  const ids = entries.map((entry) => entry.module?.manifest?.id ?? entry.module?.id).filter(Boolean);
  assert.ok(ids.includes("opencode"), `opencode missing from ${ids.join(", ")}`);
  assert.ok(!ids.includes("kilo"), "kilo must stay retired");
});

test("startup no longer erases an OpenCode account pool", async () => {
  // The retirement migration used to delete pools.opencode on every boot, which
  // would wipe an account the user had just configured.
  const stateStore = memoryStateStore({
    pools: {
      opencode: { accounts: [{ accountId: "opencode-free", providerId: "opencode" }], defaultAccountId: "opencode-free" },
      kilo: { accounts: [{ accountId: "kilo-free", providerId: "kilo" }] },
    },
    modelSelection: { providers: { opencode: { enabled: ["deepseek-v4.1-flash-free"] }, kilo: { enabled: [] } } },
  });
  const runtime = new DockyardRuntime({
    stateStore,
    secretStore: {
      data: new Map(),
      async write(ref, value) { this.data.set(ref, value); },
      async read(ref) { return this.data.get(ref) ?? null; },
      async delete(ref) { this.data.delete(ref); },
    },
    providers: [],
  });
  await runtime.whenPrepared();
  const state = await stateStore.load();
  assert.ok(state.pools?.opencode, "opencode pool must survive");
  assert.ok(state.modelSelection?.providers?.opencode, "opencode selection must survive");
  assert.equal(state.pools?.kilo, undefined, "kilo pool is still retired");
});
