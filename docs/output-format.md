# Output format

Generated designs are self-contained HTML with a JavaScript data block near the bottom. You can hand-edit them, diff them, and script against them.

## The two objects

Everything between the `DATA` and `END DATA` markers is yours to edit. Nothing below `END DATA` should be touched.

### `SYSTEM`

```js
const SYSTEM = {
  name: "...",              // page title and heading
  checked: "2026-07-20",    // price check date, shown in the footer
  profile:   [ [field, value, assumption|null], ... ],
  patterns:  [ [label, query, rate], ... ],
  stack:     [ [layer, choice, why], ... ],
  verdict:   `...`,         // the reflex stack, named and judged
  checklist: [ "...", ... ]
};
```

- **`profile`** — third element is the assumption. `null` means it was stated, not inferred, and renders without the `[assumed]` marker. Getting this backwards is the most common hand-edit mistake.
- **`patterns`** — required. Its absence fails validation, because a design that never wrote down its access patterns chose its datastore without reasoning.
- **`stack`** — required, and should include rows whose labels contain `language`, `topology`, and `repo`.
- **`verdict`** — required. If the text matches `Verdict: Rejected`, the block renders with a red left border; otherwise green.

### `TIERS`

An ordered object. Key order is display order, and **the first key is the tier that gets built now** — that is the one the budget gate checks.

```js
const TIERS = {
  now: {
    label: "Now",           // tab text
    context: "800 members", // shown beside the cost
    cost: 20,               // must equal the sum of costrows
    trigger: "...",         // observable signal to move up
    scaledown: "...",       // what to switch off when traffic falls
    costrows: [ [service, size, amount], ... ],
    nodes: [ ... ],
    edges: [ [fromId, toId, label], ... ]
  },
  next: { ... }
};
```

Two tiers minimum. Small systems get two; growing ones get three.

### Nodes

```js
{ id:"db", kind:"data", col:3, row:1,
  label:"Postgres", sub:"RDS t4g.medium",
  why:      "...",   // the profile line that justified it
  size:     "...",   // concrete: db.t4g.medium, 2vCPU/4GB
  cost:     "...",
  ceiling:  "...",   // what breaks first, with the symptom
  rejected: "..." }
```

`why`, `size`, `cost`, `ceiling` and `rejected` are all required. Leaving any blank fails validation.

`kind` sets the colour: `client`, `edge`, `compute`, `data`, `cache`, `queue`, `external`.

## Layout rules

Coordinates are a grid. `col` runs left to right, `row` top to bottom. The renderer normalises to a zero origin, so you can number from anywhere.

**One rule the validator enforces:** a same-row edge may not skip an occupied column. The router draws orthogonal elbows and does not path around obstacles, so such an edge would draw straight through the node between. Move a node to a different row, or route via an adjacent column.

```
BAD                          GOOD
[A] [B] [C]                  [A] [B] [C]
 └───────┘  through B         └───┘   │
                                  └───┘
```

## Editing by hand

Perfectly reasonable. Common edits:

- **Change a cost** — update both `costrows` and the tier's `cost`. The validator will catch you if they disagree, which is the point.
- **Add a node** — add to `nodes` with all six required fields, then add at least one edge. An unconnected node produces a warning.
- **Add a tier** — add a key to `TIERS`. Tabs are generated from the keys, so nothing else needs changing.
- **Restyle** — CSS variables at the top of the file. The renderer below `END DATA` does not need touching.

Always re-run the validator after editing:

```bash
node skills/stackreason/references/validate.js your-design.html
```

## Reading one programmatically

The data block evaluates as plain JavaScript:

```js
const fs = require("fs");
const html = fs.readFileSync("design.html", "utf8");
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
let cut = js.indexOf("END DATA");
cut = cut > -1 ? js.lastIndexOf("/*", cut) : js.indexOf("function renderTier");
const { SYSTEM, TIERS } = new Function(js.slice(0, cut) + "\nreturn { SYSTEM, TIERS };")();

console.log(SYSTEM.name, Object.keys(TIERS));
```

Cut at the comment opener, not at the words `END DATA` — slicing mid-comment leaves an unterminated `/*` and the evaluation fails. `validate.js` does exactly this and is the reference implementation.

## Why HTML and not JSON plus a viewer

The file has to open on a laptop with no network, six months from now, with no build step and no dependency that may have moved. A single self-contained HTML file is the only format that reliably survives that.

The trade is that the data is embedded in a page rather than sitting in a clean `.json`. The extraction above is four lines, which seemed a fair price.
