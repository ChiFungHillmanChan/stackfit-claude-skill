# stackreason documentation

| Document | Read it when |
|---|---|
| [architecture.md](architecture.md) | You want to know how the plugin is put together and why it is shaped this way |
| [output-format.md](output-format.md) | You are editing a generated design by hand, or writing a tool that reads one |
| [extending.md](extending.md) | You want to adapt it to your team's cloud, standards, or opinions |
| [maintaining-prices.md](maintaining-prices.md) | You are correcting or refreshing a price |
| [porting.md](porting.md) | You use an agent other than Claude Code |
| [design/](design/) | You want the original spec and the reasoning behind the current shape |

## The one-paragraph version

Five skills share one reasoning layer. `stackreason` designs new systems through an interview. `architecture-review` audits systems that already exist. `capacity-estimate` answers cost and sizing questions without a full design. `interview-drill` runs system design interview practice. `diagram-only` produces the artifact when the design is already settled.

All five read from `skills/stackreason/references/`, which holds the design principles, the service catalog, the stack-selection guidance, the HTML template, and the validator.

## The thesis

Engineers reach for the same stack regardless of requirements, because the reflex is faster than the analysis. This plugin inverts the order: requirements first, components second, and every component must cite the requirement it serves.

It guards both directions. Forcing serverless onto a write-heavy pipeline is one failure. Putting a queue, a cache, a CDN and a read replica in front of a tool serving 200 people is the same failure wearing better clothes, and it is the more expensive one because somebody then has to maintain it.

A run that concludes "the popular managed stack is correct here, and here is what breaks first" has succeeded completely.
