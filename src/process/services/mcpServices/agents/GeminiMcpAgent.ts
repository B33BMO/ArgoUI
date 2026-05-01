/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { McpOperationResult } from '../McpProtocol';
import { AbstractMcpAgent } from '../McpProtocol';
import type { IMcpServer } from '@/common/config/storage';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { safeExec } from '@process/utils/safeExec';

/** Env options for exec calls — ensures CLI is found from Finder/launchd launches */
const getExecEnv = () => ({
  env: { ...getEnhancedEnv(), NODE_OPTIONS: '', TERM: 'dumb', NO_COLOR: '1' } as NodeJS.ProcessEnv,
});

/**
 * Google Gemini CLI MCP
 *
 * Google Gemini CLI @office-ai/aioncli-core
 */
export class GeminiMcpAgent extends AbstractMcpAgent {
  constructor() {
    super('gemini');
  }

  getSupportedTransports(): string[] {
    // Google Gemini CLI stdio, sse, http (streamable_http maps to http)
    return ['stdio', 'sse', 'http', 'streamable_http'];
  }

  /**
   * Google Gemini CLI MCP
   */
  detectMcpServers(_cliPath?: string): Promise<IMcpServer[]> {
    const detectOperation = async () => {
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt === 1) {
            console.log('[GeminiMcpAgent] Starting MCP detection...');
          } else {
            console.log(`[GeminiMcpAgent] Retrying detection (attempt ${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          const { stdout: result } = await safeExec('gemini mcp list', { timeout: this.timeout, ...getExecEnv() });

          if (result.includes('No MCP servers configured') || !result.trim()) {
            console.log('[GeminiMcpAgent] No MCP servers configured');
            return [];
          }

          const mcpServers: IMcpServer[] = [];
          const lines = result.split('\n');

          for (const line of lines) {
            /* eslint-disable no-control-regex */
            const cleanLine = line
              .replace(/\u001b\[[0-9;]*m/g, '')
              .replace(/\[[0-9;]*m/g, '')
              .trim();
            /* eslint-enable no-control-regex */

            // : "✓ 12306-mcp: npx -y 12306-mcp (stdio) - Connected"
            const match = cleanLine.match(/[✓✗]\s+([^:]+):\s+(.+?)\s+\(([^)]+)\)\s*-\s*(Connected|Disconnected)/);
            if (match) {
              const [, name, commandStr, transport, status] = match;
              const commandParts = commandStr.trim().split(/\s+/);
              const command = commandParts[0];
              const args = commandParts.slice(1);

              const transportType = transport as 'stdio' | 'sse' | 'http';

              // transport
              const transportObj: any =
                transportType === 'stdio'
                  ? {
                      type: 'stdio',
                      command: command,
                      args: args,
                      env: {},
                    }
                  : transportType === 'sse'
                    ? {
                        type: 'sse',
                        url: commandStr.trim(),
                      }
                    : {
                        type: 'http',
                        url: commandStr.trim(),
                      };

              // tools
              let tools: Array<{ name: string; description?: string }> = [];
              if (status === 'Connected') {
                try {
                  const testResult = await this.testMcpConnection(transportObj);
                  tools = testResult.tools || [];
                } catch (error) {
                  console.warn(`[GeminiMcpAgent] Failed to get tools for ${name.trim()}:`, error);
                }
              }

              mcpServers.push({
                id: `gemini_${name.trim()}`,
                name: name.trim(),
                transport: transportObj,
                tools: tools,
                enabled: true,
                status: status === 'Connected' ? 'connected' : 'disconnected',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                description: '',
                originalJson: JSON.stringify(
                  {
                    mcpServers: {
                      [name.trim()]:
                        transportType === 'stdio'
                          ? {
                              command: command,
                              args: args,
                              description: `Detected from Google Gemini CLI`,
                            }
                          : {
                              url: commandStr.trim(),
                              type: transportType,
                              description: `Detected from Google Gemini CLI`,
                            },
                    },
                  },
                  null,
                  2
                ),
              });
            }
          }

          console.log(`[GeminiMcpAgent] Detection complete: found ${mcpServers.length} server(s)`);

          // "Configured MCP servers:"
          const hasConfigHeader = result.includes('Configured MCP servers:');
          const hasServerLines = lines.some((line) => line.match(/[✓✗]\s+[^:]+:/));

          if (hasConfigHeader && hasServerLines && mcpServers.length === 0) {
            throw new Error('Output appears truncated: found server markers but parsed 0 servers');
          }

          return mcpServers;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`[GeminiMcpAgent] Detection attempt ${attempt} failed:`, lastError.message);

          if (attempt < maxRetries) {
            continue;
          }
        }
      }

      console.warn('[GeminiMcpAgent] All detection attempts failed. Last error:', lastError);
      return [];
    };

    Object.defineProperty(detectOperation, 'name', { value: 'detectMcpServers' });
    return this.withLock(detectOperation);
  }

  /**
   * MCP Google Gemini CLI
   */
  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult> {
    const installOperation = async () => {
      try {
        for (const server of mcpServers) {
          if (server.transport.type === 'stdio') {
            // Gemini CLI MCP
            // : gemini mcp add <name> <command> [args...]
            let command = `gemini mcp add "${server.name}" "${server.transport.command}"`;
            if (server.transport.args?.length) {
              // Quote each arg to protect URLs and special characters from shell interpretation
              const quotedArgs = server.transport.args.map((arg: string) => `"${arg}"`).join(' ');
              command += ` ${quotedArgs}`;
            }

            // scope
            command += ' -s user';

            try {
              await safeExec(command, { timeout: 5000, ...getExecEnv() });
              console.log(`[GeminiMcpAgent] Added MCP server: ${server.name}`);
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Gemini:`, error);
            }
          } else if (
            server.transport.type === 'sse' ||
            server.transport.type === 'http' ||
            server.transport.type === 'streamable_http'
          ) {
            // SSE/HTTP/Streamable HTTP
            // Gemini CLI --transport http HTTP Streamable HTTP
            const transportFlag = server.transport.type === 'streamable_http' ? 'http' : server.transport.type;
            let command = `gemini mcp add "${server.name}" "${server.transport.url}"`;

            // transport
            command += ` --transport ${transportFlag}`;

            // scope
            command += ' -s user';

            try {
              await safeExec(command, { timeout: 5000, ...getExecEnv() });
              console.log(`[GeminiMcpAgent] Added MCP server: ${server.name}`);
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Gemini:`, error);
            }
          }
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    Object.defineProperty(installOperation, 'name', { value: 'installMcpServers' });
    return this.withLock(installOperation);
  }

  /**
   * Google Gemini CLI MCP
   */
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult> {
    const removeOperation = async () => {
      try {
        // user scope
        try {
          const removeCommand = `gemini mcp remove "${mcpServerName}" -s user`;
          const result = await safeExec(removeCommand, { timeout: 5000, ...getExecEnv() });

          if (result.stdout && result.stdout.includes('removed')) {
            console.log(`[GeminiMcpAgent] Removed MCP server: ${mcpServerName}`);
            return { success: true };
          } else if (result.stdout && result.stdout.includes('not found')) {
            // project scope
            throw new Error('Server not found in user scope');
          } else {
            return { success: true };
          }
        } catch (userError) {
          // project scope
          try {
            const removeCommand = `gemini mcp remove "${mcpServerName}" -s project`;
            const result = await safeExec(removeCommand, { timeout: 5000, ...getExecEnv() });

            if (result.stdout && result.stdout.includes('removed')) {
              console.log(`[GeminiMcpAgent] Removed MCP server from project: ${mcpServerName}`);
              return { success: true };
            } else {
              return { success: true };
            }
          } catch (projectError) {
            if (userError instanceof Error && userError.message.includes('not found')) {
              return { success: true };
            }
            return { success: false, error: userError instanceof Error ? userError.message : String(userError) };
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    Object.defineProperty(removeOperation, 'name', { value: 'removeMcpServer' });
    return this.withLock(removeOperation);
  }
}
