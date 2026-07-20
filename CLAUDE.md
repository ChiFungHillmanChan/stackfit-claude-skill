# Working on stackreason

Instructions for an agent making changes to this repository. If you are *using* the skills rather than editing them, you want `skills/stackreason/SKILL.md`.

## What this project is

Five skills that share one reasoning layer, built on a single premise: **every component in a design must cite the requirement it serves.** Everything else follows from that.

The failure mode it exists to prevent runs in both directions. Forcing serverless onto a write-heavy pipeline is one error; putting a queue, cache, CDN and read replica in front of a 200-user tool is the same error, and the more expensive one. Changes that weaken either guard are the wrong direction.

## Before you change a skill

Skills here are tightened in response to observed mistakes, not in the abstract. So:

1. **Name the failure.** What did the skill actually do wrong, on what input? A change without one is hard to evaluate and usually adds words without adding behaviour.
2. **Add the row to Common Failure Modes.** Every skill ends with a symptom-and-fix table. That table is where reliability accumulates.
3. **Prefer a constraint over a suggestion.** "Prefer X" drifts. A validator rule does not. If the behaviour can be checked mechanically, check it mechanically.

## Before you change the validator

Add the rule, then add a matching mutation to `scripts/validate-all.sh` that proves it fires. An untested validation rule silently stops working and nobody notices.

CI already does this for four rules: it mutates a known-good example and requires rejection each time. **A validator that only ever prints PASS is worthless**, and that test is the only thing preventing it becoming one.

## Before you touch a price

Read `docs/maintaining-prices.md`. Short version: verified figures carry `[v]` and a date, estimates say so explicitly, and you go to the vendor rather than recalling or trusting a tracker.

The first draft of the catalog contained a 66% overstatement, a threefold overstatement, and a budget line for a product tier that does not exist. All written in the same confident tone as the correct figures. That is why the markers exist.

## Before you regenerate an example

Examples are generated from the template plus a data block. If you change `html-template.html`, regenerate all of them and re-run `./scripts/validate-all.sh` — the cost-sum check is what catches the lines you forgot.

## House style

- No emojis, anywhere — files, output, commits.
- State the reason with the rule. "Use Postgres" drifts; "Use Postgres, because the booking transaction must be atomic" survives an argument.
- Concrete over general. `db.t4g.medium` not "a small instance". `~800 write TPS` not "high load".
- Say what breaks, not just what to do. Guidance without a ceiling is unfalsifiable.
- Admit what is unverified. An estimate labelled as one is useful; an estimate presented as fact is a liability.

## Checks

```bash
./scripts/validate-all.sh    # designs, skill frontmatter, validator self-test
./scripts/check-prices.sh    # how stale the verified prices are
```

Both run in CI. Run them before pushing.

## Things deliberately not done

- **No config system.** Adaptation happens by editing the reference files. A config format would be another thing to learn, and agents read prose fine.
- **No JSON output format.** Designs are self-contained HTML so they open on a laptop with no network in six months. See `docs/output-format.md` for reading one programmatically.
- **No pathfinding router.** The diagram router draws orthogonal elbows and cannot route around obstacles. The validator rejects layouts that would collide instead. For diagrams this size that trade is correct.
- **No auto-generated architecture from code.** Inferring a design from a repo produces a picture of what exists, not of what was decided, and the decisions are the point.
