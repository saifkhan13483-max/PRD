const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5000;

function mdToHtml(md) {
  return md
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^```[\w]*\n([\s\S]*?)```/gm, (_, code) => `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`)
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split("|").map(c => c.trim());
      return "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, match => `<table>${match}</table>`)
    .replace(/^\- \[ \] (.+)$/gm, '<li class="check unchecked">$1</li>')
    .replace(/^\- \[x\] (.+)$/gm, '<li class="check checked">$1</li>')
    .replace(/^\* (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[huptl]|```)(.+)$/gm, "$1")
    .replace(/---/g, "<hr>");
}

const html = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp Remote Desktop — PRD</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; line-height: 1.7; }
  .container { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
  .badge { display: inline-block; background: #1f6feb; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 2.2rem; font-weight: 800; color: #58a6ff; margin-bottom: 6px; line-height: 1.2; }
  h2 { font-size: 1.35rem; font-weight: 700; color: #58a6ff; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #21262d; }
  h3 { font-size: 1.05rem; font-weight: 600; color: #79c0ff; margin: 24px 0 10px; }
  p { margin: 10px 0; color: #c9d1d9; }
  hr { border: none; border-top: 1px solid #21262d; margin: 30px 0; }
  code { background: #161b22; color: #f0883e; padding: 2px 6px; border-radius: 4px; font-size: 0.88em; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
  pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; overflow-x: auto; margin: 16px 0; }
  pre code { background: none; color: #e6edf3; padding: 0; font-size: 0.85em; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; border-radius: 8px; overflow: hidden; }
  td { padding: 10px 14px; border-bottom: 1px solid #21262d; color: #c9d1d9; font-size: 0.92em; }
  tr:first-child td { background: #161b22; font-weight: 700; color: #e6edf3; border-bottom: 2px solid #30363d; }
  tr:not(:first-child):hover td { background: #161b22; }
  ul { padding-left: 20px; margin: 10px 0; }
  li { color: #c9d1d9; margin: 5px 0; }
  li.check { list-style: none; padding-left: 4px; }
  li.unchecked::before { content: "☐ "; color: #6e7681; }
  li.checked::before { content: "✓ "; color: #3fb950; }
  strong { color: #e6edf3; font-weight: 600; }
  .meta { color: #6e7681; font-size: 0.88em; margin-bottom: 32px; }
  .section { background: #161b22; border: 1px solid #21262d; border-radius: 12px; padding: 24px; margin: 24px 0; }
  .tag { display: inline-block; background: #1f3a1e; color: #3fb950; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-right: 6px; }
</style>
</head>
<body>
<div class="container">
  <div class="badge">PRD v1.0</div>
  ${content}
  <p class="meta" style="margin-top:40px;">Generated for Replit AI Coding Agent — April 2026</p>
</div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  try {
    const md = fs.readFileSync(path.join(__dirname, "PRD.md"), "utf-8");
    const body = mdToHtml(md);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html(body));
  } catch (e) {
    res.writeHead(500);
    res.end("Error loading PRD: " + e.message);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PRD viewer running on http://0.0.0.0:${PORT}`);
});
