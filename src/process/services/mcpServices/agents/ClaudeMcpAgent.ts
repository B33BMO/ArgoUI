/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { McpOperationResult } from '../McpProtocol';
import { AbstractMcpAgent } from '../McpProtocol';
import type { IMcpServer } from '@/common/config/storage';
import {
  BUILTIN_IMAGE_GEN_LEGACY_NAMES,
  BUILTIN_IMAGE_GEN_NAME,
  isBuiltinImageGenName,
  isBuiltinImageGenTransport,
} from '@process/resources/builtinMcp/constants';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { safeExec, safeExecFile } from '@process/utils/safeExec';

/** Env options for exec calls — ensures CLI is found from Finder/launchd launches */
const getExecEnv = () => ({
  env: { ...getEnhancedEnv(), NODE_OPTIONS: '', TERM: 'dumb', NO_COLOR: '1' } as NodeJS.ProcessEnv,
});

export function buildClaudeStdioJsonConfig(server: IMcpServer): string {
  if (server.transport.type !== 'stdio') {
    throw new Error('Claude stdio JSON config requires a stdio transport');
  }

  return JSON.stringify({
    command: server.transport.command,
    args: server.transport.args || [],
    env: server.transport.env || {},
  });
}

/**
 * Claude Code MCP
 * Claude CLI stdio, sse, http
 */
export class ClaudeMcpAgent extends AbstractMcpAgent {
  constructor() {
    super('claude');
  }

  getSupportedTransports(): string[] {
    // Claude CLI stdio, sse, http (streamable_http maps to http)
    return ['stdio', 'sse', 'http', 'streamable_http'];
  }

  /**
   * Claude CodeMCP
   */
  detectMcpServers(_cliPath?: string): Promise<IMcpServer[]> {
    const detectOperation = async () => {
      try {
        const { stdout: result } = await safeExec('claude mcp list', {
          timeout: this.timeout,
          ...getExecEnv(),
        });

        if (result.includes('No MCP servers configured') || !result.trim()) {
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

          // : "12306-mcp: npx -y 12306-mcp - ✓ Connected" "12306-mcp: npx -y 12306-mcp - ✗ Failed to connect"
          const match = cleanLine.match(/^([^:]+):\s+(.+?)\s*-\s*[✓✗]\s*(.+)$/);
          if (match) {
            const [, name, commandStr, statusText] = match;
            const commandParts = commandStr.trim().split(/\s+/);
            const command = commandParts[0];
            const args = commandParts.slice(1);
            const displayName =
              isBuiltinImageGenName(name.trim()) || isBuiltinImageGenTransport({ command, args })
                ? BUILTIN_IMAGE_GEN_NAME
                : name.trim();

            // Connected, Disconnected, Failed to connect
            const isConnected =
              statusText.toLowerCase().includes('connected') && !statusText.toLowerCase().includes('disconnect');
            const status = isConnected ? 'connected' : 'disconnected';

            // transport
            const transportObj = {
              type: 'stdio' as const,
              command: command,
              args: args,
              env: {},
            };

            // tools
            let tools: Array<{ name: string; description?: string }> = [];
            if (isConnected) {
              try {
                const testResult = await this.testMcpConnection(transportObj);
                tools = testResult.tools || [];
              } catch (error) {
                console.warn(`[ClaudeMcpAgent] Failed to get tools for ${name.trim()}:`, error);
                // tools
              }
            }

            mcpServers.push({
              id: `claude_${name.trim()}`,
              name: displayName,
              transport: transportObj,
              tools: tools,
              enabled: true,
              status: status,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              description: '',
              originalJson: JSON.stringify(
                {
                  mcpServers: {
                    [displayName]: {
                      command: command,
                      args: args,
                      description: `Detected from Claude CLI`,
                    },
                  },
                },
                null,
                2
              ),
            });
          }
        }

        console.log(`[ClaudeMcpAgent] Detection complete: found ${mcpServers.length} server(s)`);
        return mcpServers;
      } catch (error) {
        console.warn('[ClaudeMcpAgent] Failed to detect MCP servers:', error);
        return [];
      }
    };

    Object.defineProperty(detectOperation, 'name', { value: 'detectMcpServers' });
    return this.withLock(detectOperation);
  }

  /**
   * MCPClaude Code agent
   */
  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult> {
    const installOperation = async () => {
      try {
        for (const server of mcpServers) {
          if (server.transport.type === 'stdio') {
            try {
              await safeExecFile(
                'claude',
                ['mcp', 'add-json', '-s', 'user', server.name, buildClaudeStdioJsonConfig(server)],
                {
                  timeout: 5000,
                  ...getExecEnv(),
                }
              );
              console.log(`[ClaudeMcpAgent] Added MCP server: ${server.name}`);
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Claude Code:`, error);
            }
          } else if (
            server.transport.type === 'sse' ||
            server.transport.type === 'http' ||
            server.transport.type === 'streamable_http'
          ) {
            // SSE/HTTP/Streamable HTTP
            // Claude CLI --transport http HTTP Streamable HTTP
            // : claude mcp add -s user --transport <type> <name> <url> [--header ...]
            const transportFlag = server.transport.type === 'streamable_http' ? 'http' : server.transport.type;
            let command = `claude mcp add -s user --transport ${transportFlag} "${server.name}" "${server.transport.url}"`;

            // headers
            if (server.transport.headers) {
              for (const [key, value] of Object.entries(server.transport.headers)) {
                command += ` --header "${key}: ${value}"`;
              }
            }

            try {
              await safeExec(command, {
                timeout: 5000,
                ...getExecEnv(),
              });
              console.log(`[ClaudeMcpAgent] Added MCP server: ${server.name}`);
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Claude Code:`, error);
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
   * Claude Code agentMCP
   */
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult> {
    const removeOperation = async () => {
      try {
        // : user -> local -> project
        // user scopeAionUiuser scope
        const scopes = ['user', 'local', 'project'] as const;
        const candidateNames = Array.from(
          new Set(
            isBuiltinImageGenName(mcpServerName)
              ? [mcpServerName, BUILTIN_IMAGE_GEN_NAME, ...BUILTIN_IMAGE_GEN_LEGACY_NAMES]
              : [mcpServerName]
          )
        );

        for (const scope of scopes) {
          for (const candidateName of candidateNames) {
            try {
              const removeCommand = `claude mcp remove -s ${scope} "${candidateName}"`;
              const result = await safeExec(removeCommand, {
                timeout: 5000,
                ...getExecEnv(),
              });

              if (result.stdout && result.stdout.includes('removed')) {
                console.log(`[ClaudeMcpAgent] Removed MCP server from ${scope} scope: ${candidateName}`);
                return { success: true };
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);

              if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
                continue;
              }

              console.warn(`[ClaudeMcpAgent] Failed to remove from ${scope} scope:`, errorMessage);
            }
          }
        }

        console.log(`[ClaudeMcpAgent] MCP server ${mcpServerName} not found in any scope (may already be removed)`);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    Object.defineProperty(removeOperation, 'name', { value: 'removeMcpServer' });
    return this.withLock(removeOperation);
  }
}
