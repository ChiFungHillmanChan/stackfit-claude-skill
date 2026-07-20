# Contributing

## The most useful contributions

**Pricing corrections, first by a distance.** Prices drift, and a wrong price in a tool that tells people to stop guessing about cost is the worst kind of bug. There is an issue template for exactly this. Include the figure, the region, on-demand versus committed, a vendor link, and the date you checked.

**Observed failure modes.** If a skill did something wrong on a real request, that is worth an issue even without a fix. Include what you asked for, what it produced, and what you expected. Those reports are how the Common Failure Modes tables get written.

**Ceilings for the service catalog.** The catalog's "what breaks first" column is the part that ages slowest and helps most. If you have operated something at scale and know where it stops, that knowledge is hard to get any other way.

**Harness support.** The skills are plain markdown and the validator is dependency-free Node. If you have it working under another agent, `docs/porting.md` takes a section.

## Ground rules

**Every guideline states the requirement it serves.** "Use a queue here" is an opinion. "Use a queue when the write path must survive a database restart" is guidance. The former gets ignored the first time someone disagrees.

**Every component must be able to cite a requirement.** This is the project's central constraint and the validator enforces it. A change that lets a component in on "good practice" will be declined — that phrase is specifically rejected by `validate.js`, deliberately.

**Right-sizing cuts both ways.** Contributions that make designs bigger need the same justification as contributions that make them smaller. "The popular managed stack is correct here, stop" must remain a reachable conclusion.

**No emojis.** Anywhere.

## Before opening a PR

```bash
./scripts/validate-all.sh
./scripts/check-prices.sh
```

Both run in CI. The first also mutates an example four ways to confirm the validator still rejects defects.

If you changed `html-template.html`, regenerate the examples and re-validate. The cost-sum check is what catches missed lines.

## Adding a skill

`skills/<name>/SKILL.md`, frontmatter `name` matching the directory. Write the `description` as trigger phrases users would actually type, not as a feature summary — it is what decides whether the skill loads at all.

Read the shared reasoning layer rather than restating it:

```markdown
Read `skills/stackreason/references/design-principles.md` first.
```

End with a Common Failure Modes table, even if it starts with one row.

## Adding a validator rule

Add the rule to `validate.js`, then add a mutation to `scripts/validate-all.sh` proving it fires. Rules without tests decay silently.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
