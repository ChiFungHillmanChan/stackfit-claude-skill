# Maintaining prices

Prices are the part of this repo that rots fastest, and wrong prices are worse than absent ones because they carry the same authority as correct ones.

## The marker convention

| Marker | Meaning |
|---|---|
| **`[v]`** | Checked against a vendor pricing page on the stated date |
| *(estimate)* | Explicitly labelled. Not verified, and known not to be |
| No marker | An order-of-magnitude anchor. "Is this $50 or $5,000", nothing finer |

A machine-readable date sits at the top of the catalog:

```html
<!-- prices-verified: 2026-07-20 -->
```

`scripts/check-prices.sh` reads it and reports staleness. Over 90 days it advises a refresh; over 180 it fails.

## Running a refresh

1. **Prioritise by impact.** Refresh what appears in examples and what dominates a cost table first. A wrong figure for a $5/mo line matters far less than a wrong one for a $600/mo line.
2. **Go to the vendor.** Third-party trackers are a fallback, not a source.
3. **Note what is bundled.** Compute-only versus compute-plus-storage is where most errors hide. State which.
4. **Record region and commitment.** These figures are us-east-1, on-demand, no commitment. Anything else must say so.
5. **Update the date at the top of the catalog** in the same commit.
6. **Regenerate examples** if any figure they use changed, and re-run `./scripts/validate-all.sh`. The validator checks that cost rows still sum to their headlines, which is how you find the lines you forgot.

## When a vendor does not publish

Some vendors put per-size pricing behind a login. Tiger Cloud is the current example: only "from $36/mo" and the storage rate are public, and actual cost for a given instance size appears solely in their signed-in console.

Do not guess and present it as fact. Label it:

```
cost: "~$265/mo [estimate: Tiger Cloud does not publish per-size compute rates publicly]"
```

The label is the deliverable. A reader who knows it is an estimate can go and check; a reader who thinks it is verified will not.

## Errors this has already caught

From the first verification pass, all four written in the same confident tone as the correct figures:

| Claimed | Actual |
|---|---|
| ECS Fargate, 4 tasks — $240/mo | $144/mo. 66% over |
| Fly.io shared-cpu-2x, 3 machines — $60/mo | $19.92/mo. 3x over |
| Upstash Redis 2GB — $45/mo | **No such tier exists.** Plans go 1GB/$20 then 5GB/$100 |
| Tiger Cloud 4vCPU/16GB — $265/mo | Not publicly documented at all |

The Upstash one is the instructive one. It was not a stale price — it was a budget line for a product that has never existed. Nothing but going to the vendor's page would have caught it.

## Plan restrictions

These are not prices, but they invalidate designs harder than a wrong price does, so they live in the catalog too under "Plan Restrictions That Bite":

- Vercel Hobby forbids commercial use, and their terms name payment processing explicitly
- Cloudflare Pages free permits commercial use — the genuine $0 option when the above bites
- Cloudflare Pages caps files at 25 MiB, which rejects most WebGL builds at deploy time
- Supabase free projects pause after 7 days of inactivity
- Resend's free tier is 3,000/month *and* 100/day — a monthly total inside the limit can still fail on a burst day

Restrictions like these age more slowly than prices but change without announcement. Re-read the terms, not a blog post about the terms.

## Contributing a correction

Open a **pricing correction** issue. It is the most valuable issue type this project takes. Include the figure, the region, whether it is on-demand or committed, a vendor link, and the date you checked.
