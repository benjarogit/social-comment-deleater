(() => {
  const SCC = window.__SCC;
  if (!SCC) {
    console.error("[SCC] shared helpers missing");
    return;
  }

  const JOB_KEY = "scc_active_job";
  const JOB_MAX_AGE_MS = 30 * 60 * 1000;

  const status = {
    running: false,
    state: "idle",
    deleted: 0,
    processed: 0,
    message: "Ready. Prefer Probe before Start.",
    probeLog: null,
    phase: null,
    identity: null,
  };

  let activeAbort = null;

  function snapshot() {
    return { ...status };
  }

  function publish() {
    window.__SCC_STATUS__ = snapshot();
    window.dispatchEvent(new CustomEvent("scc:status", { detail: window.__SCC_STATUS__ }));
  }

  function applyCommand(type, settings) {
    if (type === "scc:start") return beginRun(settings, { mode: "clean" });
    if (type === "scc:probe") return beginRun(settings, { mode: "probe" });
    if (type === "scc:stop") return stop();
    return snapshot();
  }

  function detectPlatform() {
    const platforms = SCC.platforms || {};
    return Object.values(platforms).find((p) => p.match()) || null;
  }

  async function saveJob(job) {
    await browser.storage.local.set({
      [JOB_KEY]: { ...job, updatedAt: Date.now() },
    });
  }

  async function clearJob() {
    await browser.storage.local.remove(JOB_KEY);
  }

  async function loadJob() {
    const data = await browser.storage.local.get(JOB_KEY);
    return data[JOB_KEY] || null;
  }

  function beginRun(settings, { mode, resume = null } = {}) {
    if (status.running) return snapshot();

    const platform = detectPlatform();
    if (!platform) {
      status.message = "Unsupported page. Open TikTok Web.";
      return snapshot();
    }

    // Optional override only — auto-detect fills gaps inside the platform runner
    const handle = String(settings?.handle || settings?.username || "")
      .trim()
      .replace(/^@+/, "");
    const displayName = String(settings?.displayName || "").trim();

    if (mode === "probe" && typeof platform.probe !== "function") {
      status.message = "Probe not available on this platform.";
      return snapshot();
    }

    // Fresh detect every run — never keep a stale wrong account in the UI
    const detected =
      typeof platform.detectUser === "function" ? platform.detectUser() : null;
    if (mode === "clean" && !handle && !displayName && !detected?.handle) {
      status.message =
        "Account not found automatically. Enter your handle as fallback (without @), e.g. dokukanalq.";
      status.identity = null;
      publish();
      return snapshot();
    }
    status.identity = detected
      ? {
          handle: handle || detected.handle,
          displayName: displayName || detected.displayName,
          source: handle ? "user-override" : detected.source,
          auto: !handle,
        }
      : handle || displayName
        ? { handle, displayName, source: "user-override", auto: false }
        : null;
    publish();

    activeAbort = new AbortController();
    status.running = true;
    status.state = mode === "probe" ? "probing" : resume ? "resuming" : "running";
    status.deleted = resume?.deleted || 0;
    status.processed = resume?.processed || 0;
    status.probeLog = null;
    status.phase = resume?.phase || (mode === "probe" ? "probe" : "ensure_language");
    status.message = resume
      ? `Resuming after reload (${status.phase})…`
      : mode === "probe"
        ? "Probe starting…"
        : "Starting…";
    publish();
    try {
      window.__SCC_PANEL__?.show?.({ force: true });
    } catch {
      /* panel optional */
    }

    const delayMs = Math.min(5000, Math.max(400, Number(settings?.delayMs) || 700));
    const ensureEnglish = settings?.ensureEnglish !== false;
    const persistedSettings = { handle, displayName, username: handle, delayMs, ensureEnglish };

    const ctx = {
      username: handle,
      handle,
      displayName,
      delayMs,
      ensureEnglish,
      signal: activeAbort.signal,
      seen: new Set(resume?.seen || []),
      status,
      mode,
      resumePhase: resume?.phase || null,
      clearJob,
    };

    ctx.persistPhase = async (phase, extra = {}) => {
      status.phase = phase;
      if (mode !== "clean") return;
      await saveJob({
        active: true,
        mode,
        phase,
        settings: persistedSettings,
        deleted: status.deleted,
        processed: status.processed,
        seen: [...(extra.seen || ctx.seen)],
      });
    };

    (async () => {
      try {
        if (mode === "clean") {
          await ctx.persistPhase(status.phase || "ensure_language");
        }

        if (mode === "probe") {
          await platform.probe(ctx);
          if (!ctx.signal.aborted) status.state = "probed";
        } else {
          await platform.run(ctx);
          if (!ctx.signal.aborted) {
            status.state = "done";
            await clearJob();
          }
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          status.state = "stopped";
          status.message = `Stopped. Deleted ${status.deleted} so far.`;
          await clearJob();
        } else if (err?.name === "SCCReloadPending") {
          // Language change triggered navigation — job stays in storage for resume
          status.state = "reloading";
          status.message = "Waiting for TikTok reload, then continuing…";
          status.running = false;
          activeAbort = null;
          return;
        } else {
          status.state = "error";
          status.message = err?.message || String(err);
          console.error("[SCC]", err);
          await clearJob();
        }
      } finally {
        if (status.state !== "reloading") {
          status.running = false;
          activeAbort = null;
        }
        publish();
      }
    })();

    return snapshot();
  }

  function stop() {
    if (activeAbort) {
      activeAbort.abort();
      status.message = "Stopping…";
    }
    clearJob().catch(() => {});
    status.running = false;
    status.state = "stopped";
    publish();
    return snapshot();
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "scc:getStatus") {
      sendResponse(snapshot());
      return false;
    }

    if (message.type === "scc:stop" || message.type === "scc:start" || message.type === "scc:probe") {
      sendResponse(applyCommand(message.type, message.settings));
      return false;
    }

    if (message.type === "scc:detectUser") {
      const platform = detectPlatform();
      const detected =
        platform && typeof platform.detectUser === "function" ? platform.detectUser() : null;
      sendResponse({ ok: Boolean(detected?.handle), detected });
      return false;
    }

    return false;
  });

  window.addEventListener("scc:command", (event) => {
    const { type, settings } = event.detail || {};
    if (type) applyCommand(type, settings);
  });

  setInterval(publish, 600);
  publish();

  async function maybeResume() {
    try {
      const job = await loadJob();
      if (!job?.active || job.mode !== "clean") return;
      if (Date.now() - (job.updatedAt || 0) > JOB_MAX_AGE_MS) {
        await clearJob();
        return;
      }

      // Wait until sidenav is interactive after reload
      await SCC.waitFor(
        () =>
          document.querySelector("#app") &&
          (document.querySelector('button[data-e2e="nav-activity"]') ||
            document.querySelector('[class*="DivMainNavContainer"]')),
        { timeout: 25000, interval: 300 }
      );
      await SCC.sleep(800);

      console.info("[SCC] resuming job from phase", job.phase);
      beginRun(job.settings, { mode: "clean", resume: job });
    } catch (err) {
      console.warn("[SCC] resume failed", err);
    }
  }

  /** Keep panel/window in sync with the real logged-in account. */
  function refreshIdentity() {
    try {
      const platform = detectPlatform();
      if (!platform || typeof platform.detectUser !== "function") return;
      const detected = platform.detectUser();
      if (!detected?.handle) return;
      const prev = status.identity?.handle;
      if (prev && prev !== detected.handle) {
        console.warn("[SCC] correcting identity", prev, "→", detected.handle);
      }
      status.identity = {
        handle: detected.handle,
        displayName: detected.displayName || "",
        source: detected.source,
        auto: true,
      };
      publish();
    } catch (err) {
      console.warn("[SCC] refreshIdentity failed", err);
    }
  }

  console.info("[SCC] content ready on", location.hostname);
  refreshIdentity();
  setInterval(refreshIdentity, 8000);
  maybeResume();
})();
