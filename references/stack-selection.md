# Stack Selection

Language, framework, and repository shape. Infrastructure decisions get all the attention, but these are the ones the team lives inside every day, and they are far harder to reverse than swapping a managed database tier.

---

## Two independent axes people constantly conflate

**Code organization:** monorepo or polyrepo. Where the source lives.

**Runtime topology:** monolith or services. How many independently deployable units run.

These are orthogonal. All four combinations exist and three are common:

| | Monolith | Services |
|---|---|---|
| **Monorepo** | Default for most products. One repo, one deploy. | Google, Meta, Uber all run this. One repo, many deploys, shared tooling and atomic cross-service changes. |
| **Polyrepo** | Rare and usually accidental. | Common at large orgs with strong team boundaries. Independent release cycles, painful cross-cutting changes. |

"We need microservices, so we need multiple repos" does not follow. A monorepo with several deployable services is often the best of both — atomic refactors across service boundaries, one CI configuration, independent scaling.

**Choose runtime topology from scaling shape. Choose code organization from team structure.** They answer different questions.

---

## Runtime topology

### Monolith

One deployable unit. Everything in one process.

**Choose when:** one team, one product surface, shared datastore, and no component whose scaling profile differs sharply from the rest. This covers the large majority of systems, including many that are quite large.

**Ceiling:** deploys become contentious as team size grows; one component's resource appetite affects everything; a memory leak anywhere restarts everything.

**Do not underestimate it.** A well-organized monolith serving 100k users on one box is a completely respectable production system. Most microservice migrations are undertaken before the monolith was actually the problem.

### Modular monolith

One deployable unit with enforced internal module boundaries — separate schemas or table namespaces, no cross-module imports except through defined interfaces.

**Choose when:** you can see services in your future but do not need them yet. This is the highest-value default for a growing product, because it makes extraction cheap later without paying distribution costs now.

**Ceiling:** discipline. Boundaries erode unless enforced by tooling rather than convention.

### Services

Multiple independently deployable units.

**Choose when a component genuinely satisfies at least one:**

- **Different scaling shape.** Transcode workers scale on queue depth; the web tier scales on concurrent requests. Sharing a deployment unit means over-provisioning one to serve the other.
- **Different runtime requirements.** An ML inference path needs GPUs; the CRUD API does not.
- **Different availability requirements.** Payment processing must survive a deploy that takes the marketing site down.
- **Hard team boundaries.** Separate teams shipping on separate cadences with separate on-call.
- **Different language genuinely required.** A latency-critical path in Go beside a Python data pipeline.

**Do not split because:** the diagram looks tidier, microservices are modern, or the codebase feels large. Splitting turns function calls into network calls and adds partial failure, distributed tracing, versioned contracts, and eventual consistency between services that used to share a transaction. Pay that only for a stated reason.

**The honest test:** name the component, name which of the five conditions it meets, and name what breaks if it stays in the monolith. If you cannot, it stays.

### For large-system designs

When designing one subsystem of something like YouTube or Airbnb, services are usually correct — but the decomposition still has to be justified per boundary, and the subsystems you excluded become external dependencies with defined contracts. "Transcoding publishes `video.ready`; we consume it" is a real interface. A box labeled "transcoding service" with no contract is not.

---

## Language and framework

Choose on workload shape, team knowledge, and ecosystem — in that order of weight, unless the team constraint is absolute.

| Workload | Strong fits | Reasoning |
|---|---|---|
| CRUD web app, SEO matters | Next.js, Remix, Rails, Django | SSR out of the box, mature auth and ORM ecosystems, one language across the stack for Next |
| Internal tool, admin-heavy | Django, Rails, Laravel | Django admin alone can be worth the choice — hours instead of weeks for CRUD screens |
| API-only backend | FastAPI, Express/Hono, Go, Spring | No view layer needed; choose on team language and latency requirements |
| Data or ML pipeline | Python | Not close. The ecosystem is the entire reason. |
| High-throughput ingest, low latency | Go, Rust, Elixir | Predictable memory, cheap concurrency, no GC pauses at the p99 |
| Realtime, many persistent connections | Elixir/Phoenix, Go, Node | Connection-per-user at scale is a runtime property, not a framework choice |
| Heavy background jobs | Python (Celery), Ruby (Sidekiq), Go | Mature job runners with retry and scheduling semantics |
| Batch analytics | Python, SQL, Spark | SQL first; reach for Spark only past single-machine limits |

### Decision weights

**Team knowledge usually wins.** A team fluent in Python shipping FastAPI beats the same team learning Go, unless the profile has a latency or throughput line that Python genuinely cannot meet. "Better language" that nobody knows is slower in every dimension that matters for months.

**SEO and first-paint requirements force SSR.** A React SPA behind a CDN is fine for a dashboard behind a login and wrong for a public marketplace. If the profile mentions organic search or first-contentful-paint, that decides the frontend.

**One language across the stack is a real advantage for small teams.** Next.js everywhere means one toolchain, one dependency manager, one set of types shared between client and server. A team of two should weight this heavily. A team of thirty should not — specialization pays by then.

**Python's latency floor is real but usually irrelevant.** Python is genuinely slower per request than Go. It matters at high sustained throughput or tight p99 budgets. It does not matter for a CRUD app serving 50 requests a second, and choosing Go there trades ecosystem and hiring for headroom you will not use.

### Frontend

| Need | Fit |
|---|---|
| Public, SEO-sensitive, content-heavy | Next.js or Astro — SSR or static generation |
| Authenticated dashboard, no SEO | Vite SPA — simpler, no server rendering complexity |
| Content site, rarely changes | Astro or a static generator — ship HTML |
| Realtime collaborative UI | Client-heavy with a sync engine; SSR helps little here |

---

## Hosting shape follows runtime shape

| Runtime | Fits |
|---|---|
| Next.js, spiky traffic | Vercel, Netlify, Cloudflare — platform matches framework, zero ops |
| Any container, steady traffic | Fly, Railway, Render, ECS — cheaper than serverless above ~20-40% sustained utilization |
| Long-running jobs, over 15 min | Containers only — serverless duration caps make this a non-starter |
| Persistent connections (WebSocket) | Containers — serverless is billed and shaped wrong for held connections |
| GPU inference | Dedicated GPU hosts, Modal, Replicate |

**The serverless crossover is the recurring mistake.** Serverless wins for spiky and low-volume workloads and loses badly for sustained ones. Compute both numbers whenever traffic is steady — this is where a default costs real money without anyone noticing.

---

## Repository shape by team size

| Team | Shape |
|---|---|
| 1-3 | Monorepo, monolith. Anything else is overhead with no payer. |
| 4-15 | Monorepo, modular monolith. Extract a service only when one clears the five-condition test. |
| 15-50 | Monorepo, several services split on scaling shape. |
| 50+ | Either, driven by org boundaries and release independence more than by technology. |

Team size belongs in the requirements profile precisely because it decides this table, and this table has more effect on daily life than the database choice does.
