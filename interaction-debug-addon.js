"use strict";

(() => {
  const style = document.createElement("style");
  style.textContent = `
    .interaction-debug-pill{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:3px 7px;border-radius:999px;border:1px solid rgba(95,184,255,.25);background:rgba(95,184,255,.07);color:#8dccff;font-size:9px;font-weight:850;letter-spacing:.35px}
    .interaction-debug-pill.react{border-color:rgba(232,255,107,.25);background:rgba(232,255,107,.06);color:var(--accent)}
    .interaction-debug-pill.silent{border-color:rgba(255,179,71,.28);background:rgba(255,179,71,.06);color:var(--orange)}
  `;
  document.head.appendChild(style);

  function pillText(trace) {
    const recommended = trace?.interaction?.recommendation?.action || null;
    const resolved = trace?.interaction?.resolved?.action || null;
    const final = trace?.interaction?.final?.action || resolved;
    const reaction = trace?.interaction?.final?.reaction || trace?.interaction?.resolved?.reaction || null;
    if (!final) return null;

    const finalText = final === "react" && reaction ? `react ${reaction}` : final;
    if (recommended && recommended !== final) return `Key 4: ${recommended} → policy: ${finalText}`;
    return `Response mode: ${finalText}`;
  }

  async function refresh() {
    if (typeof api !== "function" || !document.getElementById("page-debug")?.classList.contains("active")) return;
    try {
      const data = await api("/api/debug/traces?limit=50");
      const traces = Array.isArray(data?.traces) ? data.traces : [];
      const cards = [...document.querySelectorAll("#page-debug .debug-trace")];

      for (const card of cards) {
        card.querySelectorAll("[data-interaction-debug]").forEach((node) => node.remove());
        const sub = card.querySelector(".debug-sub")?.textContent || "";
        const trace = traces.find((entry) => entry?.id && sub.includes(entry.id));
        const text = pillText(trace);
        if (!text) continue;

        const mode = trace?.interaction?.final?.action || trace?.interaction?.resolved?.action || "reply";
        const pill = document.createElement("div");
        pill.dataset.interactionDebug = "1";
        pill.className = `interaction-debug-pill ${mode}`;
        pill.textContent = text;
        card.querySelector(".debug-summary-main")?.appendChild(pill);
      }
    } catch {}
  }

  setInterval(refresh, 4000);
  document.addEventListener("click", (event) => {
    if (event.target.closest("#debug-nav-item,#debug-refresh")) setTimeout(refresh, 450);
  });
})();
