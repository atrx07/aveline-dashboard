"use strict";

(() => {
  const MODEL_LABELS = {
    "qwen/qwen3.6-27b": "Qwen 3.6 27B",
    "openai/gpt-oss-20b": "GPT-OSS 20B",
    "openai/gpt-oss-120b": "GPT-OSS 120B",
  };

  let snapshot = null;
  let serverOffset = 0;

  const css = `
    #router-health-section{margin:20px 0 12px}
    .router-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}
    .router-title{font-size:12px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:1px;color:var(--dim)}
    .router-sub{font-size:10px;color:var(--muted);margin-top:3px}
    .router-live{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--green);font-weight:800;text-transform:uppercase;letter-spacing:1px}
    .router-live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 7px var(--green)}
    .router-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .router-model{background:linear-gradient(145deg,var(--surface),rgba(24,24,24,.72));border:1px solid var(--border);border-radius:14px;padding:14px;min-width:0}
    .router-model-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--border)}
    .router-model-name{font-size:15px;font-weight:900;font-style:italic;color:var(--text)}
    .router-model-id{font-size:9px;color:var(--muted);margin-top:3px;word-break:break-all}
    .router-model-order{font-size:9px;font-weight:900;color:var(--accent);background:var(--accent-dim);border:1px solid rgba(232,255,107,.14);padding:3px 7px;border-radius:999px;white-space:nowrap}
    .router-keys{display:flex;flex-direction:column;gap:8px;margin-top:10px}
    .router-key{position:relative;overflow:hidden;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 12px;transition:border-color .2s,background .2s}
    .router-key.available{border-color:rgba(95,255,154,.22)}
    .router-key.cooldown{border-color:rgba(255,179,71,.32);background:rgba(255,179,71,.035)}
    .router-key.disabled,.router-key.not_configured,.router-key.model_unavailable{border-color:rgba(255,95,95,.3);background:rgba(255,95,95,.03)}
    .router-key.ready_to_probe{border-color:rgba(95,184,255,.35);background:rgba(95,184,255,.035)}
    .router-key-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .router-key-name{font-size:11px;font-weight:900;font-style:italic;color:var(--text)}
    .router-badge{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;padding:3px 6px;border-radius:999px;background:rgba(95,255,154,.1);color:var(--green)}
    .router-key.cooldown .router-badge{background:rgba(255,179,71,.12);color:var(--orange)}
    .router-key.disabled .router-badge,.router-key.not_configured .router-badge,.router-key.model_unavailable .router-badge{background:rgba(255,95,95,.12);color:var(--red)}
    .router-key.ready_to_probe .router-badge{background:rgba(95,184,255,.12);color:var(--blue)}
    .router-timer{font-variant-numeric:tabular-nums;font-size:20px;font-weight:900;font-style:italic;color:var(--orange);margin-top:8px;letter-spacing:-.5px}
    .router-meta{display:flex;justify-content:space-between;gap:8px;margin-top:7px;font-size:9px;color:var(--muted)}
    .router-reason{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%}
    .router-empty{padding:24px;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--muted);font-size:11px}
    @media(min-width:900px){.router-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.router-model{padding:16px}}
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
    if (document.getElementById("router-health-styles")) return;
    const style = document.createElement("style");
    style.id = "router-health-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function cleanLegacyOverview() {
    const page = document.getElementById("page-overview");
    if (!page) return;
    [...page.querySelectorAll(".stitle")].forEach((title) => {
      const text = title.textContent.trim().toLowerCase();
      if (text === "model usage" || text === "key usage") {
        const next = title.nextElementSibling;
        title.style.display = "none";
        if (next) next.style.display = "none";
      }
    });
  }

  function ensurePanel() {
    const page = document.getElementById("page-overview");
    if (!page) return null;
    let section = document.getElementById("router-health-section");
    if (section) return section;

    section = document.createElement("section");
    section.id = "router-health-section";
    section.innerHTML = `
      <div class="router-head">
        <div><div class="router-title">Groq routing health</div><div class="router-sub">Model-first routing · persistent cooldowns · live state</div></div>
        <div class="router-live"><span class="router-live-dot"></span>Live</div>
      </div>
      <div class="router-grid"><div class="router-empty">Loading router health…</div></div>`;

    const topbar = page.querySelector(".topbar");
    const statGrid = topbar?.nextElementSibling;
    if (statGrid) statGrid.insertAdjacentElement("afterend", section);
    else topbar?.insertAdjacentElement("afterend", section);
    return section;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours) return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
    return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
  }

  function formatRelative(value) {
    if (!value) return "Never";
    const seconds = Math.max(0, Math.floor(((Date.now() + serverOffset) - value) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }

  function effectiveStatus(key) {
    const now = Date.now() + serverOffset;
    if (!key.configured) return "not_configured";
    if (key.disabled) return "disabled";
    if (key.modelUnavailable || key.status === "model_unavailable") return "model_unavailable";
    if (key.cooldownUntil > now) return "cooldown";
    if (key.cooldownUntil) return "ready_to_probe";
    return key.status === "unknown" ? "available" : key.status;
  }

  function statusLabel(status) {
    return ({
      available: "Available",
      cooldown: "Cooldown",
      ready_to_probe: "Ready to probe",
      disabled: "Disabled",
      model_unavailable: "Model unavailable",
      not_configured: "Not configured",
      unknown: "Unknown",
    })[status] || status;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const grid = panel.querySelector(".router-grid");
    if (!snapshot?.models?.length) {
      grid.innerHTML = '<div class="router-empty">Router health is unavailable.</div>';
      return;
    }

    const now = Date.now() + serverOffset;
    grid.innerHTML = snapshot.models.map((modelEntry, modelIndex) => `
      <article class="router-model">
        <div class="router-model-head">
          <div><div class="router-model-name">${esc(MODEL_LABELS[modelEntry.model] || modelEntry.model)}</div><div class="router-model-id">${esc(modelEntry.model)}</div></div>
          <span class="router-model-order">Tier ${modelIndex + 1}</span>
        </div>
        <div class="router-keys">
          ${modelEntry.keys.map((key) => {
            const status = effectiveStatus(key);
            const remaining = Math.max(0, Number(key.cooldownUntil || 0) - now);
            const recent = key.lastSuccessAt ? `Success ${formatRelative(key.lastSuccessAt)}` : key.lastFailureAt ? `Failed ${formatRelative(key.lastFailureAt)}` : "No attempts yet";
            return `
              <div class="router-key ${esc(status)}">
                <div class="router-key-top"><div class="router-key-name">API Key ${esc(key.keyNumber)}</div><span class="router-badge">${esc(statusLabel(status))}</span></div>
                ${status === "cooldown" ? `<div class="router-timer" data-until="${esc(key.cooldownUntil)}">${formatDuration(remaining)}</div>` : ""}
                <div class="router-meta"><span class="router-reason">${esc(key.reason || recent)}</span><span>${esc(recent)}</span></div>
              </div>`;
          }).join("")}
        </div>
      </article>`).join("");
  }

  async function refresh() {
    if (typeof api !== "function") return;
    try {
      const next = await api("/api/groq/router-health");
      snapshot = next;
      serverOffset = Number(next.serverTime || Date.now()) - Date.now();
      render();
    } catch (error) {
      const grid = ensurePanel()?.querySelector(".router-grid");
      if (grid) grid.innerHTML = `<div class="router-empty">Could not load routing health: ${esc(error?.message || error)}</div>`;
    }
  }

  function boot() {
    installStyles();
    const wait = setInterval(() => {
      if (ensurePanel()) {
        clearInterval(wait);
        cleanLegacyOverview();
        refresh();
      }
    }, 200);

    setInterval(() => {
      if (snapshot && document.getElementById("page-overview")?.classList.contains("active")) render();
    }, 1000);

    setInterval(() => {
      if (!document.hidden && document.getElementById("page-overview")?.classList.contains("active")) refresh();
    }, 5000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
