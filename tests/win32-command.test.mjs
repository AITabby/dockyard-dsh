import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCmdInvocation,
  escapeCmdArgument,
  escapeCmdCommand,
  locateWindowsExecutable,
  resolveCliCommand,
  spawnCli,
} from "../packages/providers/src/win32-command.mjs";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dockyard-win32-"));
}

test("resolveCliCommand leaves non-Windows commands untouched", () => {
  const resolved = resolveCliCommand("codex", { platform: "darwin", env: { PATH: "/usr/bin" } });
  assert.deepEqual(resolved, { file: "codex", viaShell: false, resolved: "codex" });
});

test("resolveCliCommand finds an npm .cmd shim on PATH", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "codex.cmd"), "@echo off\r\necho hi\r\n");
  const env = { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" };
  const resolved = resolveCliCommand("codex", { platform: "win32", env });
  assert.equal(resolved.viaShell, true);
  assert.equal(resolved.file, join(dir, "codex.cmd"));
  assert.equal(resolved.resolved, join(dir, "codex.cmd"));
});

test("resolveCliCommand finds a .exe without routing it through cmd", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "agy.exe"), "");
  const env = { PATH: dir, PATHEXT: ".EXE;.CMD" };
  const resolved = resolveCliCommand("agy", { platform: "win32", env });
  assert.equal(resolved.viaShell, false);
  assert.equal(resolved.file, join(dir, "agy.exe"));
});

test("resolveCliCommand keeps the configured name when nothing matches", () => {
  const env = { PATH: tempDir(), PATHEXT: ".EXE;.CMD" };
  const resolved = resolveCliCommand("missing-cli", { platform: "win32", env });
  assert.equal(resolved.file, "missing-cli");
  assert.equal(resolved.viaShell, false);
});

test("locateWindowsExecutable probes an absolute path with extensions", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "tool.cmd"), "@echo off\r\n");
  const found = locateWindowsExecutable(join(dir, "tool"), { env: {} });
  assert.equal(found, join(dir, "tool.cmd"));
});

test("buildCmdInvocation wraps the shim in a ComSpec command line", () => {
  const invocation = buildCmdInvocation("C:\\npm\\codex.cmd", ["-p", "hi there"], {
    env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
  });
  assert.equal(invocation.file, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(invocation.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(invocation.windowsVerbatimArguments, true);
  const line = invocation.args[3];
  assert.ok(line.startsWith('"'));
  assert.ok(line.includes("codex.cmd"));
  // The space in the prompt is escaped, so it never splits into two arguments.
  assert.ok(line.includes("hi^ there"));
});

test("escapeCmdArgument quotes spaces and escapes cmd metacharacters", () => {
  assert.equal(escapeCmdArgument("plain"), '^"plain^"');
  assert.ok(escapeCmdArgument("a b").includes("a^ b"));
  // A pipe or ampersand must not reach cmd.exe as an operator.
  assert.ok(escapeCmdArgument("a&b").includes("^&"));
  assert.ok(escapeCmdArgument("a|b").includes("^|"));
  // A double quote inside the value is neutralized rather than closing the quote.
  assert.ok(!/^[^\\]*$/.test(escapeCmdArgument('a"b')));
});

test("escapeCmdCommand escapes metacharacters in the program path", () => {
  assert.equal(escapeCmdCommand("C:\\tools\\agy.cmd"), "C:\\tools\\agy.cmd");
  assert.ok(escapeCmdCommand("C:\\my tools\\agy.cmd").includes("^ "));
});

test("spawnCli runs a real .cmd shim on Windows", { skip: process.platform !== "win32" }, async () => {
  const dir = tempDir();
  const script = join(dir, "echoer.cmd");
  writeFileSync(script, "@echo off\r\necho {\"ok\":true}\r\n");
  const env = { ...process.env, PATH: `${dir};${process.env.PATH ?? ""}`, PATHEXT: ".COM;.EXE;.BAT;.CMD" };
  const child = spawnCli("echoer", [], { env, windowsHide: true });
  const chunks = [];
  for await (const chunk of child.stdout) chunks.push(chunk);
  const code = await new Promise((resolve) => child.once("close", resolve));
  assert.equal(code, 0);
  assert.match(Buffer.concat(chunks).toString("utf8"), /"ok":true/);
});
