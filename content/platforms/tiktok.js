(() => {
  const SCC = (window.__SCC = window.__SCC || {});

  const LABELS = {
    more: ["More", "Mehr", "Más", "Plus", "Altro", "Mais", "更多", "その他", "더 보기", "더보기"],
    activity: ["Activity", "Aktivität", "Actividad", "Activité", "Attività", "Atividade"],
    comments: ["Comments", "Kommentare", "Comentarios", "Commentaires", "Commenti", "Comentários"],
    delete: ["Delete", "Löschen", "Eliminar", "Supprimer", "Elimina", "Excluir"],
    confirm: ["Delete", "Löschen", "Confirm", "Bestätigen", "OK", "Confirmer"],
    language: ["Language", "Sprache", "Idioma", "Langue", "Lingua"],
  };

  const helpers = () => ({
    sleep: SCC.sleep,
    waitFor: SCC.waitFor,
    visible: SCC.visible,
    textOf: SCC.textOf,
    click: SCC.click,
    hover: SCC.hover,
    findButtonByLabel: SCC.findButtonByLabel,
    findButtonByAnyLabel: SCC.findButtonByAnyLabel,
    uniqueKey: SCC.uniqueKey,
  });

  function ensurePacer(ctx) {
    if (!ctx.pacer) {
      const base = Math.min(2000, Math.max(400, Number(ctx.delayMs) || 700));
      ctx.pacer = SCC.createPacer({
        baseMs: base,
        minMs: Math.max(280, Math.round(base * 0.4)),
        maxMs: Math.max(2200, Math.round(base * 2.4)),
      });
    }
    return ctx.pacer;
  }

  /** Prefer settle (short) after UI actions; gap between larger steps. */
  async function pace(ctx, kind = "settle") {
    const pacer = ensurePacer(ctx);
    if (kind === "gap") await pacer.gap(ctx.signal);
    else await pacer.settle(ctx.signal);
    report(ctx, { paceMs: pacer.ms });
  }

  function report(ctx, patch) {
    Object.assign(ctx.status, patch);
  }

  /** CSS :hover menus often ignore synthetic mouse events — force the ⋯ control visible. */
  function installHoverOverrides() {
    if (document.getElementById("scc-hover-overrides")) return;
    const style = document.createElement("style");
    style.id = "scc-hover-overrides";
    style.textContent = `
      [class*="DivMore"],
      [class*="DivMoreTriggerWrapper"],
      [class*="DivCommentHeaderWrapper"] [class*="DivMore"] {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function removeHoverOverrides() {
    document.getElementById("scc-hover-overrides")?.remove();
  }

  function sideNavRoot() {
    return (
      document.querySelector('[class*="DivMainNavContainer"]') ||
      document.querySelector('[class*="DivSideNavContainer"]') ||
      document.querySelector('[class*="DivScrollingContentContainer"]') ||
      document.body
    );
  }

  function navMoreButton() {
    const { findButtonByAnyLabel, visible, textOf } = helpers();
    const root = sideNavRoot();

    const byLabel = findButtonByAnyLabel(LABELS.more, { exact: true, root });
    if (byLabel) return byLabel;

    // Structural fallback: nav button that owns the red-dot badge container
    const withBadge = [...root.querySelectorAll("button")].find((btn) => {
      if (!visible(btn)) return false;
      return Boolean(
        btn.querySelector('[class*="TUXAlertBadgeDot"], [class*="DivIconWithRedDotContainer"]')
      );
    });
    if (withBadge && /more|mehr|más|plus|altro|mais|更多/i.test(textOf(withBadge) + (withBadge.getAttribute("aria-label") || ""))) {
      return withBadge;
    }

    // Last resort: last secondary nav button whose label is short (More/Mehr)
    const navButtons = [...root.querySelectorAll("button.TUXButton, button[role='listitem']")].filter(visible);
    const short = navButtons.filter((btn) => {
      const t = textOf(btn);
      return t.length > 0 && t.length <= 12;
    });
    return short[short.length - 1] || null;
  }

  function activityButton() {
    const { findButtonByAnyLabel } = helpers();
    return (
      document.querySelector('button[data-e2e="nav-activity"]') ||
      findButtonByAnyLabel(LABELS.activity, { exact: true, root: sideNavRoot() })
    );
  }

  function commentsTab() {
    const { findButtonByAnyLabel } = helpers();
    return (
      document.querySelector('button[data-e2e="comments"], #inbox-tab-2') ||
      findButtonByAnyLabel(LABELS.comments, { exact: true })
    );
  }

  function inboxItems() {
    const { visible } = helpers();
    return [...document.querySelectorAll('[data-e2e="inbox-list-item"]')].filter(visible);
  }

  function moreDrawer() {
    return document.querySelector(
      '[class*="DivMoreDrawerContainer"], #creator-tools-selection-menu-header'
    );
  }

  function languageListOpen() {
    const { textOf, visible } = helpers();
    return Boolean(
      [...document.querySelectorAll("div, h1, h2, span")].find((el) => {
        if (!visible(el)) return false;
        const t = textOf(el);
        return LABELS.language.some((l) => t === l);
      })
    );
  }

  function describeEl(el) {
    if (!el) return "null";
    const { textOf } = helpers();
    const tag = el.tagName.toLowerCase();
    const e2e = el.getAttribute("data-e2e") || "";
    const aria = el.getAttribute("aria-label") || "";
    const text = textOf(el).slice(0, 40);
    return `<${tag}${e2e ? ` e2e=${e2e}` : ""}${aria ? ` aria=${aria}` : ""} "${text}">`;
  }

  function isEnglishNav() {
    const { findButtonByLabel, textOf } = helpers();
    const root = sideNavRoot();
    if (findButtonByLabel("More", { exact: true, root })) return true;
    if (findButtonByLabel("Activity", { exact: true, root })) return true;
    // data-e2e is language-stable; pair with English label when present
    const activity = document.querySelector('button[data-e2e="nav-activity"]');
    if (activity && /^activity$/i.test(textOf(activity))) return true;
    return false;
  }

  async function closeOverlays(ctx) {
    const { sleep } = helpers();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await sleep(200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    clickOutsideDrawer();
    if (ctx) await pace(ctx);
    else await sleep(400);
  }

  async function ensureEnglish(ctx) {
    const { waitFor, click, textOf, findButtonByLabel, sleep } = helpers();

    // Resume after reload: language step already done
    if (ctx.resumePhase && ctx.resumePhase !== "ensure_language") {
      report(ctx, { message: "Skipping language (already done before reload)." });
      return;
    }

    if (isEnglishNav()) {
      report(ctx, { message: "UI already English." });
      await ctx.persistPhase?.("open_inbox");
      return;
    }

    report(ctx, { message: "Checking UI language (Mehr/More)…" });

    const more = await waitFor(() => navMoreButton(), { signal: ctx.signal, timeout: 8000 });
    if (!more) throw new Error('Sidebar "More/Mehr" button not found.');
    click(more);
    await pace(ctx);

    const drawer = await waitFor(() => moreDrawer(), { signal: ctx.signal, timeout: 8000 });
    if (!drawer) throw new Error("More drawer did not open.");

    const languageEntry =
      findButtonByLabel("English (US)", { exact: false, root: drawer }) ||
      [...drawer.querySelectorAll("button")].find((btn) => {
        const t = textOf(btn);
        return /english|deutsch|français|español|português|italiano|nederlands|polski|日本語|한국어|中文|čeština|svenska|dansk|suomi|magyar|română|Türkçe|العربية|हिन्दी|ไทย|Tiếng Việt|Bahasa/i.test(
          t
        );
      });

    if (!languageEntry) {
      report(ctx, { message: "Language entry not found; continuing." });
      await closeOverlays(ctx);
      await ctx.persistPhase?.("open_inbox");
      return;
    }

    const entryText = textOf(languageEntry);
    // Already showing English in the More menu — no need to switch
    if (/^english/i.test(entryText)) {
      report(ctx, { message: "Language already English (US)." });
      await closeOverlays(ctx);
      await ctx.persistPhase?.("open_inbox");
      return;
    }

    click(languageEntry);
    await pace(ctx);

    await waitFor(() => languageListOpen() || findButtonByLabel("English (US)", { exact: true }), {
      signal: ctx.signal,
      timeout: 6000,
    });

    const englishOption =
      findButtonByLabel("English (US)", { exact: true }) ||
      [...document.querySelectorAll("button, li, div[role='button']")].find(
        (el) => textOf(el) === "English (US)" && helpers().visible(el)
      );

    if (!englishOption) {
      report(ctx, { message: "English (US) option missing; continuing." });
      await closeOverlays(ctx);
      await ctx.persistPhase?.("open_inbox");
      return;
    }

    // Persist BEFORE click — TikTok often full-reloads on language change
    await ctx.persistPhase?.("open_inbox");
    report(ctx, { message: "Switching to English (US)… (continues after reload if needed)" });
    click(englishOption);

    // If the page unloads, this script dies; resume picks up open_inbox.
    // If it stays as SPA, wait for English nav then continue.
    const becameEnglish = await waitFor(() => isEnglishNav(), {
      signal: ctx.signal,
      timeout: 12000,
      interval: 400,
    });

    if (!becameEnglish) {
      // Likely navigating — signal controller to keep job and stop this instance
      report(ctx, { message: "Page reloading after language change…" });
      const err = new Error("Reload pending after language change");
      err.name = "SCCReloadPending";
      throw err;
    }

    await sleep(600);
    await closeOverlays(ctx);
    report(ctx, { message: "Language set to English (US)." });
  }

  function clickOutsideDrawer() {
    const { click } = helpers();
    const main = document.querySelector("#app") || document.body;
    click(main);
  }

  async function openCommentsInbox(ctx) {
    const { waitFor, click, sleep } = helpers();
    report(ctx, { message: "Opening Activity → Comments…" });
    await ctx.persistPhase?.("open_inbox");

    // Make sure drawers from language step are gone
    await closeOverlays(ctx);
    await sleep(300);

    const activity = await waitFor(() => activityButton(), { signal: ctx.signal, timeout: 15000 });
    if (!activity) throw new Error('Could not find "Activity/Aktivität" nav button.');
    click(activity);
    await pace(ctx);

    const tab = await waitFor(() => commentsTab(), { signal: ctx.signal, timeout: 15000 });
    if (!tab) throw new Error('Could not find inbox "Comments/Kommentare" tab.');
    click(tab);
    await pace(ctx);

    await waitFor(
      () => inboxItems().length > 0 || document.querySelector('[data-e2e="inbox-notifications"]'),
      { signal: ctx.signal, timeout: 15000 }
    );
    await ctx.persistPhase?.("clean_loop");
  }

  function isVideoDetail() {
    return Boolean(
      document.querySelector("#main-content-video_detail") ||
        document.querySelector('[class*="DivCommentListContainer"]')
    );
  }

  function commentListRoot() {
    return (
      document.querySelector('[class*="DivCommentListContainer"]') ||
      document.querySelector('[class*="DivCommentMain"]') ||
      document.querySelector("#main-content-video_detail") ||
      document
    );
  }

  /**
   * One deletable unit = DivCommentItemWrapper (top-level OR reply).
   * Never use DivCommentObjectWrapper — that wraps parent + all replies.
   * Level-1: data-e2e="comment-username-1" / comment-level-1
   * Level-2 (reply): data-e2e="comment-username-2" / comment-level-2 inside DivReplyContainer
   */
  function commentItemWrappers() {
    const { visible } = helpers();
    const root = commentListRoot();
    return [...root.querySelectorAll('[class*="DivCommentItemWrapper"]')].filter(visible);
  }

  function commentLevel(commentEl) {
    if (commentEl.querySelector('[data-e2e="comment-level-2"], [data-e2e="comment-username-2"]')) {
      return 2;
    }
    if (commentEl.querySelector('[data-e2e="comment-level-1"], [data-e2e="comment-username-1"]')) {
      return 1;
    }
    if (commentEl.closest('[class*="DivReplyContainer"]')) return 2;
    return 1;
  }

  function usernameBlock(commentEl) {
    return (
      commentEl.querySelector('[data-e2e="comment-username-2"]') ||
      commentEl.querySelector('[data-e2e="comment-username-1"]') ||
      commentEl.querySelector('[data-e2e^="comment-username"]') ||
      commentEl.querySelector('[class*="DivUsernameContentWrapper"]')
    );
  }

  function identityFromComment(commentEl) {
    const { textOf } = helpers();
    // Scope to THIS item only — do not read nested reply rows inside a parent wrapper
    const userBox = usernameBlock(commentEl);
    const link =
      userBox?.querySelector('a[href*="/@"]') ||
      commentEl.querySelector('[class*="DivAvatarWrapper"] a[href*="/@"]') ||
      commentEl.querySelector(':scope > * a[href*="/@"]');
    const handle = SCC.handleFromHref(link?.getAttribute("href") || "");
    const nameEl = userBox?.querySelector("a p, p") || link?.querySelector("p");
    const displayName = nameEl ? textOf(nameEl) : "";
    return { handle, displayName, level: commentLevel(commentEl) };
  }

  function displayNamesMatch(a, b) {
    const na = SCC.normalizeDisplayName(a);
    const nb = SCC.normalizeDisplayName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const strip = (s) => s.replace(/\.+$/, "").trim();
    const sa = strip(na);
    const sb = strip(nb);
    return Boolean(sa && sb && (sa.startsWith(sb) || sb.startsWith(sa) || sa.includes(sb) || sb.includes(sa)));
  }

  function identityMatches(commentEl, identity) {
    const { handle: wantHandle, displayName: wantDisplay } = identity;
    const found = identityFromComment(commentEl);

    if (wantHandle && found.handle && found.handle === wantHandle) return true;

    // Avatar + username links that belong to this item (not nested child items)
    if (wantHandle) {
      const userBox = usernameBlock(commentEl);
      const avatar = commentEl.querySelector('[class*="DivAvatarWrapper"]');
      const scopeLinks = [
        ...(userBox ? userBox.querySelectorAll('a[href*="/@"]') : []),
        ...(avatar ? avatar.querySelectorAll('a[href*="/@"]') : []),
      ];
      if (scopeLinks.some((a) => SCC.handleFromHref(a.getAttribute("href")) === wantHandle)) {
        return true;
      }
    }

    if (wantDisplay && found.displayName && displayNamesMatch(wantDisplay, found.displayName)) {
      return true;
    }

    return false;
  }

  /** Always the single comment row — never the whole thread object. */
  function commentRootFromEl(el) {
    return el.closest('[class*="DivCommentItemWrapper"]');
  }

  function depth(el) {
    let d = 0;
    let n = el;
    while (n) {
      d += 1;
      n = n.parentElement;
    }
    return d;
  }

  function itemOwnedByHandle(el, handle) {
    if (!handle) return false;
    const userBox = usernameBlock(el);
    const avatar = el.querySelector(':scope > [class*="DivAvatarWrapper"], [class*="DivAvatarWrapper"]');
    const links = [
      ...(userBox ? [...userBox.querySelectorAll('a[href*="/@"]')] : []),
      ...(avatar ? [...avatar.querySelectorAll('a[href*="/@"]')] : []),
    ];
    // Only direct avatar of this item (first DivAvatarWrapper), not nested replies
    const ownAvatar = el.querySelector(':scope > [class*="DivAvatarWrapper"]');
    if (ownAvatar) {
      for (const a of ownAvatar.querySelectorAll('a[href*="/@"]')) {
        if (SCC.handleFromHref(a.getAttribute("href")) === handle) return true;
      }
    }
    if (userBox) {
      for (const a of userBox.querySelectorAll('a[href*="/@"]')) {
        if (SCC.handleFromHref(a.getAttribute("href")) === handle) return true;
      }
    }
    return links.some((a) => SCC.handleFromHref(a.getAttribute("href")) === handle);
  }

  function isOwnedByMe(el, identity) {
    if (!el) return false;
    if (identity.handle && itemOwnedByHandle(el, identity.handle)) return true;
    return identityMatches(el, identity);
  }

  function threadObjects() {
    const { visible } = helpers();
    const root = commentListRoot();
    return [...root.querySelectorAll('[class*="DivCommentObjectWrapper"]')].filter(visible);
  }

  /** Top-level row inside a thread (not a reply inside DivReplyContainer). */
  function topLevelItemInThread(threadEl) {
    const items = [...threadEl.querySelectorAll('[class*="DivCommentItemWrapper"]')];
    return (
      items.find((el) => !el.closest('[class*="DivReplyContainer"]')) ||
      items.find((el) => commentLevel(el) === 1) ||
      items[0] ||
      null
    );
  }

  function replyItemsInThread(threadEl) {
    const replyBox = threadEl.querySelector('[class*="DivReplyContainer"]');
    if (!replyBox) return [];
    return [...replyBox.querySelectorAll('[class*="DivCommentItemWrapper"]')];
  }

  function findOwnComments(identity, { snippet } = {}) {
    const { textOf } = helpers();
    const found = [];
    const seen = new Set();
    const add = (el) => {
      const root = commentRootFromEl(el);
      if (!root || seen.has(root) || root.dataset.sccSkip === "1") return;
      seen.add(root);
      found.push(root);
    };

    for (const el of commentItemWrappers()) {
      if (isOwnedByMe(el, identity)) {
        add(el);
        continue;
      }
      if (snippet && snippet.length >= 4) {
        const body =
          el.querySelector(
            '[data-e2e="comment-level-2"], [data-e2e="comment-level-1"], [data-e2e^="comment-level"]'
          ) || el;
        if (
          textOf(body).toLowerCase().includes(snippet.toLowerCase()) &&
          isOwnedByMe(el, identity)
        ) {
          add(el);
        }
      }
    }

    return found;
  }

  /**
   * Deletion policy:
   * - Own top-level comment → delete ONLY the parent (TikTok removes the whole block/replies).
   * - Own reply under someone else's comment → delete that reply only.
   * - Own replies under our own parent → skip (gone when parent is deleted).
   */
  function selectDeletionTargets(identity, { snippet } = {}) {
    const targets = [];
    const seen = new Set();
    const push = (el, reason) => {
      if (!el || seen.has(el) || el.dataset.sccSkip === "1") return;
      seen.add(el);
      el.dataset.sccDeleteReason = reason;
      targets.push(el);
    };

    const threads = threadObjects();
    if (threads.length) {
      for (const thread of threads) {
        const parent = topLevelItemInThread(thread);
        if (!parent) continue;

        if (isOwnedByMe(parent, identity)) {
          // Own thread: one delete on parent clears the block (incl. all replies)
          push(parent, "own-thread");
          continue;
        }

        // Foreign thread: only our replies
        for (const reply of replyItemsInThread(thread)) {
          if (isOwnedByMe(reply, identity)) push(reply, "own-reply-on-foreign");
        }
      }
    } else {
      // Fallback if thread wrappers missing: apply same rules via level
      const own = findOwnComments(identity, { snippet });
      const ownParents = own.filter((el) => commentLevel(el) === 1);
      const ownReplies = own.filter((el) => commentLevel(el) === 2);

      for (const parent of ownParents) push(parent, "own-thread");

      for (const reply of ownReplies) {
        const thread = reply.closest('[class*="DivCommentObjectWrapper"]');
        const parent = thread ? topLevelItemInThread(thread) : null;
        if (parent && isOwnedByMe(parent, identity)) continue; // covered by parent delete
        push(reply, "own-reply-on-foreign");
      }
    }

    // Foreign replies first, then own parents (safer UI; parents wipe large blocks)
    targets.sort((a, b) => {
      const ra = a.dataset.sccDeleteReason === "own-reply-on-foreign" ? 0 : 1;
      const rb = b.dataset.sccDeleteReason === "own-reply-on-foreign" ? 0 : 1;
      return ra - rb || depth(b) - depth(a);
    });

    return targets;
  }

  /** From "Alice replied to your comment: … Was wäre wenn...: Das ist gestellt" */
  function snippetFromInboxItem(item, identity) {
    const { textOf } = helpers();
    const raw = textOf(item);
    if (!raw) return "";

    if (identity.displayName) {
      const dn = identity.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${dn}\\s*:\\s*(.+)$`, "i");
      const m = raw.match(re);
      if (m?.[1]) return m[1].replace(/\s*·\s*\d+.*/, "").trim().slice(0, 80);
    }

    // Generic: last "something: comment text" chunk
    const parts = raw.split(":");
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim();
      if (last.length >= 4) return last.replace(/\s*·\s*\d+.*/, "").trim().slice(0, 80);
    }
    return "";
  }

  function userFromObject(user, source) {
    if (!user || typeof user !== "object") return null;
    const handle = SCC.normalizeHandle(
      user.uniqueId || user.unique_id || user.uniqueid || user.username || ""
    );
    if (!handle) return null;
    return {
      handle,
      displayName: String(user.nickname || user.nickName || user.nick_name || handle),
      source,
    };
  }

  function digUserInJson(value, depth = 0) {
    if (!value || depth > 8) return null;
    if (typeof value === "object") {
      const direct = userFromObject(value, "json");
      if (direct && (value.uniqueId || value.unique_id)) return direct;
      if (Array.isArray(value)) {
        for (const item of value) {
          const hit = digUserInJson(item, depth + 1);
          if (hit) return hit;
        }
        return null;
      }
      for (const key of Object.keys(value)) {
        if (/user|account|login|app-context|user-detail/i.test(key) || depth < 3) {
          const hit = digUserInJson(value[key], depth + 1);
          if (hit) return hit;
        }
      }
    }
    return null;
  }

  /** Best-effort: who is logged in? Prefer @handle over fancy display names. */
  function detectLoggedInUser() {
    const { textOf, findButtonByAnyLabel, visible } = helpers();

    // 1) Own profile page (Edit profile visible)
    const pathHandle = SCC.handleFromHref(location.pathname);
    if (pathHandle) {
      const edit =
        document.querySelector('[data-e2e="edit-profile"]') ||
        findButtonByAnyLabel(["Edit profile", "Profil bearbeiten"], { exact: false });
      if (edit) {
        const titleEl =
          document.querySelector('[data-e2e="user-title"]') ||
          document.querySelector('[data-e2e="user-subtitle"]') ||
          document.querySelector("h1");
        return {
          handle: pathHandle,
          displayName: textOf(titleEl) || pathHandle,
          source: "profile-page",
        };
      }
    }

    // 2) Side nav Profile → /@handle
    const navRoot = sideNavRoot();
    const profileAnchors = [...navRoot.querySelectorAll('a[href*="/@"]')];
    for (const a of profileAnchors) {
      const label = `${a.getAttribute("aria-label") || ""} ${textOf(a)}`.toLowerCase();
      if (!/profile|profil/.test(label) && !a.querySelector("img")) continue;
      const handle = SCC.handleFromHref(a.getAttribute("href"));
      if (handle) {
        return {
          handle,
          displayName: textOf(a.querySelector("p, span")) || handle,
          source: "nav-profile",
        };
      }
    }

    const profileBtn = findButtonByAnyLabel(["Profile", "Profil"], { exact: true, root: navRoot });
    if (profileBtn) {
      const href =
        profileBtn.closest("a")?.getAttribute("href") ||
        profileBtn.querySelector("a")?.getAttribute("href") ||
        profileBtn.getAttribute("href");
      const handle = SCC.handleFromHref(href || "");
      if (handle) {
        return { handle, displayName: textOf(profileBtn) || handle, source: "nav-profile-btn" };
      }
    }

    // 3) Rehydration / SIGI / next data blobs
    const scriptIds = [
      "#__UNIVERSAL_DATA_FOR_REHYDRATION__",
      "#SIGI_STATE",
      "#__NEXT_DATA__",
    ];
    for (const sel of scriptIds) {
      try {
        const el = document.querySelector(sel);
        if (!el?.textContent) continue;
        const data = JSON.parse(el.textContent);
        const scoped =
          data?.__DEFAULT_SCOPE__?.["webapp.app-context"]?.user ||
          data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user ||
          data?.AppContext?.appContext?.user ||
          data?.UserModule?.users;
        const fromScoped = userFromObject(
          Array.isArray(scoped) ? null : scoped,
          sel.replace("#", "")
        );
        if (fromScoped) return fromScoped;
        if (scoped && typeof scoped === "object") {
          const first = Object.values(scoped)[0];
          const u = userFromObject(first, sel.replace("#", ""));
          if (u) return u;
        }
        const dug = digUserInJson(data);
        if (dug) {
          dug.source = sel.replace("#", "");
          return dug;
        }
      } catch {
        /* ignore */
      }
    }

    // 4) Any uniqueId in inline scripts (last resort, constrained)
    try {
      const scripts = [...document.querySelectorAll("script:not([src])")].slice(0, 40);
      for (const s of scripts) {
        const text = s.textContent || "";
        if (!/uniqueId|unique_id/.test(text)) continue;
        const m = text.match(/"uniqueId"\s*:\s*"([^"]+)"/) || text.match(/"unique_id"\s*:\s*"([^"]+)"/);
        const nick =
          text.match(/"nickname"\s*:\s*"([^"]+)"/) || text.match(/"nickName"\s*:\s*"([^"]+)"/);
        if (m?.[1]) {
          return {
            handle: SCC.normalizeHandle(m[1]),
            displayName: nick?.[1] || m[1],
            source: "inline-script",
          };
        }
      }
    } catch {
      /* ignore */
    }

    // 5) Visible avatar linking to /@… in top chrome (often current user)
    const topLinks = [...document.querySelectorAll('a[href^="/@"]')].filter(visible);
    for (const a of topLinks) {
      if (!a.querySelector("img")) continue;
      const handle = SCC.handleFromHref(a.getAttribute("href"));
      // Skip video author links in FYP that aren't profile nav — weak signal
      if (handle && a.closest('[class*="DivSideNav"], [class*="MainNav"], header, nav')) {
        return {
          handle,
          displayName: textOf(a) || handle,
          source: "chrome-avatar",
        };
      }
    }

    return null;
  }

  /**
   * Auto-detect first; optional user override if detection fails or user forces one.
   * @ is stripped — callers may display with @.
   */
  function resolveIdentity(ctx) {
    const detected = detectLoggedInUser();
    let override = SCC.normalizeHandle(ctx.handle || ctx.username || "");
    let displayOverride = (ctx.displayName || "").trim();

    // User pasted a display name into the handle/override field
    const looksLikeDisplay = /\s/.test(override) || /\.\.\.$/.test(override);
    if (looksLikeDisplay) {
      displayOverride = displayOverride || override;
      override = "";
    }

    const handle = override || detected?.handle || "";
    let displayName =
      displayOverride ||
      (detected && (!override || override === detected.handle) ? detected.displayName : "") ||
      "";
    // Ignore useless nickname === handle (nav often shows that)
    if (displayName && handle && displayName.toLowerCase() === handle.toLowerCase()) {
      displayName = displayOverride || "";
    }

    return {
      handle,
      displayName,
      detected,
      source: override ? "user-override" : detected?.source || "none",
      auto: Boolean(!override && detected?.handle),
    };
  }

  function moreTriggerIn(commentEl) {
    const { visible } = helpers();
    // Prefer header ⋯ on THIS item (aria-haspopup=dialog on DivMore)
    const scoped =
      commentEl.querySelector('[class*="DivCommentHeaderWrapper"] [class*="DivMoreTriggerWrapper"]') ||
      commentEl.querySelector('[class*="DivMore"][aria-haspopup]') ||
      commentEl.querySelector('[class*="DivMoreTriggerWrapper"]') ||
      commentEl.querySelector('[class*="DivMore"]');
    if (scoped) return scoped.querySelector('[class*="DivMoreTriggerWrapper"]') || scoped;

    return [...commentEl.querySelectorAll("button, div[role='button'], [aria-haspopup='dialog']")].find(
      (el) => {
        if (!visible(el)) return false;
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        return label.includes("more") || label.includes("mehr") || label.includes("option");
      }
    );
  }

  function deleteButton() {
    const { findButtonByAnyLabel } = helpers();
    // Popover action only — not the modal confirm button
    return (
      document.querySelector('button[data-e2e="comment-delete"]') ||
      document.querySelector('.TUXPopover-content button[data-e2e="comment-delete"]') ||
      [...document.querySelectorAll(".TUXPopover-content button, [class*='TUXPopover'] button")].find(
        (btn) => helpers().textOf(btn).toLowerCase() === "delete" || helpers().textOf(btn).toLowerCase() === "löschen"
      ) ||
      findButtonByAnyLabel(LABELS.delete, { exact: true })
    );
  }

  function deleteConfirmModal() {
    return (
      document.querySelector('[data-e2e="comment-delete-modal"]') ||
      document.querySelector(".TUXModal[role='dialog']") ||
      document.querySelector('[class*="DivDeleteModalWrapper"]')
    );
  }

  function confirmDeleteButton() {
    const { textOf, visible } = helpers();
    // Primary confirm in "Are you sure…?" modal
    const byE2e = document.querySelector('button[data-e2e="comment-modal-delete"]');
    if (byE2e && visible(byE2e)) return byE2e;

    const modal = deleteConfirmModal();
    if (!modal) return null;

    const primary =
      modal.querySelector("button.TUXButton--primary") ||
      [...modal.querySelectorAll("button")].find((btn) => {
        if (!visible(btn)) return false;
        const t = textOf(btn).toLowerCase();
        return t === "delete" || t === "löschen";
      });
    return primary || null;
  }

  async function expandReplyThreads(ctx) {
    const { click, textOf, visible } = helpers();
    const root = commentListRoot();
    const buttons = [...root.querySelectorAll("button, span, div[role='button'], a")].filter((el) => {
      if (!visible(el)) return false;
      const t = textOf(el).toLowerCase();
      if (!t || t === "hide" || t.startsWith("hide ")) return false;
      // "View 1 more", "View 3 replies", etc.
      return /view \d+\s*more|view \d+\s*repl|view more|view reply|antworten anzeigen|weitere|noch \d+/i.test(
        t
      );
    });
    for (const btn of buttons.slice(0, 10)) {
      click(btn);
      await pace(ctx);
    }
  }

  async function huntOwnComments(ctx, identity, snippet) {
    const list =
      document.querySelector('[class*="DivCommentListContainer"]') ||
      document.querySelector('[class*="DivCommentMain"]');
    const pacer = ensurePacer(ctx);

    for (let i = 0; i < 10; i++) {
      if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
      const targets = selectDeletionTargets(identity, { snippet });
      if (targets.length) return targets;

      await expandReplyThreads(ctx);
      if (list) {
        list.scrollTop = Math.min(list.scrollHeight, list.scrollTop + 450);
      }
      report(ctx, { message: `Searching comments… (${i + 1}/10)`, paceMs: pacer.ms });
      await pacer.gap(ctx.signal, document.hidden ? 1.2 : 0.7);
    }
    return selectDeletionTargets(identity, { snippet });
  }

  async function deleteOneComment(ctx, commentEl) {
    const { waitFor, click, hover } = helpers();
    const pacer = ensurePacer(ctx);

    const hoverTarget =
      commentEl.querySelector('[class*="DivCommentContentWrapper"]') ||
      commentEl.querySelector('[class*="DivCommentHeaderWrapper"]') ||
      commentEl;

    commentEl.scrollIntoView({ block: "center", inline: "nearest" });
    hover(hoverTarget);
    hover(commentEl);
    await pace(ctx, "settle");

    const trigger = await waitFor(() => moreTriggerIn(commentEl) || moreTriggerIn(hoverTarget), {
      signal: ctx.signal,
      timeout: 5000,
      interval: 80,
    });
    if (!trigger) {
      pacer.fail();
      report(ctx, { message: "⋯ menu not found on comment; skipping.", paceMs: pacer.ms });
      return false;
    }

    const clickable =
      trigger.querySelector("button, [role='button'], svg")?.closest("button, [role='button'], div") ||
      trigger;
    hover(clickable);
    click(clickable);
    click(trigger);

    const del = await waitFor(() => deleteButton(), { signal: ctx.signal, timeout: 6000, interval: 80 });
    if (!del) {
      pacer.fail();
      report(ctx, {
        message: "Delete button missing after ⋯ — is this your comment?",
        paceMs: pacer.ms,
      });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    click(del);

    const confirm = await waitFor(() => confirmDeleteButton(), {
      signal: ctx.signal,
      timeout: 6000,
      interval: 80,
    });

    if (!confirm) {
      pacer.fail();
      report(ctx, {
        message: "Delete confirm modal missing — comment may still be there.",
        paceMs: pacer.ms,
      });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    report(ctx, { message: "Confirming delete in modal…", paceMs: pacer.ms });
    click(confirm);

    const closed = await waitFor(
      () => !deleteConfirmModal() || !helpers().visible(deleteConfirmModal()),
      { signal: ctx.signal, timeout: 5000, interval: 80 }
    );

    if (!closed && deleteConfirmModal() && helpers().visible(deleteConfirmModal())) {
      const again = confirmDeleteButton();
      if (again) {
        click(again);
        await waitFor(
          () => !deleteConfirmModal() || !helpers().visible(deleteConfirmModal()),
          { signal: ctx.signal, timeout: 4000, interval: 80 }
        );
      }
    }

    if (deleteConfirmModal() && helpers().visible(deleteConfirmModal())) {
      pacer.fail();
      report(ctx, { message: "Confirm modal still open — delete not counted.", paceMs: pacer.ms });
      return false;
    }

    pacer.success();
    const stillThere = document.body.contains(commentEl);
    ctx.status.deleted += 1;
    report(ctx, {
      deleted: ctx.status.deleted,
      paceMs: pacer.ms,
      message: stillThere
        ? `Delete confirmed (${ctx.status.deleted}) · pace ${pacer.ms}ms`
        : `Deleted ${ctx.status.deleted} · pace ${pacer.ms}ms`,
    });
    await pace(ctx, "settle");
    return true;
  }

  async function cleanCommentsOnCurrentVideo(ctx, { snippet } = {}) {
    const { waitFor, sleep } = helpers();
    const identity = ctx.identity || resolveIdentity(ctx);
    // Prefer real nickname when detect only echoed the handle
    if (
      identity.handle &&
      (!identity.displayName || identity.displayName.toLowerCase() === identity.handle)
    ) {
      const fromPage = [...document.querySelectorAll('a[href*="/@"]')].find(
        (a) => SCC.handleFromHref(a.getAttribute("href")) === identity.handle
      );
      const nick = fromPage?.querySelector("p");
      if (nick) identity.displayName = helpers().textOf(nick);
    }

    const who = identity.handle
      ? `@${identity.handle}`
      : identity.displayName || "?";

    report(ctx, { message: `Looking for comments by ${who}…` });

    await waitFor(() => commentItemWrappers().length > 0, {
      signal: ctx.signal,
      timeout: 15000,
    });
    await sleep(500);

    let targets = await huntOwnComments(ctx, identity, snippet);
    if (!targets.length) {
      const sample = commentItemWrappers()
        .slice(0, 8)
        .map((el) => {
          const id = identityFromComment(el);
          return id.handle ? `@${id.handle}` : id.displayName || "?";
        })
        .join(", ");
      const msg = `No match for ${who}. Seen: ${sample || "none"}.${
        snippet ? ` Snippet: “${snippet.slice(0, 40)}”` : ""
      }`;
      report(ctx, { message: msg, lastError: msg });
      await sleep(1500);
      return 0;
    }

    const nThread = targets.filter((el) => el.dataset.sccDeleteReason === "own-thread").length;
    const nReply = targets.filter((el) => el.dataset.sccDeleteReason === "own-reply-on-foreign")
      .length;
    report(ctx, {
      message: `Plan: ${nReply} reply(s) on foreign threads + ${nThread} own thread(s) for ${who}.`,
    });

    let deletedHere = 0;
    let safety = 0;
    while (safety < 40) {
      if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
      targets = selectDeletionTargets(identity, { snippet });
      if (!targets.length) break;

      const target = targets[0];
      const reason = target.dataset.sccDeleteReason || "";
      report(ctx, {
        message:
          reason === "own-thread"
            ? "Deleting own comment (whole thread)…"
            : "Deleting own reply on foreign comment…",
      });
      const ok = await deleteOneComment(ctx, target);
      if (!ok) {
        target.dataset.sccSkip = "1";
        ensurePacer(ctx).fail();
      } else {
        deletedHere += 1;
      }
      safety += 1;
      await pace(ctx, "gap");
    }
    return deletedHere;
  }

  async function processInboxItem(ctx, item) {
    const { click, waitFor, uniqueKey, textOf, sleep } = helpers();
    const key = uniqueKey(textOf(item));
    if (ctx.seen.has(key)) return;
    ctx.seen.add(key);

    const identity = ctx.identity || resolveIdentity(ctx);
    const snippet = snippetFromInboxItem(item, identity);

    report(ctx, {
      message: `Opening notification: ${key.slice(0, 60)}…`,
      processed: ctx.status.processed,
    });

    click(item);
    ctx.status.processed += 1;
    report(ctx, { processed: ctx.status.processed });
    await pace(ctx);

    const opened = await waitFor(() => isVideoDetail(), { signal: ctx.signal, timeout: 15000 });
    if (!opened) {
      report(ctx, { message: "Video/comments view did not open; continuing." });
      return;
    }

    // Close Activity drawer so the comment panel is fully usable
    await closeOverlays(ctx);
    await sleep(400);

    const deletedHere = await cleanCommentsOnCurrentVideo(ctx, { snippet });
    if (!deletedHere) {
      report(ctx, {
        message:
          ctx.status.lastError ||
          ctx.status.message ||
          "Nothing deleted on this video — next notification…",
      });
      await sleep(1200);
    }

    await openCommentsInbox(ctx);
    await pace(ctx);
  }

  /** Dry-run: find each key control and report — no deletes. */
  async function runTikTokProbe(ctx) {
    const lines = [];
    const push = (ok, label, detail) => {
      lines.push(`${ok ? "OK" : "MISS"} ${label}: ${detail}`);
    };

    report(ctx, { message: "Probe: scanning page…" });

    const more = navMoreButton();
    push(Boolean(more), "More/Mehr", describeEl(more));

    const activity = activityButton();
    push(Boolean(activity), "Activity", describeEl(activity));

    const comments = commentsTab();
    push(Boolean(comments), "Comments tab", describeEl(comments));

    const inbox = document.querySelector('[data-e2e="inbox-notifications"]');
    push(Boolean(inbox), "Inbox panel", inbox ? "present" : "closed (open Activity first)");

    const items = inboxItems();
    push(items.length > 0, "Inbox items", `${items.length} visible`);

    const commentsOnPage = commentItemWrappers();
    push(commentsOnPage.length > 0, "Comment rows", `${commentsOnPage.length} on page`);

    const detected = detectLoggedInUser();
    push(
      Boolean(detected?.handle),
      "Logged-in detect",
      detected ? `@${detected.handle} (${detected.displayName || "—"}) via ${detected.source}` : "not found"
    );

    const identity = resolveIdentity(ctx);
    const own = identity.handle || identity.displayName ? findOwnComments(identity) : [];
    push(
      Boolean(identity.handle || identity.displayName),
      "Identity",
      identity.handle
        ? `@${identity.handle}${identity.displayName ? ` / "${identity.displayName}"` : ""}`
        : identity.displayName || "empty — set @handle"
    );
    push(
      !identity.handle && !identity.displayName ? false : own.length > 0 || !isVideoDetail(),
      "Own comments",
      `${own.length} match(es) on this page`
    );

    if (own[0]) {
      installHoverOverrides();
      helpers().hover(own[0]);
      await helpers().sleep(400);
      const id = identityFromComment(own[0]);
      push(true, "Sample own", `L${id.level} @${id.handle || "?"} “${id.displayName}”`);
      const trigger = moreTriggerIn(own[0]);
      push(Boolean(trigger), "⋯ trigger on own comment", describeEl(trigger));
      removeHoverOverrides();
    }

    const allItems = commentItemWrappers();
    const replyCount = allItems.filter((el) => commentLevel(el) === 2).length;
    push(true, "Comment rows", `${allItems.length} items (${replyCount} replies)`);

    const summary = lines.join(" · ");
    report(ctx, {
      message: summary.slice(0, 500),
      probeLog: lines,
    });
    console.info("[SCC probe]", lines);
    return lines;
  }

  async function runTikTokClean(ctx) {
    installHoverOverrides();
    ensurePacer(ctx);
    report(ctx, {
      message: `Adaptive pace starting at ${ctx.pacer.ms}ms (speeds up when stable)…`,
      paceMs: ctx.pacer.ms,
    });
    try {
      ctx.identity = resolveIdentity(ctx);
      if (!ctx.identity.handle && !ctx.identity.displayName) {
        throw new Error(
          "Account not detected. Open TikTok while logged in, or enter your handle as fallback (e.g. dokukanalq)."
        );
      }
      const tag = ctx.identity.handle ? `@${ctx.identity.handle}` : ctx.identity.displayName;
      const via = ctx.identity.auto
        ? `auto:${ctx.identity.source}`
        : ctx.identity.source === "user-override"
          ? "manual override"
          : ctx.identity.source;
      report(ctx, {
        message: `Target: ${tag}${
          ctx.identity.displayName && ctx.identity.handle
            ? ` (“${ctx.identity.displayName}”)`
            : ""
        } · ${via}`,
      });
      ctx.status.identity = {
        handle: ctx.identity.handle,
        displayName: ctx.identity.displayName,
        source: ctx.identity.source,
        auto: ctx.identity.auto,
      };

      const phase = ctx.resumePhase || "ensure_language";

      if (phase === "ensure_language") {
        if (ctx.ensureEnglish) {
          await ensureEnglish(ctx);
        } else {
          await ctx.persistPhase?.("open_inbox");
        }
      } else {
        report(ctx, { message: `Resumed at phase: ${phase}` });
      }

      if (!ctx.resumePhase || ctx.resumePhase === "ensure_language" || ctx.resumePhase === "open_inbox") {
        await openCommentsInbox(ctx);
      } else if (ctx.resumePhase === "clean_loop") {
        // Inbox may already be open after reload; ensure Comments tab
        const tab = commentsTab();
        if (tab) {
          helpers().click(tab);
          await pace(ctx);
        } else {
          await openCommentsInbox(ctx);
        }
      }

      let idleRounds = 0;
      while (!ctx.signal.aborted && idleRounds < 3) {
        await ctx.persistPhase?.("clean_loop", { seen: [...ctx.seen] });
        const items = inboxItems().filter(
          (el) => !ctx.seen.has(helpers().uniqueKey(helpers().textOf(el)))
        );
        if (!items.length) {
          idleRounds += 1;
          report(ctx, { message: `No new comment notifications (${idleRounds}/3)…` });
          const list =
            document.querySelector("#header-inbox-list") ||
            document.querySelector('[data-e2e="inbox-notifications"]');
          if (list) list.scrollTop = list.scrollHeight;
          await pace(ctx);
          await helpers().sleep(ctx.delayMs);
          continue;
        }

        idleRounds = 0;
        await processInboxItem(ctx, items[0]);
      }

      report(ctx, {
        message: `Done. Deleted ${ctx.status.deleted} comment(s) across ${ctx.status.processed} notification(s).`,
      });
      await ctx.clearJob?.();
    } finally {
      removeHoverOverrides();
    }
  }

  SCC.platforms = SCC.platforms || {};
  SCC.platforms.tiktok = {
    id: "tiktok",
    match: () => /(^|\.)tiktok\.com$/i.test(location.hostname),
    run: runTikTokClean,
    probe: runTikTokProbe,
    detectUser: detectLoggedInUser,
  };
})();
