# Social Comment Cleaner

Browser-Erweiterung zum Bereinigen **eigener** Kommentare auf TikTok Web — mit Bestätigung, adaptivem Tempo und schwimmendem Panel.

> TikTok · Firefox · Chromium (Chrome / Edge / Brave / **Vivaldi**)

**Aktuelle Builds:** [Releases](https://github.com/benjarogit/social-comment-deleater/releases)

| Datei | Browser |
|--------|---------|
| `social-comment-cleaner-*-firefox.xpi` | Firefox |
| `social-comment-cleaner-*-chromium.zip` | Chrome, Edge, Brave, Vivaldi |

---

## Installation

Es gibt zwei Wege: **temporär testen** (schnell, verschwindet oft nach Neustart) und **dauerhaft laden** (Ordner/Datei behalten).

### A) Firefox — temporär laden (empfohlen zum Testen)

So bleibt die Erweiterung ohne Store-Signatur nutzbar:

1. Repo klonen **oder** Release-ZIP/XPI-Inhalt entpacken **oder** lokal `npm run build` → Ordner `dist/firefox-src/`
2. Firefox öffnen und in die Adresszeile eingeben:  
   `about:debugging#/runtime/this-firefox`
3. **Temporäres Add-on laden…** / **Load Temporary Add-on…**
4. Datei `manifest.json` im Erweiterungsordner wählen  
   (Root des Ordners mit `manifest.json`, `content/`, `popup/`, …)
5. Tab auf [tiktok.com](https://www.tiktok.com) öffnen und **einmal neu laden**
6. Extension-Icon in der Toolbar → Probe / Start

**Wichtig:** Temporäre Add-ons verschwinden meist nach einem Firefox-Neustart. Dann Schritte 2–4 wiederholen (Reload auf der Debugging-Seite reicht manchmal).

### B) Firefox — aus Release-Datei (.xpi)

1. Neueste `.xpi` von [Releases](https://github.com/benjarogit/social-comment-deleater/releases) herunterladen
2. Versuch A — Installieren aus Datei:  
   `about:addons` → Zahnrad → **Add-on aus Datei installieren…**
3. Wenn Firefox die unsignierte XPI ablehnt → **Methode A (temporär)** nutzen  
   Ungesignierte Community-XPIs werden von Release-Firefox oft blockiert; `about:debugging` ist dann der korrekte Weg, bis es eine AMO-Signierung gibt.

### C) Vivaldi / Chrome / Edge / Brave — dauerhaft als „unpacked“

Chromium-Browser erlauben Entwickler-Erweiterungen aus einem Ordner (ohne Chrome Web Store):

1. `social-comment-cleaner-*-chromium.zip` von [Releases](https://github.com/benjarogit/social-comment-deleater/releases) laden
2. ZIP **vollständig entpacken** (Ordner muss `manifest.json` enthalten)
3. Erweiterungsseite öffnen:

   | Browser | Adresse |
   |---------|---------|
   | **Vivaldi** | `vivaldi://extensions` |
   | Chrome | `chrome://extensions` |
   | Edge | `edge://extensions` |
   | Brave | `brave://extensions` |

4. **Entwicklermodus** / **Developer mode** einschalten
5. **Entpackte Erweiterung laden** / **Load unpacked**
6. Den **entpackten Ordner** wählen (nicht die ZIP-Datei)
7. TikTok-Tab öffnen und **neu laden**
8. Extension-Icon → Probe / Start (oder **Pin on page** / **Open window**)

**Nach Browser-Update / Pfadänderung:** Falls die Erweiterung deaktiviert wird, unter Erweiterungen erneut **Load unpacked** auf denselben Ordner zeigen. Den Ordner nicht löschen oder verschieben.

**Lokal bauen statt Release:**

```bash
git clone https://github.com/benjarogit/social-comment-deleater.git
cd social-comment-deleater
npm run build
```

Dann bei „Load unpacked“ den Ordner `dist/chromium-src/` wählen.

---

## Bedienung

1. Auf TikTok einloggen
2. Optional einmal **Probe** (prüft nur Selektoren, löscht nichts) — Account oben prüfen (`@deinhandle`)
3. **Start** — läuft über Activity → Comments
4. Fortschritt im **Pin-Panel** oder **Open window** beobachten (Firefox/Vivaldi weiter nutzbar)
5. Jederzeit **Stop**

### Lösch-Logik

| Situation | Aktion |
|-----------|--------|
| Eigener Top-Level-Kommentar | Nur Parent löschen → ganzer Thread weg |
| Eigene Antwort unter fremdem Kommentar | Nur diese Antwort löschen |

Base-Delay (~700 ms) ist Startwert; das Tempo passt sich an (schneller bei Erfolg, langsamer bei Fehlern).

### Falls der Account falsch angezeigt wird

- TikTok-Tab neu laden, einmal **Probe**
- Fallback im Popup nur nutzen, wenn Auto-Detect scheitert (dein `@handle` ohne `@`)

---

## Sicherheit / Hinweise

- Löscht nur Kommentare, die zu deinem erkannten **`@handle`** gehören
- Nutzt die normale TikTok-Oberfläche inkl. „Are you sure…?“-Dialog
- Nutzung auf eigene Verantwortung; TikTok-Nutzungsbedingungen beachten
- TikTok-UI-Änderungen können Selektoren brechen — dann Issue melden / Probe-Log schicken

---

## Features (Kurz)

- Auto-Detect des eingeloggten Accounts
- Optional UI auf English (US)
- Adaptives Pacing, schwimmendes Panel, ausgelagertes Fenster
- CI baut bei jedem Tag `v*` automatisch XPI + Chromium-ZIP

---

## Entwicklung

```bash
npm run build           # Firefox .xpi + Chromium .zip → dist/
npm run build:firefox
npm run build:chromium
```

```
manifest.json              # Firefox (MV2) — für about:debugging
manifests/chromium.json    # Chromium (MV3)
lib/browser-api.js         # browser/chrome Shim
.github/workflows/build.yml
```

Release: Version in `manifest.json` erhöhen, taggen (`v0.3.2`), pushen — CI hängt die Pakete an den GitHub Release.

## License

MIT
