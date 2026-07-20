# Extending stackreason

The defaults encode general judgment. Your team has specific judgment. This is where to put it.

Everything below is a normal file edit — fork, change, done. There is no configuration system, deliberately: a config format would be one more thing to learn, and these are all files an agent reads as prose anyway.

## Constrain it to your cloud

Most teams are on one cloud and will not switch. Telling the skill saves it from proposing things you cannot adopt.

Edit `skills/stackreason/references/service-catalog.md` and delete the rows you will never use. If you are all-in on AWS, removing the Fly, Railway and Render rows means they stop appearing in "rejected alternatives" too, which makes the output shorter and more relevant.

Add a section near the top:

```markdown
## House rules

- AWS only. Other clouds are not adoptable here; do not propose them.
- No self-hosted databases. Ops capacity is committed elsewhere.
- Terraform for everything. A design requiring console clicks is incomplete.
- Anything above $500/mo needs a named budget owner before it ships.
```

The skill reads the catalog before choosing. Rules stated there are respected.

## Encode standards your team has already settled

`skills/stackreason/references/stack-selection.md` holds language, framework and topology guidance. If your shop has already made these decisions, say so — otherwise the skill will re-litigate them every run.

```markdown
## House rules

- Backend services are Go. Python is permitted only for data and ML work.
- Postgres unless a profile line makes it impossible. Not a preference — a standard.
- Modular monolith until a boundary clears the five-condition test. We have
  been through one premature decomposition and will not repeat it.
```

That last line matters more than it looks. Guidance with a reason attached survives contact with someone who disagrees; guidance without one gets ignored.

## Add a service the catalog does not know

Follow the existing row shape. The columns are load-bearing:

```markdown
| Service | Choose when | Avoid when | Ceiling | Ballpark |
```

- **Choose when** — the requirement that makes it correct, not its feature list
- **Avoid when** — be honest, including where a competitor beats it
- **Ceiling** — the number that breaks it, and the symptom you will see
- **Ballpark** — mark `[v]` with a date only if you actually checked a vendor page

An entry without a ceiling is not useful. The whole point of the catalog is knowing where things stop.

## Change how the diagram looks

CSS custom properties at the top of `skills/stackreason/references/html-template.html`, defined three times: `@media (prefers-color-scheme: dark)` for the automatic case, and `:root[data-theme="light"|"dark"]` for the manual toggle. **Change all three** or the toggle will disagree with the system theme.

```css
--client: #64748b;   --edge-c: #7c3aed;   --compute: #2b6cb0;
--data:   #047857;   --cache:  #b45309;   --queue:   #be123c;
```

Node dimensions and grid pitch are constants below the data block:

```js
const NW = 152, NH = 62, GX = 214, GY = 104, PAD = 26;
```

Widen `NW` for longer service names; widen `GX` alongside it or edge labels will collide.

## Add a validation rule

`validate.js` is a single file with no dependencies. Push into `fail` for a hard stop, `warn` for advice.

Rules worth adding for a specific team:

```js
// Only approved regions
for (const n of t.nodes)
  if (/\b(us-west-1|ap-south-1)\b/.test(n.size || ""))
    fail(`${key}/${n.id}: region not approved for production`);

// Anything expensive needs an owner named in the design
if (firstTier.cost > 500 && !/owner:/i.test(JSON.stringify(SYSTEM)))
  fail("first tier exceeds $500/mo with no budget owner named");
```

Then add the corresponding mutation to `scripts/validate-all.sh` so the new rule is itself tested. An untested validation rule silently stops working, and you will not notice.

## Add a skill

Create `skills/<name>/SKILL.md` with frontmatter whose `name` matches the directory — `validate-all.sh` checks this.

The `description` is what decides whether the skill triggers, so write it as trigger phrases rather than a summary. Include the words a user would actually type, not the words you would use to describe the feature.

Read the reasoning layer rather than restating it:

```markdown
Read `skills/stackreason/references/design-principles.md` first.
```

End with a Common Failure Modes table. Add rows as you observe real mistakes — that table is where a skill accumulates the corrections that make it reliable, and a skill without one tends to repeat the same errors indefinitely.

## What not to change

Two things are load-bearing, and weakening either removes most of the value:

**The requirement to cite.** Gate 2 exists because "good practice" is how unjustified components enter a design. The validator rejects a `why` field containing that phrase. Removing that check turns the whole thing into a diagram generator.

**Right-sizing in both directions.** Gate 1 is not only about avoiding over-engineering. It is what allows a run to conclude "the popular managed stack is correct here" and stop, which is the correct answer far more often than the field admits. A version that always finds something to add is just a different reflex.
