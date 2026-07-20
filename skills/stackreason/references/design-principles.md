# Design Principles

The reasoning layer. Read this before selecting components — it is what turns a requirements profile into a defensible design rather than a list of popular services.

There is no correct answer in system design. There are only designs you can justify against stated numbers, and designs you cannot.

---

## 1. Access patterns choose the database, not the label

"Should I use SQL or NoSQL" is the wrong question. It has no answer without knowing how the data is read and written. Ask instead:

- What is the primary read? Point lookup by key, range scan, or a join across entities?
- What is the primary write? Append, update in place, or read-modify-write?
- What is the read:write ratio?
- Do queries need to span entities, or only ever touch one?
- Are the access patterns settled, or still moving?

The answer emerges from those, not from a preference.

| Pattern | Fits | Why |
|---|---|---|
| Lookup one value by one key, no joins | Key-value (DynamoDB, Redis) | The entire workload is `GET key`. A relational engine adds machinery you never use. |
| Entities genuinely relate: users have posts have comments | Relational (Postgres) | Joins and referential integrity are the workload, not an inconvenience. |
| Append-heavy, queried by time range | Time-series (TimescaleDB, ClickHouse) | Compression and time-partitioning are the difference between $50 and $800 a month. |
| Full-text relevance ranking | Search index (Elastic, Meilisearch, Postgres FTS) | Ranking is not a `WHERE` clause. |
| Access patterns still changing weekly | Relational (Postgres) | Schema flexibility at query time beats schema flexibility at write time when you do not yet know the queries. |

**The URL shortener test.** A link shortener's entire workload is: given a short code, return a long URL. No joins, no aggregation, no cross-entity queries. That is a key-value store's exact shape. Reaching for Postgres there is not wrong, but you should be able to say why you did it anyway — usually "we already run Postgres and this table is small," which is a perfectly good reason.

**The Instagram test.** Users have posts, posts have comments, users follow users, feeds join across all of it. That is relational, and forcing it into a document store means reimplementing joins in application code.

**When access patterns are still moving, choose the flexible query engine.** DynamoDB rewards you for knowing your access patterns up front and punishes you for changing them — a new pattern can mean a new index, a migration, or a redesign. Postgres lets you write a new query. Early-stage products change access patterns constantly.

**Check JSONB before choosing a document store.** Postgres holds semi-structured data well. If the appeal of Mongo is "our schema varies," a JSONB column usually delivers that while keeping joins and transactions you will want later.

---

## 2. Reads and writes scale differently

Classify the system before designing for it. Getting this backwards produces a design tuned for the wrong axis.

**Read-heavy:** URL shorteners, news feeds, product pages, documentation, most content sites. Written once, read constantly.

**Write-heavy:** analytics ingestion, logging, chat, IoT telemetry, audit trails. Roughly one read per write, or far fewer.

Most web architectures silently assume read-heavy. A write-heavy system dropped into read-heavy defaults gets mispriced badly — this is where "just use the popular stack" fails hardest.

### Scaling reads — four tools, in order of cost

1. **Cache.** Browser, in-process, or shared (Redis). Placement matters as much as existence. See section 3 before reaching for this.
2. **CDN.** Near-mandatory for static assets. Also works for cacheable API responses. Cheap and boring.
3. **Read replicas.** One primary takes writes; replicas absorb reads. Cheap to add, and doubles as your failover story. Watch replication lag — never serve auth or balance checks from a replica.
4. **Precompute.** If the answer is expensive and requested often, compute it once on write instead of every read. A million-row average recomputed per request is a design error; a maintained aggregate is a design.

### Scaling writes — two tools

1. **Async plus a queue.** Accept the write, acknowledge immediately, process behind the queue. See section 4.
2. **Partition.** Split the data across shards so writes distribute. See section 5. This is a last resort, not a starting point.

---

## 3. Caching is remembering expensive answers — and it costs you

A cache is the most over-recommended component in system design. It is genuinely powerful and genuinely expensive in ways that do not appear on the invoice:

- **Stale data.** Every cache is a second copy that can disagree with the first.
- **Invalidation.** Knowing when to evict is the hard part. Most cache bugs are invalidation bugs.
- **Thundering herd.** A popular key expires, every request misses simultaneously, and the load lands on the database you were protecting — often taking it down.
- **Debugging.** "Works for me" now has a second explanation.

Be reluctant. The honest heuristic: caching is reached for far more often in interviews than in production, because in an interview it costs nothing and in production it costs you a class of bugs.

**Add a cache when you can name the query it removes and the measurement that showed it hurt.** Not before. A design that adds Redis to a system whose database is at 5 percent CPU has bought an invalidation bug surface for nothing.

**Corollary: a small hot set often does not need Redis at all.** A 12,000-row current-state table in Postgres is already fast. A cache there adds a component and removes nothing.

---

## 4. Queues buy you four things

Put a queue in when you want one of these, and say which:

1. **Absorb spikes.** A million simultaneous requests will break a server trying to answer a million simultaneous requests. Queued, the server drains at its own rate.
2. **Retry on failure.** Most queues make a message invisible during processing rather than deleting it. If the worker dies, the message reappears and another worker retries. Getting this for free is worth a lot.
3. **Decouple services.** If service A calls service B directly, B's outage is A's outage. Through a queue, it is a delay.
4. **Background work.** Anything slow that the user should not wait on.

**The 202 pattern.** For long work, accept and acknowledge immediately rather than holding the connection:

```
POST /uploads        -> 202 Accepted
                        { job_id, status_url }
GET /jobs/{job_id}   -> { status: "processing" | "done" | "failed" }
```

An upload that transcodes, scans for harmful content, generates thumbnails, indexes, and notifies followers might take two minutes. No user waits two minutes on an HTTP request. Accept in milliseconds, do the work behind the queue, let the client poll or subscribe.

**The cost:** the user no longer gets the answer inline. Any flow that genuinely needs a synchronous answer — payment authorization, login — cannot use this.

---

## 5. Partitioning: powerful, and a one-way door

Sharding splits data across databases so writes distribute. It works. It is also the least reversible decision in this document.

**The shard key is the whole problem.**

Shard a student database by first letter of last name and you get 26 shards — but roughly 9 percent of US surnames start with B and roughly 0.02 percent with X. The B shard falls over while the X shard idles. That is a **hot shard**, and it is the default outcome of any human-meaningful shard key, because human data is never uniform.

Shard by a synthetic ID instead and distribution is even — but now two siblings live on different shards, and any query spanning them has to fan out and merge.

There is no shard key without a trade. Choose it by naming your most important query and asking whether that query stays on one shard.

**Rebalancing is genuinely painful.** Changing the shard key later means moving data across servers while serving traffic. Assume you cannot change it.

**Exhaust the alternatives first.** Vertical scaling, read replicas, better indexes, archiving cold data, and a queue in front of writes are all reversible. Sharding is not. Most systems that shard early did not need to.

---

## 6. Consistency is the lies your system is allowed to tell

Strong consistency means a read after a write sees that write. Eventual consistency means it sees it soon.

Almost every large system you use daily lies to you constantly. An Instagram like count is frequently minutes stale, because recounting from source on every view would be absurd and nobody is harmed by the delay.

**Eventual consistency is fine when a stale answer is merely wrong, not harmful:**
feed ordering, like and view counts, follower counts, search indexes, recommendations, analytics dashboards, notification badges.

**Strong consistency is required when a stale answer causes damage:**
account balances, inventory and seat reservations, permissions and access control, payment state, anything where two concurrent readers acting on stale data produces an impossible state.

The bank case makes it concrete: transfer $100 from an account holding $100, and if the balance read is stale, a second transfer of $100 succeeds against money that no longer exists.

**Decide this per data type, not per system.** One application routinely needs both — a social app wants strong consistency on payments and account settings, and eventual consistency on feeds and counts. Say which is which in the design.

**CAP as a starting heuristic, not a law.** Under a network partition you choose availability or consistency. Most systems are not partitioned most of the time, so treat CAP as the question "what do we do when a partition happens" rather than a permanent classification.

---

## 7. Right-size before you design

The failure mode this skill exists to prevent runs in both directions.

Applying a default stack to a system it does not fit is one error. Applying a queue, a cache, a CDN, a read replica, and a service mesh to a tool serving 200 people is the same error wearing a different hat — and it is more expensive, because now someone maintains all of it.

**Ask the smallest-thing-that-works question before drawing anything:** what is the least infrastructure that meets every line of the profile?

Start there. Add a component only when a profile line demands it.

For genuinely small systems, the popular managed stack is usually correct, and the design should say so plainly and stop. A run that concludes "Vercel free tier plus Supabase free tier, $0 a month, one repository, and here is the first thing that will break" has succeeded completely. Manufacturing three tiers of infrastructure for a system that will never need them is not thoroughness.

**Design for the scale you have, document the scale you expect.** The migration path is written down; it is not built. Prepared, not pre-built.

---

## 8. Large systems: narrow before designing

"Design YouTube" is not a designable request. Neither is "design Airbnb" or "design Uber." Each is a dozen systems with different shapes sharing a brand.

The subsystems have genuinely opposing requirements:

| YouTube subsystem | Shape | What dominates |
|---|---|---|
| Upload and transcode | Write-heavy, long-running jobs | Queue depth, worker fleet, storage cost |
| Watch and delivery | Read-heavy, latency-critical | CDN strategy, egress cost |
| Search and recommendations | Read-heavy, freshness-sensitive | Index freshness, precompute vs query-time ranking |
| Creator analytics | Write-heavy ingest, read rarely | Columnar storage, eventual consistency is fine |

A design covering all four says nothing useful about any of them. Averaging their requirements produces a system that fits none.

**Narrow to one subsystem, and name the boundary.** The others become external dependencies with defined interfaces — which is a real design decision, not a dodge. Stating "transcoding publishes a `video.ready` event that this subsystem consumes" is more useful than a box labeled "transcoding" with no contract.

**Decomposition follows scaling shape, not org chart.** Split a service out when its scaling profile genuinely differs from its neighbors — transcode workers scale on queue depth while the watch path scales on concurrent viewers, so they cannot share a deployment unit sensibly. Splitting because a diagram looks tidier produces network calls where function calls used to be, and distributed failure modes in exchange for nothing.

---

## 9. Interview order, which is also design order

The sequence matters because each step constrains the next:

1. **Functional requirements.** What does it actually do? Narrow aggressively.
2. **Non-functional requirements.** Scale, latency, availability, consistency, budget. A system serving 5 requests a day and one serving a billion share no design decisions.
3. **API design.** How does anything talk to this? Protocol, endpoints, auth, rate limiting, pagination, idempotency.
4. **High-level design.** Components and data flow.
5. **Data layer.** Where interviewers and production both apply the most pressure: which database, why, what indexes, what table design, sharding, caching. Every one of those must be justified.

Skipping to step 4 is what produces the default stack. Steps 1 and 2 are what make step 5 defensible.
