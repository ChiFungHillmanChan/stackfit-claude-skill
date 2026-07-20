<img src="assets/logo.svg" width="72" align="right" alt="">

# stackreason

[![validate](https://github.com/ChiFungHillmanChan/stackreason/actions/workflows/validate.yml/badge.svg)](https://github.com/ChiFungHillmanChan/stackreason/actions/workflows/validate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![prices verified](https://img.shields.io/badge/prices%20verified-2026--07--20-047857.svg)](docs/maintaining-prices.md)

**Reason about your stack. Don't reflex into it.**

Five system-design skills for AI coding agents. They interview you about what you are actually building, make every component justify itself against a number, and emit an interactive architecture diagram plus a spec another agent can build from.

Works with Claude Code, Codex, Cursor, Gemini CLI, and anything else that reads markdown instructions.

![Clicking a component shows why it was chosen, what it costs, and what breaks first](assets/node-detail.jpg)

## Why

Engineers reach for the same stack regardless of requirements. Vercel plus Supabase gets applied to a 50-user internal tool and to a write-heavy ingestion pipeline alike, because the reflex is faster than the analysis. The cost surfaces later as a migration.

This inverts the order: requirements first, components second, and **every component must cite the requirement it serves.** Anything that cannot is deleted.

It is not anti-default, and it is not pro-complexity. Putting a queue, a cache, a CDN and a read replica in front of a tool serving 200 people is the same unexamined reflex as forcing serverless onto a write-heavy pipeline — and the more expensive one, because someone then maintains all of it. Both directions are guarded.

**A run that concludes "the popular managed stack is correct here, and here is what breaks first" has succeeded completely.**

## The five skills

| Skill | Use it when |
|---|---|
| **stackreason** | Designing something new. The full interview, gates, and artifacts. |
| **architecture-review** | Auditing a system that already exists. What is unjustified, what breaks next, what costs more than it returns. |
| **capacity-estimate** | You want a number, not an architecture. "What does 100k users cost?" with the arithmetic shown. |
| **interview-drill** | Practising system design interviews against an interviewer that pushes back. |
| **diagram-only** | The design is settled; you just need the artifact for a deck or an RFC. |

## Install

### Claude Code — all five skills

```
/plugin marketplace add ChiFungHillmanChan/stackreason
/plugin install stackreason
```

### Claude Code — just the design skill

```bash
git clone https://github.com/ChiFungHillmanChan/stackreason /tmp/sr
cp -r /tmp/sr/skills/stackreason ~/.claude/skills/
```

### Codex, Cursor, and other AGENTS.md agents

Clone somewhere permanent, then add to your `AGENTS.md`:

```markdown
When the user asks about system design, architecture, what stack to use,
or what database to use, read ~/tools/stackreason/skills/stackreason/SKILL.md
and follow it exactly.
```

Full instructions, including Gemini CLI and no-harness usage, in [docs/porting.md](docs/porting.md).

## What a run looks like

Three questions you must answer:

1. What are you building, in one sentence?
2. Who uses it, and roughly how many?
3. What is your budget ceiling per month?

Then it drafts everything else — with the arithmetic visible, so you correct the input rather than the output:

```
Write TPS ......  ~40/s   [assumed: 50k DAU x 7 writes/day, 3x peak]
Read TPS .......  ~600/s  [assumed: 15:1 read/write for a feed app]
p99 latency ....  200ms   [assumed: interactive UI, not realtime]
Budget .........  $300/mo [from Q3]
```

Almost nobody can answer "what is your write TPS" cold. Everybody can spot that 50k DAU is off by 10x.

## How it works

| Phase | What happens |
|---|---|
| 0. Repo scan | Reads `package.json`, migrations, Dockerfiles, IaC. Forty Postgres migrations does not get a DynamoDB proposal. |
| 1. Scope | Narrows large systems to one subsystem, then asks the three questions. |
| 2. Profile | Classifies the system S/M/L and drafts every requirement with visible arithmetic. |
| 3. Research | Parallel searches for current pricing and service limits. It does not search for what a load balancer is. |
| 4. Design | Access patterns → data layer → API → application stack → topology. In that order, because each constrains the next. |
| 5. Gates | Four mandatory checks before anything is drawn. |
| 6. Emit | Writes both files, then validates them. |

### Access patterns choose the database

It never asks "SQL or NoSQL" — that question has no answer. It writes down how the data is actually read and written first:

```
Primary read:   class schedule for a date range, joined to
                instructor and room  -- 8/s, the join IS the query
Primary write:  create booking + decrement capacity
                -- 2/s, must be one transaction
```

That is what picks Postgres, and it stays in the output so the choice remains defensible in six months.

### Large systems get narrowed, not attempted

Asked to design YouTube, it refuses. Upload-and-transcode is write-heavy with long jobs; watch-and-delivery is read-heavy and CDN-dominated; creator analytics is columnar and tolerates eventual consistency. Averaging those fits nothing. It offers the subsystems, you pick one, and the rest become named interfaces.

### It decides the application layer too

Language, framework, runtime topology, repo shape — not just infrastructure. Including the distinction most discussions blur: **monorepo versus polyrepo is code organisation; monolith versus services is runtime topology.** Independent axes. A monorepo running several services is common and often correct.

Services split only when a boundary clears a stated condition. A boundary with no condition does not ship.

### The four gates

**Gate 1 — right-size.** What is the least infrastructure meeting every profile line? A small system is expected to produce a small design.

**Gate 2 — every component cites a requirement.** "Good practice" is not a citation — the validator rejects that phrase specifically.

**Gate 3 — the reflex stack is named and judged out loud.** Both verdicts are successes; the reasoning is the deliverable.

**Gate 4 — budget is a hard constraint.** Over the ceiling means the design is wrong, not that the ceiling is.

## Worked examples

Three runs deliberately spanning the range, all in [`examples/`](examples/).

### It stays small when small is right

![The reflex stack judged as correct, two tiers, $20/mo](assets/verdict-correct.jpg)

A yoga studio booking app. 800 members, solo developer.

```
Verdict:   CORRECT. This is the right answer and the design stops
           here. No queue, no cache, no CDN beyond what Vercel
           already does, no read replica, no container platform.
```

Five components, $20/mo, two tiers instead of three. The research still earned its place: Vercel's Hobby plan forbids commercial use, and a studio taking payments is commercial.

### It rejects the default when the default is wrong

![The reflex stack rejected, three deployables from one monorepo](assets/verdict-rejected.jpg)

12,000 refrigeration sensors, food-safety compliance, $1,200/mo ceiling.

The research phase found the decisive number: AWS IoT Core meters at $1 per million messages, so 12,000 units reporting every 30 seconds is 1.04 billion messages a month — **$1,037/mo in messaging alone, 86% of the budget, before any database exists.** Batching ten readings per publish cuts it to $104.

A default design never surfaces that number because it never computes it.

### It handles genuinely unusual constraints

A WebGL browser game, no backend at all, hard $0 ceiling. Here the reflex stack was rejected in all three parts — and the binding constraint turned out to be Cloudflare Pages' 25 MiB per-file limit, which rejects most WebGL builds at deploy time rather than at scale.

## Validating output

```bash
node skills/stackreason/references/validate.js docs/architecture/my-design.html
```

Catches what review by eye misses: cost tables that do not sum, components that skipped a gate, edges to nonexistent nodes, layouts the router cannot draw, external references that break offline opening, and a first tier above budget.

CI does not only run it — it mutates a known-good example four ways and requires rejection each time. A validator that only ever prints PASS is worthless.

## On the numbers

A tool telling you to stop guessing about cost should not guess about cost.

Figures marked `[v]` were verified against vendor pricing on **2026-07-20**. That pass found four material errors in the first draft, including a 66% overstatement, a threefold overstatement, and a budget line for [an Upstash tier that does not exist](docs/maintaining-prices.md).

Two things this does not mean. **These are not quotes** — region, commitments and free-tier credits move them, so re-verify anything reaching a real budget. And **the architectural judgment is not independently reviewed**; the pricing is checked, the opinions in `design-principles.md` are reasoned but have not been through a production-experienced reviewer. Weigh them as argument, not authority.

## Layout

```
skills/
  stackreason/          design skill + the shared reasoning layer
    references/         principles, stack selection, catalog, template, validator
  architecture-review/  audit an existing system
  capacity-estimate/    arithmetic without a design
  interview-drill/      interview practice
  diagram-only/         artifact without an interview
docs/                   architecture, output format, extending, prices, porting
examples/               three worked runs, HTML + markdown
scripts/                validate-all.sh, check-prices.sh
```

## Documentation

- [How it is built, and why](docs/architecture.md)
- [Output format](docs/output-format.md) — hand-editing and scripting against a design
- [Extending](docs/extending.md) — your cloud, your standards, your validator rules
- [Maintaining prices](docs/maintaining-prices.md)
- [Using other agents](docs/porting.md)

## Contributing

Pricing corrections are the most valuable contribution and have their own issue template. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Caveats

- Cost figures carry a check date. They drift, and a dated figure is only trustworthy near its date.
- The examples are illustrative designs, not systems that have been built and benchmarked.
- This produces a design, not code. It stops at the spec deliberately.

## License

MIT
