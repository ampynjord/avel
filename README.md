# Avel Browser — MVP

First building block of the **AVEL** suite, a sovereign European service suite.
A clean browser with a built-in AI assistant powered by **Mistral AI**.

## ✦ Features (MVP)

- 🌐 Minimal browser (URL bar + navigation, built-in DuckDuckGo search)
- 🤖 **Avel Assistant** side panel (AI chat, connected to Mistral or simulated locally)
- 🛡️ Known tracker blocking, Do Not Track, limited third-party cookies
- 🎨 Avel design: modern, clean, blue / Celtic tones

## 📁 Layout

```
avel/
├── package.json     Dependencies (electron) and scripts
├── config.json      NON-secret configuration: model, security, trackers
├── .env             Local secrets (MISTRAL_API_KEY) — ignored by git
├── .env.example     .env template
├── main.js          Electron entry point / orchestrator
├── preload.js       Secure bridge (contextBridge) renderer ↔ main
├── index.html       Local home page (browser UI + assistant)
├── styles.css       Avel design
├── renderer.js      UI logic (navigation + streaming assistant chat)
└── core/                    Service layer (reusable across the AVEL suite)
    ├── config.js            Non-secret configuration loading
    ├── ai/
    │   ├── provider.js      Abstract AIProvider interface
    │   ├── mistral.js       Mistral provider (SSE streaming)
    │   └── simulator.js     Offline local AI fallback
    ├── security/
    │   ├── secrets.js       Secrets via .env / safeStorage (production)
    │   └── tracker.js       Tracker blocking
    └── storage/
        └── history.js       Persistent conversation history
```

## 🚀 Install & run

```bash
npm install
npm start
```

## 🔑 Enable Mistral AI

Without a key, the assistant answers in **local simulated mode** (offline).
To enable real streaming answers:

```bash
cp .env.example .env
# then edit .env:
MISTRAL_API_KEY=your_key_here
```

> ⚠️ The `.env` file is ignored by git. The key never reaches the renderer
> or `config.json`. In production it can be stored encrypted through
> Electron's `safeStorage` (already wired in `core/security/secrets.js`).

## ⚙️ Security

Options in `config.json` → `security`:

| Option | Description |
|---|---|
| `blockTrackers` | Blocks the domains in `trackerBlocklist` |
| `blockThirdPartyCookies` | Limits third-party cookies |
| `doNotTrack` | Sends the `DNT: 1` header |

## 📜 License

© 2026 ampynjord — **All rights reserved.** The code is publicly visible
for transparency only; no use, copying, modification or redistribution is
allowed without prior written permission. See [LICENSE](LICENSE).