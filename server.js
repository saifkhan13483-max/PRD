const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5000;

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function mdToHtml(md) {
  const toc = [];
  const lines = md.split("\n");
  const result = [];
  let i = 0;
  let firstH1Skipped = false;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "text";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      const code = codeLines.join("\n");
      const id = "code-" + Math.random().toString(36).slice(2, 7);
      result.push(`<div class="code-block"><div class="code-header"><span class="lang-tag">${escapeHtml(lang)}</span><button class="copy-btn" onclick="copyCode('${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button></div><pre><code id="${id}">${code}</code></pre></div>`);
      i++;
      continue;
    }

    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      if (!firstH1Skipped) {
        firstH1Skipped = true;
      } else {
        result.push(`<h1>${inlineFormat(h1[1])}</h1>`);
      }
      i++;
      continue;
    }

    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      const slug = slugify(h2[1].replace(/\*\*/g, ""));
      toc.push({ level: 2, text: h2[1].replace(/\*\*/g, ""), slug });
      result.push(`<h2 id="${slug}">${inlineFormat(h2[1])}</h2>`);
      i++;
      continue;
    }

    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      const slug = slugify(h3[1].replace(/\*\*/g, ""));
      toc.push({ level: 3, text: h3[1].replace(/\*\*/g, ""), slug });
      result.push(`<h3 id="${slug}">${inlineFormat(h3[1])}</h3>`);
      i++;
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].match(/^\|[-| :]+\|$/)) {
          rows.push(lines[i]);
        }
        i++;
      }
      if (rows.length > 0) {
        const parseRow = (r) => r.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        const headers = parseRow(rows[0]);
        const bodyRows = rows.slice(1);
        const thead = `<thead><tr>${headers.map(h => `<th>${inlineFormat(h)}</th>`).join("")}</tr></thead>`;
        const tbody = bodyRows.map(r => `<tr>${parseRow(r).map(c => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`).join("");
        result.push(`<div class="table-wrap"><table>${thead}<tbody>${tbody}</tbody></table></div>`);
      }
      continue;
    }

    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
      result.push("<hr>");
      i++;
      continue;
    }

    if (line.match(/^[-*] \[[ x]\]/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] \[[ x]\]/)) {
        const checked = lines[i].includes("[x]");
        const text = lines[i].replace(/^[-*] \[[ x]\] /, "");
        items.push(`<li class="task-item ${checked ? "done" : ""}"><span class="checkbox">${checked ? "✓" : ""}</span>${inlineFormat(text)}</li>`);
        i++;
      }
      result.push(`<ul class="task-list">${items.join("")}</ul>`);
      continue;
    }

    if (line.match(/^[-*] .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] .+/)) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^[-*] /, ""))}</li>`);
        i++;
      }
      result.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (line.match(/^\d+\. .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. .+/)) {
        items.push(`<li>${inlineFormat(lines[i].replace(/^\d+\. /, ""))}</li>`);
        i++;
      }
      result.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (line.startsWith("> ")) {
      const text = line.slice(2);
      result.push(`<blockquote>${inlineFormat(text)}</blockquote>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    result.push(`<p>${inlineFormat(line)}</p>`);
    i++;
  }

  return { html: result.join("\n"), toc };
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function buildTocHtml(toc) {
  if (!toc.length) return "";
  return toc.map(item => {
    const indent = item.level === 3 ? ' style="padding-left:16px;font-size:0.82em;opacity:0.75"' : "";
    return `<a href="#${item.slug}" class="toc-link"${indent}>${item.text}</a>`;
  }).join("");
}

function buildPage(content, toc) {
  const tocHtml = buildTocHtml(toc);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEXUS — WhatsApp Remote Desktop PRD</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg:        #080c12;
    --surface:   #0d1117;
    --surface2:  #131920;
    --border:    #1e2733;
    --border2:   #2a3544;
    --blue:      #3b82f6;
    --blue-glow: #1d4ed8;
    --cyan:      #22d3ee;
    --green:     #22c55e;
    --orange:    #f97316;
    --purple:    #a855f7;
    --text:      #e2e8f0;
    --text2:     #94a3b8;
    --text3:     #64748b;
    --sidebar-w: 260px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.75;
    font-size: 15px;
  }

  /* ── PROGRESS BAR ── */
  #progress {
    position: fixed; top: 0; left: 0; height: 3px; width: 0%;
    background: linear-gradient(90deg, var(--blue), var(--cyan));
    z-index: 1000;
    transition: width 0.1s linear;
    border-radius: 0 2px 2px 0;
    box-shadow: 0 0 10px var(--blue);
  }

  /* ── SIDEBAR ── */
  #sidebar {
    position: fixed; top: 0; left: 0;
    width: var(--sidebar-w);
    height: 100vh;
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    display: flex; flex-direction: column;
    z-index: 100;
    padding-bottom: 24px;
  }

  #sidebar::-webkit-scrollbar { width: 4px; }
  #sidebar::-webkit-scrollbar-track { background: transparent; }
  #sidebar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .sidebar-logo {
    padding: 20px 18px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sidebar-logo .logo-mark {
    display: flex; align-items: center; gap: 10px; margin-bottom: 4px;
  }

  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; color: #fff;
    box-shadow: 0 0 14px rgba(59,130,246,0.4);
  }

  .logo-name { font-weight: 800; font-size: 1.05rem; color: var(--text); letter-spacing: -0.3px; }

  .sidebar-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
    color: var(--blue); text-transform: uppercase;
    background: rgba(59,130,246,0.12);
    border: 1px solid rgba(59,130,246,0.25);
    padding: 2px 7px; border-radius: 4px; display: inline-block;
  }

  .toc-section-label {
    font-size: 10px; font-weight: 700; letter-spacing: 1.2px;
    color: var(--text3); text-transform: uppercase;
    padding: 16px 18px 8px;
  }

  .toc-link {
    display: block; padding: 6px 18px;
    color: var(--text2); text-decoration: none;
    font-size: 0.835rem; font-weight: 400;
    border-left: 2px solid transparent;
    transition: all 0.18s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.4;
  }

  .toc-link:hover, .toc-link.active {
    color: var(--blue);
    border-left-color: var(--blue);
    background: rgba(59,130,246,0.06);
  }

  /* ── MAIN CONTENT ── */
  #main {
    margin-left: var(--sidebar-w);
    min-height: 100vh;
  }

  /* ── HERO HEADER ── */
  .hero {
    background: linear-gradient(160deg, #0a0f1a 0%, #0d1525 40%, #091120 100%);
    border-bottom: 1px solid var(--border);
    padding: 56px 56px 48px;
    position: relative; overflow: hidden;
  }

  .hero::before {
    content: "";
    position: absolute; top: -60px; right: -40px;
    width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero::after {
    content: "";
    position: absolute; bottom: -80px; left: 200px;
    width: 350px; height: 350px; border-radius: 50%;
    background: radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

  .badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
    text-transform: uppercase; padding: 3px 10px; border-radius: 20px;
  }

  .badge-blue  { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
  .badge-green { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
  .badge-purple{ background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.25); }
  .badge-cyan  { background: rgba(34,211,238,0.1); color: #67e8f9; border: 1px solid rgba(34,211,238,0.25); }

  .hero h1 {
    font-size: 2.6rem; font-weight: 800; line-height: 1.15;
    color: #fff; margin-bottom: 10px;
    letter-spacing: -0.8px;
    background: linear-gradient(135deg, #fff 30%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-meta {
    font-size: 0.9rem; color: var(--text2); margin-bottom: 24px;
    display: flex; gap: 20px; flex-wrap: wrap;
  }

  .hero-meta span { display: flex; align-items: center; gap: 5px; }
  .hero-meta strong { color: var(--text); }

  .hero-promise {
    background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(34,211,238,0.07));
    border: 1px solid rgba(59,130,246,0.25);
    border-radius: 10px;
    padding: 14px 18px;
    font-size: 0.9rem;
    color: var(--text2);
    max-width: 600px;
    display: flex; align-items: center; gap: 10px;
  }

  .promise-icon { font-size: 1.2rem; }

  /* ── ARTICLE ── */
  article {
    padding: 40px 56px 80px;
    max-width: 900px;
  }

  h2 {
    font-size: 1.3rem; font-weight: 700;
    color: #fff; margin: 48px 0 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }

  h2::before {
    content: "";
    display: inline-block; width: 4px; height: 18px;
    background: linear-gradient(180deg, var(--blue), var(--cyan));
    border-radius: 4px; flex-shrink: 0;
  }

  h3 {
    font-size: 1rem; font-weight: 650;
    color: #93c5fd; margin: 28px 0 10px;
  }

  p { color: var(--text2); margin: 10px 0; }

  strong { color: var(--text); font-weight: 600; }
  em { color: var(--cyan); font-style: normal; }

  a { color: var(--blue); text-decoration: none; }
  a:hover { text-decoration: underline; }

  hr { border: none; border-top: 1px solid var(--border); margin: 36px 0; }

  /* ── BLOCKQUOTE ── */
  blockquote {
    border-left: 3px solid var(--blue);
    background: rgba(59,130,246,0.07);
    border-radius: 0 8px 8px 0;
    padding: 14px 18px; margin: 16px 0;
    color: var(--text2);
    font-size: 0.93rem;
  }

  blockquote strong { color: #60a5fa; }

  /* ── CODE ── */
  code {
    background: rgba(99,102,241,0.12);
    color: #fb923c;
    padding: 2px 7px; border-radius: 5px;
    font-size: 0.83em;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    border: 1px solid rgba(99,102,241,0.2);
  }

  .code-block {
    background: #0a0e15;
    border: 1px solid var(--border2);
    border-radius: 10px;
    overflow: hidden;
    margin: 18px 0;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }

  .code-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 9px 16px;
    background: #0d1320;
    border-bottom: 1px solid var(--border);
  }

  .lang-tag {
    font-size: 11px; font-weight: 600; letter-spacing: 0.6px;
    color: var(--text3); text-transform: uppercase;
    font-family: 'JetBrains Mono', monospace;
  }

  .copy-btn {
    background: transparent;
    border: 1px solid var(--border2);
    color: var(--text3);
    font-size: 11px; font-weight: 500;
    padding: 3px 9px; border-radius: 5px;
    cursor: pointer; display: flex; align-items: center; gap: 5px;
    font-family: 'Inter', sans-serif;
    transition: all 0.15s;
  }

  .copy-btn:hover { background: var(--border); color: var(--text); }
  .copy-btn.copied { color: var(--green); border-color: var(--green); }

  pre {
    padding: 20px 18px; overflow-x: auto;
  }

  pre code {
    background: none; border: none; padding: 0;
    color: #c9d1d9; font-size: 0.82em;
    line-height: 1.65;
  }

  pre::-webkit-scrollbar { height: 5px; }
  pre::-webkit-scrollbar-track { background: transparent; }
  pre::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  /* ── TABLES ── */
  .table-wrap {
    overflow-x: auto; margin: 18px 0;
    border-radius: 10px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  table { width: 100%; border-collapse: collapse; }

  thead tr { background: #0d1a28; }

  th {
    padding: 11px 16px;
    color: var(--text); font-size: 0.82rem; font-weight: 600;
    text-align: left; letter-spacing: 0.3px;
    border-bottom: 1px solid var(--border2);
    white-space: nowrap;
  }

  td {
    padding: 10px 16px;
    color: var(--text2); font-size: 0.87rem;
    border-bottom: 1px solid var(--border);
  }

  tbody tr:last-child td { border-bottom: none; }

  tbody tr:hover td { background: rgba(59,130,246,0.04); }

  /* ── LISTS ── */
  ul, ol { padding-left: 22px; margin: 10px 0; }
  li { color: var(--text2); margin: 6px 0; font-size: 0.92rem; }

  ul.task-list { list-style: none; padding-left: 0; }

  .task-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .task-item:last-child { border-bottom: none; }

  .checkbox {
    width: 17px; height: 17px; flex-shrink: 0;
    border-radius: 4px; display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; margin-top: 3px;
  }

  .task-item:not(.done) .checkbox {
    border: 1.5px solid var(--border2);
    background: transparent; color: transparent;
  }

  .task-item.done .checkbox {
    background: var(--green); border: 1.5px solid var(--green);
    color: #fff;
  }

  .task-item.done { opacity: 0.6; }

  /* ── FOOTER ── */
  .footer {
    margin: 60px 0 0;
    padding: 28px 0 0;
    border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }

  .footer-left { font-size: 0.82rem; color: var(--text3); }
  .footer-left strong { color: var(--text2); }

  .footer-right { display: flex; gap: 8px; }

  /* ── MOBILE ── */
  @media (max-width: 800px) {
    #sidebar { display: none; }
    #main { margin-left: 0; }
    .hero, article { padding-left: 20px; padding-right: 20px; }
    .hero h1 { font-size: 1.8rem; }
  }
</style>
</head>
<body>

<div id="progress"></div>

<nav id="sidebar">
  <div class="sidebar-logo">
    <div class="logo-mark">
      <div class="logo-icon">NX</div>
      <span class="logo-name">NEXUS</span>
    </div>
    <span class="sidebar-badge">PRD v4.0 — Apex</span>
  </div>
  <div class="toc-section-label">Contents</div>
  ${tocHtml}
</nav>

<div id="main">
  <header class="hero">
    <div class="hero-badges">
      <span class="badge badge-blue">PRD v4.0 — Apex Edition</span>
      <span class="badge badge-purple">AI-Powered</span>
      <span class="badge badge-green">Cloud-Native</span>
      <span class="badge badge-cyan">Multi-Platform</span>
    </div>
    <h1>WhatsApp Remote Desktop<br>Control System</h1>
    <div class="hero-meta">
      <span><strong>Codename:</strong> NEXUS</span>
      <span><strong>Target:</strong> Windows / macOS / Linux</span>
      <span><strong>Scale:</strong> 1 → ∞ machines</span>
      <span><strong>Updated:</strong> April 2026</span>
    </div>
    <div class="hero-promise">
      <span class="promise-icon">⚡</span>
      <span><strong>Core Promise:</strong> Type a message on WhatsApp. Your PC responds in under 2 seconds — anywhere on Earth.</span>
    </div>
  </header>

  <article>
    ${content}

    <div class="footer">
      <div class="footer-left">
        Generated for <strong>Replit AI Coding Agent</strong> · NEXUS PRD v4.0 Apex Edition
      </div>
      <div class="footer-right">
        <span class="badge badge-blue">Confidential</span>
        <span class="badge badge-green">Live Document</span>
      </div>
    </div>
  </article>
</div>

<script>
  // ── Progress bar ──
  window.addEventListener("scroll", () => {
    const el = document.getElementById("progress");
    const doc = document.documentElement;
    const scrolled = doc.scrollTop / (doc.scrollHeight - doc.clientHeight) * 100;
    el.style.width = scrolled + "%";
  });

  // ── Active TOC link ──
  const tocLinks = document.querySelectorAll(".toc-link");
  const headings = document.querySelectorAll("h2[id], h3[id]");

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove("active"));
        const active = document.querySelector('.toc-link[href="#' + entry.target.id + '"]');
        if (active) {
          active.classList.add("active");
          active.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    });
  }, { rootMargin: "-10% 0px -80% 0px" });

  headings.forEach(h => observer.observe(h));

  // ── Copy code ──
  function copyCode(id) {
    const el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => {
      const btn = el.closest(".code-block").querySelector(".copy-btn");
      btn.classList.add("copied");
      btn.textContent = "✓ Copied";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2000);
    });
  }
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  try {
    const md = fs.readFileSync(path.join(__dirname, "PRD.md"), "utf-8");
    const { html: body, toc } = mdToHtml(md);
    const page = buildPage(body, toc);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<pre style="color:red;padding:20px;">Error loading PRD:\n${e.message}\n\n${e.stack}</pre>`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXUS PRD viewer running on http://0.0.0.0:${PORT}`);
});
