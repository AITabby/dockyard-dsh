# Rakazo-like Persistent Bot Preset

A DSH cordis patch that transforms a session into a **persistent AI teammate**:
fixed persona, background subagent delegation, goal tracking, and scheduled
reminders — inspired by [Rakazo](https://github.com/elie222/rakazo).

---

## Quick Start

```bash
# Start DSH Web with this preset
dsh --profile web --patch presets/rakazo-bot.cordis.yml

# Or with Dockyard provider pool (uncomment in the yml first)
# dsh plugin --profile web add github:AITabby/dockyard-dsh
# dsh --profile web --patch presets/rakazo-bot.cordis.yml
```

Visit http://127.0.0.1:3080, create an account, connect a model, and start chatting.

---

## Features

| Capability | DSH Package | Notes |
|---|---|---|
| Persistent persona | `dsh-persona` | Fixed identity injected every turn |
| Goal tracking | `tool-goal` + `goal-round-driver` | Long-running objectives |
| Background subagents | `subagent` (continuable) | Parallel work via `send_message` |
| One-shot fork | `subagent_fork` | Inherited prefix, one-off tasks |
| Multi-agent workflow | `tool-workflow` + `tool-ralph` | Fan-out + iterative loops |
| Web fetch/search | `tool-web` | MCP puppeteer for full browser control |
| Sandbox FS + Bash | `dsh-fs-sandbox` + `dsh-bash-sandbox` | Workspace-isolated |
| Session persistence | `session-persistence-jsonl` | Compressed JSONL, auto-resume |
| Context compaction | `compaction-basic` | Auto-summary near context limit |
| In-session schedule | `dsh-schedule` | Process-local timer |

---

## Cross-Session Routines

DSH built-in `schedule/` keeps state in process memory. For truly persistent routines (like Rakazo Routines), combine with an external wake mechanism:

### Option A: System cron / Task Scheduler

```bash
# Linux/macOS crontab — daily 9am trigger
0 9 * * * dsh --profile web --patch presets/rakazo-bot.cordis.yml "Check GitHub projects"
```

### Option B: ACP HTTP wake-up

```bash
dsh --profile web --patch presets/rakazo-bot.cordis.yml --acp-port 18789
# Trigger via HTTP POST (e.g. from ntfy/Bark push notification)
curl -X POST http://127.0.0.1:18789/agent/main/message \
  -H "Content-Type: application/json" \
  -d '{"text":"Check latest issues"}'
```

---

## Customise Persona

Edit the `persona-rakazo-bot` section in `presets/rakazo-bot.cordis.yml`:

```yaml
- id: persona-rakazo-bot
  name: '@deepseek-ai/dsh-persona'
  config:
    text: |
      You are a persistent AI teammate.
      Remember past conversations, track unfinished goals,
      and be proactive about follow-ups.
    complete: true
    includeRuntimeContext: true
```

- `complete: true` replaces the deployment-level persona as the only system prompt segment
- `includeRuntimeContext: true` keeps sandbox/approval/runtime context

---

## Enable Dockyard Provider Pool

To use Codex / Antigravity / Grok / Claude / Cursor official OAuth accounts:

1. Install the plugin:
```sh
dsh plugin --profile web add github:AITabby/dockyard-dsh
```

2. Uncomment the `dockyard-dsh` block in `presets/rakazo-bot.cordis.yml`.

3. Add accounts in DSH with `/dockyard login <provider>`.

---

## Full Browser Automation (Optional)

`tool-web` provides fetch/search only. For full browser control (click, fill, screenshot),
wire up an MCP server like puppeteer:

```yaml
- id: mcp-puppeteer
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-puppeteer"]
```

---

## Project Layout

```

presets/
└─ rakazo-bot.cordis.yml   # DSH cordis patch (core config)
└─ README.md              # This file
```

---

## Comparison with Rakazo

| Feature | Rakazo | This Preset (DSH) |
|---|---|---|
| Persistent bot identity | yes (built-in) | yes (persona preset) |
| Cross-session routines | yes (built-in scheduler) | needs external cron/ACP |
| Bot-to-bot delegation | yes | yes (subagent/fork) |
| Voice interaction | yes | no (needs extra plugin) |
| Native desktop/mobile client | yes | no (relies on DSH Web/CLI) |
| Computer sandbox (E2B/Daytona) | yes | E2B available, needs config |
| Multi-model BYOM | yes | yes (Dockyard + built-in) |
| Open source | Apache 2.0 | MIT (DSH) + Apache 2.0 |

---

## License

MIT, same as upstream DSH.