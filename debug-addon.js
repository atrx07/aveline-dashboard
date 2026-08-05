"use strict";

(() => {
  const state = {
    traces: [],
    retention: null,
    filter: "all",
    query: "",
  };

  const css = `
    .debug-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .debug-input,.debug-select{background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);padding:9px 11px;color:var(--text);font:inherit;outline:none}
    .debug-input{flex:1;min-width:210px}
    .debug-input:focus,.debug-select:focus{border-color:var(--accent)}
    .debug-note{font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px;padding:11px 13px;border:1px solid rgba(232,255,107,.14);background:rgba(232,255,107,.03);border-radius:var(--rs)}
    .debug-list{display:flex;flex-direction:column;gap:10px}
    .debug-trace{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
    .debug-trace.problem{border-color:rgba(255,95,95,.45)}
    .debug-trace.mismatch{border-color:rgba(255,179,71,.55)}
    .debug-summary{list-style:none;cursor:pointer;padding:14px;display:flex;gap:10px;align-items:flex-start}
    .debug-summary::-webkit-details-marker{display:none}
    .debug-summary-main{flex:1;min-width:0}
    .debug-title{font-size:13px;font-weight:800;word-break:break-word}
    .debug-sub{font-size:10px;color:var(--muted);margin-top:3px;word-break:break-all}
    .debug-status{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;padding:3px 7px;border-radius:999px;background:var(--accent-dim);color:var(--accent);white-space:nowrap}
    .debug-status.error,.debug-status.preprocess-error{background:rgba(255,95,95,.12);color:var(--red)}
    .debug-status.skipped{background:rgba(255,179,71,.12);color:var(--orange)}
    .debug-status.processing,.debug-status.parsed,.debug-status.received{background:rgba(95,184,255,.12);color:var(--blue)}
    .debug-body{padding:0 14px 14px;border-top:1px solid var(--border)}
    .debug-grid{display:grid;grid-template-columns:1fr;gap:9px;margin-top:12px}
    .debug-stage{background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;min-width:0}
    .debug-stage-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent);margin-bottom:8px}
    .debug-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:9px 0 4px}
    .debug-label:first-of-type{margin-top:0}
    .debug-text{font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--text)}
    .debug-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#cfd3d8;background:#0c0c0c;border:1px solid #202020;border-radius:7px;padding:9px;max-height:360px;overflow:auto}
    .debug-pill-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
    .debug-pill{font-size:9px;color:var(--dim);border:1px solid var(--border);padding:3px 7px;border-radius:999px;word-break:break-all}
    .debug-good{color:var(--green)}
    .debug-bad{color:var(--red)}
    .debug-warn{color:var(--orange)}
    .debug-call{border:1px solid var(--border);border-radius:8px;margin-top:8px;overflow:hidden}
    .debug-call summary{cursor:pointer;padding:9px 10px;font-size:11px;font-weight:700;background:#141414}
    .debug-call-content{padding:10px}
    .debug-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    @media(min-width:900px){.debug-grid{grid-template-columns:1fr 1fr}.debug-stage.full{grid-column:1/-1}}
  `;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function json(value) {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return String(value);
    }
  }

  function code(value) {
    return `<pre class="debug-code">${esc(typeof value === "string" ? value : json(value))}</pre>`;
  }

  function time(value) {
    if (!value) return "unknown time";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function installStyles() {
    if (document.getElementById("aveline-debug-styles")) return;
    const style = document.createElement("style");
    style.id = "aveline-debug-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function installNavigation() {
    if (document.getElementById("debug-nav-item")) return;
    const nav = document.querySelector(".drawer-nav");
    if (!nav) return;

    const item = document.createElement("div");
    item.className = "dni";
    item.id = "debug-nav-item";
    item.innerHTML = '<span class="dni-icon">🧪</span><span class="dni-label">Debug Trace</span>';
    item.addEventListener("click", () => openDebugPage(item));
    nav.appendChild(item);
  }

  function installPage() {
    if (document.getElementById("page-debug")) return;
    const main = document.querySelector("main.main");
    if (!main) return;

    const page = document.createElement("div");
    page.className = "page";
    page.id = "page-debug";
    page.innerHTML = `
      <div class="topbar">
        <div>
          <div class="pt">Debug Trace</div>
          <div class="ps">WhatsApp payload → parser → Groq → reply</div>
        </div>
        <button class="rbtn" id="debug-refresh">↻</button>
      </div>
      <div class="debug-note" id="debug-retention">
        Traces are protected by the dashboard token and kept only in Railway memory. They disappear on restart or deployment.
      </div>
      <div class="debug-toolbar">
        <input class="debug-input" id="debug-search" placeholder="Search sender, group, message, ID…" />
        <select class="debug-select" id="debug-filter">
          <option value="all">All traces</option>
          <option value="problems">Problems only</option>
          <option value="completed">Completed</option>
          <option value="skipped">Skipped</option>
        </select>
        <button class="rbtn" id="debug-clear">Clear traces</button>
      </div>
      <div class="debug-list" id="debug-list"><div class="loading pulse">Loading traces…</div></div>
    `;
    main.appendChild(page);

    document.getElementById("debug-refresh").addEventListener("click", loadDebugTraces);
    document.getElementById("debug-clear").addEventListener("click", clearDebugTraces);
    document.getElementById("debug-filter").addEventListener("change", (event) => {
      state.filter = event.target.value;
      render();
    });
    document.getElementById("debug-search").addEventListener("input", (event) => {
      state.query = event.target.value.toLowerCase().trim();
      render();
    });
  }

  function openDebugPage(item) {
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
    document.querySelectorAll(".dni").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-debug")?.classList.add("active");
    item?.classList.add("active");
    const title = document.getElementById("nav-page-name");
    if (title) title.textContent = "Debug Trace";
    if (typeof closeDrawer === "function") closeDrawer();
    loadDebugTraces();
  }

  function isProblem(trace) {
    return trace.status === "error" ||
      trace.status === "preprocess-error" ||
      trace.parsing?.sanitizerMatchedExpectation === false ||
      trace.groqCalls?.some((call) => call.status === "error");
  }

  function filteredTraces() {
    return state.traces.filter((trace) => {
      if (state.filter === "problems" && !isProblem(trace)) return false;
      if (state.filter === "completed" && trace.status !== "completed") return false;
      if (state.filter === "skipped" && trace.status !== "skipped") return false;
      if (!state.query) return true;
      return json(trace).toLowerCase().includes(state.query);
    });
  }

  function stage(title, body, full = false) {
    return `<section class="debug-stage${full ? " full" : ""}">
      <div class="debug-stage-title">${esc(title)}</div>${body}
    </section>`;
  }

  function label(name, value, asCode = false) {
    return `<div class="debug-label">${esc(name)}</div>${asCode ? code(value) : `<div class="debug-text">${esc(value ?? "—")}</div>`}`;
  }

  function renderMentionSteps(steps) {
    if (!Array.isArray(steps) || !steps.length) {
      return '<div class="debug-text">No mention metadata was present.</div>';
    }
    return steps.map((step, index) => `
      <div class="debug-call">
        <div class="debug-call-content">
          <div class="debug-label">Mention ${index + 1}</div>
          <div class="debug-text">${esc(step.rawToken)} → ${esc(step.replacement || "(removed)")}</div>
          <div class="debug-pill-row">
            <span class="debug-pill">JID: ${esc(step.jid)}</span>
            <span class="debug-pill">${esc(step.action)}</span>
            <span class="debug-pill">${step.isBot ? "Aveline trigger" : "Human mention"}</span>
            <span class="debug-pill">Resolved: ${esc(step.resolvedName || "unavailable")}</span>
          </div>
        </div>
      </div>`).join("");
  }

  function renderGroqCalls(calls) {
    if (!Array.isArray(calls) || !calls.length) {
      return '<div class="debug-text">No Groq call was made.</div>';
    }

    return calls.map((call, index) => `
      <details class="debug-call" ${index === calls.length - 1 ? "open" : ""}>
        <summary>
          ${esc(call.purpose || "request")} · ${esc(call.model || "unknown model")} · key/client ${esc(call.clientNumber || "?")}
          · <span class="${call.status === "success" ? "debug-good" : call.status === "error" ? "debug-bad" : "debug-warn"}">${esc(call.status)}</span>
        </summary>
        <div class="debug-call-content">
          ${label("Exact request sent to Groq", call.request, true)}
          ${call.output !== undefined ? label("Raw Groq output", call.output, true) : ""}
          ${call.error ? label("Groq error", call.error, true) : ""}
          ${label("Timing", {
            startedAt: call.startedAt,
            completedAt: call.completedAt,
            durationMs: call.durationMs,
            usage: call.usage,
            finishReason: call.finishReason,
          }, true)}
        </div>
      </details>`).join("");
  }

  function traceCard(trace, index) {
    const mismatch = trace.parsing?.sanitizerMatchedExpectation === false;
    const problem = isProblem(trace);
    const cls = problem ? " problem" : mismatch ? " mismatch" : "";
    const title = trace.sender?.displayNameUsed || trace.sender?.pushName ||
      trace.sender?.canonicalPerson?.displayName || "Unknown sender";
    const location = trace.chat?.groupName || trace.chat?.id || "Unknown chat";
    const preview = trace.whatsapp?.userVisibleEstimate || trace.whatsapp?.rawText || "No text";
    const statusClass = esc(trace.status || "unknown");

    const whatsappBody =
      label("Best-effort user-visible reconstruction", trace.whatsapp?.userVisibleEstimate) +
      label("Raw WhatsApp text field received by bot", trace.whatsapp?.rawText) +
      label("Message key and context metadata", {
        messageType: trace.whatsapp?.messageType,
        key: trace.whatsapp?.key,
        contextInfo: trace.whatsapp?.contextInfo,
      }, true);

    const parsingBody =
      label("Expected parsed text", trace.parsing?.expectedSanitizedText) +
      label("Actual parsed text used by handler", trace.parsing?.actualSanitizedText) +
      `<div class="debug-label">Sanitizer check</div>
       <div class="debug-text ${mismatch ? "debug-bad" : "debug-good"}">
         ${mismatch ? "MISMATCH — parser output differs from the expected replacement." : "Matched expected transformation."}
       </div>` +
      `<div class="debug-label">Mention transformations</div>${renderMentionSteps(trace.parsing?.mentionSteps)}` +
      label("Identity prompt added to reply request", trace.parsing?.identityPrompt || "No identity prompt", true);

    const identityBody =
      label("Sender identity", trace.sender, true) +
      label("Handler/filter decisions", trace.handler || {}, true) +
      (trace.skipReason ? label("Skip reason", `${trace.skipReason}${trace.skipDetails ? `\n${json(trace.skipDetails)}` : ""}`) : "");

    const aiBody =
      label("Text, speaker and memory assembled before identity injection", trace.ai || {}, true) +
      label("Mood analysis result", trace.mood || {}, true);

    const outputBody =
      renderGroqCalls(trace.groqCalls) +
      label("Selected result", trace.selectedGroqResult || {}, true) +
      label("WhatsApp delivery", trace.delivery || {}, true) +
      (trace.error ? label("Pipeline error", trace.error, true) : "");

    return `
      <details class="debug-trace${cls}" ${index === 0 ? "open" : ""}>
        <summary class="debug-summary">
          <span class="debug-status ${statusClass}">${esc(trace.status || "unknown")}</span>
          <div class="debug-summary-main">
            <div class="debug-title">${esc(title)} · ${esc(preview)}</div>
            <div class="debug-sub">${esc(location)} · ${esc(time(trace.createdAt))} · ${esc(trace.id)}</div>
          </div>
        </summary>
        <div class="debug-body">
          <div class="debug-grid">
            ${stage("1 · What WhatsApp delivered", whatsappBody)}
            ${stage("2 · Parsing and mention resolution", parsingBody)}
            ${stage("3 · Identity and handler decisions", identityBody)}
            ${stage("4 · AI input preparation", aiBody)}
            ${stage("5 · Exact Groq calls and output", outputBody, true)}
          </div>
          <div class="debug-actions">
            <button class="rbtn" data-copy-trace="${esc(trace.id)}">Copy full trace JSON</button>
          </div>
        </div>
      </details>`;
  }

  function render() {
    const list = document.getElementById("debug-list");
    if (!list) return;
    const traces = filteredTraces();

    if (!traces.length) {
      list.innerHTML = '<div class="loading">No matching traces yet. Send Aveline a message, then refresh.</div>';
      return;
    }

    list.innerHTML = traces.map(traceCard).join("");
    list.querySelectorAll("[data-copy-trace]").forEach((button) => {
      button.addEventListener("click", async () => {
        const trace = state.traces.find((entry) => entry.id === button.dataset.copyTrace);
        if (!trace) return;
        try {
          await navigator.clipboard.writeText(json(trace));
          button.textContent = "Copied";
          setTimeout(() => { button.textContent = "Copy full trace JSON"; }, 1200);
        } catch {
          button.textContent = "Copy failed";
        }
      });
    });
  }

  async function loadDebugTraces() {
    const list = document.getElementById("debug-list");
    if (!list) return;

    try {
      const data = await api("/api/debug/traces?limit=50");
      state.traces = Array.isArray(data?.traces) ? data.traces : [];
      state.retention = data?.retention || null;
      const note = document.getElementById("debug-retention");
      if (note && state.retention) {
        note.textContent = `Protected, memory-only traces. Keeping the latest ${state.retention.maxTraces} entries; all traces reset on deployment or restart. Raw JIDs and conversation text are visible here for debugging.`;
      }
      render();
    } catch (error) {
      list.innerHTML = `<div class="loading debug-bad">Failed to load debug traces: ${esc(error?.message || error)}</div>`;
    }
  }

  async function clearDebugTraces() {
    if (!confirm("Clear all in-memory debug traces?")) return;
    try {
      await api("/api/debug/traces", { method: "DELETE" });
      state.traces = [];
      render();
    } catch (error) {
      alert(`Failed to clear traces: ${error?.message || error}`);
    }
  }

  installStyles();
  installNavigation();
  installPage();

  setInterval(() => {
    if (document.getElementById("page-debug")?.classList.contains("active")) {
      loadDebugTraces();
    }
  }, 4000);

  window.loadDebugTraces = loadDebugTraces;
})();
