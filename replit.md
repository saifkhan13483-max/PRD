# WhatsApp Remote Desktop Control — PRD Project

## Overview
A PRD (Product Requirements Document) for a WhatsApp-controlled remote desktop control system. The PRD is rendered as a web page via a lightweight Node.js HTTP server.

## Project Structure
- `PRD.md` — Full product requirements document
- `server.js` — Simple Node.js HTTP server that renders PRD.md as a styled HTML page

## Running the App
The app runs on port 5000. Start via the "Start application" workflow which executes `node server.js`.

## PRD Summary
The PRD covers:
- Architecture: Windows Desktop Agent ↔ Cloud Server ↔ WhatsApp Cloud API
- Security: HMAC auth, AES-256 encryption, allowlist, rate limiting, auto-lock
- Commands: !status, !screenshot, !run, !close, !files, !type, !click, !url, !stream, !lock, !shutdown, !log
- Tech Stack: Python agent, Node.js/FastAPI server, WhatsApp Business Cloud API, WebSocket, Redis
- 4-week implementation phased plan
