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
    hated: ["Hated", "🩸", "negative"],
    enemy: ["Enemy", "☠", "negative"],
    estranged: ["Estranged", "⌁", "distant"],
  };

  const MOODS = [
    ["happy", "😊 Happy"],
    ["neutral", "😐 Neutral"],
    ["teasing", "😏 Teasing"],
    ["annoyed", "😒 Annoyed"],
    ["affectionate", "🥰 Affectionate"],
  ];

  const METRICS = [
    ["familiarity", "Familiarity", "blue"],
    ["trust", "Trust", "green"],
    ["affection", "Affection", "pink"],
    ["respect", "Respect", "yellow"],
    ["hostility", "Hostility", "red"],
  ];

  let snapshot = null;
  let decorateQueued = false;
  let editingPersonId = null;
  let saving = false;

  const css = `
    .rel-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.35px;white-space:nowrap;border:1px solid rgba(95,184,255,.28);background:rgba(95,184,255,.09);color:#8dccff}
    .rel-badge.positive{border-color:rgba(95,255,154,.3);background:rgba(95,255,154,.09);color:#82ffae}
    .rel-badge.romantic{border-color:rgba(255,122,190,.34);background:rgba(255,122,190,.1);color:#ff9bcb}
    .rel-badge.competitive{border-color:rgba(255,179,71,.36);background:rgba(255,179,71,.09);color:#ffc46f}
    .rel-badge.distant{border-color:rgba(217,173,115,.3);background:rgba(217,173,115,.08);color:#e8bc82}
    .rel-badge.negative{border-color:rgba(255,95,95,.38);background:rgba(255,95,95,.09);color:#ff8585}

    .rel-panel{margin:2px 0 12px;padding:14px;border:1px solid #2b2f35;border-radius:11px;background:linear-gradient(145deg,rgba(24,26,29,.96),rgba(17,18,20,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
    .rel-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;flex-wrap:wrap}
    .rel-panel-title{font-size:11px;text-transform:uppercase;letter-spacing:1.15px;color:#b8c4d2;font-weight:900}
    .rel-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .rel-count{font-size:10px;color:#8c98a6;font-weight:650}
    .rel-admin-toggle{border:1px solid #39424d;background:#20242a;color:#b8c9db;border-radius:7px;padding:5px 9px;font-size:9px;font-weight:850;letter-spacing:.55px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:.15s}
    .rel-admin-toggle:hover,.rel-admin-toggle.active{border-color:var(--accent);color:var(--accent);background:rgba(232,255,107,.055)}

    .rel-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}
    .rel-metric{min-width:0;padding:9px 10px;background:#121417;border:1px solid #292d33;border-radius:8px}
    .rel-metric-head{display:flex;justify-content:space-between;align-items:center;gap:7px;margin-bottom:8px}
    .rel-metric-name{font-size:11px;color:#c9d4df;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rel-value{min-width:30px;text-align:center;font-size:12px;line-height:1;font-weight:900;font-variant-numeric:tabular-nums;color:#f4f7fa;background:#252b32;border:1px solid #343c46;border-radius:5px;padding:4px 5px}
    .rel-track{height:8px;border-radius:999px;background:#282d34;border:1px solid #323842;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.45)}
    .rel-fill{height:100%;border-radius:999px;transition:width .35s ease;background:#70bfff;box-shadow:0 0 8px rgba(112,191,255,.18)}
    .rel-metric.green .rel-fill{background:#64e895;box-shadow:0 0 8px rgba(100,232,149,.18)}
    .rel-metric.pink .rel-fill{background:#ff86c3;box-shadow:0 0 8px rgba(255,134,195,.18)}
    .rel-metric.yellow .rel-fill{background:#e8ff6b;box-shadow:0 0 8px rgba(232,255,107,.16)}
    .rel-metric.red .rel-fill{background:#ff6d6d;box-shadow:0 0 8px rgba(255,109,109,.2)}

    .rel-pending{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:10px 11px;border:1px solid rgba(255,179,71,.18);border-radius:8px;background:rgba(255,179,71,.035);font-size:10px;line-height:1.45;color:#b7a58b}
    .rel-pending strong{color:#ffc46f;font-weight:900;white-space:nowrap}
    .rel-pending-copy{min-width:0;word-break:break-word}
    .rel-none{font-size:10px;color:#8c98a6;font-style:italic}

    .rel-editor{display:none;margin-top:13px;padding-top:13px;border-top:1px solid #2d3239}
    .rel-editor.open{display:block}
    .rel-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .rel-field label{display:block;font-size:9px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#9dabb9;margin-bottom:5px}
    .rel-select,.rel-number{width:100%;background:#111318;border:1px solid #353b44;border-radius:7px;color:#edf2f7;font:inherit;outline:none}
    .rel-select{padding:9px 10px;font-size:11px}
    .rel-select:focus,.rel-number:focus{border-color:var(--accent)}

    .rel-edit-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
    .rel-edit-metric{padding:10px;background:#111318;border:1px solid #2c3138;border-radius:8px;min-width:0}
    .rel-edit-metric-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:9px}
    .rel-edit-metric-name{font-size:10px;color:#c5d0dc;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rel-number{width:52px;padding:5px 4px;text-align:center;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums}
    .rel-slider{width:100%;height:18px;accent-color:var(--accent);cursor:pointer}
    .rel-edit-metric.red .rel-slider{accent-color:#ff6d6d}
    .rel-edit-metric.pink .rel-slider{accent-color:#ff86c3}
    .rel-edit-metric.blue .rel-slider{accent-color:#70bfff}
    .rel-edit-metric.green .rel-slider{accent-color:#64e895}

    .rel-admin-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    .rel-action{border:1px solid #39414b;background:#181b20;color:#c2ccd7;border-radius:7px;padding:7px 10px;font:inherit;font-size:10px;font-weight:850;cursor:pointer;transition:.15s}
    .rel-action:hover{border-color:var(--accent);color:var(--accent)}
    .rel-action.primary{background:var(--accent);border-color:var(--accent);color:#090a0b}
    .rel-action.primary:hover{opacity:.86;color:#090a0b}
    .rel-action.warn:hover{border-color:var(--orange);color:var(--orange)}
    .rel-action.danger:hover{border-color:var(--red);color:var(--red)}
    .rel-action:disabled,.rel-admin-toggle:disabled{opacity:.45;cursor:not-allowed}
    .rel-admin-note{margin-top:8px;font-size:9px;color:#7f8a96;line-height:1.4}

    .rel-toast{position:fixed;right:18px;bottom:18px;z-index:200;background:#171a1f;border:1px solid #39414b;border-radius:9px;padding:10px 13px;color:#dbe5ef;font-size:11px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.4);animation:relToastIn .18s ease}
    .rel-toast.good{border-color:rgba(95,255,154,.4);color:#82ffae}
    .rel-toast.bad{border-color:rgba(255,95,95,.45);color:#ff8585}
    @keyframes relToastIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}

    @media(max-width:980px){.rel-metrics,.rel-edit-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:620px){.rel-metrics,.rel-edit-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rel-admin-grid{grid-template-columns:1fr}.rel-metric:last-child,.rel-edit-metric:last-child{grid-column:span 2}}
  `;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clampMetric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
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

  function toast(message, type = "good") {
    document.querySelectorAll(".rel-toast").forEach((node) => node.remove());
    const node = document.createElement("div");
    node.className = `rel-toast ${type}`;
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  }

  function badge(rel) {
    if (!rel) return '<span class="rel-badge neutral" data-rel-addon>◌ Untracked</span>';
    const meta = prettyStatus(rel.status);
    return `<span class="rel-badge ${esc(meta.family)}" data-rel-addon>${esc(meta.icon)} ${esc(meta.label)}</span>`;
  }

  function moodOptions(current) {
    return MOODS.map(([value, label]) => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`).join("");
  }

  function statusOptions(current) {
    return Object.entries(STATUS_META).map(([value, meta]) =>
      `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(meta[1])} ${esc(meta[0])}</option>`
    ).join("");
  }

  function metricView(metrics) {
    return METRICS.map(([key, label, family]) => {
      const value = clampMetric(metrics?.[key]);
      return `<div class="rel-metric ${family}">
        <div class="rel-metric-head"><span class="rel-metric-name">${esc(label)}</span><span class="rel-value">${value}</span></div>
        <div class="rel-track"><div class="rel-fill" style="width:${value}%"></div></div>
      </div>`;
    }).join("");
  }

  function metricEditors(metrics) {
    return METRICS.map(([key, label, family]) => {
      const value = clampMetric(metrics?.[key]);
      return `<div class="rel-edit-metric ${family}">
        <div class="rel-edit-metric-head"><span class="rel-edit-metric-name">${esc(label)}</span><input class="rel-number" type="number" min="0" max="100" value="${value}" data-rel-number="${esc(key)}"></div>
        <input class="rel-slider" type="range" min="0" max="100" step="1" value="${value}" data-rel-slider="${esc(key)}">
      </div>`;
    }).join("");
  }

  function panel(rel, context) {
    if (!rel || !context.personId) {
      return `<div class="rel-panel" data-rel-addon>
        <div class="rel-panel-head"><div class="rel-panel-title">Relationship state</div></div>
        <div class="rel-none">No canonical relationship state is available for admin editing yet.</div>
      </div>`;
    }

    const pending = rel.pendingTransition;
    const pendingMeta = pending ? prettyStatus(pending.target) : null;
    const pendingHtml = pending
      ? `<div class="rel-pending"><strong>Considering → ${esc(pendingMeta.icon)} ${esc(pendingMeta.label)}</strong><div class="rel-pending-copy">Evidence ${esc(pending.evidence || 0)}/${esc(pending.threshold || "?")} · ${esc(pending.reason || "relationship evidence is accumulating")}</div></div>`
      : "";
    const isOpen = editingPersonId === context.personId;

    return `<div class="rel-panel" data-rel-addon data-person-id="${esc(context.personId)}" data-mood-scope="${esc(context.moodScope || "")}">
      <div class="rel-panel-head">
        <div class="rel-panel-title">Relationship state</div>
        <div class="rel-head-right">
          <div class="rel-count">${esc(rel.interactionCount || 0)} judged interaction${Number(rel.interactionCount || 0) === 1 ? "" : "s"}</div>
          <button class="rel-admin-toggle ${isOpen ? "active" : ""}" data-rel-edit>${isOpen ? "Close admin" : "Admin controls"}</button>
        </div>
      </div>
      <div class="rel-metrics">${metricView(rel.metrics || {})}</div>
      ${pendingHtml}
      <div class="rel-editor ${isOpen ? "open" : ""}">
        <div class="rel-admin-grid">
          <div class="rel-field"><label>Mood override</label><select class="rel-select" data-rel-mood>${moodOptions(context.mood || "neutral")}</select></div>
          <div class="rel-field"><label>Relationship status</label><select class="rel-select" data-rel-status>${statusOptions(rel.status)}</select></div>
        </div>
        <div class="rel-edit-metrics">${metricEditors(rel.metrics || {})}</div>
        <div class="rel-admin-actions">
          <button class="rel-action primary" data-rel-save>Save overrides</button>
          <button class="rel-action warn" data-rel-clear-pending ${pending ? "" : "disabled"}>Clear pending transition</button>
          <button class="rel-action danger" data-rel-reset>Reset relationship</button>
        </div>
        <div class="rel-admin-note">Admin overrides bypass Aveline’s automatic relationship graph. Automatic changes still use the normal evidence and transition rules afterward.</div>
      </div>
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
    if (meta) meta.insertAdjacentHTML("afterend", panel(chat.relationship, {
      personId: chat.canonicalPersonId,
      moodScope: chat.id,
      mood: chat.mood,
    }));
  }

  function decorateMember(row, member, chat) {
    if (!row || !member || !chat) return;
    clearDecorations(row);
    const top = row.querySelector(".member-top");
    if (top) top.insertAdjacentHTML("beforeend", badge(member.relationship));
    const meta = row.querySelector(".member-meta");
    if (meta) meta.insertAdjacentHTML("afterend", panel(member.relationship, {
      personId: member.canonicalPersonId,
      moodScope: `${chat.id}:${member.id}`,
      mood: member.mood,
    }));
  }

  function decorate() {
    decorateQueued = false;
    if (!snapshot || !document.getElementById("chats-content") || saving) return;

    const groups = snapshot.filter((chat) => chat.isGroup);
    const dms = snapshot.filter((chat) => !chat.isGroup);

    const groupCards = [...document.querySelectorAll("#chats-content .group-card")];
    groupCards.forEach((card, groupIndex) => {
      const chat = groups[groupIndex];
      if (!chat) return;
      const rows = [...card.querySelectorAll(".member-row")];
      rows.forEach((row, memberIndex) => decorateMember(row, chat.members?.[memberIndex], chat));
    });

    const dmCards = [...document.querySelectorAll("#chats-content .dm-card")];
    dmCards.forEach((card, dmIndex) => decorateDm(card, dms[dmIndex]));
  }

  function queueDecorate() {
    if (decorateQueued || saving) return;
    decorateQueued = true;
    setTimeout(decorate, 60);
  }

  function mutationNeedsDecoration(mutations) {
    return mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (node.nodeType !== 1) return false;
      if (node.matches?.('[data-rel-addon]')) return false;
      return Boolean(
        node.matches?.(".group-card,.dm-card,.member-row") ||
        node.querySelector?.(".group-card,.dm-card,.member-row")
      );
    }));
  }

  function isEditing() {
    return Boolean(editingPersonId || document.querySelector(".rel-editor.open"));
  }

  async function adminApi(path, body) {
    const result = await api(path, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
    if (result?.error) throw new Error(result.error);
    return result;
  }

  async function reloadChats() {
    editingPersonId = null;
    if (typeof loadChats === "function") await loadChats();
    await refresh(true);
  }

  async function savePanel(panelNode) {
    if (!panelNode || saving) return;
    const personId = panelNode.dataset.personId;
    const moodScope = panelNode.dataset.moodScope;
    if (!personId || !moodScope) return;

    const metrics = {};
    panelNode.querySelectorAll("[data-rel-number]").forEach((input) => {
      metrics[input.dataset.relNumber] = clampMetric(input.value);
    });
    const mood = panelNode.querySelector("[data-rel-mood]")?.value || "neutral";
    const status = panelNode.querySelector("[data-rel-status]")?.value || "stranger";

    saving = true;
    panelNode.querySelectorAll("button,input,select").forEach((node) => { node.disabled = true; });
    try {
      await Promise.all([
        adminApi(`/api/admin/mood/${encodeURIComponent(moodScope)}`, { mood }),
        adminApi(`/api/admin/relationship/${encodeURIComponent(personId)}`, { status, metrics }),
      ]);
      toast("Mood and relationship overrides saved");
      await reloadChats();
    } catch (error) {
      toast(error?.message || "Failed to save overrides", "bad");
    } finally {
      saving = false;
    }
  }

  async function clearPending(panelNode) {
    if (!panelNode || saving) return;
    const personId = panelNode.dataset.personId;
    if (!personId) return;
    saving = true;
    try {
      await adminApi(`/api/admin/relationship/${encodeURIComponent(personId)}`, { clearPending: true });
      toast("Pending transition cleared");
      await reloadChats();
    } catch (error) {
      toast(error?.message || "Failed to clear pending transition", "bad");
    } finally {
      saving = false;
    }
  }

  async function resetRelationship(panelNode) {
    if (!panelNode || saving) return;
    const personId = panelNode.dataset.personId;
    if (!personId) return;
    if (!confirm("Reset this canonical relationship to Stranger and default metrics? This does not delete chat memory.")) return;
    saving = true;
    try {
      await adminApi(`/api/admin/relationship/${encodeURIComponent(personId)}`, { reset: true });
      toast("Relationship reset to Stranger");
      await reloadChats();
    } catch (error) {
      toast(error?.message || "Failed to reset relationship", "bad");
    } finally {
      saving = false;
    }
  }

  function bindEditorEvents() {
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-rel-edit]");
      if (toggle) {
        const panelNode = toggle.closest(".rel-panel");
        const personId = panelNode?.dataset.personId || null;
        editingPersonId = editingPersonId === personId ? null : personId;
        queueDecorate();
        return;
      }

      const save = event.target.closest("[data-rel-save]");
      if (save) {
        savePanel(save.closest(".rel-panel"));
        return;
      }

      const clear = event.target.closest("[data-rel-clear-pending]");
      if (clear) {
        clearPending(clear.closest(".rel-panel"));
        return;
      }

      const reset = event.target.closest("[data-rel-reset]");
      if (reset) resetRelationship(reset.closest(".rel-panel"));
    });

    document.addEventListener("input", (event) => {
      const slider = event.target.closest("[data-rel-slider]");
      if (slider) {
        const panelNode = slider.closest(".rel-panel");
        const number = panelNode?.querySelector(`[data-rel-number="${slider.dataset.relSlider}"]`);
        if (number) number.value = clampMetric(slider.value);
        return;
      }

      const number = event.target.closest("[data-rel-number]");
      if (number) {
        number.value = clampMetric(number.value);
        const panelNode = number.closest(".rel-panel");
        const sliderNode = panelNode?.querySelector(`[data-rel-slider="${number.dataset.relNumber}"]`);
        if (sliderNode) sliderNode.value = number.value;
      }
    });
  }

  async function refresh(force = false) {
    if (typeof api !== "function" || saving) return;
    if (!force && isEditing()) return;
    try {
      snapshot = await api("/api/chats");
      queueDecorate();
    } catch (error) {
      console.warn("[relationship-dashboard] Failed to load relationships:", error?.message || error);
    }
  }

  function boot() {
    installStyles();
    bindEditorEvents();

    const wait = setInterval(() => {
      const content = document.getElementById("chats-content");
      if (!content) return;
      clearInterval(wait);

      const observer = new MutationObserver((mutations) => {
        if (mutationNeedsDecoration(mutations)) queueDecorate();
      });
      observer.observe(content, { childList: true, subtree: true });
      refresh();
    }, 200);

    document.addEventListener("click", (event) => {
      const chatsNav = event.target.closest('[onclick*="chats"]');
      const refreshButton = event.target.closest('#page-chats .rbtn');
      if (refreshButton || chatsNav) setTimeout(() => refresh(true), 350);
    });

    setInterval(() => {
      if (!document.hidden && !isEditing() && document.getElementById("page-chats")?.classList.contains("active")) {
        refresh();
      }
    }, 6000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !isEditing() && document.getElementById("page-chats")?.classList.contains("active")) refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
