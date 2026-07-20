# stackreason

System design skills. Five of them, sharing one reasoning layer.

When the user asks about system design, architecture, what stack to use, what database to use, monolith versus microservices, how something scales, what infrastructure costs, or wants system design interview practice — read the matching skill file below and **follow it exactly, in order. Do not summarise it; execute it.**

| Ask | Skill file |
|---|---|
| Designing something new | `skills/stackreason/SKILL.md` |
| Auditing a system that already exists | `skills/architecture-review/SKILL.md` |
| Cost or capacity numbers, no full design | `skills/capacity-estimate/SKILL.md` |
| Interview practice | `skills/interview-drill/SKILL.md` |
| Diagram of an already-decided design | `skills/diagram-only/SKILL.md` |

The shared reasoning layer lives in `skills/stackreason/references/`:

- `design-principles.md` — read before designing anything
- `stack-selection.md` — language, framework, topology, repo shape
- `service-catalog.md` — services, ceilings, verified prices
- `html-template.html` — the diagram template
- `validate.js` — run this on generated output

## The one rule that matters most

Every component in a design must cite the specific requirement it serves. "Good practice" is not a citation, and `validate.js` rejects it.

This guards both directions. Adding a queue, cache, CDN and read replica to a tool serving 200 people is the same failure as forcing serverless onto a write-heavy pipeline. Concluding "the popular managed stack is correct here, and here is what breaks first" is a complete success.

## Validating output

```bash
node skills/stackreason/references/validate.js <design>.html
```

Node 18+, no dependencies, no network. Exit 0 passes.
