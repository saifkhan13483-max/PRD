# NEXUS — Replit AI Agent Prompt Guide
**Step-by-step prompts for building all 6 phases of the WhatsApp Remote Desktop Control System**

> Paste each prompt directly into Replit AI Agent. Complete one phase fully and test it before moving to the next.

---

## Phase 1 — Core MVP

### Prompt 1.1 — Project Setup & Webhook Server

```
Build a Node.js server using Fastify that:
1. Listens on port 5000
2. Exposes a POST /webhook endpoint that:
   - Verifies the WhatsApp Cloud API HMAC-SHA256 signature using a secret stored in environment variable WHATSAPP_SECRET
   - Silently drops and logs any message from a phone number not in an ALLOWED_PHONES environment variable (comma-separated list)
   - Parses the incoming WhatsApp message body to extract: sender phone number, message text, and timestamp
   - Returns HTTP 200 immediately (WhatsApp requires fast acknowledgment)
3. Exposes a GET /webhook endpoint for Meta's verification challenge (hub.mode, hub.verify_token, hub.challenge)
4. Stores the WHATSAPP_VERIFY_TOKEN in an environment variable
5. Logs every received message with timestamp, sender, and text

Use dotenv for environment variables. Add a .env.example file listing all required variables with descriptions.
```

---

### Prompt 1.2 — PostgreSQL Schema & Database Layer

```
Set up a PostgreSQL database for the NEXUS project with the following:

1. Create a db.js module using the 'pg' package with a connection pool reading DATABASE_URL from environment variables

2. Run this schema on startup (CREATE TABLE IF NOT EXISTS):

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'free',
  max_machines INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  agent_version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE command_log (
  id BIGSERIAL PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  tenant_id UUID REFERENCES tenants(id),
  command TEXT NOT NULL,
  result TEXT,
  status VARCHAR(20),
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

3. Create a tenants.js module with functions: findOrCreateTenant(phone), getTenantMachines(tenantId)
4. Create a machines.js module with functions: getMachineByName(tenantId, name), setMachineOnline(machineId, bool), getDefaultMachine(tenantId)
5. Create a commandLog.js module with functions: logCommand(machineId, tenantId, command, result, status, latencyMs), getRecentLogs(machineId, limit)
```

---

### Prompt 1.3 — Python Windows Desktop Agent

```
Create a Python 3 desktop agent (agent/agent.py) for Windows that:

1. Connects to a WebSocket server at WS_URL (from .env) using the 'websockets' library
2. On connection, sends a JSON registration message: { "type": "register", "pc_id": "<MACHINE_NAME from .env>", "agent_version": "1.0.0" }
3. Listens for incoming JSON command messages with structure: { "command_id": "...", "type": "command", "cmd": "..." }
4. Handles these commands:
   - !status → returns JSON with cpu_percent (psutil), ram_percent, disk_percent, uptime seconds
   - !screenshot → captures screen with PIL/mss, saves as temp PNG, returns base64-encoded image data
   - !run <app> → runs subprocess with the app name, returns success/error
   - !close <app> → kills process by name using psutil, returns success/error
   - !files <path> → lists directory contents with file sizes, returns JSON array
   - !ping → returns { "pong": true, "timestamp": "..." }
5. Sends result back as: { "command_id": "...", "type": "result", "result": "...", "status": "success|failed" }
6. Reconnects automatically with exponential backoff (1s, 2s, 4s, max 30s) on disconnect
7. Logs all activity to agent/agent.log

Also create agent/requirements.txt with all dependencies and agent/install.bat (Windows batch file) that installs requirements and sets up the agent to run on Windows startup using Task Scheduler.
```

---

### Prompt 1.4 — WebSocket Agent Relay + Command Dispatcher

```
Add to the existing Fastify server:

1. A WebSocket endpoint at /agent using the 'ws' package that:
   - Accepts connections from desktop agents
   - On registration message, stores the connection in a Map keyed by pc_id: activePCs.set(pc_id, ws)
   - Updates the machine's is_online status in PostgreSQL to true
   - On disconnect, sets is_online to false in PostgreSQL
   - Sends heartbeat ping every 30 seconds; removes agent if no pong within 10s

2. A dispatchCommand(tenantId, machineName, command) function that:
   - Looks up the machine by name for this tenant
   - Checks if the agent is connected in activePCs
   - Sends the command as JSON with a unique command_id (UUID)
   - Waits up to 15 seconds for a result (using a Promise + Map of pending callbacks)
   - Logs the command and result to command_log table
   - Returns the result or a timeout error

3. Update the /webhook POST handler to:
   - Find or create the tenant from the sender's phone number
   - Parse the command from the message text
   - Get the tenant's default (or @-prefixed) machine
   - Call dispatchCommand and send the result back via WhatsApp Cloud API
   - Use WHATSAPP_PHONE_ID and WHATSAPP_TOKEN env vars to call the send message API
```

---

### Prompt 1.5 — Screenshot Upload & WhatsApp Media Reply

```
Add screenshot handling to the NEXUS server:

1. When a !screenshot command result is received from an agent (base64 PNG):
   - Decode the base64 data to a buffer
   - Upload it to Cloudinary using the cloudinary npm package
   - Use CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET from environment variables
   - Apply auto quality and format transformations
   - Get back a secure CDN URL

2. Send the Cloudinary URL as a WhatsApp image message (not a text message) using:
   POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_ID}/messages
   with body: { "type": "image", "image": { "link": "<cloudinary_url>" } }

3. For all other command results (text), send as a WhatsApp text message with the result formatted clearly

4. Handle errors gracefully — if Cloudinary upload fails, send an error text message to the user instead of crashing
```

---

## Phase 2 — Multi-Machine + Message Broker

### Prompt 2.1 — PC Registry Commands

```
Add multi-machine management to the NEXUS WhatsApp command handler:

1. Parse these new commands from WhatsApp messages:
   - !register <name> → register the sending session's default machine under this alias, save to machines table, reply with confirmation
   - !list → query all machines for this tenant, reply with a formatted list showing name, online status (🟢/🔴), and last seen time
   - !switch <name> → update a tenant_default_machine preference (add a preferences column to tenants table), reply with confirmation
   - !rename <old> <new> → update machine name in DB, reply with confirmation
   - !remove <name> → delete machine from DB, reply with confirmation

2. Support @<machinename> prefix routing: if a message starts with @office !screenshot, route to the machine named "office" instead of the default

3. Add a getTargetMachine(tenantId, messageText) helper that:
   - Checks for @<name> prefix and returns that machine
   - Falls back to the tenant's default machine
   - Returns an error message if no machine is found or it is offline

Update the command_log table to include actor_phone VARCHAR(20) column.
```

---

### Prompt 2.2 — Redis Streams Event Bus

```
Replace direct synchronous command dispatch with a Redis Streams event bus:

1. Install ioredis. Add REDIS_URL to environment variables.

2. Create a streams.js module with:
   - publishCommand(tenantId, machineId, commandId, command) → adds to Redis stream 'commands'
   - publishResult(commandId, result, status) → adds to Redis stream 'results'
   - consumeCommands(callback) → reads from 'commands' stream using consumer group 'agent-relay', calls callback for each message
   - consumeResults(callback) → reads from 'results' stream using consumer group 'response-router', calls callback for each message

3. Update the webhook handler to publish to the commands stream instead of dispatching directly

4. Create a result consumer that:
   - Reads from the results stream
   - Resolves the pending Promise for that commandId
   - Sends the WhatsApp reply

5. The WebSocket agent relay reads from the commands stream and forwards to the correct connected agent

Keep the 15-second timeout and command_log recording unchanged.
```

---

### Prompt 2.3 — Rate Limiting with Redis

```
Add Redis-based rate limiting to the NEXUS webhook handler:

1. Implement a sliding window rate limiter using ioredis:
   - Per-session limit: 30 commands per 60 seconds
   - Per-account daily limit: 500 commands per 24 hours
   - Key format: ratelimit:{phone}:minute and ratelimit:{phone}:day

2. If the per-minute limit is exceeded, reply via WhatsApp: "⚠️ Slow down — maximum 30 commands per minute."
3. If the daily limit is exceeded, reply: "⚠️ Daily limit of 500 commands reached. Resets at midnight UTC."
4. Log rate limit hits to the console with the phone number and timestamp

5. Add JWT device certificate validation:
   - Generate a JWT secret JWT_SECRET in environment variables
   - Create an issueDeviceCert(machineId) function that signs a JWT with machineId and 30-day expiry
   - Add a device_cert TEXT column to the machines table
   - The agent sends its JWT in the WebSocket upgrade headers as Authorization: Bearer <token>
   - The server verifies the JWT before accepting the WebSocket connection
```

---

## Phase 3 — Advanced Control + AI

### Prompt 3.1 — Expanded Agent Commands

```
Extend the Python desktop agent (agent/agent.py) to handle these additional commands:

1. !type <text> → use pyautogui.typewrite(text, interval=0.05) to type text at the current cursor position
2. !click <x> <y> → use pyautogui.click(x, y)
3. !hotkey <keys> → parse comma-separated keys and call pyautogui.hotkey(*keys) e.g. "ctrl,c"
4. !scroll <up|down> <n> → use pyautogui.scroll(n) or pyautogui.scroll(-n)
5. !clipboard get → use pyperclip.paste() to return clipboard contents
6. !clipboard set <text> → use pyperclip.copy(text)
7. !url <link> → use webbrowser.open(link)
8. !window list → use pygetwindow.getAllTitles() to return list of open window titles
9. !window focus <title> → use pygetwindow.getWindowsWithTitle(title)[0].activate()
10. !processes → use psutil.process_iter(['pid','name','cpu_percent','memory_percent']) to return top 15 by CPU
11. !read <path> → read and return file contents (text only, max 10000 chars)
12. !mkdir <path> → create directory with os.makedirs
13. !lock → call ctypes.windll.user32.LockWorkStation() on Windows

Add pyautogui, pyperclip, pygetwindow to requirements.txt.
Each command must return { "command_id": "...", "type": "result", "result": "...", "status": "success|failed" }
```

---

### Prompt 3.2 — AI Natural Language Parser

```
Add an AI-powered natural language command parser to the NEXUS server:

1. Install the 'openai' npm package. Add OPENAI_API_KEY to environment variables.

2. Create an ai-parser.js module with a parseCommand(phone, messageText) function that:
   - Maintains a context window of the last 10 commands per phone number in Redis (key: context:{phone})
   - Calls GPT-4o with a system prompt explaining all available NEXUS commands
   - Returns a structured object: { isCommand: true/false, parsed: "!screenshot", confidence: 0.95 }
   - If the message already starts with ! it skips the AI and returns it directly (fast path)
   - If confidence < 0.7, sends a clarification message: "Did you mean: !screenshot? Reply yes to confirm."
   - Caches common intent patterns in Redis for 1 hour to reduce API calls

3. The system prompt must include the full command list and examples of natural language → command mappings:
   - "take a photo of my screen" → !screenshot
   - "what's running on my PC" → !processes
   - "open chrome" → !run chrome
   - "lock my computer" → !lock

4. Add AI_ENABLED=true env variable flag — if false, skip AI parsing entirely and require ! prefix

5. Update the webhook handler to call parseCommand before dispatching
```

---

### Prompt 3.3 — Macro Engine

```
Add a macro (multi-step workflow) system to NEXUS:

1. Add a macros table to PostgreSQL:
CREATE TABLE macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  trigger VARCHAR(100),
  steps JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, trigger)
);

2. Handle these WhatsApp commands:
   - !macro save <name> <cmd1> | <cmd2> | <cmd3> → save a macro with pipe-separated steps
   - !macro run <name> → execute each step in sequence on the target machine, reply with combined results
   - !macro list → list all saved macros with their triggers
   - !macro delete <name> → remove a macro

3. Macro execution:
   - Run each step using dispatchCommand in sequence
   - Wait for each step to complete before running the next
   - If any step fails, stop execution and report which step failed
   - Reply with a summary: "Macro 'morning-setup' complete: 3/3 steps succeeded"

4. Natural language macro trigger: if the incoming message matches a saved macro trigger exactly, run it automatically
```

---

### Prompt 3.4 — Scheduled Commands

```
Add scheduled command execution to NEXUS using node-cron:

1. Add a scheduled_commands table:
CREATE TABLE scheduled_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(id),
  tenant_id UUID REFERENCES tenants(id),
  cron_expr VARCHAR(100) NOT NULL,
  command TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

2. Handle these WhatsApp commands:
   - !schedule <cron_expr> <command> → save a new scheduled command, e.g. !schedule "0 9 * * 1-5" !status
   - !schedules → list all active schedules for this tenant with IDs and next run times
   - !unschedule <id> → deactivate a schedule by ID

3. On server startup, load all active schedules from the database and register them with node-cron

4. When a scheduled command fires:
   - Dispatch the command to the target machine
   - Log the result to command_log
   - Send the result to the tenant via WhatsApp with a prefix: "⏰ Scheduled: !status result..."
   - Update last_run_at and next_run_at in the database

5. Add natural language schedule parsing: if the cron expression contains spaces and words (like "every day at 9am"), convert it to a valid cron expression before saving
```

---

## Phase 4 — Security + Observability

### Prompt 4.1 — Multi-User Access Control

```
Add role-based access control (RBAC) to NEXUS:

1. Add an access_grants table:
CREATE TABLE access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(20) DEFAULT 'operator',
  machine_ids UUID[],
  granted_by VARCHAR(20),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, phone)
);

2. Define roles:
   - admin: all commands including !shutdown, !grant, !revoke
   - operator: all commands except !shutdown, !reboot, !grant, !revoke
   - viewer: only !status, !screenshot, !list, !ping, !log

3. Handle these commands (admin only):
   - !grant <phone> <role> → add access grant, reply with confirmation
   - !revoke <phone> → remove access, reply with confirmation
   - !access list → show all granted phones with roles

4. Update the webhook handler to:
   - Check if the sender is the tenant owner (matches tenant.phone) → always admin
   - Otherwise check access_grants for their role
   - Reject unauthorized commands with: "⛔ You don't have permission to use !shutdown"
   - Log all permission denials

5. Add auto-lock: if 5 commands in a row from the same phone fail authorization, temporarily block that phone for 10 minutes and notify the tenant owner via WhatsApp
```

---

### Prompt 4.2 — Proactive Alerts

```
Add proactive monitoring alerts to NEXUS:

1. Add an alert_rules table:
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(id),
  tenant_id UUID REFERENCES tenants(id),
  metric VARCHAR(50) NOT NULL,
  condition VARCHAR(10) NOT NULL,
  threshold NUMERIC,
  notify_phone VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

2. Handle these WhatsApp commands:
   - !alert set cpu>80 → create alert for CPU over 80%
   - !alert set ram>90 → RAM alert
   - !alert set offline → alert when machine goes offline
   - !alert set disk>95 → disk usage alert
   - !alert list → show all active alerts with IDs
   - !alert delete <id> → remove an alert

3. Every 60 seconds, for each online machine with active alerts:
   - Send !status to the machine silently (no WhatsApp reply)
   - Check each alert rule against the returned metrics
   - If threshold is breached, send a WhatsApp alert: "🚨 Alert: office CPU is at 92% (threshold: 80%)"
   - Cool-down: don't re-alert the same rule for 10 minutes (store last_triggered)

4. For offline alerts: trigger immediately when a machine disconnects from the WebSocket
```

---

### Prompt 4.3 — AES-256-GCM Payload Encryption

```
Add end-to-end payload encryption between the NEXUS server and desktop agents:

1. On the server:
   - Generate a unique 256-bit session key when each agent connects (using crypto.randomBytes(32))
   - Store the session key in memory keyed by pc_id
   - During the registration handshake, exchange the session key using the agent's device JWT as a shared secret:
     - Encrypt the session key with AES-256-GCM using the first 32 bytes of SHA-256(device_jwt) as the key
     - Send the encrypted session key + IV + auth tag as part of the registration ack
   - After key exchange, encrypt all outgoing command payloads with the session key
   - Decrypt all incoming result payloads with the session key

2. On the agent (agent/agent.py):
   - After registration, receive and decrypt the session key
   - Encrypt all outgoing results using the session key with AES-256-GCM (use the cryptography library)
   - Decrypt all incoming commands using the session key

3. Message format after encryption:
   { "encrypted": true, "iv": "<base64>", "tag": "<base64>", "data": "<base64 ciphertext>" }

4. Add ENCRYPTION_ENABLED=true env variable — if false, skip encryption (useful for local dev)

Add 'cryptography' to agent/requirements.txt.
```

---

## Phase 5 — Web Dashboard

### Prompt 5.1 — Dashboard Backend API

```
Add a REST + WebSocket API to the NEXUS server for the web dashboard:

1. Add JWT auth for the dashboard:
   - POST /api/auth/login → accepts { phone, otp } — send an OTP via WhatsApp using the existing send function, verify it, return a signed JWT with { tenantId, phone }
   - All /api/* routes require Authorization: Bearer <jwt> header

2. REST endpoints:
   - GET /api/machines → list all machines with online status, last seen, OS
   - GET /api/machines/:id/status → get latest system metrics for a machine
   - POST /api/machines/:id/command → { "command": "!screenshot" } → dispatches and returns result
   - GET /api/logs → query command_log with pagination (?page=1&limit=50&machineId=...)
   - GET /api/macros → list macros
   - POST /api/macros → create macro
   - DELETE /api/macros/:id → delete macro
   - GET /api/schedules → list schedules
   - POST /api/schedules → create schedule
   - DELETE /api/schedules/:id → delete schedule
   - GET /api/alerts → list alert rules
   - POST /api/alerts → create alert rule
   - DELETE /api/alerts/:id → delete alert rule

3. WebSocket endpoint /dashboard:
   - Authenticate via JWT in query parameter
   - Push real-time events: machine_online, machine_offline, command_result, alert_triggered
   - Broadcast machine status updates every 30 seconds
```

---

### Prompt 5.2 — React Dashboard Frontend

```
Create a React 18 + Vite frontend in a /dashboard folder for NEXUS:

1. Setup: npm create vite@latest dashboard -- --template react, install TailwindCSS + shadcn/ui

2. Pages and components:
   - Login page: phone number input → sends OTP → OTP verification → stores JWT in localStorage
   - Dashboard home: grid of MachineCard components showing name, OS icon, online/offline badge, CPU/RAM bars, last seen
   - Machine detail page: terminal-style command input, screenshot preview, real-time status metrics updated via WebSocket
   - Logs page: searchable, filterable table of command history with status badges and latency column
   - Macros page: list of macros with a "Run" button, plus a form to create new macros
   - Schedules page: list of active schedules with next run time, toggle active/inactive, delete
   - Alerts page: list of alert rules with metric, threshold, condition, delete button

3. Design requirements:
   - Dark theme: background #080c12, surface #0d1117, accent blue #3b82f6
   - Sidebar navigation with NEXUS logo
   - Real-time connection status indicator (WebSocket connected/disconnected)
   - All API calls go to /api/* (same origin — no CORS needed)
   - Responsive layout

4. Serve the built dashboard from the Fastify server: app.register(require('@fastify/static'), { root: path.join(__dirname, 'dashboard/dist'), prefix: '/dashboard/' })
```

---

## Phase 6 — Production Hardening

### Prompt 6.1 — Windows Installer

```
Create a production Windows installer for the NEXUS desktop agent:

1. Create agent/install.ps1 (PowerShell) that:
   - Checks for Python 3.11+ and installs it silently if missing (winget install Python.Python.3.11)
   - Installs all requirements: pip install -r requirements.txt
   - Prompts the user for: WS_URL, MACHINE_NAME, and optionally DEVICE_CERT
   - Writes a .env file to %APPDATA%\NEXUS\
   - Creates a Windows Task Scheduler task named "NEXUS Agent" that:
     - Runs agent.py at user logon
     - Runs with highest privileges
     - Restarts on failure after 30 seconds

2. Create agent/uninstall.ps1 that:
   - Removes the Task Scheduler task
   - Optionally removes the .env and log files

3. Create agent/update.ps1 that:
   - Downloads the latest agent.py from a GitHub Releases URL (AGENT_UPDATE_URL in .env)
   - Restarts the Task Scheduler task

4. Create a README in the agent/ folder with manual installation steps for users who can't run PowerShell scripts
```

---

### Prompt 6.2 — Observability & Health Checks

```
Add production observability to the NEXUS server:

1. Health check endpoints:
   - GET /health → returns { status: "ok", uptime: <seconds>, timestamp: "..." }
   - GET /ready → checks DB connection and Redis connection, returns { status: "ok"|"degraded", checks: { db: bool, redis: bool } }

2. Structured logging using pino:
   - Replace all console.log with pino logger
   - Log format: { timestamp, level, service: "nexus", tenantId?, machineId?, command?, latencyMs?, error? }
   - Log levels: info for normal operations, warn for rate limits and auth failures, error for exceptions

3. Prometheus metrics endpoint GET /metrics (using prom-client):
   - nexus_commands_total (counter, labels: status, command_type)
   - nexus_command_latency_ms (histogram, labels: command_type)
   - nexus_active_agents (gauge)
   - nexus_whatsapp_messages_total (counter, labels: direction)
   - nexus_rate_limit_hits_total (counter)

4. Error handling:
   - Global Fastify error handler that logs errors with pino and returns generic error messages (never expose stack traces)
   - Unhandled promise rejection handler that logs and triggers a graceful shutdown

5. Graceful shutdown:
   - On SIGTERM: stop accepting new connections, wait for in-flight commands (max 30s), close DB pool and Redis, exit 0
```

---

### Prompt 6.3 — Environment Variables & Secrets Checklist

```
Create a production environment variable validation module for NEXUS (config.js):

1. On server startup, validate that all required environment variables are present.
   Required variables:
   - WHATSAPP_SECRET (min 32 chars)
   - WHATSAPP_VERIFY_TOKEN
   - WHATSAPP_TOKEN (Bearer token for send API)
   - WHATSAPP_PHONE_ID
   - ALLOWED_PHONES (comma-separated, min 1 number)
   - DATABASE_URL
   - REDIS_URL
   - JWT_SECRET (min 32 chars)
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
   Optional:
   - OPENAI_API_KEY (required if AI_ENABLED=true)
   - AI_ENABLED (default: false)
   - ENCRYPTION_ENABLED (default: true)
   - PORT (default: 5000)

2. If any required variable is missing, log a clear error message listing all missing variables and exit with code 1

3. Export a frozen config object with all parsed values (numbers parsed as numbers, booleans as booleans, arrays split from comma strings)

4. Update .env.example with all variables, their types, descriptions, and example values
```

---

## Final Integration Test

### Prompt — End-to-End Test Checklist

```
Help me verify the NEXUS system is working end-to-end by creating a test script (test/e2e.js) that:

1. Simulates a WhatsApp webhook POST request with a valid HMAC signature for each of these commands and checks the response is HTTP 200:
   - !status
   - !screenshot
   - !run notepad
   - !close notepad
   - !files C:\
   - !ping
   - !list
   - !log 5

2. Tests the rate limiter: sends 35 commands from the same phone in quick succession and verifies the 31st returns a rate limit message

3. Tests HMAC rejection: sends a webhook with an invalid signature and verifies it is rejected

4. Tests phone allowlist: sends a webhook from an unlisted phone and verifies it is silently dropped

5. Tests the health and ready endpoints and verifies both return status "ok"

6. Logs PASS/FAIL for each test with the response time

Run with: node test/e2e.js
```

---

> **Tip:** After completing each phase, commit your changes before starting the next prompt. This gives you a working rollback point if anything breaks in the next phase.
