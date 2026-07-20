# Service Catalog

Starting points for component selection. Selection criteria and ceilings age slowly; **prices age fast**. Verify any price that reaches the final cost table.

Prices below are order-of-magnitude anchors last reviewed 2026-07. Treat them as "is this $50 or $5000" signals, not quotes.

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
| Container on PaaS (Fly, Railway, Render, App Runner) | Steady traffic; want containers without cluster ops; small team | Need fine-grained scheduling or heavy multi-service orchestration | Vertical scaling limits per instance; fewer knobs than ECS/K8s | $5-50/mo per small instance |
| ECS Fargate | Steady traffic; already on AWS; want containers without node management | Cost-sensitive at high sustained volume (EC2 backing is cheaper) | Task-level scaling; per-vCPU-hour pricing gets expensive at scale | ~$30-60/mo per always-on small task |
| ECS on EC2 / EKS | High sustained volume; need cost control or custom scheduling | Team of 1-3 with no ops capacity | Node management burden is real | Cheaper per unit at scale, higher fixed overhead |
| VPS (Hetzner, DigitalOcean) | Cost is the dominant constraint; predictable load; comfortable with ops | Need managed failover; compliance requires managed infra | Manual scaling and patching | $5-40/mo, often 3-5x cheaper than equivalent managed |

**Serverless-to-container crossover.** Serverless wins below roughly 20-40% sustained utilization. Above that, an always-on container is usually cheaper. Compute both numbers when the profile shows steady traffic — this is the single most common place a default costs real money.

## Relational Databases

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| Managed Postgres (RDS, Cloud SQL) | Relational access; joins; transactions; the default correct answer for most systems | Extreme write volume; genuinely schemaless data | Single writer. Vertical scale, then read replicas, then sharding | $15/mo (t4g.micro) to $250+/mo (m6g.large multi-AZ) |
| Supabase / Neon / PlanetScale | Small team; want Postgres or MySQL plus auth/APIs; fast start | Need fine-grained instance control; unusual extension requirements | Connection limits bite early — check pooling behavior against expected concurrency | $0-25/mo start, $100-400/mo growth |
| Aurora | Need Postgres or MySQL past single-instance limits; want fast failover | Small scale — the fixed cost is not justified | Scales reads well; writes still single-master unless multi-master | $60/mo minimum, realistically $200+ |

**Connection limits are the most common surprise.** Serverless compute plus a connection-limited Postgres is a classic mismatch. If the design pairs them, specify a pooler (PgBouncer, RDS Proxy, Supabase pooler) explicitly.

## Non-Relational

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| DynamoDB | Known access patterns; extreme scale; want zero ops | Access patterns still changing; need ad-hoc queries or joins | Query flexibility. Changing access patterns later means a migration | Pay-per-request cheap at low volume; provisioned cheaper at steady high volume |
| MongoDB / Atlas | Genuinely document-shaped data with varying structure | Data is actually relational and you are avoiding schema design | Transactions across documents are limited compared to Postgres | $0 free tier, $57+/mo dedicated |
| Cassandra / ScyllaDB | Write-heavy at very large scale; multi-region writes | Anything under serious scale — the ops cost is severe | Operational complexity is the real ceiling | Significant; needs dedicated capacity |

**Postgres holds JSONB.** Before choosing a document store for flexibility, check whether a JSONB column solves it. That keeps joins and transactions, which are usually needed eventually.

## Cache

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| Redis (ElastiCache, Upstash, Redis Cloud) | Read TPS exceeds what the DB serves; sessions; rate limiting; queues | The DB is not actually the bottleneck yet | Memory-bound; eviction policy matters | $10-15/mo small, $100+/mo HA |
| In-process cache | Single instance; small hot set; tolerant of per-instance inconsistency | Multiple instances needing coherence | No cross-instance invalidation | Free |
| CDN (CloudFront, Cloudflare, Fastly) | Static assets; geographically distributed users; cacheable API responses | Everything is per-user and uncacheable | Only helps cacheable content | $0-20/mo at low volume |

**Do not add a cache before measuring.** A cache added preemptively adds an invalidation bug surface for no measured gain. Gate 1 requires the profile line that justifies it.

## Queues and Streams

| Option | Choose when | Avoid when | Ceiling | Ballpark |
|---|---|---|---|---|
| SQS | Decoupling work; retries; smoothing bursts | Need ordering across all messages or replay | FIFO throughput is lower than standard | Effectively free at low volume |
| Kinesis / Kafka | Ordered streams; multiple consumers; replay needed | Simple background jobs — this is overkill | Operational complexity, shard management | Kinesis ~$15/mo per shard; MSK far more |
| Postgres-backed queue (pgmq, Graphile Worker, Sidekiq) | Already have Postgres; moderate volume; want one fewer service | Very high throughput | Competes with app traffic for DB resources | Free, reuses existing DB |

**Postgres-as-queue is underrated at small scale.** Below a few hundred jobs per second it removes a whole service from the diagram.

## Load Balancing and Ingress

| Option | Choose when | Avoid when | Ballpark |
|---|---|---|---|
| ALB | Multiple instances on AWS; need health checks and TLS termination | Single instance — it is pure overhead | ~$18/mo base plus traffic |
| Cloudflare | Want DDoS protection, CDN, and TLS in one layer | Need deep AWS-native integration | $0-20/mo |
| Platform-provided (Vercel, Fly, Render) | Already on that platform | Need custom routing rules | Included |

An ALB at ~$18/mo base is a real line item for a hobby-scale project. At one instance, skip it.

## Cost Sanity Anchors

Rough all-in monthly for a typical CRUD web app, verified against the profile:

| Scale | Realistic range | Shape |
|---|---|---|
| Hobby / under 1k users | $0-25 | Managed platform free tiers, single small DB |
| Small / 1k-50k users | $50-300 | Small container or serverless, managed Postgres, Redis, CDN |
| Growth / 50k-500k users | $300-2000 | Multi-instance, read replica, real cache tier, CDN |
| Scale / 500k+ | $2000+ | Genuinely depends on shape; estimate from the profile, not this table |

If the design lands far outside the band for its user count, something is wrong. Re-check Gate 1 for components that cannot cite a requirement.

## Compliance Triggers

These change the design and are easy to miss in the interview:

- **Health data (HIPAA)** — requires a BAA. Not every managed service offers one. Check before designing.
- **Payment cards (PCI)** — do not store card data. Use a provider's hosted fields or checkout.
- **EU personal data (GDPR)** — data residency and deletion obligations affect region choice and backup retention.
- **SOC 2** — audit logging and access control become architectural, not bolt-on.

If any apply, they constrain provider choice before anything else does. Surface them in phase 2 rather than discovering them after the design is drawn.
