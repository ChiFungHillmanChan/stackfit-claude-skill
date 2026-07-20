---
name: capacity-estimate
description: Fast back-of-envelope capacity and cost arithmetic with the working shown. Answers "what does 100k users cost", "can one Postgres handle this", "how much storage will a year of this need", "is serverless cheaper than a container here" — without running a full design. Use when the user wants a number rather than an architecture.
---

# Capacity Estimate

Not every question needs a design. Sometimes you want to know whether the answer is $50 or $5,000 before deciding whether the question is worth more thought.

This skill does the arithmetic, shows the working, and names the line item that dominates. It takes minutes, not a full interview.

## When to use the design skill instead

If the answer would change what they build, they need `stackreason`, not this. Estimates inform decisions; they do not make them.

Route to the full design skill when the user is choosing between architectures, when the estimate lands near a budget ceiling, or when they ask "what should I use" rather than "what would this cost".

## Hard Rules

1. **Show every step of the arithmetic.** A number without working cannot be corrected. The user knows their traffic better than you do, and they can only fix your inputs if they can see them.
2. **State units and time bases explicitly.** Per second, per day, per month. Most estimation errors are unit errors, and they are usually off by 86,400.
3. **Give a range, not a point.** Real traffic is not flat. Quote average and peak, and say which drives the sizing.
4. **Name the dominant line item.** Every estimate has one thing that is most of the cost. If the user only remembers one sentence, it should be that one.
5. **Stamp prices with a check date**, and verify anything above roughly $50/month rather than recalling it.

## The method

### Step 1 — Convert to a rate

Almost every question arrives as a total and has to become a rate.

```
100,000 users
  x 5 writes/user/day
  = 500,000 writes/day
  / 86,400 seconds
  = 5.8 writes/s average
```

**Then apply a peak multiplier**, because nothing is flat:

| Traffic shape | Multiplier | Why |
|---|---|---|
| Consumer app, one region | 3x | Evening concentration |
| Consumer app, global | 2x | Timezones flatten the curve |
| Business tool | 5x | Everything happens in office hours |
| Scheduled trigger (cron, class release, ticket drop) | 10-50x | Everyone arrives in the same minute |
| IoT / telemetry | 1.2x | Genuinely near-constant, but reconnect storms spike hard |

State which you used and why. This is the single most common place estimates go wrong.

### Step 2 — Size the data

```
500,000 writes/day
  x 400 bytes/row
  = 200 MB/day
  x 365
  = 73 GB/year
```

Then adjust for what actually happens to it:

- **Indexes** add roughly 20-50% on top of table size. Do not forget them.
- **Row overhead** in Postgres is around 24 bytes per row before your columns. At high row counts with narrow rows, overhead can exceed payload.
- **Time-series compression** typically achieves 5-20x on narrow numeric data, and roughly nothing on wide text rows.
- **Retention** is a decision, not a given. A year of data is only a year of data if someone chose that.

### Step 3 — Check it against known ceilings

Consult `skills/stackreason/references/service-catalog.md`. The ceilings age far more slowly than the prices.

```
5.8 writes/s average, 17/s peak
  -> a single small Postgres handles this with large margin
     (~800 write TPS on db.t4g.medium)
  -> the constraint is not throughput. Look at connections instead.
```

**The ceiling that binds is rarely the one being asked about.** People ask about throughput; what actually breaks is connection count, payload size, function duration, or a per-file limit.

### Step 4 — Price it

Itemize. Then say which line dominates:

```
Postgres  db.t4g.small, 20GB     $26/mo   [v 2026-07-20]
Compute   1 container, 512MB      $7/mo   [v 2026-07-20]
Egress    ~40GB                    $0/mo   (CDN free tier)
                                  ------
                                  $33/mo

Dominant line: the database, at 79% of spend. Everything else
is noise. If this number needs to come down, that is where to look.
```

## The comparisons worth running

Three questions come up constantly and are worth doing properly because the intuitive answer is often wrong.

### Serverless versus container

The crossover sits around 20-40% sustained utilization. Below it, serverless wins; above it, an always-on container does.

```
Serverless:  requests/mo x price-per-invocation
             + GB-seconds x price-per-GB-second
Container:   hourly rate x 730

At 5.8 req/s sustained, that is 15M invocations/month, which is
well past the crossover. The container wins, usually by 3-5x.
```

Sustained load is the tell. Spiky load with long idle periods is the opposite case.

### Managed versus self-hosted

Compare the invoice against the invoice **plus the hours**. A managed database at $60/mo versus a $10 VPS looks like a $50 saving until you price the backup verification, patching, and the failover you will eventually run at 3am.

Rough rule: below roughly 10 hours of ops per month, managed almost always wins for a small team. Say the assumption out loud rather than pretending it is purely a cost comparison.

### Storage tiering

Hot storage for data queried interactively; cold object storage for data that exists for audit. The ratio is usually extreme — often 95% of rows are never read after the first week — and the price difference is roughly 10x.

## Output shape

Keep it short. This skill exists to be fast.

```
QUESTION   What does 100k users cost on Postgres + a container?

RATE       5.8 writes/s avg, 17/s peak  [3x, consumer single-region]
DATA       73 GB/year + ~30% indexes = ~95 GB
CEILING    Not throughput-bound. Connections bind first
           at ~60 without a pooler.
COST       $33/mo, of which the database is 79%

WATCH      Connection count, not TPS. Add a pooler before
           you add a bigger instance.
```

If the estimate lands within roughly 30% of a stated budget ceiling, say so plainly. Estimates that close are not decisions — recommend the full design skill.

## Common Failure Modes

| Symptom | Fix |
|---|---|
| A number with no arithmetic | Rule 1. The user cannot correct what they cannot see. |
| Average traffic used for sizing | Rule 3. Size on peak, report both. |
| Off by 86,400 | Rule 2. Per day and per second are not the same. |
| Every line item listed as equally important | Rule 4. Name the dominant one. |
| Indexes omitted from storage | Add 20-50%. |
| Answering "what should I use" | That is a design question. Route to `stackreason`. |
