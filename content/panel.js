(() => {
  const PANEL_ID = "scc-floating-panel";
  const STYLE_ID = "scc-floating-panel-style";
  const STORAGE_POS = "scc_panel_pos";
  const STORAGE_PINNED = "scc_panel_pinned";
  const STORAGE_MIN = "scc_panel_minimized";

  function getStatus() {
    return (
      window.__SCC_STATUS__ || {
        running: false,
        state: "idle",
        deleted: 0,
        processed: 0,
        message: "Ready.",
        identity: null,
      }
    );
  }

  function formatAccount(identity) {
    if (!identity?.handle && !identity?.displayName) return "Account: auto-detect";
    const at = identity.handle ? `@${identity.handle}` : null;
    if (at && identity.displayName && identity.displayName !== identity.handle) {
      return `${at} · “${identity.displayName}”`;
    }
    return at || identity.displayName;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        --scc-bg: #0f1419;
        --scc-surface: #1a222c;
        --scc-border: #2c3846;
        --scc-text: #e8eef4;
        --scc-muted: #8b9aab;
        --scc-accent: #20d5ec;
        --scc-danger: #e85d5d;
        --scc-ok: #5dce8c;
        position: fixed;
        z-index: 2147483646;
        width: 300px;
        max-width: calc(100vw - 16px);
        color: var(--scc-text);
        font: 13px/1.4 "Segoe UI", "Helvetica Neue", sans-serif;
        background: var(--scc-bg);
        border: 1px solid var(--scc-border);
        border-radius: 10px;
        box-shadow: 0 12px 40px rgba(0,0,0,.45);
        overflow: hidden;
        user-select: none;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .scc-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--scc-surface);
        cursor: grab;
        border-bottom: 1px solid var(--scc-border);
      }
      #${PANEL_ID} .scc-head:active { cursor: grabbing; }
      #${PANEL_ID} .scc-title { flex: 1; font-weight: 650; font-size: 13px; }
      #${PANEL_ID} .scc-head button {
        border: none;
        background: transparent;
        color: var(--scc-muted);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font: inherit;
      }
      #${PANEL_ID} .scc-head button:hover { color: var(--scc-text); background: #243040; }
      #${PANEL_ID} .scc-head button.scc-pinned { color: var(--scc-accent); }
      #${PANEL_ID} .scc-body { padding: 10px 12px 12px; }
      #${PANEL_ID}.scc-min .scc-body { display: none; }
      #${PANEL_ID} .scc-account {
        font-size: 12px;
        color: var(--scc-ok);
        margin-bottom: 8px;
        word-break: break-word;
      }
      #${PANEL_ID} .scc-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 12px;
      }
      #${PANEL_ID} .scc-label { color: var(--scc-muted); }
      #${PANEL_ID} .scc-msg {
        margin: 8px 0 10px;
        color: var(--scc-muted);
        font-size: 12px;
        max-height: 4.5em;
        overflow: auto;
        word-break: break-word;
      }
      #${PANEL_ID} .scc-actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 6px;
      }
      #${PANEL_ID} .scc-actions button {
        border: none;
        border-radius: 7px;
        padding: 8px 6px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      #${PANEL_ID} .scc-actions button:disabled { opacity: .45; cursor: not-allowed; }
      #${PANEL_ID} .scc-primary { background: var(--scc-accent); color: #062026; }
      #${PANEL_ID} .scc-danger { background: var(--scc-danger); color: #1a0707; }
      #${PANEL_ID} .scc-secondary {
        background: var(--scc-surface);
        color: var(--scc-text);
        border: 1px solid var(--scc-border) !important;
      }
      #${PANEL_ID} .scc-foot {
        margin-top: 8px;
        display: flex;
        gap: 6px;
      }
      #${PANEL_ID} .scc-foot button {
        flex: 1;
        border: 1px solid var(--scc-border);
        background: transparent;
        color: var(--scc-muted);
        border-radius: 6px;
        padding: 6px;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
      }
      #${PANEL_ID} .scc-foot button:hover { color: var(--scc-text); }
    `;
    document.documentElement.appendChild(style);
  }

  async function loadPrefs() {
    try {
      return await browser.storage.local.get({
        [STORAGE_POS]: { top: 80, left: null },
        [STORAGE_PINNED]: true,
        [STORAGE_MIN]: false,
      });
    } catch {
      return { [STORAGE_POS]: { top: 80, left: null }, [STORAGE_PINNED]: true, [STORAGE_MIN]: false };
    }
  }

  async function savePrefs(partial) {
    try {
      await browser.storage.local.set(partial);
    } catch {
      /* ignore */
    }
  }

  function placePanel(el, pos) {
    el.style.top = `${Math.max(8, pos.top ?? 80)}px`;
    if (pos.left == null) {
      el.style.right = "16px";
      el.style.left = "auto";
    } else {
      el.style.left = `${Math.max(8, pos.left)}px`;
      el.style.right = "auto";
    }
  }

  function makeDraggable(panel, handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button")) return;
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      panel.style.right = "auto";
      panel.style.left = `${origLeft}px`;
      panel.style.top = `${origTop}px`;
      e.preventDefault();
    });

    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const left = Math.min(window.innerWidth - 40, Math.max(8, origLeft + dx));
      const top = Math.min(window.innerHeight - 40, Math.max(8, origTop + dy));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });

    handle.addEventListener("pointerup", async () => {
      if (!dragging) return;
      dragging = false;
      const rect = panel.getBoundingClientRect();
      await savePrefs({ [STORAGE_POS]: { top: rect.top, left: rect.left } });
    });
  }

  async function dispatch(type) {
    const data = await browser.storage.local.get({
      handle: "",
      displayName: "",
      delayMs: 900,
      ensureEnglish: true,
      handleOverrideExplicit: false,
    });
    const settings = {
      handle: data.handleOverrideExplicit ? data.handle : "",
      displayName: data.displayName || "",
      delayMs: data.delayMs,
      ensureEnglish: data.ensureEnglish !== false,
    };
    window.dispatchEvent(new CustomEvent("scc:command", { detail: { type, settings } }));
  }

  function renderStatus(panel) {
    const status = getStatus();
    const running = Boolean(status.running) || status.state === "reloading";
    panel.querySelector("[data-state]").textContent = status.state || (running ? "running" : "idle");
    const pace = status.paceMs != null ? ` · ${status.paceMs}ms` : "";
    panel.querySelector("[data-progress]").textContent =
      `${status.deleted || 0} deleted · ${status.processed || 0} opened${pace}`;
    panel.querySelector("[data-msg]").textContent = status.message || "—";
    panel.querySelector("[data-account]").textContent = formatAccount(status.identity);
    panel.querySelector('[data-act="start"]').disabled = running;
    panel.querySelector('[data-act="probe"]').disabled = running;
    panel.querySelector('[data-act="stop"]').disabled = !running && status.state !== "resuming";
  }

  async function showPanel({ force = false } = {}) {
    ensureStyles();
    const prefs = await loadPrefs();
    if (!force && prefs[STORAGE_PINNED] === false && document.getElementById(PANEL_ID)) {
      return document.getElementById(PANEL_ID);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="scc-head" data-drag>
          <div class="scc-title">Comment Cleaner</div>
          <button type="button" data-act="pin" title="Pin on page">Pin</button>
          <button type="button" data-act="min" title="Minimize">–</button>
          <button type="button" data-act="hide" title="Hide">×</button>
        </div>
        <div class="scc-body">
          <div class="scc-account" data-account>Account…</div>
          <div class="scc-row"><span class="scc-label">State</span><span data-state>idle</span></div>
          <div class="scc-row"><span class="scc-label">Progress</span><span data-progress>—</span></div>
          <p class="scc-msg" data-msg>Ready.</p>
          <div class="scc-actions">
            <button type="button" class="scc-secondary" data-act="probe">Probe</button>
            <button type="button" class="scc-primary" data-act="start">Start</button>
            <button type="button" class="scc-danger" data-act="stop">Stop</button>
          </div>
          <div class="scc-foot">
            <button type="button" data-act="window">Open window</button>
          </div>
        </div>
      `;
      document.documentElement.appendChild(panel);
      makeDraggable(panel, panel.querySelector("[data-drag]"));

      panel.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === "start") dispatch("scc:start");
        if (act === "stop") dispatch("scc:stop");
        if (act === "probe") dispatch("scc:probe");
        if (act === "hide") {
          await savePrefs({ [STORAGE_PINNED]: false });
          panel.remove();
        }
        if (act === "min") {
          const next = !panel.classList.contains("scc-min");
          panel.classList.toggle("scc-min", next);
          await savePrefs({ [STORAGE_MIN]: next });
        }
        if (act === "pin") {
          await savePrefs({ [STORAGE_PINNED]: true });
          btn.classList.add("scc-pinned");
          btn.title = "Pinned — stays on this page";
        }
        if (act === "window") {
          browser.runtime.sendMessage({ type: "scc:openPanelWindow" }).catch(() => {});
        }
      });
    }

    placePanel(panel, prefs[STORAGE_POS] || { top: 80, left: null });
    panel.classList.toggle("scc-min", Boolean(prefs[STORAGE_MIN]));
    const pinBtn = panel.querySelector('[data-act="pin"]');
    if (prefs[STORAGE_PINNED] !== false) pinBtn.classList.add("scc-pinned");
    await savePrefs({ [STORAGE_PINNED]: true });
    renderStatus(panel);
    return panel;
  }

  function hidePanel() {
    document.getElementById(PANEL_ID)?.remove();
  }

  // Mirror status from controller
  window.addEventListener("scc:status", () => {
    const panel = document.getElementById(PANEL_ID);
    if (panel) renderStatus(panel);
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "scc:showPanel") {
      showPanel({ force: true }).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message?.type === "scc:hidePanel") {
      hidePanel();
      savePrefs({ [STORAGE_PINNED]: false });
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  // Restore pinned panel after navigation / reload
  loadPrefs().then((prefs) => {
    if (prefs[STORAGE_PINNED] !== false) {
      showPanel({ force: true });
    }
  });

  // Expose for controller
  window.__SCC_PANEL__ = { show: showPanel, hide: hidePanel };
})();
