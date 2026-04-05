const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "activity.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    phone TEXT NOT NULL,
    command TEXT NOT NULL,
    status TEXT NOT NULL,
    agent_id TEXT,
    result TEXT
  );
  CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    hostname TEXT,
    platform TEXT,
    connected_at TEXT,
    last_seen TEXT,
    ip TEXT
  );
`);

const insertLog = db.prepare(
  `INSERT INTO activity_log (ts, phone, command, status, agent_id, result)
   VALUES (@ts, @phone, @command, @status, @agent_id, @result)`
);

const insertAgent = db.prepare(
  `INSERT OR REPLACE INTO agents (agent_id, hostname, platform, connected_at, last_seen, ip)
   VALUES (@agent_id, @hostname, @platform, @connected_at, @last_seen, @ip)`
);

const getRecentLogs = db.prepare(
  `SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`
);

const getAgents = db.prepare(`SELECT * FROM agents ORDER BY last_seen DESC`);

function log(phone, command, status, agentId = null, result = null) {
  insertLog.run({
    ts: new Date().toISOString(),
    phone,
    command: command.substring(0, 500),
    status,
    agent_id: agentId,
    result: result ? JSON.stringify(result).substring(0, 1000) : null,
  });
  console.log(`[LOG] ${new Date().toISOString()} | ${phone} | ${command} | ${status}`);
}

function upsertAgent(info) {
  insertAgent.run({
    agent_id: info.agentId,
    hostname: info.hostname || "unknown",
    platform: info.platform || "unknown",
    connected_at: info.connectedAt || new Date().toISOString(),
    last_seen: new Date().toISOString(),
    ip: info.ip || "unknown",
  });
}

function recentActivity(limit = 10) {
  return getRecentLogs.all(limit);
}

function listAgents() {
  return getAgents.all();
}

module.exports = { log, upsertAgent, recentActivity, listAgents };
