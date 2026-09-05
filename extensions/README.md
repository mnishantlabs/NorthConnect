# Discord Token Manager

A quiet, local-first browser extension for managing saved Discord session tokens.
Material 3 inspired UI, supports Chrome (MV3) and Firefox (MV2).

> **A note on usage:** this tool stores tokens locally and reads them back to log into
> Discord. Automating/token-based authentication may violate Discord's Terms of Service.
> Use it for your own personal, low-volume use, at your own risk.

## Features

- **Vault** — save, group, favorite, search and manage multiple sessions.
- **Quick add / verify / backup** — several account add flows, validate tokens, export JSON.
- **Launch & switch** — apply a saved session to a `discord.com` tab and reload to log in.
- **Copy / Export** — copy a token in one click, export per-session or a full backup.
- **Details dialog** — view user ID, status, joined date, badges, notes.
- **Now Playing** card for the currently active session, with a **Save** action.
- Everything is stored locally in browser `storage` — nothing is sent to any server.

## Install (load unpacked)

| Browser | Package |
| --- | --- |
| Chrome / Edge / Brave / Opera / Arc | `discord-token-manager-chrome-v1.4.1.zip` |
| Firefox | `discord-token-manager-firefox-v1.4.1.zip` |

Full step-by-step instructions live here: **<https://mnishantlabs.github.io/Discord-Token-Manager-Extenstion/>**

Quick version:

- **Chrome / Edge / Brave / Opera / Arc**
  1. Go to the extensions page (`chrome://extensions`, `edge://extensions`, etc.).
  2. Turn on **Developer mode**.
  3. Click **Load unpacked** and select the `chrome` folder.
- **Firefox**
  1. Go to `about:debugging#/runtime/this-firefox`.
  2. Click **Load Temporary Add-on** and select `firefox/manifest.json`.

## From source

```bash
git clone https://github.com/mnishantlabs/Discord-Token-Manager-Extenstion.git
# load chrome/ as unpacked in Chrome
# or firefox/manifest.json in Firefox
```

## Repository layout

```
chrome/    # Manifest V3 build (Chrome, Edge, Brave, Opera, Arc)
firefox/   # Manifest V2 build (Firefox)
docs/      # GitHub Pages website
dist/      # packaged .zip releases (not tracked)
```

## License

[MIT](LICENSE)
