"use strict";

(() => {
  const css = `
    .debug-health{display:grid;grid-template-columns:1fr;gap:8px;margin:0 0 12px;padding:12px;border:1px solid var(--border);border-radius:var(--rs);background:var(--surface)}
    .debug-health.good{border-color:rgba(95,255,154,.35)}
    .debug-health.warn{border-color:rgba(255,179,71,.45)}
    .debug-health.bad{border-color:rgba(255,95,95,.5)}
    .debug-health-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .debug-health-title{font-size:12px;font-weight:900;font-style:italic}
    .debug-health-badge{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:3px 7px;border-radius:999px;background:rgba(95,255,154,.1);color:var(--green)}
    .debug-health.warn .debug-health-badge{background:rgba(255,179,71,.12);color:var(--orange)}
    .debug-health.bad .debug-health-badge{background:rgba(255,95,95,.12);color:var(--red)}
    .debug-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .debug-health-cell{padding:8px;background:var(--surface2);border-radius:7px;min-width:0}
    .debug-health-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:3px}
    .debug-health-value{font-size:11px;color:var(--text);word-break:break-word}
    .debug-health-diagnosis{font-size:11px;color:var(--dim);line-height:1.45}
    @media(min-width:850px){.debug-health-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  `;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function installStyles() {
    if (document.getElementById("aveline-debug-health-styles")) return;
    const style = document.createElement("style");
    style.id = "aveline-debug-health-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    const page = document.getElementById("page-debug");
    const note = document.getElementById("debug-retention");
    if (!page || !note) return null;
    let panel = document.getElementById("debug-health");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "debug-health";
      panel.className = "debug-health warn";
      panel.innerHTML = '<div class="debug-health-diagnosis">Checking the explicit message pipeline…</div>';
      note.insertAdjacentElement("afterend", panel);
    }
    return panel;
  }

  function formatTime(value) {
    return value ? new Date(value).toLocaleString() : "—";
  }

  function renderHealth(health) {
    const panel = ensurePanel();
    if (!panel) return;

    const broken = !health?.active || !health?.identityListenersAttached ||
      (health?.messagesSeen > 0 && health?.tracesCreated === 0);
    const warning = !broken && (health?.preprocessErrors > 0 || health?.lastIdentityError);
    panel.className = `debug-health ${broken ? "bad" : warning ? "warn" : "good"}`;
    const label = broken ? "Disconnected" : warning ? "Degraded" : "Healthy";

    panel.innerHTML = `
      <div class="debug-health-head">
        <div class="debug-health-title">Pipeline health</div>
        <span class="debug-health-badge">${esc(label)}</span>
      </div>
      <div class="debug-health-grid">
        <div class="debug-health-cell"><div class="debug-health-label">Mode</div><div class="debug-health-value">${esc(health?.mode || "unknown")}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Messages seen</div><div class="debug-health-value">${esc(health?.messagesSeen ?? 0)}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Traces created</div><div class="debug-health-value">${esc(health?.tracesCreated ?? 0)}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Preprocess errors</div><div class="debug-health-value">${esc(health?.preprocessErrors ?? 0)}</div></div>
      </div>
      <div class="debug-health-diagnosis">${esc(health?.diagnosis || "No diagnosis returned.")}</div>
      <div class="debug-health-grid">
        <div class="debug-health-cell"><div class="debug-health-label">Last trace</div><div class="debug-health-value">${esc(formatTime(health?.lastTraceAt))}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Last raw text</div><div class="debug-health-value">${esc(health?.lastRawText || "—")}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Last parsed text</div><div class="debug-health-value">${esc(health?.lastParsedText || "—")}</div></div>
        <div class="debug-health-cell"><div class="debug-health-label">Identity listeners</div><div class="debug-health-value">${health?.identityListenersAttached ? "attached" : "missing"}</div></div>
      </div>`;
  }

  async function refreshHealth() {
    if (typeof api !== "function") return;
    try {
      renderHealth(await api("/api/debug/health"));
    } catch (error) {
      renderHealth({
        active: false,
        diagnosis: `Health endpoint failed: ${error?.message || error}`,
      });
    }
  }

  function boot() {
    installStyles();
    const wait = setInterval(() => {
      if (ensurePanel()) {
        clearInterval(wait);
        refreshHealth();
      }
    }, 250);

    document.addEventListener("click", (event) => {
      if (event.target.closest("#debug-nav-item") || event.target.closest("#debug-refresh")) {
        setTimeout(refreshHealth, 100);
      }
    });
    setInterval(() => {
      if (document.getElementById("page-debug")?.classList.contains("active")) refreshHealth();
    }, 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
