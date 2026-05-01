/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { session } from 'electron';
import { isIP } from 'node:net';

// CMMC build: outbound HTTP/HTTPS from any Electron session is restricted to
// loopback and RFC1918 private ranges. This catches anything Chromium issues
// directly (Sentry, font CDNs, telemetry, third-party SDKs called from
// renderer code, webview navigations). Node-level outbound from main/worker
// processes is NOT covered by this — patch http/https there if needed.

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'ws:',
  'wss:',
  // Electron internal / renderer-internal protocols — never block these.
  'file:',
  'data:',
  'blob:',
  'devtools:',
  'chrome-extension:',
  'aion-asset:',
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('fe80:')) return true; // link-local
  return false;
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  const ipKind = isIP(host);
  if (ipKind === 4) return isPrivateIPv4(host);
  if (ipKind === 6) return isPrivateIPv6(host);
  return false;
}

function isAllowedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Malformed URL — block it.
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return true; // unknown scheme — let Chromium handle it
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) return true;
  return isAllowedHost(parsed.hostname);
}

/**
 * Install the allowlist on a given Electron session. Idempotent.
 */
export function installNetworkAllowlist(targetSession = session.defaultSession): void {
  let blocked = 0;
  targetSession.webRequest.onBeforeRequest((details, callback) => {
    if (isAllowedUrl(details.url)) {
      callback({ cancel: false });
      return;
    }
    blocked += 1;
    if (blocked <= 20 || blocked % 50 === 0) {
      console.warn(`[network-allowlist] blocked ${details.method ?? 'GET'} ${details.url}`);
    }
    callback({ cancel: true });
  });
  console.log('[network-allowlist] installed (loopback + RFC1918 only)');
}
