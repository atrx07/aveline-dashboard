"use strict";

(() => {
  const STORAGE_KEY = "aveline.debug.openTraceIds.v1";
  const openTraceIds = new Set(loadOpenTraceIds());

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

  function restoreReaderState() {
    const available = cards();

    for (const card of available) {
      const id = traceIdFor(card);
      if (!id) continue;

      card.dataset.traceId = id;
      const shouldBeOpen = openTraceIds.has(id);
      if (card.open !== shouldBeOpen) card.open = shouldBeOpen;
    }

    if (anchor) {
      const anchoredCard = available.find((card) => traceIdFor(card) === anchor.id);
      if (anchoredCard) {
        const delta = anchoredCard.getBoundingClientRect().top - anchor.top;
        if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
      }
    }
  }

  function scheduleRestore() {
    if (restoreScheduled) return;
    restoreScheduled = true;
    queueMicrotask(() => {
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

  document.addEventListener("click", (event) => {
    const summary = event.target.closest(
      "#debug-list > details.debug-trace > summary.debug-summary"
    );
    if (!summary) return;

    const card = summary.parentElement;
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
  }, true);

  window.addEventListener("scroll", scheduleAnchorCapture, { passive: true });
  window.addEventListener("resize", scheduleAnchorCapture, { passive: true });

  if (!attachObserver()) {
    const waitForDebugPage = setInterval(() => {
      if (attachObserver()) clearInterval(waitForDebugPage);
    }, 250);
  }
})();
