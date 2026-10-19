const $ = (id) => document.getElementById(id);

const els = {
  handle: $("handle"),
  displayName: $("displayName"),
  delay: $("delay"),
  ensureEnglish: $("ensureEnglish"),
  probe: $("probe"),
  start: $("start"),
  stop: $("stop"),
  state: $("state"),
  progress: $("progress"),
  message: $("message"),
  accountLine: $("accountLine"),
  accountHint: $("accountHint"),
  pinPage: $("pinPage"),
};

function stripAt(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "");
}

function setAccount(identity) {
  if (!identity?.handle && !identity?.displayName) {
    els.accountLine.textContent = "Waiting for TikTok tab…";
    els.accountLine.dataset.ok = "false";
    return;
  }
  const at = identity.handle ? `@${identity.handle}` : null;
  els.accountLine.textContent =
    at && identity.displayName && identity.displayName !== identity.handle
      ? `${at} · “${identity.displayName}”`
      : at || identity.displayName;
  els.accountLine.dataset.ok = "true";
  els.accountHint.textContent = identity.auto
    ? `auto (${identity.source || "page"})`
    : identity.source || "manual";
}

function setUi(status) {
  const running = Boolean(status?.running) || status?.state === "reloading";
  els.state.textContent = status?.state || (running ? "running" : "idle");
  els.state.dataset.running = running ? "true" : "false";
  els.progress.textContent =
    status?.deleted != null
      ? `${status.deleted} deleted · ${status.processed || 0} opened${
          status.paceMs != null ? ` · ${status.paceMs}ms` : ""
        }`
      : "—";
  els.message.textContent = status?.message || "—";
  els.start.disabled = running;
  els.probe.disabled = running;
  els.stop.disabled = !running && status?.state !== "resuming";
  if (status?.identity) setAccount(status.identity);
}

async function loadSettings() {
  const data = await browser.storage.local.get({
    handle: "",
    displayName: "",
    delayMs: 700,
    ensureEnglish: true,
    handleOverrideExplicit: false,
  });
  els.handle.value = data.handleOverrideExplicit ? stripAt(data.handle) : "";
  els.displayName.value = data.displayName || "";
  els.delay.value = String(data.delayMs ?? 700);
  els.ensureEnglish.checked = data.ensureEnglish;
}

async function saveSettings() {
  const handle = stripAt(els.handle.value);
  els.handle.value = handle;
  const displayName = els.displayName.value.trim();
  const delayMs = Math.min(5000, Math.max(400, Number(els.delay.value) || 900));
  els.delay.value = String(delayMs);
  await browser.storage.local.set({
    handle,
    displayName,
    delayMs,
    ensureEnglish: els.ensureEnglish.checked,
    handleOverrideExplicit: Boolean(handle),
    username: "",
  });
  return {
    handle: handle || "",
    displayName,
    delayMs,
    ensureEnglish: els.ensureEnglish.checked,
  };
}

async function findTikTokTab() {
  const tabs = await browser.tabs.query({ url: ["*://www.tiktok.com/*", "*://tiktok.com/*"] });
  const active = tabs.find((t) => t.active) || tabs[0];
  return active || null;
}

async function send(type) {
  const settings = await saveSettings();
  const tab = await findTikTokTab();
  if (!tab?.id) {
    setUi({ running: false, message: "No TikTok tab found. Open tiktok.com first." });
    return;
  }
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type, settings });
    setUi(status || { running: false });
  } catch (err) {
    setUi({
      running: false,
      message: `TikTok tab not ready: ${err.message || err}. Reload the TikTok page.`,
    });
  }
}

async function refresh() {
  const tab = await findTikTokTab();
  if (!tab?.id) {
    setUi({ running: false, message: "Open a TikTok tab to control the cleaner." });
    return;
  }
  try {
    const status = await browser.tabs.sendMessage(tab.id, { type: "scc:getStatus" });
    setUi(status || { running: false });
  } catch {
    setUi({
      running: false,
      message: "Content script not ready — reload the TikTok tab.",
    });
  }
}

els.start.addEventListener("click", () => send("scc:start"));
els.probe.addEventListener("click", () => send("scc:probe"));
els.stop.addEventListener("click", () => send("scc:stop"));
els.pinPage.addEventListener("click", async () => {
  const tab = await findTikTokTab();
  if (!tab?.id) {
    setUi({ running: false, message: "Open TikTok first." });
    return;
  }
  try {
    await browser.tabs.sendMessage(tab.id, { type: "scc:showPanel" });
    setUi({ running: false, message: "Floating panel pinned on the TikTok page." });
  } catch (err) {
    setUi({ running: false, message: String(err.message || err) });
  }
});

["change", "blur"].forEach((evt) => {
  els.handle.addEventListener(evt, () => saveSettings().catch(() => {}));
  els.displayName.addEventListener(evt, () => saveSettings().catch(() => {}));
  els.delay.addEventListener(evt, () => saveSettings().catch(() => {}));
  els.ensureEnglish.addEventListener(evt, () => saveSettings().catch(() => {}));
});

loadSettings()
  .then(refresh)
  .catch((err) => setUi({ running: false, message: String(err) }));

setInterval(() => {
  refresh().catch(() => {});
}, 1000);
