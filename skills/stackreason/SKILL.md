---
name: stackreason
description: Interview-driven system design. Narrows scope, extracts real requirements (TPS, latency, availability, consistency, budget), reasons from access patterns, picks the application stack and repo shape, challenges default choices in both directions, then emits an interactive HTML architecture diagram plus a buildable markdown spec. Use when the user asks to design a system or architecture, asks "what stack should I use", "what database should I use", "monolith or microservices", "how should I build X at scale", "design YouTube/Uber/Airbnb", is preparing for a system design interview, or is about to commit to infrastructure choices for a new project or a rewrite.
---

# Stackreason — System Design Architecture

Turn a vague product idea into a defended architecture, an interactive diagram, and a spec another agent can build from.

## Why This Exists

Engineers reach for the same stack regardless of requirements. Vercel plus Supabase gets applied to a 50-user internal tool and to a write-heavy ingestion pipeline alike, because the reflex is faster than the analysis.

This skill inverts the order. Requirements first, components second, and every component justifies itself against a number.

**It is not anti-default, and it is not pro-complexity.** For a great many systems the popular managed stack is exactly right, and this skill must say so plainly and stop. Adding a queue, a cache, a CDN and a read replica to a tool serving 200 people is the same failure as forcing serverless onto a write-heavy pipeline — an unexamined reflex, just a fancier one.

Read `references/design-principles.md` before designing anything. It is the reasoning layer; this file is only the procedure.

## Hard Rules

Violating any of these invalidates the output.

1. **Never name a component before the profile table exists.** Not in passing, not as an example. The interview comes first.
2. **Never design a system you have not narrowed.** "Design YouTube" gets narrowed to one subsystem before anything else happens.
3. **Always ask the three scope questions. Never infer them.** They are the user's to answer, and guessing them silently invalidates everything downstream. If the user's message appears to answer one, confirm it rather than assuming.
4. **Ask about any ambiguity in the user's own words.** "Frontend only", "1,000 users", "real-time" — if a phrase could mean two materially different systems, ask. Only the user knows. Noting an ambiguity and then guessing is worse than not noticing, because it looks resolved.
5. **Never leave a *derived* profile field blank.** Draft a reasoned estimate with visible arithmetic for things like TPS, p99 and data volume, which nobody can answer cold. This rule covers the numbers you infer — never the scope questions or the user's own ambiguous wording.
6. **Never include a component that cannot cite a specific profile line.** If it cannot cite one, delete it.
7. **Never emit a design whose first tier exceeds the stated budget.** Revise, or state the gap in numbers.
8. **Never present an assumption as a fact.** Anything inferred stays marked `[assumed]` through to both output files.
9. **Never skip or reorder phases.** The gates run even when the answer looks obvious.

---

## Phase 0 — Repo Scan

If the working directory is a project, scan before asking anything:

| Look for | Tells you |
|---|---|
| `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` | Language and framework already committed to |
| `Dockerfile`, `docker-compose.yml` | Existing containerization |
| `prisma/`, `migrations/`, `*.sql` | Existing datastore and schema maturity |
| Terraform, CDK, `serverless.yml`, `vercel.json`, `fly.toml` | Existing deploy target |
| Workspace config (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`) | Monorepo, and whether it already runs multiple services |
| `.env.example` | Services already wired |

Use findings to skip answered questions and constrain choices. A repo with forty Postgres migrations does not get a DynamoDB proposal.

State what was found and what it constrains. If nothing is found, say so and proceed greenfield.

---

## Phase 1 — Scope and Narrowing

### The narrowing gate

Some requests name a system that is really a dozen systems: YouTube, Uber, Airbnb, Twitter, Instagram, Amazon, Netflix, Spotify, DoorDash. Also anything phrased as "a platform for" or listing several independent surfaces.

**These cannot be designed in one pass, and attempting it produces a diagram that says nothing useful about any part.** Averaging opposing requirements fits nothing.

When the request is this class, stop and narrow. Present 3-4 concrete subsystems, each with its distinct shape, and ask which one:

```
"Design YouTube" is not designable in one pass. Narrowing to one
subsystem — each is a different problem:

  1. Upload + transcode  -- write-heavy, long jobs, queue + worker
                            fleet, storage cost dominates
  2. Watch + delivery    -- read-heavy, CDN is the whole design,
                            egress cost dominates
  3. Search + recs       -- index freshness, ranking, precompute
                            vs query-time
  4. Creator analytics   -- write-heavy ingest, columnar store,
                            eventual consistency is fine

Which one? The others become named external dependencies with
defined interfaces.
```

Excluded subsystems become explicit interfaces, not omissions. "Transcoding publishes `video.ready`; this subsystem consumes it" is a design decision. A box labeled "transcoding" with no contract is not.

### The three questions

Once scope is narrow enough to design, ask exactly three, together, in one message:

1. What are you building, in one sentence?
2. Who uses it, and roughly how many?
3. What is your budget ceiling per month?

**Ask them. Do not infer them from the user's opening message.** A request like "a gaming site for 20 beta testers and 1,000 users" looks like it answers two of the three, but "1,000 users" could mean total users, concurrent users, or something else entirely, and each is a different system. Confirm rather than assume.

Add a fourth or fifth question whenever the user's own phrasing is ambiguous in a way that changes the design. Common offenders: "frontend only" (no persistence at all, or no custom backend?), "real-time" (sub-second, or just not batch?), "scalable" (to what number?), and any bare figure without a unit.

Only if the user explicitly says they do not know does a scope answer become an assumption — and then it is marked `[assumed]` like any other.

### Functional requirements

Before moving on, write what the system does as a short list of capabilities. This is what "narrow" means concretely — a bounded list, not a product vision.

```
In scope:
  - Creators upload a video file and receive a processing status
  - System transcodes to 3 renditions and generates a thumbnail
  - Creators see per-video processing state and failure reasons
Out of scope (external interfaces):
  - Playback and delivery -- consumes `video.ready`
  - Search indexing       -- consumes `video.ready`
  - Monetization          -- not modeled
```

---

## Phase 2 — Profile and Classification

### Classify the system

Class decides how much design the system warrants. Getting this wrong in either direction is the core failure mode.

| Class | Signals | Treatment |
|---|---|---|
| **S — Small** | Under ~1,000 users, no compliance, one small team, no hard latency floor, modest traffic | Expect the managed default to win. **2 tiers.** One repo, one deployable. Design is minimal by intent. |
| **M — Growth** | Real traffic, cost is a live constraint, single product surface | **3 tiers.** Monolith or modular monolith, a few services if justified. |
| **L — Large** | Narrowed subsystem of a large system, or genuinely distinct scaling shapes in one product | **3 tiers.** Service decomposition is part of the design, justified per boundary. |

State the class and why. It is not a compliment or an insult — it is a sizing decision.

### Draft the non-functional profile

Every field gets a value, a bracketed assumption, and visible reasoning. Present for correction by exception.

```
Write TPS ......  ~40/s   [assumed: 50k DAU x 7 writes/day, 3x peak]
Read TPS .......  ~600/s  [assumed: 15:1 read/write for a feed app]
Read/write shape  Read-heavy [feed reads dominate; posts written once]
p99 latency ....  200ms   [assumed: interactive UI, not realtime]
Availability ...  99.9%   [assumed: 43min/mo downtime tolerable]
Consistency ....  Strong on writes, eventual on feed counts
Durability .....  No data loss on write ack
Data volume ....  ~80GB yr 1  [assumed: 12KB/user/day]
Budget .........  $300/mo [from Q3]
Compliance .....  None    [assumed: no PII beyond email]
Team size ......  2       [assumed: small team, ops burden matters]
```

Rules:

- **Show the arithmetic inside the assumption.** "50k DAU x 7 writes/day, 3x peak" lets the user correct the input rather than the output. "~40/s [estimated]" is useless to them.
- **Always include read/write shape.** Read-heavy and write-heavy systems need opposite toolkits, and most defaults silently assume read-heavy.
- **Correction is by exception.** Say so: "Correct anything wrong; silence means accepted."
- **Scale the profile to the class.** A Class S internal tool needs no consistency analysis. Drop fields that cannot matter and say which you dropped.
- **Peak, not average.** Default to 3x average for consumer apps, 10x for anything with a scheduled trigger or viral surface.
- **Team size is a real constraint**, not a courtesy field. It decides repo shape and how much ops burden the design may impose.

---

## Phase 3 — Targeted Research

Fire 3 to 6 web searches in parallel, scoped only to what goes stale or is genuinely uncertain:

- Current pricing for candidate services at the sizes under consideration
- Managed service limits relevant to the profile: connection caps, throughput ceilings, payload limits, duration caps, cold starts
- Version-specific gotchas where built-in knowledge may lag

Do not search for architecture patterns. That knowledge is in `references/design-principles.md` and searching for it wastes minutes for no accuracy gain.

Stamp every price with its check date. `references/service-catalog.md` has ballparks; verify anything reaching the final cost table.

---

## Phase 4 — Design

Work in this order. Each step constrains the next, and skipping to topology is what produces default stacks.

### 4a — Access patterns, then the data layer

**Never ask "SQL or NoSQL."** Ask how the data is read and written, and let the answer emerge. Write the access patterns down explicitly:

```
Primary read:   feed for one user, most recent 50 posts, joined to
                author -- 600/s
Primary write:  one post insert -- 40/s
Secondary read: single post with comment tree -- 90/s
Analytics:      daily active users -- 1/day, offline
```

Then choose the store, citing the pattern. See `design-principles.md` section 1 for the pattern-to-store mapping.

Then specify, with justification for each: table design, indexes (each annotated with the query it serves), sharding (only if genuinely required — it is a one-way door), and caching (only with a named query it removes and evidence it hurt).

This is where interviewers and production both apply the most pressure. Every decision here needs a reason.

### 4b — API design

How does anything talk to this?

- **Protocol**, with a reason: REST, GraphQL, gRPC, WebSocket, or a queue contract for service-to-service
- **Endpoints**: method, path, auth requirement, expected p99
- **Auth**: mechanism and where it is enforced
- **Rate limiting**: limits and the dimension they apply to
- **Pagination**: cursor or offset, and why, for any list that grows
- **Idempotency**: for any write a client may legitimately retry
- **Long operations**: use the 202-plus-status-URL pattern for anything a user should not wait on

### 4c — Application stack

The layer infrastructure-only designs skip entirely. See `references/stack-selection.md`.

Decide and justify:

- **Language**, from workload shape and team knowledge
- **Framework**, from what the workload actually needs — SSR requirements, admin scaffolding, job runners
- **Runtime topology**: monolith, modular monolith, or services. Split a service only when it clears a stated condition.
- **Code organization**: monorepo or polyrepo. This is independent of runtime topology — a monorepo can contain many services.
- **Hosting shape**, which follows from runtime shape

For Class S, this section is short by design: one language, one framework, one repo, one deployable.

### 4d — Topology and scaling tiers

Draw the components and define the tiers. Class S gets 2, Classes M and L get 3.

Tiers are defined by concrete numbers from the profile, never vague labels. The first tier is what you build now.

Each tier carries:

- Its topology
- Itemized monthly cost
- **Trigger metric** — the observable signal that says move up. "DB CPU sustains above 60% for an hour" or "p99 crosses 300ms." A tier without a trigger metric is incomplete.
- **Scale-down path** — what to switch off and what it saves when traffic falls

Later tiers are documented, not built. Prepared, not pre-built.

---

## Phase 5 — Gates

All four are mandatory, including when the answer seems obvious.

### Gate 1 — Right-size

**What is the least infrastructure meeting every profile line?** Start from that and add only what a line demands.

Delete anything failing this test. A queue, cache, CDN and read replica on a system serving 200 people is over-engineering, and over-engineering is the same unexamined reflex as under-engineering, wearing better clothes.

For Class S, the expected outcome is a small design. Concluding "Vercel free tier plus Supabase free tier, $0/mo, one repo, and here is what breaks first" is a complete success, not a shortfall.

### Gate 2 — Every component cites a requirement

A service enters the design only attached to a specific profile line:

```
Redis        <- read TPS 600/s at p99 200ms exceeds uncached Postgres
Read replica <- 99.9% availability needs failover, and it absorbs feed reads
CDN          <- p99 200ms with users in 3 regions
```

No orphans. "Good practice" is not a citation. A component that cannot cite a line gets removed, not vaguely justified.

Same rule for service boundaries: name which condition from `stack-selection.md` justifies each split.

### Gate 3 — Name the lazy default and judge it out loud

Write down the reflex answer for this system class, then evaluate it against the profile in the open.

```
Reflex stack: Vercel + Supabase + Next.js

Fits:      Read TPS 600/s is comfortable. Team of 2 has no ops
           capacity. Postgres matches the relational access pattern.
Breaks:    Nothing at this scale.
Verdict:   Correct choice. Revisit at ~5k write TPS or when
           connection pooling becomes the bottleneck.
```

Or:

```
Reflex stack: Vercel + Supabase

Fits:      Fast to ship.
Breaks:    Write TPS 4k/s with 50KB payloads. Serverless duration
           caps at the ingestion step. Per-invocation pricing at this
           volume is ~6x a container running continuously.
Verdict:   Rejected. Long-running container on ECS with Kinesis
           buffering.
```

**Both verdicts are successes.** The reasoning is the deliverable, not the conclusion. A run concluding the popular stack is correct, with numbers, has done its job. Reflexively rejecting defaults is just a different reflex.

### Gate 4 — Budget is a hard constraint

If the first tier exceeds the ceiling, the design is wrong. Before emitting: consider cheaper managed options, smaller instance classes, defer components to a later tier, collapse services that can share a host.

If the requirements genuinely cannot be met within budget, say so directly, present the cheapest design that does meet them, and quantify the gap.

### Also required

Weigh at least two alternatives each for compute, datastore, and cache — including "none" for the cache, which is frequently correct. Record what was rejected and why; this feeds the HTML detail panels.

---

## Phase 6 — Emit

Write both files to `docs/architecture/` in the current project. If the working directory is not a project, ask for a path rather than scattering files.

- `docs/architecture/<system-name>-design.html`
- `docs/architecture/<system-name>-design.md`

### Output 1 — Interactive HTML

Build from `references/html-template.html`. Fully self-contained: inline SVG, inline CSS, inline JS, no network requests. It must open from `file://` with no internet.

Required: tier tabs (2 or 3, matching class), clickable nodes with detail panels, access-pattern table, stack summary, itemized cost, trigger metric and scale-down path per tier, and an ordered start-here checklist.

Node detail panels contain: what it is, which requirement justified it, concrete size and tier, monthly cost, ceiling before it breaks with the symptom, and what was rejected in its place.

Constraints: no external requests of any kind; service icons must be inline SVG; theme-aware via `prefers-color-scheme` plus a `data-theme` override on `:root`; wide content scrolls inside its own container so the body never scrolls horizontally; no emojis.

### Output 2 — Markdown build spec

Build from `references/spec-template.md`. Written as constraints, not suggestions: "Use Postgres 16 on RDS", never "consider using Postgres".

Contents: access patterns; stack decision with repo shape; service list with exact versions and instance tiers; full DDL with every index annotated by the query it serves; API surface table; caching keys, TTLs and invalidation rules; environment variables; ordered build checklist; and every uncorrected `[assumed]` field flagged for verification.

Rationale and rejected alternatives live in the HTML. The markdown stays a build document.

### Validate before reporting done

```bash
node ~/.claude/skills/stackreason/references/validate.js docs/architecture/<name>-design.html
```

Catches what review by eye misses: cost rows not summing to the headline, nodes missing a `why` or `ceiling`, edges pointing at nonexistent nodes, overlapping layout, same-row edges drawing through intervening nodes, external requests breaking the self-contained rule, and a first tier above budget.

A `why` reading "good practice" or "industry standard" is rejected. That is intentional — it is not a citation.

---

## After Emitting

Report both file paths. Offer to publish the HTML as a shareable artifact.

Then state the two or three assumptions most likely to be wrong and what would change if they were. This is the highest-value closing move: it tells the user where to spend verification effort.

## Common Failure Modes

| Symptom | Fix |
|---|---|
| Recommending a stack in phase 1 | Stop. Return to the interview. Rule 1. |
| Attempting "design YouTube" whole | Rule 2. Narrow to one subsystem first. |
| Three tiers of infra for 200 users | Gate 1. Class S gets 2 tiers and a small design. |
| Every profile field marked `[assumed]` | Scope questions were asked too shallowly, or the repo scan was skipped. |
| Design has a queue, cache and CDN for a tiny app | Gate 2 was not run honestly. Delete what cannot cite a line. |
| Gate 3 always rejects the popular stack | Over-correction. The reflex stack is often right. Judge it; do not reflexively reject it. |
| Chose the database before writing access patterns | Phase 4a exists precisely to prevent this. |
| No language or repo-shape decision anywhere | Phase 4c was skipped. Infrastructure is not the whole design. |
| Services proposed with no stated condition | Gate 2 applies to boundaries too. |
| Cost table has no dates | Phase 3 was skipped. |
| Tiers labeled "small, medium, large" | Tiers need real numbers and trigger metrics, not t-shirt sizes. |

## Reference Files

- `references/design-principles.md` — **read this first.** Access patterns, read/write scaling, caching costs, queues, partitioning, consistency, right-sizing, narrowing large systems.
- `references/stack-selection.md` — language, framework, runtime topology, repo shape.
- `references/service-catalog.md` — candidate services with selection criteria, ceilings, cost anchors. Verify pricing before use.
- `references/html-template.html` — self-contained interactive diagram scaffold.
- `references/spec-template.md` — markdown build spec structure.
- `references/validate.js` — output validator.
