"use strict";

(() => {
  const POLL_MS = 4000;
  const EXPANDED_KEY_STORAGE = "aveline.feed.expandedKey.v1";

  let pollInFlight = false;
  let lastSignature = null;
  let expandedKey = readExpandedKey();

  function readExpandedKey() {
    try {
      return sessionStorage.getItem(EXPANDED_KEY_STORAGE) || null;
    } catch {
      return null;
    }
  }

  function saveExpandedKey() {
    try {
      if (expandedKey) sessionStorage.setItem(EXPANDED_KEY_STORAGE, expandedKey);
      else sessionStorage.removeItem(EXPANDED_KEY_STORAGE);
    } catch {}
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function hash(value) {
    let result = 2166136261;
    const text = String(value ?? "");
    for (let index = 0; index < text.length; index++) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function feedKey(entry) {
    return [
      entry?.timestamp || 0,
      entry?.type || "",
      entry?.from || "",
      entry?.name || "",
      entry?.text || "",
      entry?.reply || "",
      entry?.message || "",
    ].join(":") + ":" + hash(JSON.stringify(entry || {}));
  }

  function feedSignature(feed) {
    return JSON.stringify((feed || []).map((entry) => [
      feedKey(entry),
      entry?.mood || null,
      entry?.responseTime || null,
    ]));
  }

  function feedPageIsActive() {
    return document.getElementById("page-feed")?.classList.contains("active");
  }

  function timeLabel(timestamp) {
    try {
      if (typeof timeAgo === "function") return timeAgo(timestamp);
    } catch {}

    const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || 0)) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function moodEmoji(mood) {
    try {
      if (typeof me !== "undefined" && me?.[mood]) return me[mood];
    } catch {}
    return { happy: "😊", neutral: "😐", teasing: "😏", annoyed: "😒", affectionate: "🥰" }[mood] || "";
  }

  function visibleAnchor() {
    if (!feedPageIsActive()) return null;
    const cards = [...document.querySelectorAll("#feed-list > .fi[data-feed-key]")];
    const visible = (card) => {
      const rect = card.getBoundingClientRect();
      return rect.bottom > 70 && rect.top < window.innerHeight - 20;
    };
    const card = cards.find((entry) => entry.classList.contains("expanded") && visible(entry)) ||
      cards.find(visible);
    if (!card) return null;
    return {
      key: card.dataset.feedKey,
      top: card.getBoundingClientRect().top,
    };
  }

  function restoreAnchor(anchor) {
    if (!anchor) return;
    requestAnimationFrame(() => {
      const card = [...document.querySelectorAll("#feed-list > .fi[data-feed-key]")]
        .find((entry) => entry.dataset.feedKey === anchor.key);
      if (!card) return;
      const delta = card.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    });
  }

  function updateTimeLabels() {
    document.querySelectorAll("#feed-list [data-feed-timestamp]").forEach((node) => {
      node.textContent = timeLabel(Number(node.dataset.feedTimestamp));
    });
  }

  function systemCard(entry) {
    const key = feedKey(entry);
    return `<div class="fi sys" data-feed-key="${esc(key)}">
      <div class="fi-top">
        <span class="ftag sys">SYS</span>
        <div class="fi-body"><div class="fn">${esc(entry?.message || "")}</div></div>
        <div class="fi-meta">
          <div class="fi-time" data-feed-timestamp="${Number(entry?.timestamp || 0)}">${esc(timeLabel(entry?.timestamp))}</div>
        </div>
      </div>
    </div>`;
  }

  function messageCard(entry) {
    const key = feedKey(entry);
    const isExpanded = key === expandedKey;
    const groupLine = entry?.isGroup
      ? `<div class="fg">${esc(entry?.groupName || "Group")}</div>`
      : "";

    return `<div class="fi${isExpanded ? " expanded" : ""}" data-feed-key="${esc(key)}">
      <div class="fi-top">
        <span class="ftag msg">${entry?.isGroup ? "GRP" : "DM"}</span>
        <div class="fi-body">
          <div class="fn">${esc(entry?.name || "Unknown")}</div>
          ${groupLine}
          <div class="ft-preview">${esc(entry?.text || "")}</div>
        </div>
        <div class="fi-meta">
          <div class="fi-time" data-feed-timestamp="${Number(entry?.timestamp || 0)}">${esc(timeLabel(entry?.timestamp))}</div>
          <div class="fi-mood">${esc(moodEmoji(entry?.mood))}</div>
          <div class="fi-arrow">▾</div>
        </div>
      </div>
      <div class="fi-expand">
        <div class="fi-expand-row">
          <div class="fi-expand-label">Message</div>
          <div class="fi-expand-text">${esc(entry?.text || "—")}</div>
        </div>
        <div class="fi-expand-row">
          <div class="fi-expand-label">Reply</div>
          <div class="fi-expand-text reply">${esc(entry?.reply || "—")}</div>
        </div>
        <div class="fi-expand-stats">
          <div class="fi-stat">Mood: <span>${esc(entry?.mood || "—")}</span></div>
          <div class="fi-stat">Response: <span>${Number(entry?.responseTime || 0)}ms</span></div>
          <div class="fi-stat">Type: <span>${entry?.isGroup ? "Group" : "DM"}</span></div>
        </div>
      </div>
    </div>`;
  }

  function renderFeed(feed) {
    const list = document.getElementById("feed-list");
    if (!list) return;

    const anchor = visibleAnchor();
    const availableKeys = new Set((feed || []).map(feedKey));
    if (expandedKey && !availableKeys.has(expandedKey)) {
      expandedKey = null;
      saveExpandedKey();
    }

    if (!feed?.length) {
      list.innerHTML = '<div class="loading">No events yet</div>';
      lastSignature = feedSignature([]);
      return;
    }

    list.innerHTML = feed.map((entry) =>
      entry?.type === "system" ? systemCard(entry) : messageCard(entry)
    ).join("");
    lastSignature = feedSignature(feed);
    restoreAnchor(anchor);
  }

  async function loadFeedLive({ background = false } = {}) {
    const list = document.getElementById("feed-list");
    if (!list || pollInFlight) return;

    pollInFlight = true;
    const hasCards = Boolean(list.querySelector(".fi"));
    if (!background && !hasCards) {
      list.innerHTML = '<div class="loading pulse">Loading...</div>';
    }

    try {
      const feed = await api("/api/feed");
      const signature = feedSignature(feed);
      if (signature === lastSignature) updateTimeLabels();
      else renderFeed(feed);
    } catch (error) {
      if (!hasCards) {
        list.innerHTML = `<div class="loading">Failed to load: ${esc(error?.message || error)}</div>`;
      }
    } finally {
      pollInFlight = false;
    }
  }

  function installInteraction() {
    const list = document.getElementById("feed-list");
    if (!list || list.dataset.liveInteractionInstalled === "true") return;
    list.dataset.liveInteractionInstalled = "true";

    list.addEventListener("click", (event) => {
      const card = event.target.closest(".fi[data-feed-key]");
      if (!card || card.classList.contains("sys")) return;

      const shouldOpen = !card.classList.contains("expanded");
      list.querySelectorAll(".fi.expanded").forEach((entry) => {
        if (entry !== card) entry.classList.remove("expanded");
      });
      card.classList.toggle("expanded", shouldOpen);
      expandedKey = shouldOpen ? card.dataset.feedKey : null;
      saveExpandedKey();
    });
  }

  function installLiveBadge() {
    const topbar = document.querySelector("#page-feed .topbar");
    if (!topbar || document.getElementById("feed-live-badge")) return;

    const badge = document.createElement("span");
    badge.id = "feed-live-badge";
    badge.textContent = "● Live · 4s";
    badge.style.cssText = [
      "margin-left:auto",
      "align-self:center",
      "font-size:10px",
      "font-weight:700",
      "color:var(--green)",
      "white-space:nowrap",
    ].join(";");

    const refresh = topbar.querySelector(".rbtn");
    topbar.insertBefore(badge, refresh || null);
  }

  function install() {
    if (!document.getElementById("page-feed")) return false;
    installInteraction();
    installLiveBadge();
    window.loadFeed = () => loadFeedLive({ background: false });
    if (feedPageIsActive()) loadFeedLive({ background: false });
    return true;
  }

  if (!install()) {
    const wait = setInterval(() => {
      if (install()) clearInterval(wait);
    }, 250);
  }

  setInterval(() => {
    if (feedPageIsActive() && !document.hidden) {
      loadFeedLive({ background: true });
    }
  }, POLL_MS);

  setInterval(updateTimeLabels, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && feedPageIsActive()) loadFeedLive({ background: true });
  });
})();
