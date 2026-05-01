/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMcpServer, IMcpServerTransport } from '@/common/config/storage';

// Why: this fork operates in CMMC-controlled environments where MCP servers must
// be locally hosted. Remote (sse / http / streamable_http) transports allow a
// third-party endpoint to inject tool definitions that get executed with the
// agent's privileges, and would also let an external CLI agent connect directly
// to the remote URL bypassing AionUi's process boundary.
const REMOTE_TRANSPORT_REJECTION =
  'Remote MCP servers (sse / http / streamable_http) are disabled in this build. Only stdio transports are permitted.';

export class RemoteMcpTransportError extends Error {
  constructor(message: string = REMOTE_TRANSPORT_REJECTION) {
    super(message);
    this.name = 'RemoteMcpTransportError';
  }
}

export function isStdioTransport(transport: IMcpServerTransport): boolean {
  return transport.type === 'stdio';
}

export function assertStdioTransport(transport: IMcpServerTransport): void {
  if (!isStdioTransport(transport)) {
    throw new RemoteMcpTransportError();
  }
}

export function assertCompliantServer(server: IMcpServer | IMcpServer['transport']): void {
  const transport = 'transport' in server ? server.transport : server;
  assertStdioTransport(transport);
}

export function filterCompliantServers(servers: IMcpServer[]): IMcpServer[] {
  return servers.filter((s) => isStdioTransport(s.transport));
}
