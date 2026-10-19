# Social Comment Cleaner

Browser extension that helps you clean **your own** comments on TikTok Web — carefully, with confirmation dialogs, adaptive pacing, and a floating control panel.

> TikTok first · Firefox + Chromium (Chrome / Edge / Brave / Vivaldi)

## Features

- Auto-detect logged-in account via `@handle`
- Optional English UI for stable selectors
- Activity → Comments inbox walkthrough
- Smart delete policy:
  - **Own top-level comment** → delete parent (whole thread goes away)
  - **Own reply under someone else** → delete only that reply
- Adaptive pacing (faster when stable, slower on errors)
- Floating panel on the page + detachable control window

## Install from GitHub Releases (CI builds)

Every push to `main` and every tag `v*` builds packages via GitHub Actions:

| File | Browser |
|------|---------|
| `social-comment-cleaner-*-firefox.xpi` | Firefox |
| `social-comment-cleaner-*-chromium.zip` | Chrome, Edge, Brave, Vivaldi |

Artifacts: **Actions → latest workflow → Artifacts**, or a **Release** when you push a tag like `v0.3.0`.

### Firefox (XPI)

1. Download the `.xpi`
2. `about:addons` → gear → **Install Add-on From File…**  
   *(or drag the `.xpi` onto Firefox)*  
3. Temporary alternative: `about:debugging` → Load Temporary Add-on → `manifest.json` from a clone

> Unsigned XPI from GitHub may need temporary install via `about:debugging` depending on Firefox channel/policy.

### Chromium (ZIP)

1. Download / unzip the Chromium package (or use `dist/chromium-src` after `npm run build`)
2. Open `chrome://extensions` (or `edge://extensions`, Brave equivalents)
3. Enable **Developer mode**
4. **Load unpacked** → select the unpacked folder (must contain `manifest.json`)

## Develop locally

```bash
git clone https://github.com/benjarogit/social-comment-deleater.git
cd social-comment-deleater
npm run build
```

Outputs in `dist/`:

- `*-firefox.xpi`
- `*-chromium.zip`
- `firefox-src/` / `chromium-src/` (unpacked, for Load Temporary / Load unpacked)

```bash
npm run build:firefox    # XPI only
npm run build:chromium   # ZIP only
```

## Usage

1. Prefer **Probe** once (checks selectors, deletes nothing)
2. **Start** on a logged-in TikTok tab
3. Watch progress in the pinned panel or detached window
4. **Stop** anytime

Base delay (default ~700 ms) is only a starting point — pacing adapts automatically.

## Safety notes

- Deletes **only your** comments (matched by `@handle`)
- Uses TikTok’s normal UI + confirm modal
- Respect platform terms of use; use at your own risk
- UI changes on TikTok can break selectors — Probe helps diagnose

## Project layout

```
manifest.json              # Firefox (MV2) — load this for local Firefox testing
manifests/chromium.json    # Chromium (MV3) source for builds
lib/browser-api.js         # browser/chrome shim
background/                # shared background + Chromium service worker entry
content/                   # TikTok automation + floating panel
popup/  panel/  icons/
scripts/build.mjs
.github/workflows/build.yml
```

## Release a version

```bash
# bump version in manifest.json (+ manifests/chromium.json is synced at build time)
git tag v0.3.0
git push origin v0.3.0
```

CI creates a GitHub Release with XPI + ZIP attached.

## License

MIT
