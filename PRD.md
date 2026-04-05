# PRD: WhatsApp Remote Desktop Control System
**Version:** 1.0 | **Target:** Windows PC | **Deployment:** Production-Ready

---

## 1. Product Vision

A personal remote desktop agent that executes secure, real-time commands on a Windows PC triggered by WhatsApp messages from a single verified owner number. Zero third-party remote desktop dependency — fully self-hosted.

---

## 2. Architecture Overview

```
[Owner's Phone]
     │ WhatsApp Message
     ▼
[WhatsApp Business Cloud API / Twilio WhatsApp]
     │ Webhook (HTTPS POST)
     ▼
[Cloud Command Server — Node.js/FastAPI]
  • Auth: verify sender number + HMAC signature
  • Parse & validate command
  • Push to command queue (Redis/WebSocket)
     │ Encrypted WebSocket (WSS)
     ▼
[Windows Desktop Agent — Python]
  • Execute command locally
  • Capture result / screenshot
  • Return response via WebSocket
     │
     ▼
[Cloud Server → WhatsApp API → Owner's Phone]
```

---

## 3. Core Features

| Feature | Description |
|---|---|
| **Command Execution** | Run shell commands, open/close apps, manage files |
| **Screenshot on Demand** | Capture + compress + send as WhatsApp image |
| **System Status** | Report CPU, RAM, disk, battery, network in real time |
| **Browser Control** | Open URLs, manage tabs via Chrome DevTools Protocol |
| **Mouse & Keyboard** | Remote cursor movement, click, type via `pyautogui` |
| **File Access** | List, read, upload/download files to cloud buffer |
| **Signed-In App Access** | Launch apps already authenticated on host PC |
| **Live Screen Stream** | MJPEG stream URL returned on `!stream` command |

---

## 4. Security Requirements (Non-Negotiable)

- **Allowlist Auth:** Only one hardcoded WhatsApp number accepted; all others silently dropped
- **HMAC Verification:** Every webhook validated with WhatsApp signature secret
- **Command Allowlist:** Only predefined commands execute; raw shell gated behind explicit unlock phrase
- **TLS Everywhere:** WSS between agent and server; HTTPS for all API calls
- **AES-256 Payload Encryption:** Command payloads encrypted in transit
- **Activity Log:** Every command logged with timestamp, command text, result status to local encrypted log file
- **Auto-Lock:** Agent locks itself after 3 unknown commands; requires reactivation
- **Rate Limiting:** Max 30 commands/minute per session

---

## 5. Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Agent** | Python 3.11 (`pyautogui`, `pywin32`, `websockets`, `PIL`, `psutil`) |
| **Cloud Server** | Node.js 20 + Express OR Python FastAPI |
| **Message Gateway** | WhatsApp Business Cloud API (Meta) or Twilio WhatsApp |
| **Real-Time Channel** | WebSocket (WSS) with auto-reconnect + heartbeat |
| **Queue** | In-memory queue (Redis optional for scale) |
| **Screen Stream** | OpenCV MJPEG over HTTPS endpoint |
| **Auth** | HMAC-SHA256 webhook verification + phone allowlist |
| **Logging** | SQLite local log + optional remote append-only log |

---

## 6. Command Reference (MVP)

```
!status          → CPU, RAM, disk, battery, uptime
!screenshot      → Captures and sends screen image
!run <app>       → Opens application by name
!close <app>     → Closes application
!files <path>    → Lists directory contents
!type <text>     → Types text at cursor
!click <x> <y>  → Clicks screen coordinate
!url <link>      → Opens URL in default browser
!stream          → Returns live stream URL (60s session)
!lock            → Locks PC screen
!shutdown        → Initiates shutdown (requires confirm code)
!log             → Returns last 10 activity log entries
!help            → Lists all commands
```

---

## 7. Implementation Phases

### Phase 1 — Foundation (Week 1)
- [ ] WhatsApp webhook server (Node/FastAPI) with HMAC auth
- [ ] Phone number allowlist + command parser
- [ ] WSS channel between server and Windows agent
- [ ] Desktop agent: install, auto-start on Windows boot (Task Scheduler)

### Phase 2 — Core Commands (Week 2)
- [ ] `!status`, `!screenshot`, `!run`, `!close`, `!files`
- [ ] Screenshot compress + upload + WhatsApp media reply
- [ ] Activity logging (SQLite)

### Phase 3 — Advanced Control (Week 3)
- [ ] `!type`, `!click`, `!url`, `!stream`
- [ ] MJPEG stream server on agent
- [ ] Browser tab control via Chrome DevTools Protocol

### Phase 4 — Hardening (Week 4)
- [ ] AES-256 payload encryption layer
- [ ] Rate limiting + auto-lock
- [ ] `!shutdown` with confirmation code
- [ ] Full test suite + Windows installer (NSIS/Inno Setup)

---

## 8. Deployment Model

- **Cloud Server:** Replit deployment (always-on) OR VPS (Railway/Render/DigitalOcean)
- **Desktop Agent:** Runs as Windows background service, auto-restarts, reconnects on network loss
- **Agent Install:** Single `.exe` installer; registers as Windows Service

---

## 9. Success Criteria

- Command round-trip latency < 3 seconds on standard broadband
- Zero unauthorized command execution in all test scenarios
- Agent auto-recovers from network drops within 10 seconds
- Screenshot delivery < 5 seconds including WhatsApp upload
- 99.9% uptime of cloud command server

---

## 10. Out of Scope (v1.0)

- Multi-user / multi-PC support
- Mobile agent (iOS/Android)
- GUI dashboard (CLI + WhatsApp only)
- Voice command support
