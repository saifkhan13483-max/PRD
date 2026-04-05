# PRD: WhatsApp Remote Desktop Control System
**Version:** 3.0 | **Target:** Windows PC (Unlimited Scale, Multi-Tenant) | **Deployment:** Cloud-Native, Globally Distributed

---

## 1. Product Vision

A horizontally scalable, cloud-native, multi-tenant remote desktop control platform where any number of Windows PCs can be registered and controlled by their owner through WhatsApp. Commands route through a stateless API gateway to the correct machine in real time. Designed to grow from 1 PC to millions without re-architecture, supporting global distribution, fault tolerance, and zero-downtime deployments.

---

## 2. Scalable Architecture (v3.0)

```
[Owner's Phone]
     │ WhatsApp Message (e.g., "@office !screenshot")
     ▼
[WhatsApp Business Cloud API]
     │ Webhook (HTTPS POST)
     ▼
┌─────────────────────────────────────────────────────────┐
│              EDGE / CDN LAYER                            │
│  Cloudflare WAF + DDoS + IP Allowlist (Meta ranges)     │
│  • TLS termination at edge                              │
│  • Rate limiting before origin                          │
│  • Geo-routing to nearest region                        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│         API GATEWAY MICROSERVICE (Stateless)             │
│  Node.js 20 + Fastify — horizontally auto-scaled        │
│  • HMAC webhook auth + phone allowlist                  │
│  • Command parser + PC router                           │
│  • Redis sliding-window rate limiter                    │
│  • JWT device cert validation                           │
│  • OpenTelemetry instrumentation                        │
│  • Feature flags (LaunchDarkly / Unleash)               │
└─────────────────┬───────────────────────────────────────┘
                  │ Publish event
                  ▼
┌─────────────────────────────────────────────────────────┐
│         EVENT STREAMING LAYER                            │
│  Apache Kafka (production) / Redis Streams (MVP)        │
│  • Topic per PC-group (sharded by owner_id)             │
│  • Dead-letter topics for failed commands               │
│  • At-least-once delivery with idempotency keys         │
│  • Retention: 7 days for replay / audit                 │
│  • Consumer groups per region                           │
└─────────────────┬───────────────────────────────────────┘
                  │ WSS / Long-poll per PC
                  ▼
┌─────────────────────────────────────────────────────────┐
│       WINDOWS DESKTOP AGENTS (N PCs)                     │
│  Python 3.11 background service                         │
│  • Registers with unique PC ID on startup               │
│  • Persistent encrypted WSS connection (mTLS)           │
│  • Executes commands in isolated subprocess             │
│  • Streams results back via response topic              │
│  • Circuit breaker on repeated command failures         │
│  • Self-heals: exponential backoff reconnect            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│         RESPONSE ROUTER MICROSERVICE                     │
│  • Consumes result events from Kafka                    │
│  • Routes reply to correct WhatsApp thread              │
│  • Uploads media to CDN (S3 / Cloudflare R2)           │
│  • Sends reply via WhatsApp Cloud API                   │
│  • Timeout escalation: notifies user if PC unreachable  │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
         [Owner's Phone — Reply]
```

---

## 3. Microservices Breakdown

| Service | Responsibility | Scale Strategy |
|---|---|---|
| **api-gateway** | Webhook ingestion, auth, routing | Stateless; HPA on CPU/RPS |
| **command-router** | Parse command, resolve PC, publish to Kafka | Stateless; HPA |
| **agent-relay** | Maintain WSS connections to desktop agents | Sticky sessions; scale by PC count |
| **response-router** | Consume results, send WhatsApp replies | Stateless; HPA |
| **media-uploader** | Receive binary payloads, upload to CDN | Stateless; HPA |
| **scheduler** | Cron job management per PC | Single-leader via distributed lock |
| **pc-registry** | CRUD for PC metadata, online status | Read replicas for list queries |
| **auth-service** | JWT issuance, device cert rotation, phone allowlist | Stateless; cached certs in Redis |
| **notification-service** | WhatsApp reply batching and rate management | Queue-backed, retry logic |
| **observability-collector** | Prometheus, Loki, OpenTelemetry aggregation | Sidecar pattern |

---

## 4. Core Features

| Feature | Description | Scale Factor |
|---|---|---|
| **Multi-PC Registry** | Register unlimited PCs; address by alias (`@home`, `@office`) | DB-backed per tenant |
| **Multi-Tenant Isolation** | Each user's PCs, logs, and commands are fully isolated | Tenant-scoped DB partitions |
| **Command Execution** | Shell, open/close apps, file ops | Per-PC isolated queue |
| **Screenshot on Demand** | Capture → compress → CDN upload → WhatsApp image | CDN scales globally |
| **System Status** | CPU, RAM, disk, battery, network latency | Streamed via WebSocket |
| **Browser Control** | Open URLs, manage tabs via Chrome DevTools Protocol | Per-PC agent |
| **Mouse & Keyboard** | Remote cursor, click, type via pyautogui | Per-PC agent |
| **File Access** | List, read, upload/download via cloud buffer | Object storage (S3/R2) |
| **Live Screen Stream** | MJPEG/WebRTC stream, CDN-distributed | Media server (optional) |
| **Scheduled Commands** | Cron-style commands run at set times | Temporal.io distributed scheduler |
| **Command History** | Full searchable log of all commands per PC | PostgreSQL partitioned table |
| **Event Replay** | Replay any command sequence from Kafka history | 7-day Kafka retention |
| **Multi-Region Routing** | Route commands to nearest cloud region | Geo-aware DNS + Cloudflare |
| **Graceful Degradation** | Queue commands when PC is offline; deliver on reconnect | Kafka persistence |

---

## 5. Security Requirements (Non-Negotiable)

- **Allowlist Auth:** Only registered WhatsApp numbers accepted; all others silently dropped + logged
- **HMAC Verification:** Every webhook validated with WhatsApp signature secret (replay window: 5 min)
- **Command Allowlist:** Predefined commands only; raw shell gated behind explicit unlock passphrase
- **mTLS:** Mutual TLS between Desktop Agent and cloud backend — agent certificates rotated every 30 days via automated cert manager
- **AES-256-GCM Payload Encryption:** Command payloads encrypted end-to-end with per-session keys
- **Zero-Trust PC Identity:** Each PC holds a signed JWT device certificate; server verifies on every connection; certificate revocation list (CRL) maintained
- **Tenant Isolation:** Database row-level security (RLS) enforced at PostgreSQL level; no cross-tenant data access possible
- **Activity Log:** Every command logged with timestamp, PC ID, command, result, duration — immutable, append-only, Kafka-backed
- **Auto-Lock:** Agent locks after 5 unknown commands; reactivation requires OTP via WhatsApp
- **Rate Limiting:** 30 commands/min per session (Redis sliding window); global 500 commands/day per account
- **DDoS Protection:** API gateway behind Cloudflare WAF + edge; webhook IPs allowlisted to Meta's published ranges
- **Secret Rotation:** All service-to-service tokens auto-rotated every 24 hours via Vault or AWS Secrets Manager
- **Audit Trail:** All authentication events and permission changes written to separate immutable audit log

---

## 6. Tech Stack

| Layer | Technology | Scalability Approach |
|---|---|---|
| **Desktop Agent** | Python 3.11 (`pyautogui`, `pywin32`, `websockets`, `PIL`, `psutil`) | N independent agents; self-healing |
| **API Gateway** | Node.js 20 + Fastify | Stateless; HPA on CPU + RPS |
| **Event Streaming** | Apache Kafka (prod) / Redis Streams (MVP) | Partitioned topics; consumer groups |
| **Message Broker** | Redis Pub/Sub (MVP) → Kafka (scale) | Sharded by owner_id |
| **Real-Time Channel** | WebSocket (WSS/mTLS) + heartbeat every 30s | One WSS conn per PC; sticky agent-relay |
| **Database** | PostgreSQL 16 (partitioned) + PgBouncer + read replicas | Tenant partitioning; connection pooling |
| **Cache** | Redis Cluster (sessions, rate limits, PC status) | Sharded; read-through cache pattern |
| **File/Media Storage** | Cloudflare R2 / AWS S3 Multi-Region | Global CDN; signed URLs |
| **Screen Stream** | OpenCV MJPEG → WebRTC | TURN/STUN server; media relay |
| **Scheduler** | Temporal.io (distributed workflows) | Fault-tolerant, durable execution |
| **Auth** | JWT device certs + HMAC + phone allowlist + Vault | Stateless JWT; cert rotation automated |
| **Service Mesh** | Istio or Linkerd (production) | mTLS between services; traffic policies |
| **Observability** | Prometheus + Grafana + Loki + Jaeger + OpenTelemetry | Centralised; per-region collectors |
| **Deployment** | Docker + Helm + Kubernetes (GKE / EKS) | HPA + VPA; blue-green deployments |
| **CDN/Edge** | Cloudflare (WAF + Workers + R2) | Global edge; geo-routing |
| **Feature Flags** | Unleash (self-hosted) or LaunchDarkly | Gradual rollouts; kill switches |
| **CI/CD** | GitHub Actions + ArgoCD (GitOps) | Automated, auditable deployments |

---

## 7. Database Schema (Scalable)

```sql
-- Tenants (one per WhatsApp account owner)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'free',     -- free | pro | enterprise
  max_pcs INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registered PCs (partitioned by tenant_id for scale)
CREATE TABLE pcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  device_cert TEXT NOT NULL,
  last_seen TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  region VARCHAR(20),                  -- us-east-1, eu-west-1, etc.
  agent_version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
) PARTITION BY HASH (tenant_id);

-- Command log (partitioned by month for efficient archival)
CREATE TABLE command_log (
  id BIGSERIAL,
  pc_id UUID REFERENCES pcs(id),
  tenant_id UUID REFERENCES tenants(id),
  command TEXT NOT NULL,
  result TEXT,
  status VARCHAR(20),                  -- success | failed | timeout | queued
  latency_ms INT,
  idempotency_key UUID UNIQUE,         -- prevents duplicate execution
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Scheduled commands
CREATE TABLE scheduled_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_id UUID REFERENCES pcs(id),
  tenant_id UUID REFERENCES tenants(id),
  cron_expr VARCHAR(100),
  command TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ
);

-- Device certificates (for revocation tracking)
CREATE TABLE device_certs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pc_id UUID REFERENCES pcs(id),
  cert_fingerprint TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

-- Row-level security: tenants can only see their own data
ALTER TABLE pcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_commands ENABLE ROW LEVEL SECURITY;
```

---

## 8. Auto-Scaling Policies

### Kubernetes HPA Configuration

| Service | Scale Trigger | Min Replicas | Max Replicas |
|---|---|---|---|
| api-gateway | CPU > 60% OR RPS > 500/pod | 2 | 50 |
| command-router | CPU > 70% OR queue depth > 1000 | 2 | 30 |
| agent-relay | PC connections > 500/pod | 2 | 100 |
| response-router | Kafka consumer lag > 500 | 2 | 20 |
| media-uploader | CPU > 80% | 1 | 20 |

### Kafka Partition Strategy

- **Topics:** `commands.<region>`, `results.<region>`, `dead-letter`, `audit`
- **Partitions:** 1 partition per 1,000 expected concurrent PCs
- **Replication Factor:** 3 (fault-tolerant across availability zones)
- **Consumer Groups:** One per microservice type + one per region

---

## 9. Resilience & Fault Tolerance

| Pattern | Implementation | Benefit |
|---|---|---|
| **Circuit Breaker** | Resilience4j / custom Python decorator | Stops cascade failures to offline PCs |
| **Retry with Backoff** | Exponential backoff (1s, 2s, 4s, max 30s) | Handles transient failures gracefully |
| **Dead Letter Queue** | Kafka DLQ topic + alerting | Failed commands captured for inspection |
| **Idempotency Keys** | UUID per command; checked before execution | Prevents duplicate command execution |
| **Graceful Degradation** | Commands queued in Kafka when PC offline | Delivered on reconnect (up to 7 days) |
| **Health Checks** | `/health` + `/ready` on every service | Kubernetes liveness + readiness probes |
| **Bulkhead Isolation** | Separate thread pools per tenant tier | Pro/enterprise tenants unaffected by free-tier load |
| **Chaos Engineering** | Chaos Monkey / LitmusChaos in staging | Validates resilience before production |

---

## 10. Multi-Region Deployment

```
Region: us-east-1 (Primary)
  ├── API Gateway cluster (3–50 pods)
  ├── Kafka cluster (3 brokers)
  ├── PostgreSQL primary + 2 read replicas
  ├── Redis Cluster (3 shards)
  └── Agent Relay cluster

Region: eu-west-1 (Secondary)
  ├── API Gateway cluster (mirror)
  ├── Kafka cluster (mirrors us-east-1 via MirrorMaker 2)
  ├── PostgreSQL read replica (promoted to primary on failover)
  ├── Redis Cluster
  └── Agent Relay cluster

Region: ap-southeast-1 (Secondary)
  └── (same as eu-west-1 pattern)

Geo-routing:
  • Cloudflare geo-DNS routes WhatsApp webhooks to nearest region
  • Desktop agents connect to nearest agent-relay via latency-based DNS
  • Failover: automatic region failover within 60 seconds
```

---

## 11. Command Reference (v3.0)

```
-- PC Management --
!register <name>       → Register this PC under alias (e.g., !register office)
!list                  → List all your registered PCs and their online status
!switch <name>         → Set default active PC for this session
!rename <old> <new>    → Rename a registered PC

-- @<pc> prefix routes to a specific PC (e.g., @office !screenshot) --

!status                → CPU, RAM, disk, battery, uptime, network
!screenshot            → Capture + CDN upload + WhatsApp reply
!run <app>             → Open application by name
!close <app>           → Close application by name
!files <path>          → List directory contents
!type <text>           → Type text at cursor
!click <x> <y>         → Click screen coordinate
!url <link>            → Open URL in default browser
!stream                → Start live MJPEG stream (60s), returns URL
!lock                  → Lock PC screen
!shutdown [code]       → Shutdown (requires one-time confirm code)
!schedule <cron> <cmd> → Schedule recurring command
!unschedule <id>       → Cancel a scheduled command
!log [n]               → Last N activity log entries (default 10)
!ping                  → Latency check (round-trip ms)
!replay <cmd_id>       → Re-run a previous command by ID
!help                  → List all commands
```

---

## 12. Implementation Phases

### Phase 1 — Core MVP (Weeks 1–2)
- [ ] WhatsApp webhook server with HMAC auth + phone allowlist
- [ ] Single-PC WebSocket channel (server ↔ agent)
- [ ] Desktop agent: install, auto-start on Windows boot
- [ ] Commands: `!status`, `!screenshot`, `!run`, `!close`, `!files`
- [ ] PostgreSQL schema + command log + tenant table
- [ ] Screenshot → S3/R2 → WhatsApp media reply
- [ ] Redis Streams as lightweight event bus

### Phase 2 — Multi-PC + Broker (Weeks 3–4)
- [ ] PC registry (`!register`, `!list`, `!switch`)
- [ ] Kafka event streaming with per-PC partitioning
- [ ] `@<pc>` routing in command parser
- [ ] Rate limiting (Redis sliding window)
- [ ] JWT device certificates for agent authentication
- [ ] Idempotency keys for all command events
- [ ] Microservice split: api-gateway, command-router, response-router

### Phase 3 — Advanced Control (Weeks 5–6)
- [ ] `!type`, `!click`, `!url`, `!stream` (MJPEG)
- [ ] Browser tab control via Chrome DevTools Protocol
- [ ] Scheduled commands via Temporal.io
- [ ] mTLS between agent and server
- [ ] AES-256-GCM payload encryption layer
- [ ] Circuit breaker + retry logic on all agent connections
- [ ] Dead-letter queue + alerting

### Phase 4 — Scale & Observability (Weeks 7–8)
- [ ] Horizontal API gateway scaling (Kubernetes + HPA)
- [ ] Prometheus + Grafana + Loki + Jaeger + OpenTelemetry
- [ ] Row-level security + tenant isolation
- [ ] PostgreSQL table partitioning (by tenant + by month)
- [ ] Multi-region deployment (us-east-1 + eu-west-1)
- [ ] Chaos engineering tests (LitmusChaos)
- [ ] Feature flags rollout (Unleash)
- [ ] Windows `.exe` installer (NSIS/Inno Setup) with auto-update

### Phase 5 — Enterprise & Global Scale (Weeks 9–12)
- [ ] Third region (ap-southeast-1) + global geo-routing
- [ ] Service mesh (Istio) with traffic policies
- [ ] Kafka MirrorMaker 2 for cross-region replication
- [ ] Automated cert rotation via cert-manager / Vault
- [ ] Bulkhead isolation per tenant tier (free / pro / enterprise)
- [ ] SLA dashboard + uptime status page
- [ ] Load testing: 100,000 concurrent PCs simulation
- [ ] WebRTC live stream migration (TURN/STUN)

---

## 13. Deployment Model

| Component | MVP | Scale (v3+) |
|---|---|---|
| **Cloud Server** | Replit Deploy (always-on) | Kubernetes (GKE / EKS) multi-region |
| **Event Bus** | Redis Streams | Apache Kafka (partitioned, replicated) |
| **Database** | PostgreSQL single | PostgreSQL partitioned + PgBouncer + read replicas |
| **Cache** | Redis single | Redis Cluster (sharded) |
| **Media Storage** | Cloudflare R2 | R2 / S3 multi-region + CDN |
| **Desktop Agent** | `.exe` installer, Windows Task Scheduler | Auto-update via GitHub Releases + Sparkle |
| **Service Mesh** | None (MVP) | Istio with mutual TLS between all services |
| **Edge** | Replit domain | Cloudflare WAF + geo-routing + DDoS |
| **Secrets** | Environment variables | HashiCorp Vault / AWS Secrets Manager |
| **CI/CD** | Manual / GitHub Actions | ArgoCD GitOps + automated canary releases |

---

## 14. Non-Functional Requirements

| Metric | Target |
|---|---|
| Command round-trip latency | < 3 seconds (p95) |
| Screenshot delivery | < 5 seconds including upload |
| Agent reconnect after network drop | < 10 seconds |
| API gateway uptime | 99.9% (99.99% with multi-region) |
| Max concurrent PCs per user | 50 (v1), unlimited (v3+) |
| Max concurrent PCs system-wide | 1,000,000+ with horizontal scaling |
| Command throughput | 100,000 commands/min system-wide |
| Region failover time | < 60 seconds |
| Zero unauthorized executions | 100% — any breach triggers immediate agent shutdown |
| Data residency | EU data stays in eu-west-1; configurable per tenant |
| RTO (Recovery Time Objective) | < 5 minutes for full region failure |
| RPO (Recovery Point Objective) | < 30 seconds (Kafka-backed) |

---

## 15. Scalability Levers (Summary)

1. **Stateless API Gateway** — add instances behind a load balancer; Kubernetes HPA scales on CPU/RPS
2. **Kafka Event Streaming** — partitioned by owner_id; consumer groups scale horizontally; 7-day replay window
3. **Tenant Isolation** — PostgreSQL partitioning by tenant; row-level security; bulkhead per tier
4. **CDN for Media** — screenshots/streams served from edge, never bottlenecking the API
5. **Read Replicas + PgBouncer** — PostgreSQL read replicas for log queries; connection pooling handles burst
6. **Agent Self-Healing** — lost connections use exponential backoff; circuit breakers prevent cascade failures
7. **Idempotency** — UUID-keyed commands prevent duplicate execution during retries at any scale
8. **Multi-Region** — geo-routing directs traffic to nearest region; automatic failover under 60 seconds
9. **Feature Flags** — new features rolled out gradually; instant kill switch without redeployment
10. **Chaos Testing** — resilience validated continuously in staging before any production promotion

---

## 16. Out of Scope (v3.0)

- iOS/Android mobile agent
- GUI web dashboard (WhatsApp + CLI only in this version)
- Voice command support
- Video recording (screenshots and live stream only)
- On-premise Kafka management (use managed Confluent Cloud / MSK)
