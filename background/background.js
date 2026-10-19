/** Background: detached panel window + messaging (Firefox + Chromium). */

let panelWindowId = null;

browser.runtime.onInstalled.addListener(() => {
  console.info("[SCC] Social Comment Cleaner installed");
});

async function openPanelWindow() {
  if (panelWindowId != null) {
    try {
      const existing = await browser.windows.get(panelWindowId);
      if (existing?.id != null) {
        await browser.windows.update(panelWindowId, { focused: true });
        return { ok: true, reused: true };
      }
    } catch {
      panelWindowId = null;
    }
  }

  const win = await browser.windows.create({
    url: browser.runtime.getURL("panel/panel.html"),
    type: "popup",
    width: 380,
    height: 620,
  });
  panelWindowId = win?.id ?? null;
  return { ok: true, reused: false, windowId: panelWindowId };
}

browser.windows.onRemoved.addListener((id) => {
  if (id === panelWindowId) panelWindowId = null;
});

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "scc:log") {
    console.info("[SCC]", message.payload);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "scc:openPanelWindow") {
    openPanelWindow()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  return false;
});
