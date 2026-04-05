# PRD: WhatsApp Remote Desktop Control System
**Version:** 4.0 — Apex Edition | **Codename:** NEXUS
**Target:** Windows / macOS / Linux (Unlimited Scale, Multi-Tenant, AI-Powered)
**Deployment:** Cloud-Native, Globally Distributed, Zero-Downtime

---

## 1. Executive Summary

NEXUS is the world's most capable WhatsApp-native remote control platform. It transforms any smartphone into a full-power remote operations center — controlling unlimited PCs via natural language, AI automation, real-time streaming, and enterprise-grade security. Built to scale from a single developer's machine to a Fortune 500 fleet without re-architecture.

> **Core Promise:** Type a message on WhatsApp. Your PC responds in under 2 seconds — anywhere on Earth.

---

## 2. Product Vision

A horizontally scalable, AI-augmented, cloud-native, multi-tenant remote desktop platform where unlimited machines across any OS are registered, monitored, and controlled through WhatsApp. Commands are parsed by AI, routed through a stateless API gateway in real time, and executed on the correct machine via encrypted WebSocket tunnels. Designed for individuals, power users, and enterprise IT teams alike.

---

## 3. System Architecture (v4.0 — Apex)

```
[Owner's Phone]
     │  WhatsApp Message (Natural Language or Command)
     ▼
[WhatsApp Business Cloud API]
     │  Webhook (HTTPS POST, signed)
     ▼
┌────────────────────────────────────────────────────────────┐
│                    EDGE / CDN LAYER                         │
│  Cloudflare WAF + DDoS Shield + IP Allowlist (Meta ranges) │
│  • TLS 1.3 termination at edge                             │
│  • Smart rate limiting before origin                       │
│  • Geo-routing to nearest healthy region                   │
│  • Bot protection + anomaly scoring                        │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│          AI COMMAND INTELLIGENCE LAYER                      │
│  LLM Intent Parser (GPT-4o / Claude 3.5) — Optional        │
│  • Natural language → structured command                   │
│  • Context awareness (last 10 commands per session)        │
│  • Auto-suggest corrections for typos                      │
│  • Multi-step workflow extraction                          │
│  • Guardrails: blocks dangerous or unrecognized intents    │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│         API GATEWAY MICROSERVICE (Stateless)                │
│  Node.js 20 + Fastify — horizontally auto-scaled           │
│  • HMAC webhook auth + phone allowlist                     │
│  • Command parser + multi-PC router                        │
│  • Redis sliding-window rate limiter                       │
│  • JWT device cert validation                              │
│  • OpenTelemetry instrumentation                           │
│  • Feature flags (Unleash / LaunchDarkly)                  │
└──────────────────────┬─────────────────────────────────────┘
                       │  Publish event
                       ▼
┌────────────────────────────────────────────────────────────┐
│              EVENT STREAMING LAYER                          │
│  Apache Kafka (production) / Redis Streams (MVP)           │
│  • Topic per PC-group (sharded by owner_id)                │
│  • Dead-letter topics for failed commands                  │
│  • At-least-once delivery with idempotency keys            │
│  • 7-day retention for replay / audit                      │
│  • Consumer groups per region                              │
└──────────────────────┬─────────────────────────────────────┘
                       │  WSS / Long-poll per machine
                       ▼
┌────────────────────────────────────────────────────────────┐
│         DESKTOP AGENTS (N Machines — Any OS)                │
│  Python 3.11 background service (Windows / macOS / Linux)  │
│  • Registers with unique machine ID on startup             │
│  • Persistent encrypted WSS connection (mTLS)              │
│  • Executes commands in isolated subprocess                │
│  • AI macro executor (multi-step workflows)                │
│  • Streams results back via response topic                 │
│  • Circuit breaker on repeated failures                    │
│  • Self-heals: exponential backoff reconnect               │
│  • Tamper detection + process integrity check              │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│          RESPONSE ROUTER MICROSERVICE                       │
│  • Consumes result events from Kafka                       │
│  • Routes reply to correct WhatsApp thread                 │
│  • Uploads media to Cloudinary (auto-optimised + CDN)      │
│  • Sends reply via WhatsApp Cloud API                      │
│  • Timeout escalation: notifies user if PC unreachable     │
│  • Smart formatting: tables, code blocks, emoji status     │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼
              [Owner's Phone — Reply]
```

---

## 4. Microservices Breakdown

| Service | Responsibility | Scale Strategy |
|---|---|---|
| **api-gateway** | Webhook ingestion, auth, routing | Stateless; HPA on CPU/RPS |
| **ai-parser** | NL→command via LLM + context memory | Stateless; cached embeddings in Redis |
| **command-router** | Parse command, resolve PC, publish to Kafka | Stateless; HPA |
| **agent-relay** | Maintain WSS connections to desktop agents | Sticky sessions; scale by PC count |
| **response-router** | Consume results, send WhatsApp replies | Stateless; HPA |
| **media-uploader** | Receive binary payloads, upload to Cloudinary | Stateless; HPA |
| **macro-engine** | Multi-step workflow orchestration | Temporal.io durable workflows |
| **scheduler** | Cron job management per PC | Single-leader via distributed lock |
| **pc-registry** | CRUD for machine metadata, online status | Read replicas for list queries |
| **auth-service** | JWT issuance, device cert rotation, phone allowlist | Stateless; cached certs in Redis |
| **notification-service** | WhatsApp reply batching and rate management | Queue-backed, retry logic |
| **web-dashboard** | Real-time browser-based control panel | React SPA + WebSocket feed |
| **analytics-service** | Usage metrics, trends, alerts | ClickHouse + Grafana |
| **observability-collector** | Prometheus, Loki, OpenTelemetry aggregation | Sidecar pattern |

---

## 5. Core Features (v4.0)

### 5.1 Remote Control
| Feature | Description | Platform |
|---|---|---|
| **Command Execution** | Shell, open/close apps, file ops, process management | All OS |
| **Screenshot on Demand** | Capture → compress → Cloudinary → WhatsApp image reply | All OS |
| **Live Screen Stream** | MJPEG or WebRTC stream, CDN-distributed, up to 30fps | All OS |
| **Mouse & Keyboard** | Remote cursor, click, type, hotkeys, scroll | All OS |
| **Browser Control** | Open URLs, manage tabs via Chrome DevTools Protocol | All OS |
| **File Access** | List, read, upload/download files via cloud buffer | All OS |
| **Clipboard Sync** | Get/set clipboard content remotely | All OS |
| **Window Management** | Minimize, maximize, tile, move, snap windows | All OS |

### 5.2 AI & Automation
| Feature | Description |
|---|---|
| **Natural Language Commands** | "open Chrome and search for latest AI news" → parsed automatically |
| **Multi-Step Macros** | Record + replay complex workflows triggered by a single message |
| **AI Context Memory** | Last 10 commands per session remembered for smarter parsing |
| **Smart Autocorrect** | Typos and ambiguous commands auto-corrected with confirmation |
| **Scheduled Automation** | Cron-style + natural language schedules ("every weekday at 9am") |
| **Trigger Chains** | If [event] then [command] — event-driven automation |
| **AI Error Recovery** | If a command fails, AI suggests fixes or retries alternatives |

### 5.3 Monitoring & Alerts
| Feature | Description |
|---|---|
| **System Status** | CPU, RAM, disk, battery, network, temperature |
| **Process Monitor** | List, kill, or prioritize running processes |
| **Proactive Alerts** | Notify via WhatsApp if CPU > threshold, disk full, PC goes offline |
| **Command History** | Full searchable log per machine — 90-day retention |
| **Analytics Dashboard** | Usage heatmaps, command frequency, machine health over time |

### 5.4 Security & Access Control
| Feature | Description |
|---|---|
| **Multi-User Access** | Grant access to other WhatsApp numbers with role-based permissions |
| **Role Profiles** | Admin, Operator (no shell), View-only, Custom |
| **Session Recording** | All commands and screen captures logged per session |
| **Emergency Kill Switch** | Single command to lock all agents system-wide |
| **Geo-Fencing** | Block commands originating outside allowed countries |

### 5.5 Web Dashboard
| Feature | Description |
|---|---|
| **Live Machine Grid** | Real-time status cards for all registered machines |
| **Browser-Based Control** | Type commands, view screenshots, stream screen via browser |
| **Visual Command Builder** | Drag-and-drop macro builder with no-code interface |
| **Audit Log Viewer** | Filter, search, export command logs with full metadata |
| **Team Management** | Invite teammates, assign roles, manage access per machine |

---

## 6. Security Requirements (Non-Negotiable)

- **Allowlist Auth:** Only registered WhatsApp numbers accepted; all others silently dropped and logged
- **HMAC Verification:** Every webhook validated with WhatsApp signature secret (5-minute replay window)
- **Command Allowlist:** Predefined commands only; raw shell gated behind explicit unlock passphrase
- **mTLS:** Mutual TLS between Desktop Agent and cloud backend — certs auto-rotated every 30 days
- **AES-256-GCM Payload Encryption:** All command payloads encrypted end-to-end with per-session keys
- **Zero-Trust Machine Identity:** Each machine holds a signed JWT device certificate; CRL maintained
- **Tenant Isolation:** PostgreSQL row-level security (RLS) enforced at DB level; zero cross-tenant leakage
- **Role-Based Access Control:** Per-machine permission profiles; least-privilege by default
- **Activity Log:** Every command logged immutably — timestamp, machine ID, user, command, result, duration
- **Auto-Lock:** Agent locks after 5 unknown commands; reactivation requires OTP via WhatsApp
- **Session Timeout:** Inactive sessions auto-expire after 30 minutes; configurable per tenant
- **Rate Limiting:** 30 commands/min per session (Redis sliding window); 500 commands/day per account
- **DDoS Protection:** API gateway behind Cloudflare WAF + edge; webhook IPs allowlisted to Meta ranges
- **Secret Rotation:** All service-to-service tokens auto-rotated every 24h via Vault / AWS Secrets Manager
- **Audit Trail:** All auth events and permission changes written to separate immutable audit log
- **Tamper Detection:** Agent detects binary modification and refuses to start; reports via secure channel
- **Geo-Fencing:** Optional per-tenant restriction of accepted command origins by country/region
- **Anomaly Detection:** ML-based detection of unusual command patterns; auto-alerts + optional block

---

## 7. Tech Stack

| Layer | Technology | Scalability Approach |
|---|---|---|
| **Desktop Agent** | Python 3.11 (`pyautogui`, `pywin32`, `websockets`, `PIL`, `psutil`) | N independent agents; self-healing |
| **AI Parser** | OpenAI GPT-4o / Anthropic Claude 3.5 (switchable) | Stateless; prompt-cached; Redis context store |
| **API Gateway** | Node.js 20 + Fastify | Stateless; HPA on CPU + RPS |
| **Web Dashboard** | React 18 + Vite + TailwindCSS + shadcn/ui | SPA; WebSocket real-time feed |
| **Event Streaming** | Apache Kafka (prod) / Redis Streams (MVP) | Partitioned topics; consumer groups |
| **Real-Time Channel** | WebSocket (WSS/mTLS) + heartbeat every 30s | One WSS conn per machine; sticky agent-relay |
| **Database** | PostgreSQL 16 (partitioned) + PgBouncer + read replicas | Tenant partitioning; connection pooling |
| **Analytics DB** | ClickHouse (columnar, fast aggregation) | Append-only; sharded by tenant |
| **Cache** | Redis Cluster (sessions, rate limits, PC status, AI context) | Sharded; read-through cache pattern |
| **File/Media Storage** | Cloudinary (images, screenshots, raw files) | Built-in CDN; auto-optimisation; signed URLs |
| **Screen Stream** | OpenCV MJPEG → WebRTC | TURN/STUN server; media relay |
| **Scheduler** | Temporal.io (distributed durable workflows) | Fault-tolerant; retryable |
| **Auth** | JWT device certs + HMAC + phone allowlist + Vault | Stateless JWT; cert rotation automated |
| **Service Mesh** | Istio (production) | mTLS between all services; traffic policies |
| **Observability** | Prometheus + Grafana + Loki + Jaeger + OpenTelemetry | Centralised; per-region collectors |
| **Deployment** | Docker + Helm + Kubernetes (GKE / EKS) | HPA + VPA; blue-green deployments |
| **CDN/Edge** | Cloudflare WAF + Workers + Cloudinary CDN | Global edge; geo-routing; media optimisation |
| **Feature Flags** | Unleash (self-hosted) or LaunchDarkly | Gradual rollouts; instant kill switches |
| **CI/CD** | GitHub Actions + ArgoCD (GitOps) | Automated, auditable, zero-downtime deployments |

---

## 8. Database Schema (Scalable)

```sql
-- Tenants (one per WhatsApp account owner)
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  plan          VARCHAR(20) DEFAULT 'free',      -- free | pro | enterprise
  max_machines  INT DEFAULT 5,
  ai_enabled    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Registered Machines (partitioned by tenant_id for scale)
CREATE TABLE machines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(50) NOT NULL,
  os             VARCHAR(20),                    -- windows | macos | linux
  device_cert    TEXT NOT NULL,
  last_seen      TIMESTAMPTZ,
  is_online      BOOLEAN DEFAULT false,
  region         VARCHAR(20),                    -- us-east-1, eu-west-1, etc.
  agent_version  VARCHAR(20),
  ip_address     INET,
  tags           TEXT[],
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
) PARTITION BY HASH (tenant_id);

-- Access Grants (multi-user per tenant)
CREATE TABLE access_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  phone       VARCHAR(20) NOT NULL,
  role        VARCHAR(20) DEFAULT 'operator',    -- admin | operator | viewer | custom
  machine_ids UUID[],                            -- NULL = all machines
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

-- Command Log (partitioned by month for efficient archival)
CREATE TABLE command_log (
  id              BIGSERIAL,
  machine_id      UUID REFERENCES machines(id),
  tenant_id       UUID REFERENCES tenants(id),
  actor_phone     VARCHAR(20),
  command         TEXT NOT NULL,
  raw_input       TEXT,                          -- original NL input if AI-parsed
  result          TEXT,
  status          VARCHAR(20),                   -- success | failed | timeout | queued
  latency_ms      INT,
  idempotency_key UUID UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Macros (multi-step workflows)
CREATE TABLE macros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  name        VARCHAR(100) NOT NULL,
  trigger     TEXT,                              -- command alias to invoke macro
  steps       JSONB NOT NULL,                   -- ordered list of commands
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Commands
CREATE TABLE scheduled_commands (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   UUID REFERENCES machines(id),
  tenant_id    UUID REFERENCES tenants(id),
  cron_expr    VARCHAR(100),
  nl_schedule  TEXT,                            -- "every weekday at 9am"
  command      TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  next_run_at  TIMESTAMPTZ,
  last_run_at  TIMESTAMPTZ
);

-- Alert Rules
CREATE TABLE alert_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  UUID REFERENCES machines(id),
  tenant_id   UUID REFERENCES tenants(id),
  metric      VARCHAR(50),                      -- cpu | ram | disk | offline
  threshold   NUMERIC,
  condition   VARCHAR(10),                      -- gt | lt | eq
  action      TEXT,                             -- whatsapp_notify | kill_session
  is_active   BOOLEAN DEFAULT true
);

-- Device Certificates (for revocation tracking)
CREATE TABLE device_certs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id      UUID REFERENCES machines(id),
  cert_fingerprint TEXT UNIQUE NOT NULL,
  issued_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT
);

-- Row-level security: tenants only see their own data
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;
```

---

## 9. Auto-Scaling Policies

### Kubernetes HPA Configuration

| Service | Scale Trigger | Min Pods | Max Pods |
|---|---|---|---|
| api-gateway | CPU > 60% OR RPS > 500/pod | 2 | 50 |
| ai-parser | CPU > 70% OR queue depth > 200 | 2 | 20 |
| command-router | CPU > 70% OR queue depth > 1,000 | 2 | 30 |
| agent-relay | Machine connections > 500/pod | 2 | 100 |
| response-router | Kafka consumer lag > 500 | 2 | 20 |
| media-uploader | CPU > 80% | 1 | 20 |
| web-dashboard | CPU > 60% | 2 | 10 |

### Kafka Partition Strategy

- **Topics:** `commands.<region>`, `results.<region>`, `macros`, `dead-letter`, `audit`, `alerts`
- **Partitions:** 1 partition per 1,000 expected concurrent machines
- **Replication Factor:** 3 (fault-tolerant across availability zones)
- **Consumer Groups:** One per microservice type, one per region

---

## 10. Resilience & Fault Tolerance

| Pattern | Implementation | Benefit |
|---|---|---|
| **Circuit Breaker** | Resilience4j / custom Python decorator | Stops cascade failures to offline machines |
| **Retry with Backoff** | Exponential backoff (1s → 2s → 4s → max 30s) | Handles transient failures gracefully |
| **Dead Letter Queue** | Kafka DLQ topic + alerting | Failed commands captured for inspection |
| **Idempotency Keys** | UUID per command; checked before execution | Prevents duplicate command execution |
| **Graceful Degradation** | Commands queued in Kafka when machine offline | Delivered on reconnect (up to 7 days) |
| **Health Checks** | `/health` + `/ready` on every service | Kubernetes liveness + readiness probes |
| **Bulkhead Isolation** | Separate thread pools per tenant tier | Pro/enterprise unaffected by free-tier load |
| **Chaos Engineering** | LitmusChaos in staging | Validates resilience before production |
| **Tamper Detection** | Agent integrity hash on startup | Refuses to run if binary modified |

---

## 11. Multi-Region Deployment

```
Region: us-east-1 (Primary)
  ├── API Gateway cluster (2–50 pods)
  ├── AI Parser cluster (2–20 pods)
  ├── Kafka cluster (3 brokers, 3x replication)
  ├── PostgreSQL primary + 2 read replicas
  ├── ClickHouse cluster (analytics)
  ├── Redis Cluster (3 shards)
  └── Agent Relay cluster

Region: eu-west-1 (Secondary)
  ├── Full service mirror
  ├── Kafka MirrorMaker 2 from us-east-1
  ├── PostgreSQL read replica (auto-promotes on failover)
  └── GDPR-compliant data residency enforced

Region: ap-southeast-1 (Secondary)
  └── Same pattern as eu-west-1

Geo-routing:
  • Cloudflare geo-DNS routes webhooks to nearest healthy region
  • Desktop agents connect to nearest agent-relay via latency DNS
  • Automatic failover within 60 seconds
  • Active-active writes with conflict resolution via idempotency keys
```

---

## 12. Command Reference (v4.0)

```
════════════════════════════════════════
  MACHINE MANAGEMENT
════════════════════════════════════════
!register <name>          Register this machine under an alias
!list                     List all machines + online status + OS
!switch <name>            Set default active machine for session
!rename <old> <new>       Rename a registered machine
!remove <name>            Unregister a machine permanently
!tag <name> <tags>        Tag machines (e.g., !tag office work,windows)
!find <tag>               List all machines with a given tag

════════════════════════════════════════
  SYSTEM INFO  (@<machine> prefix optional)
════════════════════════════════════════
!status                   CPU, RAM, disk, battery, uptime, network
!processes                List top running processes
!ping                     Latency check (round-trip ms)
!info                     Machine specs: hostname, OS, IP, agent version
!network                  Detailed network stats per interface

════════════════════════════════════════
  REMOTE CONTROL
════════════════════════════════════════
!screenshot               Capture + CDN upload + WhatsApp reply
!stream                   Start live MJPEG stream (60s), returns URL
!run <app>                Open application by name
!close <app>              Close application by name
!type <text>              Type text at cursor
!click <x> <y>            Click screen coordinate
!hotkey <keys>            Send keyboard shortcut (e.g., !hotkey ctrl+c)
!scroll <up|down> <n>     Scroll N steps in direction
!clipboard get            Return clipboard contents
!clipboard set <text>     Set clipboard to text
!url <link>               Open URL in default browser
!window list              List open windows
!window focus <title>     Bring window to foreground

════════════════════════════════════════
  FILE OPERATIONS
════════════════════════════════════════
!files <path>             List directory contents
!read <path>              Return file contents (text files, max 10KB)
!upload <path>            Upload file to Cloudinary, returns URL
!delete <path>            Delete file (requires confirmation)
!mkdir <path>             Create directory

════════════════════════════════════════
  AUTOMATION & SCHEDULING
════════════════════════════════════════
!macro save <name> <cmds> Save a multi-step macro
!macro run <name>         Run a saved macro
!macro list               List all saved macros
!schedule <cron> <cmd>    Schedule recurring command (cron expression)
!schedule "every day 8am" <cmd>   Natural language schedule
!unschedule <id>          Cancel a scheduled command
!schedules                List all scheduled commands

════════════════════════════════════════
  SECURITY & SESSION
════════════════════════════════════════
!lock                     Lock machine screen
!unlock <otp>             Unlock after auto-lock (OTP via WhatsApp)
!shutdown [code]          Shutdown (requires one-time confirm code)
!reboot [code]            Reboot (requires one-time confirm code)
!session end              End current session and revoke temp access
!killall                  Emergency: lock ALL your registered machines

════════════════════════════════════════
  HISTORY & LOGS
════════════════════════════════════════
!log [n]                  Last N activity log entries (default 10)
!search <query>           Full-text search across command history
!replay <cmd_id>          Re-run a previous command by ID
!export log               Export last 7 days log as CSV via WhatsApp

════════════════════════════════════════
  ACCESS CONTROL
════════════════════════════════════════
!grant <phone> <role>     Grant WhatsApp number access (admin/operator/viewer)
!revoke <phone>           Remove access for a number
!access list              Show all granted access

════════════════════════════════════════
  ALERTS
════════════════════════════════════════
!alert set cpu>80         Alert me when CPU exceeds 80%
!alert set offline        Alert me when machine goes offline
!alert list               List active alert rules
!alert delete <id>        Remove an alert rule

════════════════════════════════════════
  GENERAL
════════════════════════════════════════
!help                     Full command reference
!help <command>           Detailed help for one command
```

---

## 13. AI Natural Language Examples

```
User:  "open spotify and play lo-fi music"
NEXUS: Parsed → !run spotify → !type "lo-fi music" → !hotkey enter

User:  "take a screenshot of my office PC and send it to me"
NEXUS: @office !screenshot  (returned as WhatsApp image)

User:  "remind me every morning at 8am to clear my downloads folder"
NEXUS: Saved schedule: 0 8 * * * !run cmd /c del /q C:\Users\*\Downloads\*.*

User:  "what's the status of all my machines?"
NEXUS: Returns formatted table with CPU/RAM/status for every registered machine

User:  "lock everything — I'm leaving the office"
NEXUS: Broadcasts !lock to all online machines, confirms in reply
```

---

## 14. Implementation Phases

### Phase 1 — Core MVP (Weeks 1–2)
- [ ] WhatsApp webhook server with HMAC auth + phone allowlist
- [ ] Single-machine WebSocket channel (server ↔ agent)
- [ ] Desktop agent: install, auto-start on Windows boot
- [ ] Commands: `!status`, `!screenshot`, `!run`, `!close`, `!files`
- [ ] PostgreSQL schema + command log + tenant table
- [ ] Screenshot → Cloudinary upload → WhatsApp media reply
- [ ] Redis Streams as lightweight event bus

### Phase 2 — Multi-Machine + Broker (Weeks 3–4)
- [ ] Machine registry (`!register`, `!list`, `!switch`, `!tag`)
- [ ] Kafka event streaming with per-machine partitioning
- [ ] `@<machine>` routing in command parser
- [ ] Rate limiting (Redis sliding window)
- [ ] JWT device certificates for agent authentication
- [ ] Idempotency keys for all command events
- [ ] Microservice split: api-gateway, command-router, response-router

### Phase 3 — Advanced Control + AI (Weeks 5–6)
- [ ] Full command set: `!type`, `!click`, `!hotkey`, `!clipboard`, `!window`
- [ ] Browser tab control via Chrome DevTools Protocol
- [ ] AI parser integration (GPT-4o / Claude 3.5) with context memory
- [ ] Macro engine (`!macro save`, `!macro run`)
- [ ] Scheduled commands: cron + natural language (Temporal.io)
- [ ] mTLS between agent and server
- [ ] AES-256-GCM payload encryption layer
- [ ] Circuit breaker + retry logic on all agent connections

### Phase 4 — Security + Observability (Weeks 7–8)
- [ ] Multi-user access grants + RBAC (`!grant`, `!revoke`)
- [ ] Proactive alerts (`!alert set`)
- [ ] Geo-fencing + anomaly detection
- [ ] Horizontal API gateway scaling (Kubernetes + HPA)
- [ ] Prometheus + Grafana + Loki + Jaeger + OpenTelemetry
- [ ] Row-level security + tenant isolation
- [ ] PostgreSQL table partitioning (by tenant + by month)
- [ ] Chaos engineering tests (LitmusChaos)
- [ ] Feature flags rollout (Unleash)

### Phase 5 — Web Dashboard (Weeks 9–10)
- [ ] React 18 + Vite + TailwindCSS + shadcn/ui SPA
- [ ] Live machine status grid with WebSocket feed
- [ ] Browser-based command terminal per machine
- [ ] Visual macro builder (drag-and-drop)
- [ ] Audit log viewer with search + export
- [ ] Team management: invite, assign roles, revoke

### Phase 6 — Enterprise & Global Scale (Weeks 11–14)
- [ ] Multi-region deployment (us-east-1 + eu-west-1 + ap-southeast-1)
- [ ] Service mesh (Istio) with traffic policies
- [ ] Kafka MirrorMaker 2 for cross-region replication
- [ ] Automated cert rotation via cert-manager / Vault
- [ ] Bulkhead isolation per tenant tier (free / pro / enterprise)
- [ ] ClickHouse analytics + usage dashboards
- [ ] SLA dashboard + uptime status page
- [ ] Load testing: 1,000,000 concurrent machines simulation
- [ ] WebRTC live stream (TURN/STUN upgrade)
- [ ] macOS + Linux desktop agent support

---

## 15. Deployment Model

| Component | MVP | Scale (v4+) |
|---|---|---|
| **Cloud Server** | Replit Deploy (always-on) | Kubernetes (GKE / EKS) multi-region |
| **Event Bus** | Redis Streams | Apache Kafka (partitioned, replicated) |
| **Database** | PostgreSQL single | PostgreSQL partitioned + PgBouncer + read replicas |
| **Analytics** | None | ClickHouse cluster |
| **Cache** | Redis single | Redis Cluster (sharded) |
| **AI Parser** | OpenAI API (per request) | Dedicated model endpoint with prompt caching |
| **Media Storage** | Cloudinary (free tier) | Cloudinary (paid) — CDN, auto-optimisation |
| **Desktop Agent** | `.exe` Windows installer | Cross-platform: `.exe`, `.dmg`, `.deb`/`.rpm` |
| **Web Dashboard** | None (MVP) | React SPA on Cloudflare Pages |
| **Service Mesh** | None (MVP) | Istio with mutual TLS between all services |
| **Edge** | Replit domain | Cloudflare WAF + geo-routing + DDoS |
| **Secrets** | Environment variables | HashiCorp Vault / AWS Secrets Manager |
| **CI/CD** | Manual / GitHub Actions | ArgoCD GitOps + automated canary releases |

---

## 16. Non-Functional Requirements

| Metric | Target |
|---|---|
| **Command round-trip latency** | < 2 seconds (p95) |
| **AI parse latency** | < 500ms (cached intent patterns) |
| **Screenshot delivery** | < 5 seconds including CDN upload |
| **Agent reconnect after network drop** | < 10 seconds |
| **API gateway uptime** | 99.9% (99.99% with multi-region) |
| **Max machines per user** | 50 (free), 500 (pro), unlimited (enterprise) |
| **Max machines system-wide** | 1,000,000+ with horizontal scaling |
| **Command throughput** | 500,000 commands/min system-wide |
| **Region failover time** | < 60 seconds |
| **Zero unauthorized executions** | 100% — any breach triggers immediate agent shutdown |
| **Data residency** | EU data stays in eu-west-1; configurable per tenant |
| **RTO (Recovery Time Objective)** | < 5 minutes for full region failure |
| **RPO (Recovery Point Objective)** | < 30 seconds (Kafka-backed) |
| **Dashboard real-time update lag** | < 1 second via WebSocket |

---

## 17. Scalability Levers (Summary)

1. **Stateless API Gateway** — add instances behind a load balancer; Kubernetes HPA auto-scales on CPU/RPS
2. **AI Parser Caching** — common intents cached in Redis; only novel inputs hit LLM API
3. **Kafka Event Streaming** — partitioned by owner_id; consumer groups scale horizontally; 7-day replay
4. **Tenant Isolation** — PostgreSQL partitioning by tenant; row-level security; bulkhead per tier
5. **Cloudinary for Media** — screenshots auto-optimised via Cloudinary's global CDN
6. **Read Replicas + PgBouncer** — PostgreSQL read replicas for log/dashboard queries; connection pooling
7. **Agent Self-Healing** — lost connections use exponential backoff; circuit breakers prevent cascade failures
8. **Idempotency** — UUID-keyed commands prevent duplicate execution at any scale
9. **Multi-Region** — geo-routing directs traffic to nearest region; automatic failover under 60 seconds
10. **Feature Flags** — new features rolled out gradually; instant kill switch without redeployment
11. **Chaos Testing** — resilience continuously validated in staging before production promotion
12. **ClickHouse Analytics** — columnar storage handles billions of log rows with sub-second query response

---

## 18. Pricing Tiers

| Tier | Machines | Commands/Day | AI Parser | Alerts | Price |
|---|---|---|---|---|---|
| **Free** | 1 | 100 | ✗ | ✗ | $0/mo |
| **Pro** | 10 | 2,000 | ✓ | 5 rules | $12/mo |
| **Team** | 50 | 20,000 | ✓ | Unlimited | $49/mo |
| **Enterprise** | Unlimited | Unlimited | ✓ | Unlimited | Custom |

---

## 19. Out of Scope (v4.0)

- iOS/Android mobile agent (phone-side agent — WhatsApp is the interface)
- Video recording of sessions (screenshots and live stream only)
- On-premise Kafka management (use Confluent Cloud / MSK)
- GUI-only desktop application (this is WhatsApp + web dashboard only)
- Consumer IoT device control (Windows / macOS / Linux machines only)
