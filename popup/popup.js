const $ = (id) => document.getElementById(id);

const els = {
  handle: $("handle"),
  displayName: $("displayName"),
  delay: $("delay"),
  ensureEnglish: $("ensureEnglish"),
  detect: $("detect"),
  probe: $("probe"),
  start: $("start"),
  stop: $("stop"),
  pinPage: $("pinPage"),
  openWindow: $("openWindow"),
  state: $("state"),
  progress: $("progress"),
  message: $("message"),
  accountLine: $("accountLine"),
  accountHint: $("accountHint"),
  overrideBox: $("overrideBox"),
};

function formatAccount(identity) {
  if (!identity?.handle && !identity?.displayName) return null;
  const at = identity.handle ? `@${identity.handle.replace(/^@+/, "")}` : null;
  if (at && identity.displayName) return `${at} · “${identity.displayName}”`;
  return at || identity.displayName;
}

function setAccountUi(identity, { error } = {}) {
  if (error) {
    els.accountLine.textContent = error;
    els.accountLine.dataset.ok = "false";
    els.accountHint.textContent = "Open the fallback section and enter your handle.";
    els.overrideBox.open = true;
    return;
  }
  const line = formatAccount(identity);
  if (!line) {
    els.accountLine.textContent = "Not detected yet";
    els.accountLine.dataset.ok = "false";
    els.accountHint.textContent =
      "Stay logged in on TikTok. Or open fallback and type your handle (no @ needed).";
    return;
  }
  const via = identity.auto
    ? `auto (${identity.source || "page"})`
    : identity.source === "user-override"
      ? "manual override"
      : identity.source || "saved";
  els.accountLine.textContent = line;
  els.accountLine.dataset.ok = "true";
  els.accountHint.textContent = identity.auto
    ? `Using ${via}. @ is added automatically.`
    : `Using ${via}. Clear the fallback handle to return to auto-detect.`;
}

function setUi(status) {
  const running = Boolean(status?.running);
  const reloading = status?.state === "reloading";
  els.state.textContent = running || reloading
    ? status?.state || "running"
    : status?.state || "idle";
  els.state.dataset.running = running || reloading ? "true" : "false";
  els.progress.textContent =
    status?.deleted != null
      ? `${status.deleted} deleted · ${status.processed || 0} opened${
          status.paceMs != null ? ` · ${status.paceMs}ms` : ""
        }`
      : "—";
  els.message.textContent = status?.message || "Open TikTok — account is detected automatically.";
  els.probe.disabled = running || reloading;
  els.start.disabled = running || reloading;
  els.detect.disabled = running || reloading;
  els.stop.disabled = !(running || reloading || status?.state === "resuming");
  els.handle.disabled = running;
  els.displayName.disabled = running;
  els.delay.disabled = running;
  els.ensureEnglish.disabled = running;

  if (status?.identity) {
    setAccountUi(status.identity);
  }
}

function stripAt(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "");
}

async function loadSettings() {
  const data = await browser.storage.local.get({
    handle: "",
    displayName: "",
    username: "",
    delayMs: 700,
    ensureEnglish: true,
    handleOverrideExplicit: false,
  });

  // Drop legacy "username" leftovers (e.g. Benjaro) unless user explicitly set override
  const legacy = stripAt(data.username || "");
  const storedHandle = stripAt(data.handle || "");
  const explicit = Boolean(data.handleOverrideExplicit);

  if (!explicit && (storedHandle || legacy)) {
    els.handle.value = "";
    await browser.storage.local.set({ handle: "", username: "", handleOverrideExplicit: false });
  } else {
    els.handle.value = explicit ? storedHandle : "";
  }

  els.displayName.value = data.displayName || "";
  els.delay.value = String(data.delayMs ?? 700);
  els.ensureEnglish.checked = data.ensureEnglish;
  els.overrideBox.open = Boolean(els.handle.value);
}

async function saveSettings({ explicitOverride } = {}) {
  const handle = stripAt(els.handle.value);
  els.handle.value = handle;
  const displayName = els.displayName.value.trim();
  const delayMs = Math.min(5000, Math.max(400, Number(els.delay.value) || 900));
  els.delay.value = String(delayMs);

  const data = await browser.storage.local.get({ handleOverrideExplicit: false });
  const handleOverrideExplicit =
    explicitOverride === true
      ? true
      : explicitOverride === false
        ? false
        : handle
          ? Boolean(data.handleOverrideExplicit)
          : false;

  await browser.storage.local.set({
    handle,
    displayName,
    username: "", // stop reusing legacy field
    delayMs,
    ensureEnglish: els.ensureEnglish.checked,
    handleOverrideExplicit,
  });
  return {
    handle: handleOverrideExplicit ? handle : "",
    displayName,
    username: handleOverrideExplicit ? handle : "",
    delayMs,
    ensureEnglish: els.ensureEnglish.checked,
  };
}

async function getActiveTikTokTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url || !/tiktok\.com/i.test(tab.url)) {
    return null;
  }
  return tab;
}

/**
 * @param {{ silent?: boolean, preferAuto?: boolean }} opts
 * preferAuto: clear stale override and use detected account (Detect button / popup open)
 */
async function detectAccount({ silent = false, preferAuto = false } = {}) {
  const tab = await getActiveTikTokTab();
  if (!tab) {
    if (!silent) {
      setAccountUi(null, { error: "No TikTok tab active" });
      setUi({ running: false, message: "Open tiktok.com while logged in." });
    }
    return null;
  }

  try {
    const res = await browser.tabs.sendMessage(tab.id, { type: "scc:detectUser" });

    if (preferAuto || !stripAt(els.handle.value)) {
      // Auto mode: wipe leftover override so Benjaro etc. cannot stick
      els.handle.value = "";
      await saveSettings({ explicitOverride: false });
    }

    const settings = await saveSettings();

    // Only honor override if user explicitly typed one and we are not forcing auto
    if (settings.handle && !preferAuto) {
      const identity = {
        handle: settings.handle,
        displayName: settings.displayName || res?.detected?.displayName || "",
        source: "user-override",
        auto: false,
      };
      setAccountUi(identity);
      if (!silent) {
        setUi({
          running: false,
          message: `Override @${settings.handle}. Click Detect to use auto instead.`,
          identity,
        });
      }
      return identity;
    }

    if (!res?.ok || !res.detected?.handle) {
      setAccountUi(null, { error: "Auto-detect failed" });
      if (!silent) {
        setUi({
          running: false,
          message: "Could not detect account. Enter handle under fallback (without @).",
        });
      }
      return null;
    }

    // Show display name for context, but do not treat it as a sticky override handle
    if (res.detected.displayName) {
      els.displayName.value = res.detected.displayName;
      await browser.storage.local.set({ displayName: res.detected.displayName });
    }

    const identity = {
      handle: res.detected.handle,
      displayName: res.detected.displayName || "",
      source: res.detected.source,
      auto: true,
    };
    setAccountUi(identity);
    if (!silent) {
      setUi({
        running: false,
        message: `Auto: @${res.detected.handle} via ${res.detected.source}.`,
        identity,
      });
    }
    return identity;
  } catch (err) {
    if (!silent) {
      setAccountUi(null, { error: "Content script not ready" });
      setUi({
        running: false,
        message: `Detect failed: ${err.message || err}. Reload TikTok + extension.`,
      });
    }
    return null;
  }
}

async function refreshStatus() {
  const tab = await getActiveTikTokTab();
  if (!tab) {
    setUi({ running: false, message: "Open a tiktok.com tab and try again." });
    return;
  }
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type: "scc:getStatus" });
    setUi(status || { running: false });
  } catch {
    setUi({
      running: false,
      message: "Content script not ready. Reload the TikTok tab once.",
    });
  }
}

async function send(type) {
  // Start/Probe: prefer auto unless user explicitly left an override
  const settings = await saveSettings();
  const tab = await getActiveTikTokTab();
  if (!tab) {
    setUi({ running: false, message: "Activate a tiktok.com tab first." });
    return;
  }

  try {
    const status = await browser.tabs.sendMessage(tab.id, { type, settings });
    setUi(status);
  } catch (err) {
    setUi({
      running: false,
      message: `Could not talk to page: ${err.message || err}. Reload TikTok + reload the temp add-on.`,
    });
  }
}

els.detect.addEventListener("click", () => detectAccount({ silent: false, preferAuto: true }));
els.probe.addEventListener("click", () => send("scc:probe"));
els.start.addEventListener("click", () => send("scc:start"));

els.pinPage.addEventListener("click", async () => {
  const tab = await getActiveTikTokTab();
  if (!tab) {
    setUi({ running: false, message: "Activate a tiktok.com tab first." });
    return;
  }
  try {
    await browser.tabs.sendMessage(tab.id, { type: "scc:showPanel" });
    setUi({ running: false, message: "Floating panel pinned on the page — drag the title bar." });
  } catch (err) {
    setUi({ running: false, message: String(err.message || err) });
  }
});

els.openWindow.addEventListener("click", async () => {
  try {
    const res = await browser.runtime.sendMessage({ type: "scc:openPanelWindow" });
    if (!res?.ok) {
      setUi({ running: false, message: res?.error || "Could not open window." });
      return;
    }
    setUi({
      running: false,
      message: "Detached window opened — it stays open while the cleaner runs.",
    });
  } catch (err) {
    setUi({ running: false, message: String(err.message || err) });
  }
});

els.stop.addEventListener("click", async () => {
  const tab = await getActiveTikTokTab();
  if (!tab) return;
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type: "scc:stop" });
    setUi(status);
  } catch (err) {
    setUi({ running: false, message: String(err.message || err) });
  }
});

els.handle.addEventListener("change", async () => {
  els.handle.value = stripAt(els.handle.value);
  await saveSettings({ explicitOverride: Boolean(els.handle.value) });
  await detectAccount({ silent: true, preferAuto: !els.handle.value });
});
els.handle.addEventListener("blur", async () => {
  els.handle.value = stripAt(els.handle.value);
  await saveSettings({ explicitOverride: Boolean(els.handle.value) });
});

["change", "blur"].forEach((evt) => {
  els.displayName.addEventListener(evt, () => saveSettings().catch(() => {}));
  els.delay.addEventListener(evt, () => saveSettings().catch(() => {}));
  els.ensureEnglish.addEventListener(evt, () => saveSettings().catch(() => {}));
});

loadSettings()
  .then(async () => {
    await refreshStatus();
    // Always prefer auto on open — clears stale Benjaro leftovers
    await detectAccount({ silent: true, preferAuto: true });
  })
  .catch((err) => setUi({ running: false, message: String(err) }));

setInterval(() => {
  refreshStatus().catch(() => {});
}, 1200);
