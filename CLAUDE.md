# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Command Rules

- NEVER use grep
- ALWAYS use rg (ripgrep)
- NEVER use find
- ALWAYS use fd

## Search Commands

grep is forbidden.

Always use:

- rg instead of grep
- fd instead of find

Reason:
grep is not installed on this machine and commands will fail.

## Protected Files (do not overwrite)

- **`app/preview/design-mock.html` is the canonical source of the UI design (a hand-built mock; read-only, chmod 444).**
- Writing to, copying over, or regenerating output into this file is forbidden. The only output target for `bun run preview:screens` is `app/preview/index.html`.
- Design changes may only be made after explicit user approval, and only after unlocking the file with chmod.

## Working Rules for Apps That Display a Version (must read)

The following apps display the app version (the `version` in `app.json`) on screen.
**Before starting any work that changes the code of these apps, always check the `version` in the relevant `app.json` and bump the patch by one before working** (unless otherwise instructed).

- Examples: `0.0.1` -> `0.0.2`, `0.2.3` -> `0.2.4`
- Target apps:
  - `apps/hisho/app.json` (shows `HISHO v<version>` in the status bar)
  - `apps/g2hermes/app.json` (shows `G2 Hermes v<version>` in the header)
- If the user specifies a concrete version (e.g., bump minor/major, or set a specific value), follow that instead.

How it works (common): the `version` in `app.json` is injected as a literal `__APP_VERSION__` at build time via the `define` option in `vite.config.ts`, and the screen code displays it through `appVersion()`. Runs that do not go through Vite (`bun test`) fall back to `'0.0.0-dev'`.

## Distribution Build / Packaging Rules (.ehpk / absolutely mandatory)

When building an `.ehpk` distribution package, follow the rules below **every time**. There was a past incident (2026-06-10) where building in a worktree produced a broken `.ehpk` with missing ENV that got distributed.

1. **Build where the `.env` exists.** `apps/<app>/.env` (e.g., g2hermes's `VITE_BRIDGE_BASE` / `VITE_BRIDGE_TOKEN`) is **gitignored**. A git worktree contains only tracked files, so `.env` is absent there, and Vite bakes `import.meta.env.VITE_*` in **as undefined, causing connection errors on the device**.
   - If you must build in a worktree, always run `cp <main checkout>/apps/<app>/.env apps/<app>/.env` before building (it is gitignored and won't be committed). Or **build from the main checkout**.
2. **Order is build -> pack.** `bun run build` (= `tsc -b && vite build`, which injects ENV and `__APP_VERSION__`) -> `evenhub pack app.json dist -o <name>.ehpk`. Packing without first producing `dist/` is forbidden.
3. **Call `evenhub` (the global `~/.bun/bin/evenhub`) directly. `npx evenhub` is forbidden** (it resolves a different npm package `evenhub` and 404s).
4. **Always verify the bundle before and after pack (via rg).**
   - ENV: `rg -o "<actual BASE value, e.g. 100.64.0.1:8787>" dist/assets/*.js` must hit. **A `VITE_BRIDGE_BASE` / `VITE_BRIDGE_TOKEN`-not-set warning string is always included in the bundle**, so do not judge by its presence -- verify by the actual value.
   - version: `rg -o "<x.y.z>" dist/assets/*.js` must hit (it comes from app.json, so it passes regardless of ENV -> do not mistakenly conclude "version is in, so it's OK").
   - The build log must not show the `VITE_BRIDGE_BASE` / `VITE_BRIDGE_TOKEN`-not-set warning.

## Purpose of This Repository

A personal hobby project building apps (Even Hub plugins) for Even Realities' smart glasses **Even G2**. Unaffiliated with Even Realities (unofficial).

The reference docs under `docs/` are an unofficial Japanese summary of the official documentation; app code lives under `apps/`, and more apps will be added to this repository over time.

## everything-evenhub Plugin

This repository has the official Even Realities Claude Code plugin **everything-evenhub** installed. When working on G2 apps, always use the corresponding skills:

- New app scaffolding: `quickstart` / `template`
- UI building: `glasses-ui`; input handling: `handle-input`; device features: `device-features`
- Testing: `test-with-simulator` / `simulator-automation`
- API lookup: `sdk-reference` / `cli-reference` / `design-guidelines`
- Build / publish: `build-and-deploy`

See `docs/ai-tooling/skill-catalog.md` for details on which skill to use when.

## Basic Structure of an Even Hub App (key points from docs)

- **The app itself runs in a WebView on the smartphone.** The glasses only render the display and emit input events (`docs/getting-started/04-architecture.md`).
- The setup is "a standard Vite + TypeScript web project + an `app.json` manifest." The only Even-specific dependency is `@evenrealities/even_hub_sdk`.
- The display is **576x288px, 4-bit green grayscale**. There is no CSS/DOM; it uses a "container" model (up to 4 images, up to 8 others, exactly one must have `isEventCapture: 1`). See `docs/guides/03-display-ui.md`.
- Networking requires **both** the `app.json` whitelist **and** server-side CORS (`docs/guides/06-networking.md`).

### CLI (used after creating an app)

`evenhub` and `eh` are the same command (`@evenrealities/evenhub-cli`):

```bash
evenhub init                          # generate app.json scaffold
evenhub qr --url "http://<ip>:5173"   # QR for sideloading to the device (supports hot reload)
evenhub pack app.json dist -o app.ehpk # create distribution package
```

## Writing Conventions for docs/

`docs/` is an unofficial Japanese summary of the official documentation (https://hub.evenrealities.com/docs/). When editing, match the format of existing pages:

1. At the top, a blockquote linking the original source URL plus a note that this is an unofficial summary.
2. At the bottom, previous/next navigation links.
3. When a page is added or removed, update the table of contents in `docs/README.md` as well.
4. When content is re-derived from the official source, update the "summary baseline date" entry in `docs/README.md`.
