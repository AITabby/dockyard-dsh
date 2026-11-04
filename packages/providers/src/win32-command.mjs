/**
 * Windows command launching for the official provider CLIs.
 *
 * On Windows an npm-installed CLI is a `.cmd` shim next to the real entry
 * point. `CreateProcess` cannot launch a `.cmd` directly, and Node's
 * `child_process.spawn` therefore fails with ENOENT for the bare command name
 * even when the shim is on PATH. Everything here exists to make those shims
 * launchable without changing behaviour on macOS or Linux.
 *
 * The quoting follows the rules `cmd.exe` and the MSVCRT argument parser
 * expect; it is the same algorithm the widely used `cross-spawn` package
 * applies, kept here so the CLI transport has no extra runtime dependency.
 */
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { basename, delimiter, dirname, extname, isAbsolute, join, sep } from "node:path";

const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";
const SHELL_SCRIPT_EXTENSIONS = new Set([".cmd", ".bat"]);
// Characters `cmd.exe` treats specially outside of a quoted argument.
const CMD_META_CHARS = /([()\][%!^"`<>&|;, *?])/g;

function pathSeparators(platform) {
  return platform === "win32" ? new Set(["/", "\\"]) : new Set([sep]);
}

function hasPathSeparator(command, platform) {
  const separators = pathSeparators(platform);
  for (const character of command) {
    if (separators.has(character)) return true;
  }
  return false;
}

function searchPathDirectories(env, platform) {
  const raw = platform === "win32"
    ? env.PATH ?? env.Path ?? env.path ?? ""
    : env.PATH ?? "";
  const separator = platform === "win32" ? ";" : delimiter;
  return String(raw).split(separator).filter(Boolean);
}

function extensionCandidates(command, env, platform) {
  if (platform !== "win32") return [command];
  if (extname(command) !== "") return [command];
  const raw = env.PATHEXT ?? DEFAULT_PATHEXT;
  const extensions = String(raw).split(";").map((value) => value.trim()).filter(Boolean);
  const candidates = [];
  for (const extension of extensions) {
    // Lowercase first: Windows is case-insensitive, but the POSIX hosts used by
    // the test suite are not, and a resolved path is echoed back to the user.
    candidates.push(`${command}${extension.toLowerCase()}`);
    candidates.push(`${command}${extension}`);
  }
  // A command that already names an executable without an extension still works.
  candidates.push(command);
  return candidates;
}

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Locate the file a command name refers to.
 * Absolute and relative paths are probed with the extension candidates too, so
 * a configured `C:\tools\codex` still resolves to `C:\tools\codex.cmd`.
 * Returns null when nothing matches; callers keep the original name so the
 * spawn error still names what the user configured.
 *
 * The path API follows the host (`node:path` on Windows is the win32 variant),
 * which is what makes the search order testable off Windows.
 */
export function locateWindowsExecutable(command, { env = process.env } = {}) {
  if (isAbsolute(command) || hasPathSeparator(command, "win32") || hasPathSeparator(command, process.platform)) {
    const directory = dirname(command);
    const name = basename(command);
    for (const candidate of extensionCandidates(name, env, "win32")) {
      const resolved = join(directory, candidate);
      if (isFile(resolved)) return resolved;
    }
    return null;
  }
  for (const directory of searchPathDirectories(env, "win32")) {
    for (const candidate of extensionCandidates(command, env, "win32")) {
      const resolved = join(directory, candidate);
      if (isFile(resolved)) return resolved;
    }
  }
  return null;
}

/**
 * Decide how to launch `command` on the requested platform.
 *
 * @returns {{ file: string, viaShell: boolean, resolved: string }}
 *  `viaShell` means `file` is a `.cmd`/`.bat` shim that must run through
 *  `%ComSpec% /d /s /c`.
 */
export function resolveCliCommand(command, { platform = process.platform, env = process.env } = {}) {
  const name = String(command ?? "");
  if (platform !== "win32" || name.length === 0) {
    return { file: name, viaShell: false, resolved: name };
  }
  const resolved = locateWindowsExecutable(name, { env }) ?? name;
  const extension = extname(resolved).toLowerCase();
  return {
    file: resolved,
    viaShell: SHELL_SCRIPT_EXTENSIONS.has(extension),
    resolved,
  };
}

/** Escape one argument for a `cmd.exe /c` command line. */
export function escapeCmdArgument(value) {
  let argument = String(value ?? "");
  // Double backslashes that precede a quote so the shell keeps them literal.
  argument = argument.replace(/(\\*)"/g, "$1$1\\\"");
  // Double a trailing run of backslashes for the same reason.
  argument = argument.replace(/(\\*)$/, "$1$1");
  argument = `"${argument}"`;
  return argument.replace(CMD_META_CHARS, "^$1");
}

/** Escape a program path for a `cmd.exe /c` command line. */
export function escapeCmdCommand(value) {
  return String(value ?? "").replace(CMD_META_CHARS, "^$1");
}

/**
 * Build the `cmd.exe /d /s /c "<line>"` invocation for a `.cmd` shim.
 * `windowsVerbatimArguments` is required: the command line is already quoted
 * for `cmd.exe`, and re-quoting it in Node would double the escaping.
 */
export function buildCmdInvocation(scriptPath, args = [], { env = process.env } = {}) {
  const comspec = env.ComSpec ?? env.COMSPEC ?? env.comspec ?? "cmd.exe";
  const line = [escapeCmdCommand(scriptPath), ...args.map(escapeCmdArgument)].join(" ");
  return {
    file: comspec,
    args: ["/d", "/s", "/c", `"${line}"`],
    windowsVerbatimArguments: true,
  };
}

/**
 * Spawn a provider CLI, transparently routing `.cmd`/`.bat` shims through
 * `cmd.exe`. Every other platform keeps the exact previous behaviour.
 *
 * @param {string} command Configured command or absolute path.
 * @param {string[]} args Arguments, passed through unchanged.
 * @param {object} options `spawn` options plus optional `platform`/`spawnImpl`.
 */
export function spawnCli(command, args = [], options = {}) {
  const {
    platform = process.platform,
    spawnImpl = spawn,
    env = process.env,
    ...spawnOptions
  } = options;
  const target = resolveCliCommand(command, { platform, env });
  if (!target.viaShell) {
    return spawnImpl(target.file, args, { env, ...spawnOptions });
  }
  const invocation = buildCmdInvocation(target.file, args, { env });
  return spawnImpl(invocation.file, invocation.args, {
    env,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    ...spawnOptions,
  });
}

export const win32CommandConstants = Object.freeze({
  defaultPathExt: DEFAULT_PATHEXT,
  shellScriptExtensions: Object.freeze([...SHELL_SCRIPT_EXTENSIONS]),
});
