# stackfit

**Stop defaulting to the same stack.** Interview-driven system design for Claude Code.

A skill that interviews you about what you are actually building, challenges the stack you were about to reach for, and emits an interactive architecture diagram plus a spec another agent can build from.

Two files come out the other end:

- **`<system>-design.html`** — self-contained interactive page. Three scale tiers you can tab between, clickable components, cost breakdown per tier, and an ordered start-here checklist.
- **`<system>-design.md`** — build spec written as constraints, precise enough that a coding agent starts implementing without asking follow-up questions.

## Why

Engineers reach for the same stack regardless of requirements. Vercel plus Supabase gets applied to a 50-user internal tool and to a write-heavy ingestion pipeline alike, because the reflex is faster than the analysis. The cost surfaces later as a migration.

This skill inverts the order: requirements first, components second, and every component has to justify itself against a number.

It is not anti-default. For plenty of systems the popular stack is genuinely correct, and the skill will say so plainly, with the reasoning shown. What it forbids is arriving there without checking.

## Install

Clone straight into your skills directory. `SKILL.md` sits at the repo root, so the clone target becomes the skill name.

```bash
git clone https://github.com/ChiFungHillmanChan/stackfit-claude-skill.git \
  ~/.claude/skills/stackfit
```

For a single project instead of globally:

```bash
git clone https://github.com/ChiFungHillmanChan/stackfit-claude-skill.git \
  .claude/skills/stackfit
```

Restart Claude Code, or start a new session. Verify with `/stackfit`.

## Use

Invoke explicitly:

```
/stackfit
```

Or just describe the problem — the skill triggers on phrasing like "design the architecture for a ride-sharing backend", "what stack should I use for this", "what database should I use", "how should I build this at scale".

You will be asked exactly three questions:

1. What are you building, in one sentence?
2. Who uses it, and roughly how many?
3. What is your budget ceiling per month?

Then it drafts the rest — write TPS, read TPS, p99 target, availability, consistency, data volume, compliance — with the arithmetic shown for every estimate:

```
Write TPS ......  ~40/s   [assumed: 50k DAU x 7 writes/day, 3x peak]
Read TPS .......  ~600/s  [assumed: 15:1 read/write for a feed app]
p99 latency ....  200ms   [assumed: interactive UI, not realtime]
Availability ...  99.9%   [assumed: 43min/mo downtime tolerable]
Budget .........  $300/mo [from Q3]
```

You correct what is wrong. Silence means accepted. This exists because almost nobody can answer "what is your write TPS" cold, but everybody can spot that 50k DAU is off by 10x.

## How It Works

| Phase | What happens |
|---|---|
| 0. Repo scan | Reads `package.json`, migrations, Dockerfiles, IaC. A repo with 40 Postgres migrations does not get a DynamoDB proposal. |
| 1. Scope | Three unskippable questions. |
| 2. Profile | Drafts every remaining requirement with visible arithmetic. You correct by exception. |
| 3. Research | 3-6 parallel web searches for current pricing and service limits. Patterns come from built-in knowledge; it does not search for what a load balancer is. |
| 4. Gates | Three mandatory checks before anything is drawn. |
| 5. Emit | Writes both files, then validates them. |

### The three gates

**Gate 1 — every component cites a requirement.** A service enters the design only when attached to a specific profile line. "Good practice" is not a citation. Anything that cannot cite a line gets deleted.

**Gate 2 — the lazy default gets named and judged out loud.** The skill writes down the reflex answer for your system class, then evaluates it against your numbers in the open:

```
Reflex stack: Vercel + Supabase
Fits:      Read TPS 600/s is comfortable. Team of 2 has no ops capacity.
Breaks:    Nothing at this scale.
Verdict:   Correct choice. Revisit at ~5k write TPS.
```

That verdict is a success, not a failure. The reasoning is the deliverable.

**Gate 3 — budget is a hard constraint.** If the MVP tier exceeds your stated ceiling, the design is wrong and gets revised before emitting. If the requirements genuinely cannot be met within budget, it says so and quantifies the gap rather than quietly shipping something you cannot afford.

## Output Detail

The HTML is fully self-contained — inline SVG, inline CSS, inline JS, zero network requests. It opens from `file://` on a plane.

Each of the three tiers carries:

- Its own topology, itemized cost, and total
- A **trigger metric** — the observable signal that says move up. "Go to Growth when DB CPU sustains above 60% or p99 crosses 300ms." Not "when you get bigger."
- A **scale-down path** — what to switch off and what it saves when traffic falls. Scaling down is treated as a requirement, not an afterthought.

Clicking any component shows what it is, which requirement justified it, its exact size and cost, what breaks first with the symptom, and what was rejected in its place.

## Validating Generated Output

```bash
node ~/.claude/skills/stackfit/references/validate.js \
  docs/architecture/my-system-design.html
```

Catches what a visual check misses: cost tables that do not sum to their headline, components that skipped Gate 1, edges pointing at nonexistent nodes, overlapping layout, external requests that break the self-contained rule, and MVP tiers that blow the stated budget.

The skill runs this automatically before reporting done.

## Worked Example

`examples/` holds a full run for a refrigeration fleet telemetry system — 12,000 sensors, food-safety compliance, $1,200/mo ceiling. Open the HTML locally to click through it.

It is worth reading for what the research phase caught. AWS IoT Core meters at $1 per million messages, so 12,000 units reporting every 30 seconds generates 1.04 billion messages a month: **$1,037/mo in messaging alone, 86% of the entire budget, before any database exists.** Batching 10 readings per publish cuts that to $104.

A default design never surfaces that number, because a default design never computes it.

The same run rejected the reflex stack for the ingest plane, with reasons:

```
Reflex stack: Vercel + Supabase
Fits:      Dashboard for 600 staff is trivial. Postgres suits the
           relational half — sites, units, alert rules.
Breaks:    400 writes/s sustained, 12.6B rows/yr. No columnar
           compression means 820GB/yr and punitive storage cost.
           Devices speak MQTT over cellular; there is no MQTT ingress.
           Serverless has nowhere to hold the disk buffer that the
           no-data-loss requirement demands.
Verdict:   Rejected for ingest. The read plane is one container
           alongside the evaluator, so adding Vercel would introduce
           a second deploy target for no gain.
```

It also declined to add Redis at MVP — a 12,000-row current-state table serves dashboard reads fine, so a cache would buy an invalidation bug surface for no measured gain. Redis enters at Growth, when per-reading updates start contending with the ingest path.

## Repo Layout

```
SKILL.md                         the skill itself
references/
  service-catalog.md             candidate services, ceilings, cost anchors
  html-template.html             interactive diagram scaffold
  spec-template.md               build spec structure
  validate.js                    output validator
examples/
  refrigeration-telemetry-design.html    worked example, interactive
  refrigeration-telemetry-design.md      worked example, build spec
```

## Customizing

Most tuning happens in `references/service-catalog.md` — it holds the selection criteria, ceilings, and cost anchors. If your team standardizes on a cloud or has services it will not adopt, encode that there and the skill will respect it.

To change the diagram's look, edit the CSS variables at the top of `references/html-template.html`. The renderer is data-driven, so nothing below the `END DATA` marker needs touching.

## Caveats

- Cost figures are estimates stamped with a check date. They drift. Verify before committing spend.
- The service catalog's prices age faster than its selection criteria. Phase 3 pulls live pricing, but the catalog itself needs occasional maintenance.
- This produces a design, not code. It stops at the spec deliberately.

## License

MIT
