import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeSchema } from "../modules/provider-antigravity/src/native-transport.mjs";

test("Gemini function declarations drop schema keywords it rejects", () => {
  // Gemini answers "Unknown name exclusiveMinimum ... Cannot find field" and the
  // whole turn fails, so numeric exclusions and the other non-subset keywords
  // never reach the request.
  const out = sanitizeSchema({
    type: "object",
    properties: {
      limit: { type: "integer", exclusiveMinimum: 1000, exclusiveMaximum: 9000, minimum: 1, maximum: 50000 },
      paths: { type: "array", items: { type: "string" } },
    },
    required: ["limit"],
    additionalProperties: false,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    patternProperties: { "^x": { type: "string" } },
  });
  assert.deepEqual(out, {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50000 },
      paths: { type: "array", items: { type: "string" } },
    },
    required: ["limit"],
  });
});
