---
name: diagram-only
description: Turn an architecture you have already decided into an interactive diagram, with no interview. Use when the user describes a system they have already designed and wants the artifact — for a slide deck, a design doc, an RFC, or onboarding material. Triggers on "diagram this", "draw this architecture", "make a diagram of our stack", "I need this for a deck".
---

# Diagram Only

The design is already decided. Skip the interview and build the artifact.

This exists because producing an architecture diagram by hand is genuinely slow — hunting component images, pasting them into slides, dragging arrows into alignment. Forty minutes per deck, spent on layout rather than on architecture.

## When this is the wrong skill

If the user is still deciding anything, this is the wrong tool and produces a diagram that documents an unexamined decision. Route to `stackreason` when:

- They ask "should I use X or Y"
- They describe a system that does not exist yet
- They mention a number they are unsure the design can handle
- They say "I think" more than once while describing it

Say so directly: *"You still have open decisions here. A diagram would just make them look settled. Want to run the design skill first?"*

Drawing an undecided architecture is worse than not drawing it, because a diagram confers a confidence the reasoning has not earned.

## Hard Rules

1. **Do not redesign.** Draw what they described. If a choice looks wrong, note it once after the artifact — never silently substitute something else.
2. **Do not invent components** to fill the diagram out. If they described four things, draw four things.
3. **Do ask for anything genuinely missing.** Sizes and costs can be omitted; you cannot invent them.
4. **Validate before delivering.**

## Step 1 — Read back the architecture

Restate what you understood as a component list with connections, and mark anything you inferred:

```
Understood:
  Client -> Cloudflare -> ECS (3 tasks) -> RDS Postgres
                              |
                              +-> Redis
                              +-> SQS -> workers -> S3

Inferred (correct me):
  - Redis is a cache, not a queue
  - Workers read from SQS and write to S3, not to Postgres
```

Cheap to confirm, expensive to get wrong.

## Step 2 — Collect what the panels need

Each node in the artifact has a detail panel. Ask for what you do not have, in one message. Anything not supplied is simply omitted — never guessed:

- **Size or tier** — `db.t4g.medium`, `3x Fargate 1vCPU/2GB`
- **Cost**, if they want the cost table
- **What it breaks on**, if known

If they want costs but do not know them, offer to estimate with the `capacity-estimate` skill and mark the figures clearly as estimates.

## Step 3 — Build

Use `skills/stackreason/references/html-template.html`. Fill the `SYSTEM` and `TIERS` data block; do not hand-write SVG.

Layout rules that keep the renderer honest:

- Grid coordinates: `col` left to right, `row` top to bottom. Flow along a row; branch by changing row.
- **Never connect two nodes on the same row with a node between them.** The router does not path around obstacles, and the validator rejects it.
- Node kinds set the colour: `client`, `edge`, `compute`, `data`, `cache`, `queue`, `external`.
- Normalise nothing manually — the renderer collapses unused rows and columns itself.

Tiers are optional here. A single-tier diagram is legitimate when the user just wants today's architecture drawn. The validator requires at least two, so for a single architecture either add a "planned" tier or use the markdown output instead.

## Step 4 — Validate and deliver

```bash
node skills/stackreason/references/validate.js <output>.html
```

The validator will reject nodes missing a `why`. In this skill that field holds **the user's stated reason**, or a plain description of the component's role if they did not give one — not a justification you invented on their behalf.

Deliver as a file, and offer to publish it as a shareable artifact.

## Step 5 — Note concerns, once

After delivering, you may raise at most two or three observations — a component that looks unjustified, a ceiling that seems close, a cost line that looks off.

Frame them as observations, not corrections, and do not repeat them if the user moves on. They asked for a diagram, and unsolicited redesign after an explicit "just draw it" is not helpful.

## For slide decks

The HTML is self-contained and screenshots cleanly. Practical notes:

- The diagram scales to its container, so a wide browser window gives the highest-resolution capture.
- Light and dark both render; match whichever the deck uses via the theme toggle.
- Capture each tier tab separately for a build-up sequence across slides.
- The detail panels do not screenshot well as a set — for a deck, put the diagram on the slide and the detail in the speaker notes.

## Common Failure Modes

| Symptom | Fix |
|---|---|
| Silently swapped a component for a better one | Rule 1. Draw what they said; note concerns after. |
| Added a load balancer they never mentioned | Rule 2. Four described, four drawn. |
| Invented a cost figure | Rule 3. Ask, estimate explicitly, or omit. |
| Edge draws through another node | Same-row edges cannot skip an occupied column. Reroute. |
| Diagrammed a design still being argued about | Wrong skill. Route to `stackreason`. |
| Long list of redesign suggestions after delivery | Two or three observations, once. They asked for a drawing. |
