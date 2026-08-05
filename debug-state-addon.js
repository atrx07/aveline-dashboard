"use strict";

(() => {
  const STORAGE_KEY = "aveline.debug.openTraceIds.v1";
  const openTraceIds = new Set(loadOpenTraceIds());
  const panelScrollState = new Map();
  const nestedOpenState = new Map();

  let observer = null;
  let anchor = null;
  let restoreScheduled = false;
  let anchorScheduled = false;

  function loadOpenTraceIds() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  function saveOpenTraceIds() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...openTraceIds].slice(-50)));
    } catch {}
  }

  function debugList() {
    return document.getElementById("debug-list");
  }

  function debugPageIsActive() {
    return document.getElementById("page-debug")?.classList.contains("active");
  }

  function traceIdFor(card) {
    return card?.querySelector("[data-copy-trace]")?.dataset.copyTrace || null;
  }

  function cards() {
    const list = debugList();
    return list ? [...list.querySelectorAll(":scope > details.debug-trace")] : [];
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function codePanelBase(panel, card) {
    const stage = panel.closest(".debug-stage");
    const stageTitle = normalizeText(
      stage?.querySelector(":scope > .debug-stage-title")?.textContent || "stage"
    );
    const label = normalizeText(
      panel.previousElementSibling?.classList.contains("debug-label")
        ? panel.previousElementSibling.textContent
        : "code"
    );
    const call = panel.closest("details.debug-call");
    const calls = [...card.querySelectorAll("details.debug-call")];
    const callIndex = call ? calls.indexOf(call) : -1;
    return `${stageTitle}|call:${callIndex}|${label}`;
  }

  function codePanelKey(panel, card) {
    const base = codePanelBase(panel, card);
    const panels = [...card.querySelectorAll(".debug-code")];
    const panelIndex = panels.indexOf(panel);
    let occurrence = 0;

    for (let index = 0; index < panelIndex; index++) {
      if (codePanelBase(panels[index], card) === base) occurrence++;
    }

    return `${base}|occurrence:${occurrence}`;
  }

  function nestedDetailsKey(details, card) {
    const calls = [...card.querySelectorAll("details.debug-call")];
    const index = calls.indexOf(details);
    return index >= 0 ? `call:${index}` : null;
  }

  function rememberPanelScroll(panel) {
    const card = panel.closest("details.debug-trace");
    const traceId = traceIdFor(card);
    if (!card || !traceId) return;

    const key = codePanelKey(panel, card);
    let traceState = panelScrollState.get(traceId);
    if (!traceState) {
      traceState = new Map();
      panelScrollState.set(traceId, traceState);
    }

    traceState.set(key, {
      top: panel.scrollTop,
      left: panel.scrollLeft,
    });
  }

  function restorePanelScroll(card, traceId) {
    const traceState = panelScrollState.get(traceId);
    if (!traceState) return;

    for (const panel of card.querySelectorAll(".debug-code")) {
      const saved = traceState.get(codePanelKey(panel, card));
      if (!saved) continue;

      const maxTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
      const maxLeft = Math.max(0, panel.scrollWidth - panel.clientWidth);
      panel.scrollTop = Math.min(saved.top, maxTop);
      panel.scrollLeft = Math.min(saved.left, maxLeft);
    }
  }

  function restoreNestedDetails(card, traceId) {
    for (const details of card.querySelectorAll("details.debug-call")) {
      const key = nestedDetailsKey(details, card);
      if (!key) continue;
      const stateKey = `${traceId}|${key}`;
      if (nestedOpenState.has(stateKey)) {
        details.open = nestedOpenState.get(stateKey);
      }
    }
  }

  function rememberViewportAnchor() {
    if (!debugPageIsActive()) return;

    const available = cards();
    if (!available.length) return;

    const inViewport = (card) => {
      const rect = card.getBoundingClientRect();
      return rect.bottom > 70 && rect.top < window.innerHeight - 20;
    };

    const card = available.find((entry) => entry.open && inViewport(entry)) ||
      available.find(inViewport);
    const id = traceIdFor(card);
    if (!card || !id) return;

    anchor = {
      id,
      top: card.getBoundingClientRect().top,
    };
  }

  function scheduleAnchorCapture() {
    if (anchorScheduled) return;
    anchorScheduled = true;
    requestAnimationFrame(() => {
      anchorScheduled = false;
      rememberViewportAnchor();
    });
  }

  function pruneRemovedTraces(available) {
    const liveIds = new Set(available.map(traceIdFor).filter(Boolean));

    for (const traceId of panelScrollState.keys()) {
      if (!liveIds.has(traceId)) panelScrollState.delete(traceId);
    }
    for (const stateKey of nestedOpenState.keys()) {
      const traceId = stateKey.split("|", 1)[0];
      if (!liveIds.has(traceId)) nestedOpenState.delete(stateKey);
    }
  }

  function restoreReaderState() {
    const available = cards();
    pruneRemovedTraces(available);

    for (const card of available) {
      const id = traceIdFor(card);
      if (!id) continue;

      card.dataset.traceId = id;
      const shouldBeOpen = openTraceIds.has(id);
      if (card.open !== shouldBeOpen) card.open = shouldBeOpen;
      restoreNestedDetails(card, id);
      restorePanelScroll(card, id);
    }

    if (anchor) {
      const anchoredCard = available.find((card) => traceIdFor(card) === anchor.id);
      if (anchoredCard) {
        const delta = anchoredCard.getBoundingClientRect().top - anchor.top;
        if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
      }
    }

    requestAnimationFrame(() => {
      for (const card of cards()) {
        const id = traceIdFor(card);
        if (!id) continue;
        restoreNestedDetails(card, id);
        restorePanelScroll(card, id);
      }
    });
  }

  function scheduleRestore() {
    if (restoreScheduled) return;
    restoreScheduled = true;
    requestAnimationFrame(() => {
      restoreScheduled = false;
      restoreReaderState();
    });
  }

  function attachObserver() {
    const list = debugList();
    if (!list) return false;
    if (observer && observer.__debugList === list) return true;

    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList")) {
        scheduleRestore();
      }
    });
    observer.__debugList = list;
    observer.observe(list, { childList: true });
    scheduleRestore();
    return true;
  }

  document.addEventListener("scroll", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.matches("#debug-list .debug-code")) return;
    rememberPanelScroll(target);
  }, true);

  document.addEventListener("click", (event) => {
    const topSummary = event.target.closest(
      "#debug-list > details.debug-trace > summary.debug-summary"
    );
    if (topSummary) {
      const card = topSummary.parentElement;
      const id = traceIdFor(card);
      if (!id) return;

      rememberViewportAnchor();
      setTimeout(() => {
        if (!card.isConnected) return;

        if (card.open) openTraceIds.add(id);
        else openTraceIds.delete(id);
        saveOpenTraceIds();

        anchor = {
          id,
          top: card.getBoundingClientRect().top,
        };
      }, 0);
      return;
    }

    const nestedSummary = event.target.closest(
      "#debug-list details.debug-call > summary"
    );
    if (!nestedSummary) return;

    const details = nestedSummary.parentElement;
    const card = details.closest("details.debug-trace");
    const traceId = traceIdFor(card);
    const key = card ? nestedDetailsKey(details, card) : null;
    if (!traceId || !key) return;

    setTimeout(() => {
      if (!details.isConnected) return;
      nestedOpenState.set(`${traceId}|${key}`, details.open);
    }, 0);
  }, true);

  window.addEventListener("scroll", scheduleAnchorCapture, { passive: true });
  window.addEventListener("resize", scheduleAnchorCapture, { passive: true });

  if (!attachObserver()) {
    const waitForDebugPage = setInterval(() => {
      if (attachObserver()) clearInterval(waitForDebugPage);
    }, 250);
  }
})();
