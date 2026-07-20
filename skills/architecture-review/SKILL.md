---
name: architecture-review
description: Audit an architecture that already exists. Infers the current stack from the repo, then checks every component against the requirement it should be serving — finding what is over-provisioned, what is about to break, and what nobody can justify. Use when the user asks to review or audit an existing architecture, asks "is my stack right", "am I over-engineering", "what will break first", "why is my bill so high", "should we still be on X", or is inheriting a system they did not design.
---

# Architecture Review

Design skills answer "what should we build". This one answers "was what we built right, and what breaks next".

Read `skills/stackreason/references/design-principles.md` first. It is the reasoning layer this review applies.

## What This Is Not

Not a code review. Not a security audit. This looks at **component-level decisions**: which services exist, why, what they cost, and what fails first.

If the user wants code quality, say so and stop.

## Hard Rules

1. **Never recommend a rewrite as the headline finding.** It is the least actionable advice available. Find the specific component that is wrong and cost the specific change.
2. **Never flag something as over-engineered without pricing the removal.** "You do not need Kafka" is an opinion. "Removing Kafka saves $610/mo and costs you replay you are not using" is a finding.
3. **Never recommend adding infrastructure without naming the measurement that would justify it.**
4. **Grade against the system's actual requirements, not against a reference architecture.** A design that looks unusual but meets its numbers is correct.

## Phase 1 — Infer the current architecture

Read, do not ask. The repo knows most of this.

| Source | Tells you |
|---|---|
| `docker-compose.yml`, `Dockerfile` | Services and their runtime shape |
| Terraform, CDK, Pulumi, `serverless.yml` | What actually exists in the cloud |
| `package.json`, `requirements.txt`, `go.mod` | Language, framework, client libraries — the libraries reveal services the IaC may not |
| `.env.example`, `.env.sample` | Every external service, including ones nobody documented |
| `prisma/`, `migrations/`, `*.sql` | Datastore, schema maturity, index coverage |
| CI config | Deploy targets, environments |
| `README`, `docs/` | The architecture as the team believes it to be |

Then state the inferred architecture back, explicitly marking anything you could not confirm from files. **A review built on a misread architecture is worse than no review**, so this list is the one thing worth confirming with the user before proceeding.

## Phase 2 — Recover the requirements

You are reviewing against requirements that were probably never written down. Recover what you can:

- **Measured, if available** — monitoring config, alert thresholds, SLO documents, load test scripts. Alert thresholds are especially useful: they encode what someone once decided mattered.
- **Inferred from code** — timeouts, retry counts, pagination limits, cache TTLs. These are requirements in disguise.
- **Asked, if neither exists** — current traffic, current bill, the last incident and its cause.

Write the recovered profile in the same shape the design skill uses, marking each line as `[measured]`, `[inferred]`, or `[assumed]`. The proportion of `[assumed]` lines is itself a finding: a system whose requirements cannot be recovered is a system nobody can evaluate.

## Phase 3 — The four checks

### Check 1 — Orphans

For each component, name the requirement it serves. Anything that cannot cite one is an orphan.

Orphans usually come from three places, and the cause changes the recommendation:

- **Cargo-culted** — added because a reference architecture had it. Usually safe to remove.
- **Outgrown** — served a real need that no longer exists. Check for remaining dependents before removing.
- **Aspirational** — added for scale that never arrived. Removing it is reversible; leave a note about the trigger that would bring it back.

Price the removal for each.

### Check 2 — Ceilings

For each component, find the number that breaks it and compare against current load:

```
Postgres db.t4g.medium   ~800 write TPS   currently ~140   HEADROOM
Supabase pooler          60 connections   currently ~55    AT RISK
Lambda 15-min cap        job now 11 min   growing 8%/mo    BREAKS IN ~4 MONTHS
```

Rank by time-to-breach, not by severity. A thing that breaks next month outranks a thing that is merely undersized.

### Check 3 — Cost against value

Get the actual bill if the user can share it. Then, per line item, ask what requirement that spend buys.

Common findings, in rough order of how often they appear:

- **Serverless above the crossover.** Sustained utilization over roughly 20-40% costs more than an always-on container.
- **Idle non-production environments.** Staging running production-sized instances around the clock.
- **Over-provisioned databases.** Instance sized for a peak that never came, and never revisited.
- **Retention nobody chose.** Logs and metrics kept at default retention forever.
- **Redundant managed services.** Two things doing caching, three doing observability.

### Check 4 — The reflex audit, in reverse

The design skill asks whether the default stack was chosen without checking. Review asks the mirror question: **which components are here because they were the default at the time?**

Look for the tell — a component whose configuration is entirely stock. Nobody tuned it because nobody chose it.

## Phase 4 — Report

Rank findings by **annualized cost or time-to-breach**, whichever is more concrete. Not by how interesting they are.

Each finding carries:

- What was found, in one line
- The evidence — file, config value, or metric
- What it costs today, in money or in risk
- The specific change, and what that change costs
- What would have to be true for the current state to be correct (this is the honesty check on your own finding)

That last item matters. If you cannot state the condition under which the existing choice was right, you have not understood it well enough to criticise it.

End with what is **correct and should not change**. A review that only lists problems reads as noise and gets discounted entirely. Naming what works tells the reader you understood the system.

## Optional output

If the user wants an artifact, build the current architecture as tier one and the recommended architecture as tier two using `skills/stackreason/references/html-template.html`, then validate with `references/validate.js`. Seeing the two side by side with costs attached is more persuasive than a list.

## Common Failure Modes

| Symptom | Fix |
|---|---|
| "Consider migrating to microservices" | Rule 1. Name a component and cost the change. |
| Findings ranked by interestingness | Rank by annualized cost or time-to-breach. |
| Flagged as over-engineered with no price | Rule 2. Price the removal or drop the finding. |
| Graded against a reference architecture | Grade against the system's own numbers. |
| Every profile line is `[assumed]` | Phase 2 was skipped. Read the monitoring config. |
| No mention of anything that works | The report will be discounted. Name what is correct. |
