# Service Catalog

Starting points for component selection. Selection criteria and ceilings age slowly; **prices age fast**. Verify any price that reaches the final cost table.

Prices marked **[v]** were verified against vendor pricing pages on **2026-07-20** (us-east-1, on-demand, no commitment). Unmarked figures are order-of-magnitude anchors — treat those as "is this $50 or $5000" signals, not quotes.

Compute-only figures exclude storage, data transfer, and backups unless stated. That distinction is where most cost surprises live.

## Verification Method

Figures marked **[v]** were checked on 2026-07-20 against vendor pricing pages, cross-referenced against price-tracking sources that read the AWS Price List API where the vendor page renders its tables dynamically and cannot be read directly. Treat them as good to within a few percent, not as quotes. Regions other than us-east-1, committed-use discounts, and free-tier credits all move these numbers.

**Re-verify anything before it reaches a real budget.** Prices drift, and a figure with a date is only trustworthy near that date.

## How To Use This

Do not read this file top to bottom and pick favorites. Work from the profile:

1. Find the profile line that creates a need
2. Read the "Choose when" rows in the relevant section
3. Take two candidates to Gate 1
4. Verify current pricing for both before committing

---

## Compute

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| Serverless functions (Lambda, Vercel, Cloudflare Workers) | Spiky or unpredictable traffic; low steady volume; no ops capacity | Sustained high volume; long-running work; heavy cold-start sensitivity | Duration caps (15min Lambda, less on edge); per-invocation cost crosses over containers around 20-40% sustained utilization | $0 at rest, dominated by invocation count |
| Container on PaaS (Fly, Railway, Render, App Runner) | Steady traffic; want containers without cluster ops; small team | Need fine-grained scheduling or heavy multi-service orchestration | Vertical scaling limits per instance; fewer knobs than ECS/K8s | **[v]** Fly shared-cpu-1x 256MB $2.02/mo, 512MB $3.32/mo, shared-cpu-2x 1GB $6.64/mo; Render Starter $7/mo; Railway Hobby $5/mo incl. $5 credit |
| ECS Fargate | Steady traffic; already on AWS; want containers without node management | Cost-sensitive at high sustained volume (EC2 backing is cheaper) | Task-level scaling; per-vCPU-hour pricing gets expensive at scale | **[v]** $36/mo per always-on 1vCPU/2GB task ($0.04048/vCPU-hr + $0.004445/GB-hr) |
| ECS on EC2 / EKS | High sustained volume; need cost control or custom scheduling | Team of 1-3 with no ops capacity | Node management burden is real | Cheaper per unit at scale, higher fixed overhead |
| VPS (Hetzner, DigitalOcean) | Cost is the dominant constraint; predictable load; comfortable with ops | Need managed failover; compliance requires managed infra | Manual scaling and patching | **[v]** DigitalOcean from $4/mo (1vCPU/512MB), Hetzner CX22 ~€4.49/mo (2vCPU/4GB); both scale into $40+/mo |

**Serverless-to-container crossover.** Serverless wins below roughly 20-40% sustained utilization. Above that, an always-on container is usually cheaper. Compute both numbers when the profile shows steady traffic — this is the single most common place a default costs real money.

## Relational Databases

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| Managed Postgres (RDS, Cloud SQL) | Relational access; joins; transactions; the default correct answer for most systems | Extreme write volume; genuinely schemaless data | Single writer. Vertical scale, then read replicas, then sharding | **[v]** t4g.micro ~$14/mo, t4g.small ~$26/mo, t4g.medium+100GB ~$59/mo, m6g.large multi-AZ ~$255/mo |
| Supabase / Neon / PlanetScale | Small team; want Postgres or MySQL plus auth/APIs; fast start | Need fine-grained instance control; unusual extension requirements | Connection limits bite early — check pooling behavior against expected concurrency | **[v]** Supabase Free 500MB / Pro $25/mo per project (8GB, $10 compute credit) |
| Aurora | Need Postgres or MySQL past single-instance limits; want fast failover | Small scale — the fixed cost is not justified | Scales reads well; writes still single-master unless multi-master | **[v]** Serverless v2 floor ~$44/mo (0.5 ACU x $0.12/ACU-hr); realistic production with an HA reader $200-400+ |

**Connection limits are the most common surprise.** Serverless compute plus a connection-limited Postgres is a classic mismatch. If the design pairs them, specify a pooler (PgBouncer, RDS Proxy, Supabase pooler) explicitly.

## Non-Relational

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| DynamoDB | Known access patterns; extreme scale; want zero ops | Access patterns still changing; need ad-hoc queries or joins | Query flexibility. Changing access patterns later means a migration | **[v]** On-demand $0.125/M read request units, $0.625/M write request units |
| MongoDB / Atlas | Genuinely document-shaped data with varying structure | Data is actually relational and you are avoiding schema design | Transactions across documents are limited compared to Postgres | **[v]** Free tier, then M10 dedicated ~$58/mo ($0.08/hr, 2vCPU/2GB/10GB) |
| Cassandra / ScyllaDB | Write-heavy at very large scale; multi-region writes | Anything under serious scale — the ops cost is severe | Operational complexity is the real ceiling | Significant; needs dedicated capacity |

**Postgres holds JSONB.** Before choosing a document store for flexibility, check whether a JSONB column solves it. That keeps joins and transactions, which are usually needed eventually.

## Cache

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| Redis (ElastiCache, Upstash, Redis Cloud) | Read TPS exceeds what the DB serves; sessions; rate limiting; queues | The DB is not actually the bottleneck yet | Memory-bound; eviction policy matters | **[v]** ElastiCache cache.t4g.medium 2-node HA ~$95/mo compute-only |
| In-process cache | Single instance; small hot set; tolerant of per-instance inconsistency | Multiple instances needing coherence | No cross-instance invalidation | Free |
| CDN (CloudFront, Cloudflare, Fastly) | Static assets; geographically distributed users; cacheable API responses | Everything is per-user and uncacheable | Only helps cacheable content | **[v]** Cloudflare Free, or Pro $20/mo billed annually ($25 monthly) |

**Upstash fixed plans jump.** 1GB is $20/mo **[v]**, and the next fixed tier is 5GB at $100/mo — there is nothing between. Pay-as-you-go ($0.25/GB-month plus $0.20 per 100K commands) is usually the better fit for a small hot set. Sizing a "2GB plan" into a budget is sizing something that does not exist.

**Do not add a cache before measuring.** A cache added preemptively adds an invalidation bug surface for no measured gain. Gate 1 requires the profile line that justifies it.

## Queues and Streams

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| SQS | Decoupling work; retries; smoothing bursts | Need ordering across all messages or replay | FIFO throughput is lower than standard | Effectively free at low volume |
| Kinesis / Kafka | Ordered streams; multiple consumers; replay needed | Simple background jobs — this is overkill | Operational complexity, shard management | **[v]** Kinesis $10.95/shard-month provisioned plus PUT payload; MSK 3x kafka.m5.large ~$460/mo compute, ~$610/mo with 500GB/broker |
| Postgres-backed queue (pgmq, Graphile Worker, Sidekiq) | Already have Postgres; moderate volume; want one fewer service | Very high throughput | Competes with app traffic for DB resources | Free, reuses existing DB |

**Postgres-as-queue is underrated at small scale.** Below a few hundred jobs per second it removes a whole service from the diagram.

## Load Balancing and Ingress

| Option | Choose when | Avoid when | Ballpark |
|---|---|---|---|
| ALB | Multiple instances on AWS; need health checks and TLS termination | Single instance — it is pure overhead | **[v]** $16.43/mo base ($0.0225/hr) plus LCU charges |
| Cloudflare | Want DDoS protection, CDN, and TLS in one layer | Need deep AWS-native integration | **[v]** Free, or Pro $20/mo annual |
| Platform-provided (Vercel, Fly, Render) | Already on that platform | Need custom routing rules | Included |

An ALB at $16/mo base is a real line item for a hobby-scale project. At one instance, skip it.

## Cost Sanity Anchors

Rough all-in monthly for a typical CRUD web app, verified against the profile:

| Scale | Realistic range | Shape |
|---|---|---|
| Hobby / under 1k users | $0-25 | Managed platform free tiers, single small DB |
| Small / 1k-50k users | $50-300 | Small container or serverless, managed Postgres, Redis, CDN |
| Growth / 50k-500k users | $300-2000 | Multi-instance, read replica, real cache tier, CDN |
| Scale / 500k+ | $2000+ | Genuinely depends on shape; estimate from the profile, not this table |

If the design lands far outside the band for its user count, something is wrong. Re-check Gate 1 for components that cannot cite a requirement.

## Plan Restrictions That Bite

Not price, but they invalidate designs just as hard:

- **Vercel Hobby forbids commercial use [v].** Their terms name "any method of requesting or processing payment from visitors" as commercial. Any app taking money needs Pro at $20/seat-month. Donations are exempt.
- **Cloudflare Pages free tier permits commercial use [v]** — unlimited sites and bandwidth, 500 builds/month. This is the genuine $0 option when Vercel's restriction bites.
- **Supabase free projects pause after 7 days of inactivity [v]**, and the free plan caps you at 2 active projects. Irrelevant for a live app with daily traffic; fatal for a demo you revisit monthly.
- **Resend's free tier is 3,000/month but also capped at 100/day [v].** A monthly total inside the limit can still fail on a burst day.
- **Tiger Cloud does not publish per-instance-size compute pricing.** Only "from $36/mo" and the storage rate ($0.212/GB-month) are public; actual cost for a given vCPU/RAM appears only in their signed-in console. Any figure for a specific size is an estimate until you check the console.

## Compliance Triggers

These change the design and are easy to miss in the interview:

- **Health data (HIPAA)** — requires a BAA. Not every managed service offers one. Check before designing.
- **Payment cards (PCI)** — do not store card data. Use a provider's hosted fields or checkout.
- **EU personal data (GDPR)** — data residency and deletion obligations affect region choice and backup retention.
- **SOC 2** — audit logging and access control become architectural, not bolt-on.

If any apply, they constrain provider choice before anything else does. Surface them in phase 2 rather than discovering them after the design is drawn.
