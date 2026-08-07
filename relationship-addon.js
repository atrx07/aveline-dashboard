"use strict";

(() => {
  const STATUS_META = {
    stranger: ["Stranger", "◌", "neutral"],
    acquaintance: ["Acquaintance", "◔", "neutral"],
    familiar: ["Familiar", "◕", "neutral"],
    respected: ["Respected", "✦", "positive"],
    friend: ["Friend", "🤝", "positive"],
    close_friend: ["Close friend", "💚", "positive"],
    best_friend: ["Best friend", "💫", "positive"],
    confidant: ["Confidant", "🔐", "positive"],
    protective: ["Protective", "🛡️", "positive"],
    friendly_rival: ["Friendly rival", "⚡", "competitive"],
    rival: ["Rival", "⚔️", "competitive"],
    flirty: ["Flirty", "✨", "romantic"],
    crush: ["Crush", "💗", "romantic"],
    romantic_interest: ["Romantic interest", "💞", "romantic"],
    partner: ["Partner", "❤️", "romantic"],
    distant_friend: ["Distant friend", "↔", "distant"],
    cautious: ["Cautious", "⚠️", "distant"],
    distrustful: ["Distrustful", "◈", "negative"],
    uneasy: ["Uneasy", "…", "distant"],
    disappointed: ["Disappointed", "↓", "distant"],
    disliked: ["Disliked", "✕", "negative"],
    avoided: ["Avoided", "↘", "negative"],
    hostile: ["Hostile", "🔥", "negative"],
    enemy: ["Enemy", "☠", "negative"],
    estranged: ["Estranged", "⌁", "distant"],
  };

  const METRICS = [
    ["familiarity", "Familiarity"],
    ["trust", "Trust"],
    ["affection", "Affection"],
    ["respect", "Respect"],
    ["hostility", "Hostility"],
  ];

  let snapshot = null;
  let decorateQueued = false;

  const css = `
    .rel-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.35px;white-space:nowrap;border:1px solid rgba(95,184,255,.18);background:rgba(95,184,255,.07);color:var(--blue)}
    .rel-badge.positive{border-color:rgba(95,255,154,.22);background:rgba(95,255,154,.08);color:var(--green)}
    .rel-badge.romantic{border-color:rgba(255,122,190,.28);background:rgba(255,122,190,.09);color:#ff7abe}
    .rel-badge.competitive{border-color:rgba(255,179,71,.3);background:rgba(255,179,71,.08);color:var(--orange)}
    .rel-badge.distant{border-color:rgba(255,179,71,.2);background:rgba(255,179,71,.05);color:#d8a76a}
    .rel-badge.negative{border-color:rgba(255,95,95,.3);background:rgba(255,95,95,.08);color:var(--red)}
    .rel-panel{margin:0 0 10px;padding:10px;border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.018)}
    .rel-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .rel-panel-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:800}
    .rel-count{font-size:9px;color:var(--muted)}
    .rel-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
    .rel-metric{min-width:0}
    .rel-metric-head{display:flex;justify-content:space-between;gap:3px;font-size:8px;color:var(--muted);margin-bottom:4px;overflow:hidden}
    .rel-metric-head span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rel-metric-head b{color:var(--dim);font-weight:800;font-variant-numeric:tabular-nums}
    .rel-track{height:3px;border-radius:3px;background:#242424;overflow:hidden}
    .rel-fill{height:100%;border-radius:3px;background:var(--accent);transition:width .35s ease}
    .rel-metric.hostility .rel-fill{background:var(--red)}
    .rel-pending{display:flex;align-items:flex-start;gap:7px;margin-top:9px;padding-top:8px;border-top:1px solid var(--border);font-size:9px;line-height:1.4;color:var(--dim)}
    .rel-pending strong{color:var(--orange);font-weight:900;white-space:nowrap}
    .rel-pending-copy{min-width:0;word-break:break-word}
    .rel-none{font-size:9px;color:var(--muted);font-style:italic}
    @media(max-width:620px){.rel-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rel-metric:last-child{grid-column:span 2}}
  `;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function prettyStatus(status) {
    const meta = STATUS_META[status] || [String(status || "Untracked").replace(/_/g, " "), "◌", "neutral"];
    return { label: meta[0], icon: meta[1], family: meta[2] };
  }

  function installStyles() {
    if (document.getElementById("aveline-relationship-styles")) return;
    const style = document.createElement("style");
    style.id = "aveline-relationship-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function badge(rel) {
    if (!rel) return '<span class="rel-badge neutral" data-rel-addon>◌ Untracked</span>';
    const meta = prettyStatus(rel.status);
    return `<span class="rel-badge ${esc(meta.family)}" data-rel-addon>${esc(meta.icon)} ${esc(meta.label)}</span>`;
  }

  function panel(rel) {
    if (!rel) {
      return '<div class="rel-panel" data-rel-addon><div class="rel-none">No canonical relationship state recorded yet.</div></div>';
    }

    const metrics = rel.metrics || {};
    const pending = rel.pendingTransition;
    const pendingMeta = pending ? prettyStatus(pending.target) : null;
    const pendingHtml = pending
      ? `<div class="rel-pending"><strong>Considering → ${esc(pendingMeta.icon)} ${esc(pendingMeta.label)}</strong><div class="rel-pending-copy">Evidence ${esc(pending.evidence || 0)} · ${esc(pending.reason || "relationship evidence is accumulating")}</div></div>`
      : "";

    return `<div class="rel-panel" data-rel-addon>
      <div class="rel-panel-head"><div class="rel-panel-title">Relationship state</div><div class="rel-count">${esc(rel.interactionCount || 0)} judged interaction${Number(rel.interactionCount || 0) === 1 ? "" : "s"}</div></div>
      <div class="rel-metrics">
        ${METRICS.map(([key, label]) => {
          const value = Math.max(0, Math.min(100, Number(metrics[key]) || 0));
          return `<div class="rel-metric ${key === "hostility" ? "hostility" : ""}"><div class="rel-metric-head"><span>${esc(label)}</span><b>${value}</b></div><div class="rel-track"><div class="rel-fill" style="width:${value}%"></div></div></div>`;
        }).join("")}
      </div>
      ${pendingHtml}
    </div>`;
  }

  function clearDecorations(root) {
    root?.querySelectorAll?.('[data-rel-addon]').forEach((node) => node.remove());
  }

  function decorateDm(card, chat) {
    if (!card || !chat) return;
    clearDecorations(card);
    const top = card.querySelector(".cc-top");
    if (top) top.insertAdjacentHTML("beforeend", badge(chat.relationship));
    const meta = card.querySelector(".cc-meta");
    if (meta) meta.insertAdjacentHTML("afterend", panel(chat.relationship));
  }

  function decorateMember(row, member) {
    if (!row || !member) return;
    clearDecorations(row);
    const top = row.querySelector(".member-top");
    if (top) top.insertAdjacentHTML("beforeend", badge(member.relationship));
    const meta = row.querySelector(".member-meta");
    if (meta) meta.insertAdjacentHTML("afterend", panel(member.relationship));
  }

  function decorate() {
    decorateQueued = false;
    if (!snapshot || !document.getElementById("chats-content")) return;

    const groups = snapshot.filter((chat) => chat.isGroup);
    const dms = snapshot.filter((chat) => !chat.isGroup);

    const groupCards = [...document.querySelectorAll("#chats-content .group-card")];
    groupCards.forEach((card, groupIndex) => {
      const chat = groups[groupIndex];
      if (!chat) return;
      const rows = [...card.querySelectorAll(".member-row")];
      rows.forEach((row, memberIndex) => decorateMember(row, chat.members?.[memberIndex]));
    });

    const dmCards = [...document.querySelectorAll("#chats-content .dm-card")];
    dmCards.forEach((card, dmIndex) => decorateDm(card, dms[dmIndex]));
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    setTimeout(decorate, 60);
  }

  async function refresh() {
    if (typeof api !== "function") return;
    try {
      snapshot = await api("/api/chats");
      queueDecorate();
    } catch (error) {
      console.warn("[relationship-dashboard] Failed to load relationships:", error?.message || error);
    }
  }

  function boot() {
    installStyles();

    const wait = setInterval(() => {
      const content = document.getElementById("chats-content");
      if (!content) return;
      clearInterval(wait);

      const observer = new MutationObserver(() => queueDecorate());
      observer.observe(content, { childList: true, subtree: true });
      refresh();
    }, 200);

    document.addEventListener("click", (event) => {
      const chatsNav = event.target.closest('[data-page="chats"], [onclick*="chats"], .dni');
      const refreshButton = event.target.closest('#page-chats .rbtn');
      if (refreshButton || chatsNav) setTimeout(refresh, 350);
    });

    setInterval(() => {
      if (!document.hidden && document.getElementById("page-chats")?.classList.contains("active")) {
        refresh();
      }
    }, 6000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && document.getElementById("page-chats")?.classList.contains("active")) refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
