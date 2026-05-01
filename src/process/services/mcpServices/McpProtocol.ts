/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPlatformServices } from '@/common/platform';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import { JSONRPC_VERSION } from '@/common/types/acpTypes';
import type { IMcpServer } from '@/common/config/storage';
import { assertCompliantServer } from './complianceGuard';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getEnhancedEnv, normalizeNpxArgsForBundledBun, resolveNpxPath } from '@/process/utils/shellEnv';

/**
 */
export type McpSource = AcpBackendAll | 'gemini' | 'aionui' | 'aionrs';

/**
 */
export interface McpOperationResult {
  success: boolean;
  error?: string;
}

/**
 */
export interface McpConnectionTestResult {
  success: boolean;
  tools?: Array<{ name: string; description?: string; _meta?: Record<string, unknown> }>;
  error?: string;
  needsAuth?: boolean; // OAuth
  authMethod?: 'oauth' | 'basic';
  wwwAuthenticate?: string; // WWW-Authenticate
}

/**
 */
export interface DetectedMcpServer {
  source: McpSource;
  servers: IMcpServer[];
}

/**
 */
export interface McpSyncResult {
  success: boolean;
  results: Array<{
    agent: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 */
export interface IMcpProtocol {
  /**
   * @param cliPath CLI
   * @returns MCP
   */
  detectMcpServers(cliPath?: string): Promise<IMcpServer[]>;

  /**
   * MCPagent
   * @param mcpServers MCP
   * @returns
   */
  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult>;

  /**
   * agentMCP
   * @param mcpServerName MCP
   * @returns
   */
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult>;

  /**
   * @param server MCP
   * @returns
   */
  testMcpConnection(server: IMcpServer): Promise<McpConnectionTestResult>;

  /**
   * @returns
   */
  getSupportedTransports(): string[];

  /**
   * agent
   * @returns agent
   */
  getBackendType(): McpSource;
}

/**
 */
export abstract class AbstractMcpAgent implements IMcpProtocol {
  protected readonly backend: McpSource;
  protected readonly timeout: number;
  private operationQueue: Promise<any> = Promise.resolve();

  constructor(backend: McpSource, timeout: number = 30000) {
    this.backend = backend;
    this.timeout = timeout;
  }

  /**
   */
  protected withLock<T>(operation: () => Promise<T>): Promise<T> {
    const currentQueue = this.operationQueue;
    const operationName = operation.name || 'anonymous operation';

    const newOperation = currentQueue
      .then(() => operation())
      .catch((error) => {
        console.warn(`[${this.backend} MCP] ${operationName} failed:`, error);
        throw error;
      });

    this.operationQueue = newOperation.catch(() => {
      // Empty catch to prevent unhandled rejection
    });

    return newOperation;
  }

  abstract detectMcpServers(cliPath?: string): Promise<IMcpServer[]>;

  abstract installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult>;

  abstract removeMcpServer(mcpServerName: string): Promise<McpOperationResult>;

  abstract getSupportedTransports(): string[];

  getBackendType(): McpSource {
    return this.backend;
  }

  /**
   * @param serverOrTransport
   */
  testMcpConnection(serverOrTransport: IMcpServer | IMcpServer['transport']): Promise<McpConnectionTestResult> {
    try {
      assertCompliantServer(serverOrTransport);
      const transport = 'transport' in serverOrTransport ? serverOrTransport.transport : serverOrTransport;

      switch (transport.type) {
        case 'stdio':
          return this.testStdioConnection(transport);
        default:
          return Promise.resolve({
            success: false,
            error: 'Unsupported transport type',
          });
      }
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   */
  protected async testStdioConnection(
    transport: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    },
    retryCount: number = 0
  ): Promise<McpConnectionTestResult> {
    let mcpClient: Client | null = null;

    try {
      // app imported statically

      // Use enhanced env (includes shell PATH) instead of bare process.env
      // so CLI tools installed via nvm/fnm/volta are discoverable in packaged mode
      const enhancedEnv = {
        ...getEnhancedEnv(transport.env),
        TERM: 'dumb',
        NO_COLOR: '1',
      };
      const command = transport.command === 'npx' ? resolveNpxPath(enhancedEnv) : transport.command;
      const args =
        transport.command === 'npx'
          ? ['x', '--bun', ...normalizeNpxArgsForBundledBun(transport.args || [])]
          : (transport.args ?? []);

      const stdioTransport = new StdioClientTransport({
        command,
        args,
        env: enhancedEnv,
        // Prevent child process stderr from inheriting parent's TTY.
        // Default 'inherit' causes `zsh: suspended (tty output)` when the
        // spawned MCP server (e.g. npx) writes to stderr while Electron
        // runs under terminal job control.
        stderr: 'pipe',
      });

      mcpClient = new Client(
        {
          name: getPlatformServices().paths.getName(),
          version: getPlatformServices().paths.getVersion(),
        },
        {
          capabilities: {
            sampling: {},
          },
        }
      );

      await mcpClient.connect(stdioTransport);
      const result = await mcpClient.listTools();

      const tools = result.tools.map((tool) =>
        Object.assign({ name: tool.name, description: tool.description }, tool._meta ? { _meta: tool._meta } : {})
      );

      return { success: true, tools };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as NodeJS.ErrnoException)?.code;

      // Detect missing command (npx/node not installed)
      if (
        errorCode === 'ENOENT' ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('spawn') ||
        errorMessage.includes('not found')
      ) {
        const cmd = transport.command;
        const isNpx = cmd === 'npx' || cmd.endsWith('/npx') || cmd.endsWith('\\npx');
        if (isNpx) {
          return {
            success: false,
            error:
              'Bundled bun runtime is unavailable. Please reinstall AionUi or use a direct stdio command instead of npx.',
          };
        }
        return {
          success: false,
          error: `Command "${cmd}" not found. Please ensure it is installed and available in your PATH.`,
        };
      }

      // Detect permission errors
      if (errorCode === 'EACCES' || errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
        return {
          success: false,
          error: `Permission denied when running "${transport.command}". Please check file permissions or reinstall AionUi.`,
        };
      }

      // Detect timeout errors
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        return {
          success: false,
          error: `Connection timed out. The MCP server "${transport.command}" may be taking too long to start. Check network and try again.`,
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.error('[Stdio] Error closing connection:', closeError);
        }
      }
    }
  }

  /**
   */
  protected async testSseConnection(transport: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<McpConnectionTestResult> {
    let mcpClient: Client | null = null;

    try {
      // app imported statically

      const authCheckResponse = await fetch(transport.url, {
        method: 'GET',
        headers: transport.headers || {},
      });

      if (authCheckResponse.status === 401) {
        const wwwAuthenticate = authCheckResponse.headers.get('WWW-Authenticate');
        if (wwwAuthenticate) {
          return {
            success: false,
            needsAuth: true,
            authMethod: wwwAuthenticate.toLowerCase().includes('bearer') ? 'oauth' : 'basic',
            wwwAuthenticate: wwwAuthenticate,
            error: 'Authentication required',
          };
        }
      }

      const sseTransport = new SSEClientTransport(new URL(transport.url), {
        requestInit: {
          headers: transport.headers,
        },
      });

      mcpClient = new Client(
        {
          name: getPlatformServices().paths.getName(),
          version: getPlatformServices().paths.getVersion(),
        },
        {
          capabilities: {
            sampling: {},
          },
        }
      );

      await mcpClient.connect(sseTransport);
      const result = await mcpClient.listTools();

      const tools = result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));

      return { success: true, tools };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.toLowerCase().includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        return {
          success: false,
          needsAuth: true,
          error: 'Authentication required',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.error('[SSE] Error closing connection:', closeError);
        }
      }
    }
  }

  /**
   * MCP Streamable HTTP servers may respond with JSON or SSE (text/event-stream).
   * Try raw JSON-RPC first; if the response is SSE, fall back to StreamableHTTPClientTransport.
   */
  protected async testHttpConnection(transport: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<McpConnectionTestResult> {
    try {
      // Quick probe: check if the server requires authentication before
      // handing off to the SDK (which doesn't surface 401 details).
      const probeResponse = await fetch(transport.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...transport.headers,
        },
        body: JSON.stringify({
          jsonrpc: JSONRPC_VERSION,
          method: 'initialize',
          id: 1,
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: {
              name: getPlatformServices().paths.getName(),
              version: getPlatformServices().paths.getVersion(),
            },
          },
        }),
      });

      if (probeResponse.status === 401) {
        const wwwAuthenticate = probeResponse.headers.get('WWW-Authenticate');
        if (wwwAuthenticate) {
          return {
            success: false,
            needsAuth: true,
            authMethod: wwwAuthenticate.toLowerCase().includes('bearer') ? 'oauth' : 'basic',
            wwwAuthenticate: wwwAuthenticate,
            error: 'Authentication required',
          };
        }
        return {
          success: false,
          error: `HTTP ${probeResponse.status}: ${probeResponse.statusText}`,
        };
      }

      if (!probeResponse.ok) {
        return {
          success: false,
          error: `HTTP ${probeResponse.status}: ${probeResponse.statusText}`,
        };
      }

      // Auth OK — close the probe body and delegate to StreamableHTTPClientTransport
      // which handles session-id, SSE, and all protocol details correctly.
      await probeResponse.body?.cancel().catch(() => {});
      return this.testStreamableHttpConnection(transport);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   */
  protected async testStreamableHttpConnection(transport: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<McpConnectionTestResult> {
    let mcpClient: Client | null = null;

    try {
      // app imported statically

      // Streamable HTTP
      const streamableHttpTransport = new StreamableHTTPClientTransport(new URL(transport.url), {
        requestInit: {
          headers: transport.headers,
        },
      });

      mcpClient = new Client(
        {
          name: getPlatformServices().paths.getName(),
          version: getPlatformServices().paths.getVersion(),
        },
        {
          capabilities: {
            sampling: {},
          },
        }
      );

      await mcpClient.connect(streamableHttpTransport);
      const result = await mcpClient.listTools();

      const tools = result.tools.map((tool) =>
        Object.assign({ name: tool.name, description: tool.description }, tool._meta ? { _meta: tool._meta } : {})
      );

      return { success: true, tools };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.error('[StreamableHTTP] Error closing connection:', closeError);
        }
      }
    }
  }
}
