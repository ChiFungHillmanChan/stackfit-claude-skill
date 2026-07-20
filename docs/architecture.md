# How stackreason is built

The shape of this repo is itself a design decision, and the reasoning is worth stating since the plugin's whole premise is that decisions should be justified.

## Layout

```
skills/
  stackreason/            the design skill, and the shared reasoning layer
    SKILL.md
    references/
      design-principles.md    access patterns, scaling, caching, consistency
      stack-selection.md      language, framework, topology, repo shape
      service-catalog.md      candidate services, ceilings, verified prices
      html-template.html      the interactive diagram, data-driven
      spec-template.md        the markdown build spec
      validate.js             output validator
  architecture-review/    audit an existing system
  capacity-estimate/      arithmetic without a full design
  interview-drill/        interview practice
  diagram-only/           artifact without an interview
```

## Why the references live under `skills/stackreason/`

They are shared by all five skills, so the obvious placement is a top-level `references/`. They are not there, for one reason: **a single skill has to be installable on its own.**

Most people want the design skill and nothing else. Putting the references inside it means this works:

```bash
git clone .../stackreason /tmp/sr && cp -r /tmp/sr/skills/stackreason ~/.claude/skills/
```

and the skill is complete — nothing dangling above it. The other four reference it by path from the plugin root, and degrade to built-in knowledge if it is absent.

The cost is that `skills/stackreason/` is doing two jobs: it is a skill, and it is the library. That is a real wart. It was accepted because standalone installability matters more than tidiness, and because the alternative — duplicating the catalog into five skills — would guarantee they drift apart.

## Why the diagram is data-driven

`html-template.html` contains a renderer that consumes a JavaScript object:

```js
{ id:"db", kind:"data", col:3, row:1, label:"Postgres",
  why:"...", ceiling:"...", rejected:"..." }
```

Skills fill in data. They never write SVG markup. Two reasons:

**Reliability.** Hand-authored SVG coordinates are easy for a language model to get subtly wrong, and the errors are invisible until rendered.

**Enforcement.** Because `why` and `ceiling` are structured fields rather than prose, the validator can require them. Gate 2 — every component cites a requirement — is not a suggestion in a prompt that a model may drift from. It is a field that must be non-empty or the output fails. That is the difference between guidance and a constraint.

## Why there is a validator at all

Language models produce plausible output. Plausible output with wrong arithmetic is worse than obviously broken output, because nobody checks it.

`validate.js` catches the class of error that survives review by eye:

- Cost rows that do not sum to their headline figure
- Nodes missing `why` or `ceiling`, meaning Gate 2 was skipped
- A `why` reading "good practice" or "industry standard" — rejected, because that is not a citation
- Edges pointing at nonexistent nodes
- Two nodes in one grid cell
- Same-row edges drawing through an intervening node, which the router cannot path around
- External references, which break the offline-open promise
- A first tier above the stated budget, which is Gate 4
- Missing access patterns, stack decision, or reflex-stack verdict, each meaning a design phase was skipped

Every one of these was added after it actually happened.

CI does not only run the validator. It **mutates a known-good example four ways and requires the validator to reject each one.** A validator that only ever prints PASS is worthless, and without that test there is nothing stopping it silently degrading into one.

## Why the renderer normalises coordinates

Authors write `col` and `row` on whatever origin feels natural. The renderer subtracts the minimum before laying out, so a diagram whose nodes all sit on row 1 does not render with an empty band above it.

This was a bug before it was a feature.

## The router's known limitation

Edges are orthogonal elbows. The vertical segment drops in the gutter immediately left of the target column — not at the midpoint, which would land inside an intervening node on any jump wider than one column.

The router still does not path around obstacles. A same-row edge that skips an occupied column draws straight through it. Rather than build a pathfinder, the validator rejects that layout and tells the author to reroute. For diagrams of this size that trade is correct: the constraint is easy to satisfy and the pathfinder would be a lot of code serving a handful of nodes.

## Why prices carry markers and dates

A tool that tells you to stop guessing about cost cannot itself guess about cost.

Figures verified against a vendor carry `[v]` and a check date. Everything else is explicitly labelled an estimate. `scripts/check-prices.sh` reports how stale the verified set has become and fails past six months.

This matters because the first draft of the catalog contained figures that were confidently wrong — one 66% overstatement, one three-fold overstatement, and one product tier that did not exist at all. All were written in the same authoritative tone as the correct ones. The markers exist so a reader can tell which is which.

## Why skills have a "Common Failure Modes" table

Each skill ends with a table of symptom and fix. These are not hypothetical. Every row was added after the behaviour was observed, usually while running the skill on a real request.

The most instructive one: the design skill originally had a rule saying "never leave a profile field blank, draft an estimate". That was meant for derived numbers like TPS which nobody can answer cold. Applied to the three scope questions, it licensed skipping the interview entirely and guessing what the user meant — which is exactly what happened on a real request. The rule is now split in three, and the failure mode is documented so it does not come back.
