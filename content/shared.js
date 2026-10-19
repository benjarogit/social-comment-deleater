(() => {
  const SCC = (window.__SCC = window.__SCC || {});

  SCC.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Wait until fn() is truthy. Uses MutationObserver + short poll (no blind long sleeps).
   */
  SCC.waitFor = async (fn, { timeout = 12000, interval = 100, signal, root } = {}) => {
    const start = Date.now();
    const immediate = fn();
    if (immediate) return immediate;

    return new Promise((resolve, reject) => {
      let done = false;
      let observer = null;
      let timer = null;
      let poll = null;

      const cleanup = () => {
        if (done) return;
        done = true;
        observer?.disconnect();
        if (timer) clearTimeout(timer);
        if (poll) clearInterval(poll);
        signal?.removeEventListener?.("abort", onAbort);
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };

      const check = () => {
        if (done) return;
        if (signal?.aborted) {
          onAbort();
          return;
        }
        try {
          const value = fn();
          if (value) {
            cleanup();
            resolve(value);
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      const target = root || document.documentElement;
      try {
        observer = new MutationObserver(() => {
          // rAF batches rapid mutations
          requestAnimationFrame(check);
        });
        observer.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: false,
        });
      } catch {
        observer = null;
      }

      poll = setInterval(check, Math.max(50, interval));
      timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeout);

      // First paint check
      requestAnimationFrame(check);
    });
  };

  /**
   * Adaptive pacing: speed up after successes, slow down after failures.
   * Background tabs get a floor so Firefox throttling doesn't break clicks.
   */
  SCC.createPacer = ({ baseMs = 700, minMs = 320, maxMs = 2200 } = {}) => {
    let current = Math.min(maxMs, Math.max(minMs, baseMs));
    let okStreak = 0;

    const effective = () => {
      if (document.hidden) return Math.max(current, 1100);
      return current;
    };

    return {
      get ms() {
        return Math.round(effective());
      },
      get base() {
        return Math.round(current);
      },
      /** Short settle after a click — UI needs a beat, not a full gap. */
      async settle(signal, factor = 0.28) {
        const ms = Math.max(80, Math.round(effective() * factor));
        await SCC.sleep(ms);
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      },
      /** Gap between major steps (open next item, etc.). */
      async gap(signal, factor = 1) {
        const ms = Math.round(effective() * factor);
        await SCC.sleep(ms);
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      },
      success() {
        okStreak += 1;
        if (okStreak >= 2) {
          current = Math.max(minMs, current * 0.88);
          okStreak = 0;
        }
      },
      fail() {
        okStreak = 0;
        current = Math.min(maxMs, current * 1.4);
      },
      bump(factor = 1.25) {
        okStreak = 0;
        current = Math.min(maxMs, current * factor);
      },
    };
  };

  SCC.visible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  SCC.textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  SCC.click = (el) => {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    if (typeof el.click === "function") el.click();
    return true;
  };

  SCC.hover = (el) => {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent("pointerover", opts));
    el.dispatchEvent(new MouseEvent("pointerenter", opts));
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mouseenter", opts));
    el.dispatchEvent(new MouseEvent("mousemove", opts));
    return true;
  };

  SCC.findByText = (selector, text, { exact = false, root = document } = {}) => {
    const needle = text.trim().toLowerCase();
    const nodes = [...root.querySelectorAll(selector)];
    return (
      nodes.find((node) => {
        if (!SCC.visible(node)) return false;
        const hay = SCC.textOf(node).toLowerCase();
        return exact ? hay === needle : hay.includes(needle);
      }) || null
    );
  };

  SCC.findButtonByLabel = (label, { exact = true, root = document } = {}) => {
    const buttons = [...root.querySelectorAll("button, [role='button'], a")];
    const needle = label.trim().toLowerCase();
    return (
      buttons.find((btn) => {
        if (!SCC.visible(btn)) return false;
        const aria = (btn.getAttribute("aria-label") || "").trim().toLowerCase();
        const text = SCC.textOf(btn).toLowerCase();
        if (exact) return aria === needle || text === needle;
        return aria.includes(needle) || text.includes(needle);
      }) || null
    );
  };

  SCC.findButtonByAnyLabel = (labels, { exact = true, root = document } = {}) => {
    for (const label of labels) {
      const hit = SCC.findButtonByLabel(label, { exact, root });
      if (hit) return hit;
    }
    return null;
  };

  SCC.uniqueKey = (text) => text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 180);

  SCC.normalizeDisplayName = (value) =>
    String(value || "")
      .normalize("NFKC")
      .replace(/\u2026/g, "...")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  SCC.handleFromHref = (href) => {
    if (!href) return "";
    try {
      const path = href.startsWith("http") ? new URL(href, location.origin).pathname : href;
      const m = path.match(/\/@([^/?#]+)/);
      return m ? decodeURIComponent(m[1]).toLowerCase() : "";
    } catch {
      return "";
    }
  };

  SCC.normalizeHandle = (value) =>
    String(value || "")
      .trim()
      .replace(/^@+/, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
})();
