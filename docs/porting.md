# Using stackreason with other agents

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

## Claude Code

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

## Codex, Cursor, Windsurf, and other AGENTS.md harnesses

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
