# system-design-architecture — Design Spec

Date: 2026-07-20
Status: Approved, ready for implementation plan

## Problem

Engineers reach for the same default stack regardless of requirements. Vercel plus Supabase gets applied to a 50-user internal tool and to a write-heavy ingestion pipeline alike, because the reflex is faster than the analysis. The cost surfaces later as a migration.

Separately, producing the architecture diagram that communicates a design is manual and slow: hunting component images, pasting them into a deck, dragging arrows. Forty to fifty minutes per slide deck, spent on layout rather than on the architecture.

This skill addresses both. It forces requirements to precede component selection, and it emits the diagram automatically.

## Goal

Given a description of a system to build, produce:

1. An interactive HTML page showing the architecture, how it scales up and down, what each service costs, and what to do first.
2. A markdown build spec precise enough that a coding agent implements from it without re-deriving decisions.

Non-goal: writing the application code. This skill stops at the spec.

## Skill Location and Shape

Single file at `~/.claude/skills/system-design-architecture/SKILL.md`, matching the flat structure of the user's existing skills (`evoke-database-upgrade`, `code-review`).

Triggers:
- Explicit: `/system-design-architecture`
- Implicit: "design the architecture for", "what stack should I use", "system design for X", "how should I build X at scale"

## Phase Flow

Five phases, strictly ordered. No phase may be skipped or reordered.

### Phase 0 — Repo scan

If the working directory is a project, scan before asking anything:

- `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` — language and framework already committed to
- `Dockerfile`, `docker-compose.yml` — existing containerization
- `prisma/`, `migrations/`, `*.sql` — existing datastore and schema maturity
- Terraform, CDK, `serverless.yml`, `vercel.json`, `fly.toml` — existing deploy target
- `.env.example` — services already wired

Use findings to skip questions already answered and to constrain choices. A repo with forty Postgres migrations does not get a DynamoDB proposal. State what was found and what it constrains before proceeding.

If nothing is found, proceed greenfield.

### Phase 1 — Scope

Exactly three questions. These are unskippable; everything else is inferred.

1. What are you building, in one sentence?
2. Who uses it, and roughly how many?
3. What is your budget ceiling per month?

Ask them together, not one at a time. This phase is deliberately short because phase 2 does the real extraction.

### Phase 2 — Profile draft and correction

Draft the full requirements profile. Every field carries a value, a bracketed assumption, and the reasoning behind it. Present it as a table for the user to correct.

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

Rules for this phase:

- Never leave a field blank pending user input. A drafted wrong answer is correctable; a blank is work handed back to the user.
- Show the arithmetic in the assumption. "50k DAU x 7 writes/day, 3x peak" lets the user correct the input rather than the output.
- The user corrects by exception. Silence means accepted.
- Every assumption that survives uncorrected is marked `[assumed]` in both output files. Assumptions must remain visible downstream.

Fields to cover: write TPS, read TPS, p99 latency target, availability target, consistency requirements, durability requirements, data volume year one, budget ceiling, compliance obligations, team size and ops capacity.

Scale the profile to the system class. A static marketing site does not need a consistency analysis. Drop fields that cannot matter, and say they were dropped.

### Phase 3 — Targeted research

Three to six web searches, fired in parallel, scoped to what goes stale or what is genuinely uncertain:

- Current pricing for each candidate service at the sizes under consideration
- Managed service limits relevant to the profile numbers (connection caps, throughput ceilings, payload limits)
- Version-specific gotchas for anything where the model's knowledge may lag

Architecture patterns come from built-in knowledge. Do not search for what a load balancer is.

Cite what was found. Pricing in the output carries the date it was checked.

### Phase 4 — Design and default challenge

Select components, then pass three gates. All three are mandatory.

**Gate 1 — Every component cites a requirement.**

A service enters the design only when attached to a specific line of the profile. "Redis, because read TPS of 600/s at p99 200ms exceeds what Postgres serves uncached." No orphan components. A component that cannot cite a requirement gets removed.

**Gate 2 — Name the lazy default and judge it out loud.**

Explicitly write down the reflex answer for this class of system — Vercel plus Supabase, or Next.js on Netlify, or Lambda plus DynamoDB, whichever is the reflex here — and state why it fits or does not fit against the profile.

This gate does not ban default stacks. For a 500-user internal tool, Vercel plus Supabase is genuinely correct and the skill must be able to say so plainly. What the gate bans is arriving there without checking. The reasoning is the deliverable, not the verdict.

**Gate 3 — Budget is a hard constraint.**

If the MVP tier exceeds the ceiling from phase 1 question 3, the design is wrong. Revise before emitting. Consider cheaper managed options, smaller instance classes, and deferring components to a later tier. If the requirements genuinely cannot be met within budget, say so explicitly and present the cheapest design that does meet them, with the gap quantified.

Additionally: weigh at least two alternatives each for compute, datastore, and cache. Record what was rejected and why.

### Phase 5 — Emit

Write both files to `docs/architecture/` in the current project. If the working directory is not a project, ask for a path rather than scattering files.

- `docs/architecture/<system-name>-design.md`
- `docs/architecture/<system-name>-design.html`

## Output 1 — Interactive HTML

Mermaid graphs with a JavaScript interactivity layer. JS attaches behavior to the rendered SVG after paint.

### Dual rendering context

The file must render in two different environments, which resolve Mermaid differently:

- **Local file, opened via `file://`** — the primary destination, since output lands in `docs/architecture/`. No native Mermaid here. The page loads Mermaid from a CDN `<script>` tag, which `file://` permits. Requires internet on first open.
- **Published as an Artifact** — a strict CSP blocks the CDN script, but Artifacts render `<pre class="mermaid">` blocks natively, so the graphs still appear.

The same markup serves both. The CDN tag loads locally and is blocked in Artifacts; native rendering covers the Artifact case. There is no double-render risk, because the two paths are mutually exclusive by construction.

The interactivity JS must therefore wait for whichever renderer completed, rather than assuming either. Poll for rendered SVG presence with a timeout; on timeout, degrade to the static diagram with detail content shown inline below it rather than throwing.

If the user needs a diagram that renders with no network at all, that requires the hand-authored SVG approach instead of Mermaid. Note this trade in the skill so it can be revisited.

### Tier tabs

Three tabs: MVP, Growth, Scale. Each swaps in its own Mermaid graph and updates the cost readout.

Tiers are defined by concrete numbers derived from the profile, never by vague labels. MVP is launch traffic. Growth and Scale are the next meaningful inflection points for this specific system, not fixed multiples.

Each tier records:

- Its topology, as a Mermaid graph
- Its monthly cost, itemized by service
- **Trigger metric** — the observable signal that says move up. "Go to Growth when DB CPU sustains above 60 percent or p99 crosses 300ms." A tier without a trigger metric is incomplete.
- **Scale-down path** — what to switch off and what it saves when traffic drops. Scaling down is an explicit requirement, not an afterthought.

### Node detail panel

Clicking any node opens a panel containing:

- What the service is, in one line
- Which requirement justified it, quoted from the profile
- Size and tier, concretely (`db.t4g.medium, 2vCPU/4GB, 100GB gp3`)
- Monthly cost at this tier
- Ceiling before it breaks, with the symptom (`~3k TPS before you need a read replica`)

### Start-here checklist

Ordered setup steps, first action to running system. Each step is a concrete action, not a topic.

### Constraints

- Inline all CSS and own JS. The Mermaid CDN tag is the single permitted external reference, per the dual-rendering section above.
- No external logo hotlinking. Any service icons must be inline SVG, so they survive the Artifact CSP.
- Theme-aware: style for both light and dark via `prefers-color-scheme` plus `:root[data-theme]` overrides.
- Responsive: wide content scrolls inside its own container; the page body never scrolls horizontally.
- No emojis, per user preference.

## Output 2 — Markdown build spec

Written as constraints, not suggestions, so a downstream coding agent cannot drift back to defaults. Imperative voice: "Use Postgres 16 on RDS", not "consider using Postgres".

Contents:

- **Service list** — exact versions and instance tiers, not families
- **Schema** — full DDL. Every index annotated with the query it serves. An index without a named query is removed.
- **API surface** — endpoint table: method, path, auth requirement, expected p99
- **Caching** — key patterns, TTLs, and invalidation rules. Invalidation is stated explicitly; a cache without a stated invalidation rule is not in the design.
- **Environment variables** — name, purpose, and whether it is a secret
- **Build checklist** — ordered steps to a running system
- **Assumptions** — every `[assumed]` field from the profile that the user did not correct, flagged for verification

Excluded: the "why not X" rejection log. Rationale lives in the HTML detail panels. The markdown stays a build document.

## Design Decisions

**Mermaid over hand-authored SVG.** Mermaid is cheaper to generate, renders consistently, and stays hand-editable after the fact. The lost interactivity is recovered by the JS layer. Chosen over custom SVG despite custom SVG allowing animated tier transitions, because diagram editability after generation matters more than transition polish.

**Three questions, then draft.** Most users cannot answer "what is your write TPS". Asking anyway produces either a wrong number stated with false confidence or a stall. Drafting a reasoned estimate with visible arithmetic converts the task from recall to correction, which is far easier, and leaves an audit trail of what was assumed.

**Targeted research, not exhaustive.** Pricing and service limits go stale and must be checked. Architecture patterns do not. Searching for both wastes minutes per run for no accuracy gain.

**Repo scan before interview.** Designing greenfield inside an existing project produces proposals the user cannot act on. Reading what is already committed constrains the design to reachable states.

**The default challenge is a reasoning requirement, not a prohibition.** Banning popular stacks would be its own unexamined reflex. The gate requires that the obvious answer be considered and judged, which is what was actually missing.

## Success Criteria

- Running the skill on a small internal tool concludes that a simple managed stack is correct, with stated reasoning. It does not over-engineer to prove a point.
- Running it on a write-heavy or latency-sensitive system produces a design that departs from the default stack, with each departure citing a profile line.
- A coding agent handed only the markdown file begins implementation without asking about schema, indexes, or caching.
- The HTML renders correctly both as a local file and as a published Artifact, in light and dark themes.
- Every uncorrected assumption is visible in both outputs.

## Open Risks

- **Cost estimates drift.** Mitigated by stamping the check date on every price and by pulling live pricing in phase 3. Not eliminated.
- **The JS-to-Mermaid binding is coupled to rendered SVG structure.** Node lookup must be resilient to Mermaid version changes. Bind by node text content with a defensive fallback that degrades to a static diagram rather than throwing.
- **Tier definitions can become arbitrary.** Mitigated by requiring a trigger metric per tier; a tier that cannot state its trigger is not a real tier.
