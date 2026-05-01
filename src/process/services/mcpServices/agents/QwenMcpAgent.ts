/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
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
 * Qwen CLI stdio, sse, http
 */
export class QwenMcpAgent extends AbstractMcpAgent {
  constructor() {
    super('qwen');
  }

  getSupportedTransports(): string[] {
    return ['stdio', 'sse', 'http'];
  }

  /**
   * Qwen CodeMCP
   */
  detectMcpServers(_cliPath?: string): Promise<IMcpServer[]> {
    const detectOperation = async () => {
      try {
        const { stdout: result } = await safeExec('qwen mcp list', { timeout: this.timeout, ...getExecEnv() });

        if (result.trim() === 'No MCP servers configured.' || !result.trim()) {
          console.log('[QwenMcpAgent] No MCP servers configured');
          return [];
        }

        const mcpServers: IMcpServer[] = [];
        const lines = result.split('\n');

        for (const line of lines) {
          // eslint-disable-next-line no-control-regex
          const cleanLine = line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').trim();
          // : "✓ filesystem: npx @modelcontextprotocol/server-filesystem /path (stdio) - Connected"
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
                console.warn(`[QwenMcpAgent] Failed to get tools for ${name.trim()}:`, error);
                // tools
              }
            }

            mcpServers.push({
              id: `qwen_${name.trim()}`,
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
                            description: `Detected from Qwen CLI`,
                          }
                        : {
                            url: commandStr.trim(),
                            type: transportType,
                            description: `Detected from Qwen CLI`,
                          },
                  },
                },
                null,
                2
              ),
            });
          }
        }

        console.log(`[QwenMcpAgent] Detection complete: found ${mcpServers.length} server(s)`);
        return mcpServers;
      } catch (error) {
        console.warn('[QwenMcpAgent] Failed to get Qwen Code MCP config:', error);
        return [];
      }
    };

    Object.defineProperty(detectOperation, 'name', { value: 'detectMcpServers' });
    return this.withLock(detectOperation);
  }

  /**
   * MCPQwen Code agent
   */
  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult> {
    const installOperation = async () => {
      try {
        for (const server of mcpServers) {
          if (server.transport.type === 'stdio') {
            // Qwen CLIMCP
            // : qwen mcp add <name> <command> [args...]
            let command = `qwen mcp add "${server.name}" "${server.transport.command}"`;
            if (server.transport.args?.length) {
              // Quote each arg to protect URLs and special characters from shell interpretation
              const quotedArgs = server.transport.args.map((arg: string) => `"${arg}"`).join(' ');
              command += ` ${quotedArgs}`;
            }
            const envEntries = Object.entries(server.transport.env || {});
            if (envEntries.length) {
              // Quote env values to protect special characters
              const envArgs = envEntries.map(([key, value]) => `--env "${key}=${value}"`).join(' ');
              command += ` ${envArgs}`;
            }

            // user
            command += ' -s user';

            try {
              await safeExec(command, { timeout: 5000, ...getExecEnv() });
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Qwen Code:`, error);
            }
          } else if (
            server.transport.type === 'sse' ||
            server.transport.type === 'http' ||
            server.transport.type === 'streamable_http'
          ) {
            // SSE/HTTP/Streamable HTTP
            // Qwen CLI --transport http HTTP Streamable HTTP
            const transportFlag = server.transport.type === 'streamable_http' ? 'http' : server.transport.type;
            let command = `qwen mcp add "${server.name}" "${server.transport.url}"`;
            command += ` --transport ${transportFlag}`;

            // headers
            if (server.transport.headers) {
              for (const [key, value] of Object.entries(server.transport.headers)) {
                command += ` --header "${key}: ${value}"`;
              }
            }

            command += ' -s user';

            try {
              await safeExec(command, { timeout: 5000, ...getExecEnv() });
            } catch (error) {
              console.warn(`Failed to add MCP ${server.name} to Qwen Code:`, error);
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
   * Qwen Code agentMCP
   */
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult> {
    const removeOperation = async () => {
      try {
        // userproject
        try {
          const removeCommand = `qwen mcp remove "${mcpServerName}" -s user`;
          const result = await safeExec(removeCommand, { timeout: 5000, ...getExecEnv() });

          if (result.stdout && result.stdout.includes('removed from user settings')) {
            return { success: true };
          } else if (result.stdout && result.stdout.includes('not found in user')) {
            // userproject
            throw new Error('Server not found in user settings');
          } else {
            return { success: true };
          }
        } catch (userError) {
          // userproject
          try {
            const removeCommand = `qwen mcp remove "${mcpServerName}" -s project`;
            const result = await safeExec(removeCommand, { timeout: 5000, ...getExecEnv() });

            if (result.stdout && result.stdout.includes('removed from project settings')) {
              return { success: true };
            } else if (result.stdout && result.stdout.includes('not found in project')) {
              // project
              throw new Error('Server not found in project settings', { cause: userError });
            } else {
              return { success: true };
            }
          } catch (projectError) {
            const configPath = join(homedir(), '.qwen', 'client_config.json');

            if (!existsSync(configPath)) {
              return { success: true };
            }

            try {
              const config = JSON.parse(readFileSync(configPath, 'utf-8'));
              if (config.mcpServers && config.mcpServers[mcpServerName]) {
                delete config.mcpServers[mcpServerName];
                writeFileSync(configPath, JSON.stringify(config, null, 2));
              }
              return { success: true };
            } catch (fileError) {
              console.warn(`Failed to update config file ${configPath}:`, fileError);
              return { success: true };
            }
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
