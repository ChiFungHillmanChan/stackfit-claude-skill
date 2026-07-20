---
name: system-design-architecture
description: Interview-driven system design. Extracts real requirements (TPS, latency, availability, consistency, budget), challenges default stacks, then emits an interactive HTML architecture diagram plus a buildable markdown spec. Use when the user asks to design a system or architecture, asks "what stack should I use", "how should I build X at scale", "design the architecture for X", "what database should I use", or is about to commit to infrastructure choices for a new project or a rewrite.
---

# System Design Architecture

Turn a vague product idea into a defended architecture, an interactive diagram, and a spec another agent can build from.

## Why This Exists

Engineers reach for the same stack regardless of requirements. Vercel plus Supabase gets applied to a 50-user internal tool and to a write-heavy ingestion pipeline alike, because the reflex is faster than the analysis. The cost shows up later as a migration.

This skill inverts the order. Requirements first, components second, and every component has to justify its existence against a number.

It is not anti-default. For plenty of systems the popular stack is genuinely correct, and this skill must be able to say so plainly. What it forbids is arriving there without checking.

## Hard Rules

Violating any of these invalidates the output.

1. **Never name a component before the profile table exists.** Not in passing, not as an example. The interview comes first, always.
2. **Never leave a profile field blank pending user input.** Draft a reasoned estimate and show the arithmetic. A wrong number the user can correct beats a blank that hands the work back.
3. **Never include a component that cannot cite a specific profile line.** If it cannot cite one, delete it.
4. **Never emit a design whose MVP tier exceeds the stated budget.** Revise, or state the gap explicitly in numbers.
5. **Never present an assumption as a fact.** Anything inferred stays marked `[assumed]` through to both output files.
6. **Never skip or reorder phases.** Phase 4 gates run even when the answer looks obvious.

## Phase 0 — Repo Scan

If the working directory is a project, scan before asking anything:

| Look for | Tells you |
|---|---|
| `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` | Language and framework already committed to |
| `Dockerfile`, `docker-compose.yml` | Existing containerization |
| `prisma/`, `migrations/`, `*.sql` | Existing datastore and schema maturity |
| Terraform, CDK, `serverless.yml`, `vercel.json`, `fly.toml` | Existing deploy target |
| `.env.example` | Services already wired |

Use findings to skip questions already answered and to constrain choices. A repo with forty Postgres migrations does not get a DynamoDB proposal.

State what was found and what it constrains before moving on. If nothing is found, say so and proceed greenfield.

## Phase 1 — Scope

Exactly three questions. Ask them together, in one message.

1. What are you building, in one sentence?
2. Who uses it, and roughly how many?
3. What is your budget ceiling per month?

This phase is deliberately short. Phase 2 does the real extraction.

If the user cannot answer question 3, assume the cheapest tier that meets the requirements and mark it `[assumed]`.

## Phase 2 — Profile Draft

Draft the full requirements profile. Every field gets a value, a bracketed assumption, and visible reasoning. Present it for correction by exception.

```
Write TPS ......  ~40/s   [assumed: 50k DAU x 7 writes/day, 3x peak]
Read TPS .......  ~600/s  [assumed: 15:1 read/write for a feed app]
p99 latency ....  200ms   [assumed: interactive UI, not realtime]
Availability ...  99.9%   [assumed: 43min/mo downtime tolerable]
Consistency ....  Strong on writes, eventual on feed
Durability .....  No data loss on write ack
Data volume ....  ~80GB yr 1  [assumed: 12KB/user/day]
Budget .........  $300/mo [from Q3]
Compliance .....  None    [assumed: no PII beyond email]
Team size ......  2       [assumed: small team, ops burden matters]
```

Rules:

- **Show the arithmetic inside the assumption.** "50k DAU x 7 writes/day, 3x peak" lets the user correct the input rather than the output. "~40/s [estimated]" is useless to them.
- **Correction is by exception.** Say so explicitly: "Correct anything wrong; silence means accepted."
- **Scale the profile to the system class.** A static marketing site needs no consistency analysis. Drop fields that cannot matter and say which you dropped and why.
- **Peak, not average.** Traffic is never flat. Default to 3x average for consumer apps, 10x for anything with a scheduled trigger or a viral surface.

Then say the profile is what everything downstream is derived from, and wait.

## Phase 3 — Targeted Research

Fire 3 to 6 web searches in parallel, scoped only to what goes stale or what is genuinely uncertain:

- Current pricing for each candidate service at the sizes under consideration
- Managed service limits relevant to the profile numbers: connection caps, throughput ceilings, payload limits, cold start behavior
- Version-specific gotchas where built-in knowledge may lag

Do not search for architecture patterns. Do not search for what a load balancer is. That knowledge is already available and searching for it wastes minutes per run for no accuracy gain.

Stamp every price with the date it was checked. `references/service-catalog.md` has starting ballparks, but it goes stale — verify anything that lands in the final cost table.

## Phase 4 — Design and Default Challenge

Select components, then pass three gates. All three are mandatory, including when the answer seems obvious.

### Gate 1 — Every component cites a requirement

A service enters the design only when attached to a specific profile line.

```
Redis        <- read TPS 600/s at p99 200ms exceeds uncached Postgres
Read replica <- 99.9% availability needs failover, and it absorbs feed reads
CDN          <- p99 200ms with users in 3 regions
```

No orphan components. A component that cannot cite a line gets removed, not justified vaguely. "Good practice" is not a citation.

### Gate 2 — Name the lazy default and judge it out loud

Write down the reflex answer for this class of system, then evaluate it against the profile in the open.

```
Reflex stack: Vercel + Supabase + Next.js

Fits:      Read TPS 600/s is comfortable. Team of 2 has no ops capacity.
           Postgres matches the relational access pattern.
Breaks:    Nothing at this scale.
Verdict:   Correct choice. Revisit at ~5k write TPS or when
           connection pooling becomes the bottleneck.
```

Or:

```
Reflex stack: Vercel + Supabase

Fits:      Fast to ship.
Breaks:    Write TPS 4k/s with 50KB payloads. Serverless function
           duration caps at the ingestion step. Per-invocation pricing
           at this volume is ~6x a container running continuously.
Verdict:   Rejected. Long-running container on ECS with Kinesis buffering.
```

Both verdicts are valid outputs. The reasoning is the deliverable, not the conclusion. A run that concludes the popular stack is right, with numbers, has succeeded.

### Gate 3 — Budget is a hard constraint

If the MVP tier exceeds the ceiling from phase 1, the design is wrong. Before emitting:

- Consider cheaper managed options and smaller instance classes
- Defer components to a later tier where the requirement does not yet bite
- Collapse services that can share a host at low volume

If the requirements genuinely cannot be met within budget, say so directly, present the cheapest design that does meet them, and quantify the gap. Do not silently emit an over-budget design.

### Also required

Weigh at least two alternatives each for compute, datastore, and cache. Record what was rejected and why — this goes into the HTML detail panels.

## Phase 5 — Emit

Write both files to `docs/architecture/` in the current project. If the working directory is not a project, ask for a path rather than scattering files.

- `docs/architecture/<system-name>-design.html`
- `docs/architecture/<system-name>-design.md`

### Output 1 — Interactive HTML

Build from `references/html-template.html`. Fully self-contained: inline SVG, inline CSS, inline JS, no network requests. It must open correctly from `file://` with no internet.

Required elements:

**Tier tabs** — MVP, Growth, Scale. Each swaps its own SVG diagram and updates the cost readout.

Tiers are defined by concrete numbers from the profile, never vague labels. MVP is launch traffic. Growth and Scale are the next meaningful inflection points for this specific system, not fixed multiples.

Each tier carries:

- Its topology as inline SVG
- Monthly cost, itemized by service
- **Trigger metric** — the observable signal that says move up. "Go to Growth when DB CPU sustains above 60 percent or p99 crosses 300ms." A tier without a trigger metric is incomplete.
- **Scale-down path** — what to switch off and what it saves when traffic drops. Scaling down is a requirement, not an afterthought.

**Clickable nodes** — every SVG node opens a detail panel containing:

- What the service is, one line
- Which requirement justified it, quoted from the profile
- Size and tier, concretely: `db.t4g.medium, 2vCPU/4GB, 100GB gp3`
- Monthly cost at this tier
- Ceiling before it breaks, with the symptom: `~3k TPS before you need a read replica`
- What was rejected in its place, and why

**Start-here checklist** — ordered setup steps, first action to running system. Each step is a concrete action, not a topic. "Create the RDS instance with these parameters" beats "set up the database".

Constraints:

- No external requests of any kind. No CDN scripts, no remote fonts, no hotlinked logos. Service icons must be inline SVG.
- Theme-aware: support light and dark via `prefers-color-scheme`, and honor a `data-theme` attribute override on `:root`.
- Responsive: wide content scrolls inside its own `overflow-x: auto` container. The page body never scrolls horizontally.
- No emojis.

### Output 2 — Markdown build spec

Build from `references/spec-template.md`. Written as constraints, not suggestions, so a downstream coding agent cannot drift back to defaults. Imperative voice: "Use Postgres 16 on RDS", never "consider using Postgres".

Contents:

- **Service list** — exact versions and instance tiers, not families. `db.t4g.medium`, not "a small RDS instance".
- **Schema** — full DDL. Every index annotated with the query it serves. An index without a named query gets removed.
- **API surface** — endpoint table: method, path, auth requirement, expected p99.
- **Caching** — key patterns, TTLs, and invalidation rules. A cache without a stated invalidation rule is not in the design.
- **Environment variables** — name, purpose, whether it is a secret.
- **Build checklist** — ordered steps to a running system.
- **Assumptions** — every uncorrected `[assumed]` field, flagged for verification.

Rationale and rejected alternatives live in the HTML, not here. The markdown stays a build document.

### Validate before reporting done

After writing the HTML, run the validator and fix anything it reports. Do not claim the design is finished until it passes.

```bash
node <skill-dir>/references/validate.js docs/architecture/<system-name>-design.html
```

It checks what review by eye misses: cost rows that do not sum to the headline figure, nodes missing a `why` or `ceiling` (Gate 1 violations), edges pointing at nonexistent nodes, overlapping grid cells, external requests that break the self-contained rule, and an MVP tier above the stated budget (Gate 3 violation).

A `why` field that reads "good practice" or "industry standard" is rejected by the validator. That is intentional — it is not a citation.

## After Emitting

Report both file paths. Offer to publish the HTML as a shareable artifact.

Then state the two or three assumptions most likely to be wrong, and what would change in the design if they were. This is the highest-value closing move: it tells the user where to spend verification effort.

## Common Failure Modes

| Symptom | Fix |
|---|---|
| Recommending a stack in phase 1 | Stop. Return to the interview. Rule 1. |
| Every profile field marked `[assumed]` | The three scope questions were asked too shallowly, or the repo scan was skipped. |
| Design has a queue, a cache, and a CDN for 200 users | Gate 1 was not run honestly. Delete anything that cannot cite a line. |
| Gate 2 always rejects the popular stack | Over-correction. The reflex stack is often right. Judge it, do not reflexively reject it. |
| Cost table has no dates | Phase 3 was skipped. Prices without a check date are not usable. |
| Tiers labeled "small, medium, large" | Tiers need real numbers and trigger metrics, not t-shirt sizes. |

## Reference Files

- `references/service-catalog.md` — candidate services with selection criteria, ceilings, and cost ballparks. Verify pricing before use.
- `references/html-template.html` — self-contained interactive diagram scaffold.
- `references/spec-template.md` — markdown build spec structure.
