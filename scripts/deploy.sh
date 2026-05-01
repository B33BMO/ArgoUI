#!/usr/bin/env bash
# ============================================================================
# ArgoUI — quick deploy script (CMMC fork)
# ----------------------------------------------------------------------------
# Builds the standalone web server, starts it, and surfaces the admin
# credentials. Server binds to 127.0.0.1 only (loopback enforced by the
# CMMC build).
#
# Usage:
#   ./scripts/deploy.sh                    # build, run foreground, print creds
#   ./scripts/deploy.sh --port 8080        # custom port (default 3000)
#   ./scripts/deploy.sh --background       # run via nohup, capture creds, exit
#   ./scripts/deploy.sh --reset-password   # rotate admin password before start
#   ./scripts/deploy.sh --skip-build       # skip build (use existing dist-server/)
#   ./scripts/deploy.sh --build-only       # build, don't start
#   ./scripts/deploy.sh --stop             # stop a backgrounded / docker instance
#
# Docker mode (recommended for shared-tech deployments):
#   ./scripts/deploy.sh --docker           # build image + start via docker compose
#   ./scripts/deploy.sh --docker --stop    # stop the docker stack
#   ./scripts/deploy.sh --docker --logs    # follow docker logs
# ============================================================================

set -euo pipefail

# ── colors ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_R=$'\033[0;31m'; C_G=$'\033[0;32m'; C_Y=$'\033[1;33m'
  C_B=$'\033[0;34m'; C_C=$'\033[0;36m'; C_BOLD=$'\033[1m'; C_N=$'\033[0m'
else
  C_R=""; C_G=""; C_Y=""; C_B=""; C_C=""; C_BOLD=""; C_N=""
fi

info()    { echo "${C_B}[info]${C_N} $*"; }
ok()      { echo "${C_G}[ ok ]${C_N} $*"; }
warn()    { echo "${C_Y}[warn]${C_N} $*"; }
err()     { echo "${C_R}[err ]${C_N} $*" >&2; }
die()     { err "$*"; exit 1; }

# ── paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$LOG_DIR/server.pid"
cd "$ROOT"

# ── flags ───────────────────────────────────────────────────────────────────
PORT="${PORT:-3000}"
DO_BUILD=1
DO_START=1
BACKGROUND=0
RESET_PASS=0
STOP=0
DOCKER=0
LOGS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)            PORT="$2"; shift 2 ;;
    --background|-d)   BACKGROUND=1; shift ;;
    --reset-password)  RESET_PASS=1; shift ;;
    --skip-build)      DO_BUILD=0; shift ;;
    --build-only)      DO_START=0; shift ;;
    --stop)            STOP=1; shift ;;
    --docker)          DOCKER=1; shift ;;
    --logs)            LOGS=1; shift ;;
    -h|--help)
      sed -n '3,23p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Unknown flag: $1 (use --help)" ;;
  esac
done

# ── docker mode ─────────────────────────────────────────────────────────────
if [[ $DOCKER -eq 1 ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    die "docker not found on PATH. Install Docker Engine, then re-run."
  fi
  # Compose v2 ships as `docker compose` (subcommand). Older v1 = `docker-compose`.
  if docker compose version >/dev/null 2>&1; then
    DC=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DC=(docker-compose)
  else
    die "docker compose plugin not available (need v2: 'docker compose', or v1: 'docker-compose')"
  fi
  export ARGOUI_PORT="$PORT"

  if [[ $LOGS -eq 1 ]]; then
    exec "${DC[@]}" logs -f argoui
  fi

  if [[ $STOP -eq 1 ]]; then
    info "Stopping docker stack…"
    "${DC[@]}" down
    ok "Stopped."
    exit 0
  fi

  if [[ $RESET_PASS -eq 1 ]]; then
    info "Rotating admin password inside container…"
    "${DC[@]}" exec -T argoui bun dist-server/server.mjs --resetpass admin \
      || warn "resetpass failed — run again after the container is healthy"
  fi

  if [[ $DO_BUILD -eq 1 ]]; then
    info "Building docker image…"
    "${DC[@]}" build
  fi

  if [[ $DO_START -eq 0 ]]; then
    ok "Build-only — exiting."
    exit 0
  fi

  info "Starting docker stack on port $PORT (network_mode=host)…"
  "${DC[@]}" up -d
  ok "Stack started. Container: argoui"
  echo
  echo "${C_BOLD}${C_C}================================================================${C_N}"
  echo "${C_BOLD}  ArgoUI (docker) is starting${C_N}"
  echo "${C_BOLD}${C_C}================================================================${C_N}"
  echo "  URL (loopback):       ${C_G}http://127.0.0.1:${PORT}${C_N}"
  echo "  Follow logs:          $0 --docker --logs"
  echo "  Stop stack:           $0 --docker --stop"
  echo "  Rotate admin pwd:     $0 --docker --reset-password"
  echo "${C_BOLD}${C_C}================================================================${C_N}"
  echo
  info "Waiting up to 60s for first-boot credentials banner in logs…"
  for _ in {1..60}; do
    if "${DC[@]}" logs --no-color argoui 2>/dev/null | grep -q 'Or Use Initial Admin Credentials\|Web Server Started Successfully'; then
      break
    fi
    sleep 1
  done
  echo
  echo "${C_BOLD}Initial admin credentials (from container log):${C_N}"
  "${DC[@]}" logs --no-color argoui 2>/dev/null \
    | awk '/Or Use Initial Admin Credentials/,/^={3,}$/' \
    | tail -n 20 \
    || warn "No credentials banner yet. Tail logs: $0 --docker --logs"
  echo
  warn "Network: container uses network_mode=host. The webserver binds 127.0.0.1"
  warn "of the host. Front it with a reverse proxy (nginx/caddy/traefik) to"
  warn "publish to your techs over TLS. Do NOT expose port $PORT directly."
  exit 0
fi

# ── stop mode (host/nohup) ──────────────────────────────────────────────────
if [[ $STOP -eq 1 ]]; then
  if [[ ! -f "$PID_FILE" ]]; then
    warn "No PID file at $PID_FILE — nothing to stop."
    exit 0
  fi
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    info "Stopping server (pid $pid)…"
    kill "$pid"
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    kill -0 "$pid" 2>/dev/null && { warn "Forcing SIGKILL"; kill -9 "$pid" || true; }
    ok "Stopped."
  else
    warn "PID $pid not running."
  fi
  rm -f "$PID_FILE"
  exit 0
fi

# ── prereqs ─────────────────────────────────────────────────────────────────
if ! command -v bun >/dev/null 2>&1; then
  if [[ -x "$HOME/.bun/bin/bun" ]]; then
    export PATH="$HOME/.bun/bin:$PATH"
  else
    err  "bun not found on PATH."
    info "Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi
fi
ok "bun $(bun --version)"

# ── build ───────────────────────────────────────────────────────────────────
if [[ $DO_BUILD -eq 1 ]]; then
  info "Installing deps (bun install)…"
  if [[ -f bun.lock || -f bun.lockb ]]; then
    bun install --frozen-lockfile
  else
    bun install
  fi

  info "Building web renderer…"
  bun run build:renderer:web

  info "Building server bundle…"
  bun run build:server

  ok "Build complete: dist-server/server.mjs"
fi

if [[ $DO_START -eq 0 ]]; then
  ok "Build-only mode — exiting."
  exit 0
fi

[[ -f dist-server/server.mjs ]] || die "dist-server/server.mjs missing. Run without --skip-build."

# ── optional password reset (requires DB to already exist) ─────────────────
if [[ $RESET_PASS -eq 1 ]]; then
  info "Rotating admin password…"
  bun dist-server/server.mjs --resetpass admin || warn "resetpass failed — continuing (DB may be uninitialized; first boot will auto-seed)"
fi

# ── start ───────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
export PORT NODE_ENV="${NODE_ENV:-production}"

print_access_info() {
  echo
  echo "${C_BOLD}${C_C}================================================================${C_N}"
  echo "${C_BOLD}  ArgoUI server is running${C_N}"
  echo "${C_BOLD}${C_C}================================================================${C_N}"
  echo "  URL (loopback only):  ${C_G}http://127.0.0.1:${PORT}${C_N}"
  echo "  Logs:                 $LOG_FILE"
  if [[ $BACKGROUND -eq 1 ]]; then
    echo "  Stop:                 $0 --stop"
    echo "  Tail logs:            tail -f $LOG_FILE"
  fi
  echo "${C_BOLD}${C_C}================================================================${C_N}"
}

extract_creds_from_log() {
  # Surface "Username:" + "Password:" + QR URL printed by the server's
  # displayInitialCredentials banner, if present in the most recent boot.
  awk '
    /Or Use Initial Admin Credentials/ {capture=1}
    capture {print}
    /^={3,}$/ && capture==2 {exit}
    /^={3,}$/ && capture==1 {capture=2}
  ' "$LOG_FILE" | tail -n 40 || true
}

if [[ $BACKGROUND -eq 1 ]]; then
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    die "Server already running (pid $(cat "$PID_FILE")). Stop with: $0 --stop"
  fi

  info "Starting in background on port $PORT (logs → $LOG_FILE)…"
  : > "$LOG_FILE"
  nohup bun dist-server/server.mjs >>"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  pid=$(cat "$PID_FILE")

  # Wait for either the credentials banner or the listen confirmation.
  info "Waiting for server to become ready…"
  for _ in {1..60}; do
    if grep -q 'Web Server Started Successfully\|listening on\|Server listening' "$LOG_FILE" 2>/dev/null; then
      break
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      err "Server died during startup. Last 40 log lines:"
      tail -n 40 "$LOG_FILE" >&2
      rm -f "$PID_FILE"
      exit 1
    fi
    sleep 0.5
  done

  print_access_info
  echo
  echo "${C_BOLD}Initial admin credentials (from log):${C_N}"
  if creds=$(extract_creds_from_log) && [[ -n "$creds" ]]; then
    echo "$creds"
  else
    warn "No initial-credentials banner found in log."
    warn "If admin already exists, rotate with:  $0 --reset-password --skip-build --background"
  fi
  exit 0
fi

# Foreground: server prints its own credentials banner on first boot.
print_access_info
info "Starting server in foreground. CTRL-C to stop."
echo
exec bun dist-server/server.mjs
