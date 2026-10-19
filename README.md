# Social Comment Cleaner

Firefox browser extension that helps you clean **your own** comments on TikTok Web — slowly, carefully, and with confirmation dialogs.

> First public version · TikTok only · Firefox first (Chromium later)

## Features

- Auto-detect logged-in account via `@handle` (e.g. `dokukanalq`)
- Optional English UI for stable selectors
- Activity → Comments inbox walkthrough
- Smart delete policy:
  - **Own top-level comment** → delete parent (whole thread goes away)
  - **Own reply under someone else** → delete only that reply
- Adaptive pacing (faster when stable, slower on errors)
- Floating panel on the page + detachable control window
- Pin / monitor while Firefox stays usable in other tabs

## Install (Firefox — temporary)

1. Clone this repo  
   `git clone https://github.com/benjarogit/social-comment-deleater.git`
2. Open Firefox → `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → select `manifest.json` in this folder
4. Open [tiktok.com](https://www.tiktok.com) (logged in) and reload the tab
5. Use the extension popup, **Pin on page**, or **Open window**

Temporary add-ons are removed when Firefox restarts — reload via `about:debugging` after a restart.

## Usage

1. Prefer **Probe** once (checks selectors, deletes nothing)
2. **Start** on a logged-in TikTok tab
3. Watch progress in the pinned panel or detached window
4. **Stop** anytime

Base delay (default ~700 ms) is only a starting point — pacing adapts automatically.

## Safety notes

- Deletes **only your** comments (matched by `@handle`)
- Uses TikTok’s normal UI + confirm modal (`Are you sure…?`)
- Respect platform terms of use; use at your own risk
- UI changes on TikTok can break selectors — Probe helps diagnose

## Project layout

```
manifest.json
background/
content/          # shared helpers, TikTok automation, floating panel
popup/            # toolbar popup
panel/            # detached control window
icons/
```

## Roadmap

- Chromium / Edge / Brave / Vivaldi (Manifest V3)
- More platforms beyond TikTok
- Optional signed release / AMO listing

## License

MIT
