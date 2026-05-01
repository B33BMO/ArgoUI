# ArgoUI

A locally-deployed AI chat workspace for CMMC-controlled environments.

ArgoUI is a hardened private fork of [AionUi](https://github.com/iOfficeAI/AionUi). It removes telemetry, restricts network egress to loopback + private RFC1918 ranges, and locks the MCP integration to stdio transports only — so the entire stack can run on an air-gapped or controlled-network workstation alongside local LLMs (Ollama, LM Studio, llama.cpp, etc.).

It is **not** a redistribution of AionUi. It is an internal-use fork whose threat model assumes a CMMC-controlled boundary, where any unsolicited outbound HTTP from the desktop app is a finding.

> **License:** Apache-2.0. Original copyright © AionUi (aionui.com) is retained on every source file per license terms. ArgoUI changes are this repo's contribution.

---

## What this fork changes vs. upstream

| Area | Upstream AionUi | ArgoUI (this fork) |
|---|---|---|
| Telemetry | `@sentry/electron` initialized in main + renderer | Sentry, sentry-vite-plugin, and analytics ID **removed entirely** |
| Auto-updater | `electron-updater` checks GitHub releases on startup | **Removed.** No outbound update checks. Update by `git pull && ./scripts/deploy.sh` |
| Bug-report flow | Collects logs and POSTs to Sentry | **Removed** |
| MCP transports | stdio + sse + http + streamable_http + OAuth login | **stdio only.** Remote MCP transports throw `RemoteMcpTransportError`; OAuth helpers disabled |
| Config storage | base64-encoded JSON on disk | Encrypted with OS keychain via Electron `safeStorage`; falls back to legacy codec with a one-shot warning if unavailable |
| Plugin loader | `eval('require')` loads channel plugins from manifest entries | Loader removed; all manifest plugins are rejected |
| Web server bind | Optional `--remote` flag binds `0.0.0.0` | Loopback-only. The `--remote` flag and related env vars are ignored |
| Messaging integrations | Telegram / Lark / DingTalk / WeCom / WeChat plugins functional | All five plugin classes replaced with stub that throws `Messaging channel plugins are disabled in this build (CMMC).` Vendor SDKs left in `node_modules` only because formatter helpers (Adapter / Cards / Keyboards) still type-check against them |
| AWS Bedrock bridge | Cloud-only LLM service connector | IPC handler kept (renderer still calls it) but always returns failure with CMMC notice |
| Renderer-issued network | Unrestricted | Electron `webRequest.onBeforeRequest` allowlist on the default session: only `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `*.localhost`, RFC1918 IPv4 (`10/8`, `172.16/12`, `192.168/16`, `169.254/16`), and IPv6 unique-local / link-local. http/https/ws/wss to anything else is cancelled and logged. (Node-level outbound from main/worker processes is **not** covered — patch http/https there if your threat model requires it.) |

See `git log --oneline main` for the chronological commit-by-commit story.

### What did NOT change

- The Electron app architecture (main / renderer / worker processes)
- The IPC bridge (`src/preload.ts`)
- The local LLM client paths (the `openai` SDK is the way Ollama / LM Studio talk to the app via OpenAI-compatible HTTP at `127.0.0.1`)
- Any MCP server you connect over **stdio** — these still work normally
- Apache-2.0 copyright headers on every source file (legally required attribution to upstream)

---

## Quick deploy

Single host, single command:

```bash
git clone git@github.com:B33BMO/ArgoUI.git
cd ArgoUI
./scripts/deploy.sh
```

The script will:

1. Verify `bun` is installed (offers the install command if not)
2. `bun install` (frozen lockfile if present)
3. Build the web renderer (`bun run build:renderer:web`) and standalone server (`bun run build:server`)
4. Start the server bound to `127.0.0.1:3000`
5. On first boot, the server auto-seeds an `admin` user with a random 12-char password and prints the credentials inline. Save them — the plaintext is not stored anywhere after that.

Open `http://127.0.0.1:3000` and log in.

### Deploy script flags

```
./scripts/deploy.sh                    # build, run foreground
./scripts/deploy.sh --port 8080        # custom port (default 3000)
./scripts/deploy.sh --background       # nohup, capture creds from log, exit
./scripts/deploy.sh --reset-password   # rotate admin password, then start
./scripts/deploy.sh --skip-build       # use existing dist-server/
./scripts/deploy.sh --build-only       # build, don't start
./scripts/deploy.sh --stop             # stop a backgrounded instance
```

Background-mode logs land in `logs/server.log`, PID in `logs/server.pid` (both gitignored).

### Lost the admin password?

```bash
./scripts/deploy.sh --reset-password --skip-build
```

Or directly:

```bash
bun dist-server/server.mjs --resetpass admin
```

This rotates a new random password and the JWT secret (invalidating all prior sessions).

---

## Desktop (Electron) build

The fork still produces a normal Electron desktop app if you'd rather not run the headless server.

```bash
bun install
bun run start            # dev mode (hot reload)
bun run dist:linux       # produce .deb in out/
bun run dist:win         # Windows NSIS installer
bun run dist:mac         # macOS .dmg
```

Installer metadata:

- App ID: `guru.bmo.argoui`
- Executable / product name: `ArgoUI`
- Deep-link scheme: `argoui://`
- Linux maintainer: `brandon@bmo.guru`

There is no signing / notarization config in this fork — sign with your own Apple Developer ID / EV cert before distributing internally.

---

## System requirements

- Linux / macOS / Windows
- [bun](https://bun.sh) ≥ 1.3 (script will refuse to run otherwise)
- Node.js ≥ 22 (only required for `electron-builder` packaging; the runtime uses bun)
- ~2 GB free disk for `node_modules` + `dist-server/`
- A local LLM endpoint reachable on the loopback interface (Ollama default `http://127.0.0.1:11434`, LM Studio `http://127.0.0.1:1234/v1`, etc.)

The webserver build is thin enough to live on a small VM; the desktop Electron build needs whatever Electron 37 needs (~500 MB RAM idle).

---

## Configuring a local LLM

ArgoUI talks to local LLMs via OpenAI-compatible HTTP. In the app's **Settings → Models**, add a provider:

- **Base URL:** `http://127.0.0.1:11434/v1` (Ollama) or `http://127.0.0.1:1234/v1` (LM Studio)
- **API key:** any non-empty string (most local servers ignore it)
- **Model:** whatever you have pulled (`llama3.1:70b`, `qwen2.5-coder:32b`, etc.)

The renderer-side network allowlist will permit these requests because they target loopback. Anything not on the allowlist is blocked at the Electron `webRequest` layer with a `[network-allowlist] blocked …` warning.

---

## Security posture (summary)

The fork is hardened against three categories of risk:

1. **Outbound exfiltration.** Sentry / analytics / auto-updater removed; renderer network requests filtered to loopback + private ranges; remote MCP transports rejected; OAuth login flows disabled; webserver `--remote` bind disabled.
2. **Unverified code execution.** Plugin loader (`eval('require')`) removed; messaging-channel plugins replaced with throw-stubs; AWS Bedrock bridge inert.
3. **At-rest disclosure.** Config file encrypted via Electron `safeStorage` (OS keychain).

What this fork does **not** claim:

- Not a CMMC certification. It removes commonly-flagged outbound channels but the rest of your boundary (OS, network, physical) is your problem.
- Not a complete sandbox. Electron's main/worker Node processes can still issue arbitrary HTTP — only the Chromium-side requests are filtered. Audit any new dependency that runs main-side before installing.
- Not audited. Read the diffs against upstream (`git log upstream/main..main`) before running this on real CUI.
- Not a substitute for endpoint controls. Run it on a host with the usual EDR / disk encryption / patch hygiene you'd require for any CUI workload.

---

## Repository layout

```
src/
  index.ts                  Electron main entry
  server.ts                 Standalone webserver entry (used by deploy.sh)
  preload.ts                Renderer ↔ main IPC bridge
  process/                  Main process code (no DOM)
    bridge/                 IPC handlers (mcp, conversation, ...)
    services/               Database, MCP, cron, webserver
    channels/plugins/       Disabled messaging stubs
    utils/networkAllowlist  Loopback-only webRequest filter (CMMC)
    utils/deepLink.ts       argoui:// scheme handler
  renderer/                 React UI (no Node)
  worker/                   Background AI workers (gemini, codex, acp)

scripts/
  deploy.sh                 One-shot build + run for the standalone server
  build-server.mjs          esbuild bundle for src/server.ts
  build-with-builder.js     Electron desktop packaging

resources/                  Build-time assets (icons, bundled bun, hub data)
docs/                       Architecture and contributor docs
```

---

## Staying current with upstream

The remote `upstream` points at the original AionUi:

```bash
git fetch upstream
git log main..upstream/main -- src/        # see what's new upstream
git cherry-pick <sha>                       # pull a specific fix
```

A clean `git merge upstream/main` will re-introduce everything we hardened away — don't do it. Cherry-pick security fixes one at a time and re-run the test suite.

---

## Contributing

This is a private internal fork. If you have access to the repo, the upstream contributor guide still applies for everything that isn't CMMC-specific: see `CONTRIBUTING.md`.

When you change anything in the categories listed under "What this fork changes vs. upstream", update the table above so the security delta stays auditable.

---

## License

Apache-2.0. See `LICENSE` and the per-file copyright headers.

ArgoUI builds on years of work by the AionUi team — all credit for the underlying app belongs to them. This fork's contribution is the CMMC hardening, network allowlist, and the deploy automation.
