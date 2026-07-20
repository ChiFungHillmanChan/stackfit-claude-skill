# Changelog

## 1.0.0 — 2026-07-20

First release as a plugin. Renamed from `stackfit-claude-skill` to `stackreason`, since nothing here is Claude-specific.

### Skills

- **stackreason** — interview-driven system design. Narrows scope, drafts a requirements profile, reasons from access patterns, chooses the application stack and repo shape, then emits an interactive diagram and a buildable spec.
- **architecture-review** — audits a system that already exists. Infers the stack from the repo, recovers requirements from monitoring and code, then finds orphans, ceilings, and cost with no matching value.
- **capacity-estimate** — back-of-envelope arithmetic with the working shown. Answers what something costs without running a full design.
- **interview-drill** — system design interview practice with an interviewer that pushes back, probes the data layer hardest, and debriefs against what actually gets graded.
- **diagram-only** — produces the artifact when the design is already settled, with no interview.

### Reasoning layer

- `design-principles.md` — access patterns choose the datastore, read and write scale differently, what caching actually costs, queues, shard key selection and hot shards, consistency as the lies a system may tell, right-sizing, and narrowing large systems.
- `stack-selection.md` — language, framework, runtime topology, and repo shape. Includes the axis distinction most discussions blur: monorepo versus polyrepo is code organisation, monolith versus services is runtime topology, and they are independent.
- `service-catalog.md` — candidate services with selection criteria, ceilings, verified prices, and the plan restrictions that invalidate designs rather than merely repricing them.

### Verification

All pricing checked against vendor sources on 2026-07-20. The pass found four material errors in the first draft:

| Claimed | Actual |
|---|---|
| ECS Fargate, 4 tasks — $240/mo | $144/mo. 66% over |
| Fly.io shared-cpu-2x, 3 machines — $60/mo | $19.92/mo. 3x over |
| Upstash Redis 2GB — $45/mo | That tier does not exist |
| Tiger Cloud 4vCPU/16GB — $265/mo | Not publicly documented; now labelled an estimate |

Verified figures carry `[v]` and a check date. `scripts/check-prices.sh` reports staleness and fails past six months.

### Tooling

- `validate.js` — rejects cost rows that do not sum, components missing a justification or ceiling, `why` fields reading "good practice", edges to nonexistent nodes, overlapping layout, same-row edges crossing intervening nodes, external references, and a first tier above budget.
- CI mutates a known-good example four ways and requires rejection each time. A validator that only ever prints PASS is worthless.
- `scripts/validate-all.sh` — designs, skill frontmatter, self-containment, and the validator self-test.

### Fixes found by using it

- **Scope questions were being inferred rather than asked.** A rule intended for derived numbers ("never leave a field blank, draft an estimate") licensed skipping the interview and guessing what the user meant. Split into three rules: scope questions must be asked, ambiguity in the user's own wording must be asked about, and only derived fields get drafted.
- **Rejected verdicts rendered with the accept colour.** The regex anchored "rejected" to line start, but it sits after the `Verdict:` label.
- **A `$0` budget skipped the budget gate**, because `0` is falsy — precisely the case where the ceiling matters most.
- **Diagrams forced horizontal scrolling.** SVG now scales to fit; a diagram you must scroll to read is not a clear diagram.
- **Elbow edges drew through intervening nodes** on multi-column jumps. The vertical run now drops in the gutter left of the target column, and the validator rejects layouts it still cannot route.
- **Unused leading rows rendered as empty bands.** Coordinates are normalised to a zero origin.
- **Tier count was fixed at three.** Systems are now classified S/M/L and tier count follows, so a small system gets a small design.

### Documentation

`docs/` covers the internal architecture and the reasoning behind it, the output format for hand-editing or scripting, extension points, the price maintenance protocol, and using the skills with agents other than Claude Code.
