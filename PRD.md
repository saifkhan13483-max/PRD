# PRD: WhatsApp Remote Desktop Control System
**Version:** 2.0 | **Target:** Windows PC (Multi-Instance Ready) | **Deployment:** Production-Ready, Cloud-Native

---

## 1. Product Vision

A horizontally scalable, cloud-native remote desktop control platform where any number of Windows PCs can be registered and controlled by their owner through WhatsApp. Commands route through a stateless API gateway to the correct machine in real time. Designed to grow from 1 PC to thousands without re-architecture.

---

## 2. Scalable Architecture

```
[Owner's Phone]
     │ WhatsApp Message (e.g., "@office !screenshot")
     ▼
[WhatsApp Business Cloud API]
     │ Webhook (HTTPS POST)
     ▼
┌─────────────────────────────────────────────┐
│         API GATEWAY LAYER (Stateless)        │
│  Node.js / FastAPI — horizontally scaled     │
│  • HMAC auth + phone allowlist               │
│  • Command parser + PC router                │
│  • Rate limiter (Redis)                      │
│  • Load balanced via Nginx / Replit Deploy   │
└─────────────────┬───────────────────────────┘
                  │ Publish to Message Broker
                  ▼
┌─────────────────────────────────────────────┐
│         MESSAGE BROKER (Redis Pub/Sub        │
│         OR RabbitMQ / BullMQ)                │
│  • Per-PC command queues                     │
│  • Dead letter queue for failed commands     │
│  • Retry + timeout handling                  │
└─────────────────┬───────────────────────────┘
                  │ WSS / Long-poll per PC
                  ▼
┌─────────────────────────────────────────────┐
│       WINDOWS DESKTOP AGENTS (N PCs)         │
│  Python 3.11 background service              │
│  • Registers with unique PC ID on startup    │
│  • Persistent encrypted WSS connection       │
│  • Executes commands locally                 │
│  • Streams results back to broker            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         RESPONSE ROUTER                      │
│  • Routes result to correct WhatsApp thread  │
│  • Uploads screenshots to CDN (S3/Cloudflare)│
│  • Sends reply via WhatsApp Cloud API        │
└─────────────────────────────────────────────┘
                  │
                  ▼
         [Owner's Phone — Reply]
```

---

## 3. Core Features

| Feature | Description | Scale Factor |
|---|---|---|
| **Multi-PC Registry** | Register N PCs; address by name (`@home`, `@office`) | DB-backed per user |
| **Command Execution** | Shell, open/close apps, file ops | Per-PC isolated queue |
| **Screenshot on Demand** | Capture → compress → CDN upload → WhatsApp image | CDN scales globally |
| **System Status** | CPU, RAM, disk, battery, network latency | Streamed via WebSocket |
| **Browser Control** | Open URLs, manage tabs via Chrome DevTools Protocol | Per-PC agent |
| **Mouse & Keyboard** | Remote cursor, click, type via pyautogui | Per-PC agent |
| **File Access** | List, read, upload/download via cloud buffer | Object storage (S3) |
| **Live Screen Stream** | MJPEG/WebRTC stream, CDN-distributed | Media server (optional) |
| **Scheduled Commands** | Cron-style commands run at set times | Scheduler microservice |
| **Command History** | Full searchable log of all commands per PC | PostgreSQL append-only |

---

## 4. Security Requirements (Non-Negotiable)

- **Allowlist Auth:** Only registered WhatsApp numbers accepted; all others silently dropped + logged
- **HMAC Verification:** Every webhook validated with WhatsApp signature secret (replay window: 5 min)
- **Command Allowlist:** Predefined commands only; raw shell gated behind explicit unlock passphrase
- **mTLS:** Mutual TLS between Desktop Agent and cloud backend — agent certificates rotated every 30 days
- **AES-256-GCM Payload Encryption:** Command payloads encrypted end-to-end with per-session keys
- **Zero-Trust PC Identity:** Each PC holds a signed JWT device certificate; server verifies on every connection
- **Activity Log:** Every command logged with timestamp, PC ID, command, result, duration — immutable append-only
- **Auto-Lock:** Agent locks after 5 unknown commands; reactivation requires OTP via WhatsApp
- **Rate Limiting:** 30 commands/min per session (Redis sliding window); global 500 commands/day per account
- **DDoS Protection:** API gateway behind Cloudflare / Replit edge; webhook IPs allowlisted to Meta's published ranges

---

## 5. Tech Stack

| Layer | Technology | Scalability Approach |
|---|---|---|
| **Desktop Agent** | Python 3.11 (`pyautogui`, `pywin32`, `websockets`, `PIL`, `psutil`) | N agents, each independent |
| **API Gateway** | Node.js 20 + Fastify OR Python FastAPI | Stateless; horizontal scale |
| **Message Broker** | Redis Pub/Sub (MVP) → RabbitMQ / BullMQ (scale) | Sharded queues per PC group |
| **Real-Time Channel** | WebSocket (WSS) with auto-reconnect + heartbeat every 30s | One WSS conn per PC |
| **Database** | PostgreSQL (PC registry, users, logs) + Redis (sessions, rate limits) | Read replicas + connection pooling |
| **File/Media Storage** | AWS S3 or Cloudflare R2 (screenshots, uploads) | Global CDN distribution |
| **Screen Stream** | OpenCV MJPEG → WebRTC (scale tier) | TURN/STUN server optional |
| **Scheduler** | BullMQ cron jobs OR Temporal.io | Distributed, fault-tolerant |
| **Auth** | JWT device certs + HMAC webhook auth + phone allowlist | Stateless JWT verification |
| **Observability** | Prometheus + Grafana (metrics), Loki (logs), OpenTelemetry (traces) | Centralised per deployment |
| **Deployment** | Docker + Docker Compose (MVP) → Kubernetes (scale) | Replit Deploy for cloud server |
| **CDN/Edge** | Cloudflare (API shield + WAF) | Global edge caching |

---

## 6. Database Schema (Core)

```sql
-- Registered PCs per user
CREATE TABLE pcs (
  id UUID PRIMARY KEY,
  owner_phone VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,         -- e.g., "office", "home"
  device_cert TEXT NOT NULL,
  last_seen TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command history (append-only)
CREATE TABLE command_log (
  id BIGSERIAL PRIMARY KEY,
  pc_id UUID REFERENCES pcs(id),
  owner_phone VARCHAR(20),
  command TEXT NOT NULL,
  result TEXT,
  status VARCHAR(20),               -- success | failed | timeout
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled commands
CREATE TABLE scheduled_commands (
  id UUID PRIMARY KEY,
  pc_id UUID REFERENCES pcs(id),
  cron_expr VARCHAR(100),
  command TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

---

## 7. Command Reference (v2.0)

```
-- PC Management --
!register <name>       → Register this PC under alias (e.g., !register office)
!list                  → List all your registered PCs and their online status
!switch <name>         → Set default active PC for this session

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
!log [n]               → Last N activity log entries (default 10)
!ping                  → Latency check (round-trip ms)
!help                  → List all commands
```

---

## 8. Implementation Phases

### Phase 1 — Core MVP (Weeks 1–2)
- [ ] WhatsApp webhook server with HMAC auth + phone allowlist
- [ ] Single-PC WebSocket channel (server ↔ agent)
- [ ] Desktop agent: install, auto-start on Windows boot
- [ ] Commands: `!status`, `!screenshot`, `!run`, `!close`, `!files`
- [ ] PostgreSQL schema + command log
- [ ] Screenshot → S3/R2 → WhatsApp media reply

### Phase 2 — Multi-PC + Broker (Weeks 3–4)
- [ ] PC registry (`!register`, `!list`, `!switch`)
- [ ] Redis Pub/Sub message broker with per-PC queues
- [ ] `@<pc>` routing in command parser
- [ ] Rate limiting (Redis sliding window)
- [ ] JWT device certificates for agent authentication

### Phase 3 — Advanced Control (Weeks 5–6)
- [ ] `!type`, `!click`, `!url`, `!stream` (MJPEG)
- [ ] Browser tab control via Chrome DevTools Protocol
- [ ] Scheduled commands (BullMQ cron)
- [ ] mTLS between agent and server
- [ ] AES-256-GCM payload encryption layer

### Phase 4 — Scale & Observability (Weeks 7–8)
- [ ] Horizontal API gateway scaling (Docker + load balancer)
- [ ] Prometheus + Grafana + Loki + OpenTelemetry setup
- [ ] Migrate stream to WebRTC (TURN/STUN)
- [ ] Kubernetes manifests for cloud deployment
- [ ] Windows `.exe` installer (NSIS/Inno Setup) with auto-update
- [ ] Full integration test suite + chaos testing

---

## 9. Deployment Model

| Component | MVP | Scale |
|---|---|---|
| **Cloud Server** | Replit Deploy (always-on) | Kubernetes cluster (GKE / EKS) |
| **Message Broker** | Redis single-node | Redis Cluster (sharded) |
| **Database** | PostgreSQL single | PostgreSQL + read replicas + PgBouncer |
| **Media Storage** | Cloudflare R2 | R2 / S3 multi-region |
| **Desktop Agent** | `.exe` installer, Windows Task Scheduler | Auto-update via GitHub Releases |
| **Edge** | Replit domain | Cloudflare WAF + DDoS protection |

---

## 10. Non-Functional Requirements

| Metric | Target |
|---|---|
| Command round-trip latency | < 3 seconds (p95) |
| Screenshot delivery | < 5 seconds including upload |
| Agent reconnect after network drop | < 10 seconds |
| API gateway uptime | 99.9% |
| Max concurrent PCs per user | 50 (v1), unlimited (v2+) |
| Max concurrent PCs system-wide | 10,000+ with horizontal scaling |
| Command throughput | 10,000 commands/min system-wide |
| Zero unauthorized executions | 100% — any breach triggers immediate agent shutdown |

---

## 11. Scalability Levers (Summary)

1. **Stateless API Gateway** — add instances behind a load balancer, no shared state
2. **Message Broker** — Redis Pub/Sub → RabbitMQ for 10k+ PC scale; queues are per-PC, fully isolated
3. **CDN for media** — screenshots/streams served from edge, never bottlenecking the API
4. **Read replicas** — PostgreSQL read replicas for log queries and PC listings
5. **Agent auto-reconnect** — lost connections do not require server restart; agents self-heal
6. **Horizontal agent fan-out** — each PC agent is a completely independent process; scale linearly

---

## 12. Out of Scope (v2.0)

- iOS/Android mobile agent
- GUI web dashboard (WhatsApp + CLI only in this version)
- Voice command support
- Video recording (screenshots and live stream only)
