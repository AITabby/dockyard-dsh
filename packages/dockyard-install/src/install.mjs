import { spawnSync } from "node:child_process";
import process from "node:process";

export const DEFAULT_PLUGIN_SPEC = "@dockyard-dsh/plugin@latest";
export const DEFAULT_DSH_SPEC = "@deepseek-ai/dsh@0.1.5-rc.2";
export const DEFAULT_PROFILE = "web";

function printUsage() {
  console.log(`Dockyard DSH one-command installer

Usage:
  npx -y @dockyard-dsh/install@latest

Options:
  --profile <name>       Install into a different DSH profile (default: web)
  --plugin <spec>        Override the Dockyard plugin package spec
  --dsh <spec>           Override the DSH package used when dsh is missing
  --dry-run              Print the commands without changing the machine
  --no-color             Disable colored output
  -h, --help             Show this help

Environment:
  DOCKYARD_DSH_SPEC      Same as --dsh
  DOCKYARD_PLUGIN_SPEC   Same as --plugin
`);
}

function parseValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv = []) {
  const options = {
    profile: DEFAULT_PROFILE,
    plugin: process.env.DOCKYARD_PLUGIN_SPEC || DEFAULT_PLUGIN_SPEC,
    dsh: process.env.DOCKYARD_DSH_SPEC || DEFAULT_DSH_SPEC,
    dryRun: false,
    color: true,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--profile") {
      options.profile = parseValue(argv, index, arg);
      index += 1;
    } else if (arg === "--plugin") {
      options.plugin = parseValue(argv, index, arg);
      index += 1;
    } else if (arg === "--dsh") {
      options.dsh = parseValue(argv, index, arg);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-color") {
      options.color = false;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!/^[A-Za-z0-9._-]+$/.test(options.profile)) {
    throw new Error("Profile name may contain only letters, numbers, dot, underscore, and hyphen");
  }
  return options;
}

export function nodeVersionSupported(version = process.versions.node) {
  const [major, minor] = String(version).split(".").map(Number);
  return major > 24 || (major === 24) || (major === 22 && minor >= 19);
}

// `cmd.exe` metacharacters, escaped the way the MSVCRT argument parser and
// `cmd.exe` expect. Kept local so this package stays dependency-free when it is
// published on its own; packages/providers/src/win32-command.mjs holds the
// equivalent used by the plugin itself.
const CMD_META_CHARS = /([()\][%!^"`<>&|;, *?])/g;

function escapeCmdArgument(value) {
  let argument = String(value ?? "");
  argument = argument.replace(/(\\*)"/g, "$1$1\\\"");
  argument = argument.replace(/(\\*)$/, "$1$1");
  return `"${argument}"`.replace(CMD_META_CHARS, "^$1");
}

function escapeCmdCommand(value) {
  return String(value ?? "").replace(CMD_META_CHARS, "^$1");
}

export function commandAvailable(command, env = process.env) {
  // On Windows `dsh` and `pnpm` are `.cmd` shims, which CreateProcess cannot
  // launch without a shell. The command here is always a literal, never user
  // input, so enabling the shell cannot be steered.
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    env,
    ...(process.platform === "win32" ? { shell: true } : {}),
  });
  return result.status === 0;
}

function commandText(command, args) {
  return [command, ...args].map((part) => /[^A-Za-z0-9_./:@%+=,-]/.test(part) ? JSON.stringify(part) : part).join(" ");
}

export function buildInstallPlan(options, { dshAvailable = true, pnpmAvailable = true } = {}) {
  const commands = [];
  if (!dshAvailable) commands.push({ command: "npm", args: ["install", "--global", options.dsh] });
  if (!pnpmAvailable) commands.push({ command: "npm", args: ["install", "--global", "pnpm"] });
  commands.push({ command: "dsh", args: ["plugin", "--profile", options.profile, "add", options.plugin] });
  return commands;
}

function run(command, args, env) {
  console.log(`\n> ${commandText(command, args)}`);
  const result = process.platform === "win32"
    ? runThroughCmd(command, args, env)
    : spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status ?? "unknown"}`);
}

/** Run a `.cmd` shim (npm, pnpm, dsh) through ComSpec so Windows can launch it. */
function runThroughCmd(command, args, env, { stdio = "inherit" } = {}) {
  const comspec = env.ComSpec || env.COMSPEC || "cmd.exe";
  const line = [escapeCmdCommand(command), ...args.map(escapeCmdArgument)].join(" ");
  return spawnSync(comspec, ["/d", "/s", "/c", `"${line}"`], {
    stdio,
    env,
    windowsHide: true,
    windowsVerbatimArguments: true,
  });
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    return 1;
  }
  if (options.help) {
    printUsage();
    return 0;
  }
  if (process.platform !== "darwin" && process.platform !== "win32") {
    console.error(`Dockyard DSH supports macOS and Windows. Current platform: ${process.platform}.`);
    return 1;
  }
  if (!nodeVersionSupported()) {
    console.error(`Dockyard DSH requires Node.js 22.19+ or 24+. Current version: ${process.versions.node}`);
    return 1;
  }

  const dshAvailable = commandAvailable("dsh");
  const pnpmAvailable = commandAvailable("pnpm");
  const plan = buildInstallPlan(options, { dshAvailable, pnpmAvailable });
  if (options.dryRun) {
    console.log(plan.map(({ command, args }) => commandText(command, args)).join("\n"));
    console.log("\nThe DSH Web profile must be restarted after installation.");
    return 0;
  }

  console.log("Installing Dockyard DSH into the DSH Web profile…");
  for (const step of plan) {
    run(step.command, step.args, process.env);
  }
  console.log("\nDockyard DSH was installed successfully.");
  console.log("Restart your running DSH Web profile to load the new bundle.");
  return 0;
}
