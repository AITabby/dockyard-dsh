import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { apply } from "../packages/dsh-plugin/src/index.mjs";

test("DSH plugin cleanup waits for and disposes the native key pool", async () => {
  const effects = [];
  let disposed = false;
  const nativeKeyPool = {
    async start() {
      return this;
    },
    dispose() {
      disposed = true;
    },
  };
  const runtime = {
    async init() {},
  };
  const ctx = {
    llm: {
      registerAdapter() {},
    },
    commands: {
      register() {
        return () => {};
      },
    },
    get() {
      return undefined;
    },
    effect(effect) {
      effects.push(effect);
    },
  };

  apply(ctx, {
    runtime,
    providers: ["test-provider"],
    nativeKeyPool,
    serviceOptions: { autoRefresh: false },
  });

  assert.equal(effects.length, 2);
  effects[0]();
  const dispose = await effects[1]();
  await dispose();
  assert.equal(disposed, true);
});

test("model menu groups stay expanded by default and keep checked model visible", async () => {
  const { syncModelMenuGroups, modelGroupFoldState } = await import("../packages/dsh-plugin/src/dockyard-client.mjs");

  function createMockElement(tagName, attributes = {}) {
    const attrs = new Map(Object.entries(attributes));
    const classList = new Set(attributes.class ? attributes.class.split(" ") : []);
    const dataset = {};
    const children = [];
    const el = {
      tagName: tagName.toUpperCase(),
      dataset,
      children,
      classList: {
        add: (cls) => classList.add(cls),
        contains: (cls) => classList.has(cls),
      },
      getAttribute: (name) => attrs.get(name) ?? null,
      setAttribute: (name, val) => attrs.set(name, String(val)),
      appendChild: (child) => {
        child.parentNode = el;
        children.push(child);
        return child;
      },
      querySelector: (selector) => {
        for (const child of children) {
          if (child.classList.contains("dockyard-dsh-model-group-chevron")) return child;
        }
        return null;
      },
      querySelectorAll: (selector) => {
        const results = [];
        const walk = (node) => {
          for (const child of node.children) {
            if (selector === 'section[role="group"]' && child.tagName === "SECTION" && child.getAttribute("role") === "group") {
              results.push(child);
            }
            walk(child);
          }
        };
        walk(el);
        return results;
      },
      closest: (selector) => {
        let cur = el;
        while (cur) {
          if (selector === '[role="menu"]' && cur.getAttribute("role") === "menu") return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      textContent: attributes.textContent ?? "",
      id: attributes.id ?? "",
    };
    return el;
  }

  const prevDoc = globalThis.document;
  try {
    globalThis.document = {
      createElement: (tag) => createMockElement(tag),
      createElementNS: (ns, tag) => createMockElement(tag),
    };

    modelGroupFoldState.clear();

    const menu = createMockElement("div", { role: "menu", "aria-label": "模型与推理等级" });
    const section1 = createMockElement("section", { role: "group", "aria-labelledby": "sec-1" });
    const title1 = createMockElement("div", { id: "sec-1", textContent: "Antigravity" });
    section1.appendChild(title1);
    for (let i = 0; i < 15; i++) {
      section1.appendChild(createMockElement("button", { role: "menuitemradio", "aria-checked": i === 0 ? "true" : "false" }));
    }
    menu.appendChild(section1);

    const section2 = createMockElement("section", { role: "group", "aria-labelledby": "sec-2" });
    const title2 = createMockElement("div", { id: "sec-2", textContent: "Codex" });
    section2.appendChild(title2);
    for (let i = 0; i < 10; i++) {
      section2.appendChild(createMockElement("button", { role: "menuitemradio", "aria-checked": "false" }));
    }
    menu.appendChild(section2);

    syncModelMenuGroups(menu);

    // Large catalogs must NOT be collapsed by default
    assert.equal(section1.dataset.dockyardModelGroupCollapsed, "false");
    assert.equal(section2.dataset.dockyardModelGroupCollapsed, "false");

    // Even if stored was true, section with active checked model must stay expanded
    modelGroupFoldState.set("Antigravity", true);
    modelGroupFoldState.set("Codex", true);

    syncModelMenuGroups(menu);

    assert.equal(section1.dataset.dockyardModelGroupCollapsed, "false");
    assert.equal(section2.dataset.dockyardModelGroupCollapsed, "true");
  } finally {
    globalThis.document = prevDoc;
  }
});

test("root install entry and published subpackage declare the same dependencies and client injects", () => {
  // GitHub installs use the root package.json; npm installs use
  // packages/dsh-plugin/package.json. If their dependency versions or
  // dsh.client.inject lists drift, the two install paths behave differently.
  const root = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const published = JSON.parse(readFileSync(new URL("../packages/dsh-plugin/package.json", import.meta.url), "utf8"));

  assert.deepEqual(root.dependencies, published.dependencies);
  assert.deepEqual(root.peerDependencies, published.peerDependencies);
  assert.deepEqual(root.peerDependenciesMeta, published.peerDependenciesMeta);
  assert.deepEqual(root.devDependencies, published.devDependencies);
  assert.deepEqual(root.dsh.client.inject, published.dsh.client.inject);
  assert.equal(root.version, published.version);
});
