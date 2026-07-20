# Using stackreason with other agents

## Platform status

Honest about what has actually been run versus what merely looks right.

| Platform | Status | Evidence |
|---|---|---|
| **Claude Code** | **Verified** | Skill loads and runs; used to produce every example in `examples/` |
| **Codex** | **Verified end to end** | `codex plugin marketplace add .` then `codex plugin add stackreason@stackreason`. Reports installed and enabled, all five skills present in the installed cache, validator runs from that copy |
| **Gemini CLI** | **Verified end to end** | `gemini extensions install <repo> --consent`. `gemini extensions list` shows all five skills with descriptions and `GEMINI.md` as the context file |
| **Cursor** | **Partly unverified** | `.cursor/rules/stackreason.mdc` uses Cursor's documented rules format and should work, but was not loaded in a running Cursor session. `.cursor-plugin/plugin.json` mirrors what superpowers ships, but the Cursor CLI exposes no plugin or skill command, so that path could not be exercised at all |
| **OpenCode** | **Untested** | `.opencode/plugins/stackreason.js` parses as a valid ES module and mirrors a working plugin's structure. OpenCode was not installed, so it has never been loaded |
| **Kimi, Pi, Copilot CLI** | **No manifest** | Not attempted |

Testing caught one error that would have hit every Codex user on their first command: the marketplace manifest used `"authentication": "NONE"`, which the schema rejects — only `ON_INSTALL` and `ON_USE` are valid. Nothing but running the command would have found that.

If you run this on Cursor or OpenCode, an issue reporting either outcome is genuinely useful.

## What a skill actually is

Nothing here is Claude-specific. The skills are markdown with YAML frontmatter, the validator is dependency-free Node, and the output is plain HTML. Any agent that can read a file and run a command can use this.

## What a skill actually is

```markdown
---
name: stackreason
description: ...trigger phrases...
---

# Instructions in markdown
```

That is the whole format. The frontmatter `description` decides when the agent loads it; the body is the procedure. Different harnesses discover these differently, but the file is the same.

## Claude Code — verified

**As a plugin** — all five skills:

```bash
/plugin marketplace add ChiFungHillmanChan/stackreason
/plugin install stackreason
```

**As a single skill** — just the design one:

```bash
git clone https://github.com/ChiFungHillmanChan/stackreason /tmp/sr
cp -r /tmp/sr/skills/stackreason ~/.claude/skills/
```

## Codex — verified

Codex has a real plugin marketplace:

```bash
codex plugin marketplace add ChiFungHillmanChan/stackreason
codex plugin add stackreason@stackreason
```

Confirm with `codex plugin list` — it should read `installed, enabled`.

For a local checkout, `codex plugin marketplace add .` from the repo root works too.

## Gemini CLI — verified

```bash
gemini extensions install https://github.com/ChiFungHillmanChan/stackreason
```

`gemini extensions list` should show all five skills and `GEMINI.md` as the context file.

## Cursor

Cursor's CLI has no plugin or skill command; it uses rules. Copy the rule into your project:

```bash
mkdir -p .cursor/rules
curl -o .cursor/rules/stackreason.mdc \
  https://raw.githubusercontent.com/ChiFungHillmanChan/stackreason/main/.cursor/rules/stackreason.mdc
```

Then edit the paths in it to point at wherever you cloned the repo.

`.cursor-plugin/plugin.json` also exists, mirroring what other skill plugins ship, but no CLI command exercises it — treat it as untested.

## OpenCode

See [`.opencode/INSTALL.md`](../.opencode/INSTALL.md). Untested; report either outcome.

## Windsurf and other AGENTS.md harnesses

These read `AGENTS.md` from the project root. Clone the repo somewhere permanent and point at it:

```markdown
## System design

When the user asks about system design, architecture, what stack to use,
what database to use, or monolith versus microservices, read
~/tools/stackreason/skills/stackreason/SKILL.md and follow it exactly.

Related skills in ~/tools/stackreason/skills/:
  architecture-review/  audit an existing system
  capacity-estimate/    cost and sizing arithmetic
  interview-drill/      interview practice
  diagram-only/         artifact without an interview
```

Explicit paths work better than "search for a skill" — the harness will not find it otherwise.

## Gemini CLI

Same approach via `GEMINI.md`. Gemini follows imperative instructions well but is more likely to summarise a long file than execute it step by step, so add:

```markdown
Follow the phases in order. Do not summarise the file; execute it.
```

## Any agent, no configuration

Paste the skill body into the conversation. It is self-contained prose and works without any harness integration:

> Follow this procedure exactly: [paste SKILL.md]
>
> I want to design: a booking system for a yoga studio.

Less convenient, but it works everywhere, including in a plain chat window.

## What degrades without a harness

| Feature | Needs | Without it |
|---|---|---|
| Auto-triggering | Frontmatter-aware harness | Invoke it manually |
| Live pricing | Web search | Falls back to the catalog, which has dates |
| Repo scan | File reading | Designs greenfield; tell it your stack instead |
| Validation | Shell access | Run `node validate.js` yourself |
| Artifact publishing | Claude Code | Open the HTML locally; it is self-contained |

Only the first is a real loss. Everything else has a manual path.

## Running the validator anywhere

```bash
node skills/stackreason/references/validate.js design.html
```

Node 18 or later. No dependencies, no install, no network. Exit code 0 passes, 1 fails.

This matters more than it sounds: whatever agent produced the design, the validator is an independent check on it. An agent grading its own homework is not a check. A dependency-free script that fails the build is.

## Porting notes

If you add support for a harness, the parts that usually need adjusting:

- **Path references.** Skills reference `skills/stackreason/references/...` from the plugin root. Harnesses with a different root need these rewritten or symlinked.
- **Tool names.** The skills mention web search and file reading generically rather than by tool name, so this is usually fine.
- **Instruction strength.** Some models drift from multi-phase procedures. Adding "do not skip or reorder phases" near the top helps measurably.

Pull requests adding harness support are welcome. Include a note in this file describing what you had to change.
