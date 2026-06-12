# Island Vault

A Dynamic Island–style clipboard vault for macOS. A jet-black pill fuses with the MacBook notch; hover it and a tray slides out with everything you've copied — text, images, and files. Click any item to put it back on the clipboard. Right-click a text clip for AI actions powered by your local `claude` CLI.

## Features

- **Hover the notch** → tray expands (120 ms hover intent, Escape or mouse-away to close)
- **Captures everything**: text (plain + rich), images/screenshots, multi-file Finder copies
- **Click to copy back** — files paste-able in Finder, images in Preview, text anywhere
- **Pin** favorites (survive the 500-item cap), **search**, native right-click menu
- **AI quick-actions** on text clips via `claude` CLI: Clean Up, Summarize, Translate, Extract Links & Emails — result lands as a new clip, already copied
- **Privacy**: password-manager clips (concealed/transient pasteboard types) are never captured
- History persists across restarts (SQLite at `~/Library/Application Support/island-vault/`)

## Develop

```bash
npm install
npm run dev        # HMR dev session
npx electron .     # run the built bundle
npm run build      # rebuild out/
```

## Package

```bash
npm run build:mac  # dist/Island Vault-*.dmg (unsigned)
```

First launch of the unsigned app: right-click → Open to pass Gatekeeper.

## Notes

- AI actions need the `claude` CLI installed (`/opt/homebrew/bin/claude` or on PATH). Default model for actions is `haiku`; spend per action is capped at $0.50.
- No notch? The pill still sits top-center — a fake island.
- Stack: Electron 42 + TypeScript + React (electron-vite), `node:sqlite` for storage — zero native modules.
