/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { McpOperationResult } from '../McpProtocol';
import { AbstractMcpAgent } from '../McpProtocol';
import type { IMcpServer } from '@/common/config/storage';
import { ProcessConfig } from '@process/utils/initStorage';

/**
 * AionUi MCP
 *
 * @office-ai/aioncli-core Gemini CLI MCP
 *
 * 1. MCP ProcessConfig 'mcp.config'
 * 2. GeminiAgentManager mcp.config @office-ai/aioncli-core
 * 3. @office-ai/aioncli-core MCP servers
 *
 * ACP Backend MCP Agents
 * - AionuiMcpAgent: AionUi @office-ai/aioncli-core MCP
 */
export class AionuiMcpAgent extends AbstractMcpAgent {
  constructor() {
    // 'aionui' backend type Gemini CLI
    // GeminiAgentManager MCP agent
    super('aionui');
  }

  getSupportedTransports(): string[] {
    // @office-ai/aioncli-core stdio, sse, http (streamable_http maps to http)
    // : node_modules/@office-ai/aioncli-core/dist/src/config/config.d.ts -> MCPServerConfig
    return ['stdio', 'sse', 'http', 'streamable_http'];
  }

  /**
   * AionUi MCP
   */
  async detectMcpServers(_cliPath?: string): Promise<IMcpServer[]> {
    try {
      const mcpConfig = await ProcessConfig.get('mcp.config');
      if (!mcpConfig || !Array.isArray(mcpConfig)) {
        return [];
      }

      // MCP servers
      // @office-ai/aioncli-core
      return mcpConfig.filter((server: IMcpServer) => {
        const supportedTypes = this.getSupportedTransports();
        return supportedTypes.includes(server.transport.type);
      });
    } catch (error) {
      console.warn('[AionuiMcpAgent] Failed to detect MCP servers:', error);
      return [];
    }
  }

  /**
   */
  async installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult> {
    try {
      const currentConfig = (await ProcessConfig.get('mcp.config')) || [];
      const existingServers = Array.isArray(currentConfig) ? currentConfig : [];

      const serverMap = new Map<string, IMcpServer>();

      existingServers.forEach((server: IMcpServer) => {
        serverMap.set(server.name, server);
      });

      mcpServers.forEach((server) => {
        if (this.getSupportedTransports().includes(server.transport.type)) {
          serverMap.set(server.name, {
            ...server,
            updatedAt: Date.now(),
          });
        } else {
          console.warn(`[AionuiMcpAgent] Skipping ${server.name}: unsupported transport type ${server.transport.type}`);
        }
      });

      const mergedServers = Array.from(serverMap.values());
      await ProcessConfig.set('mcp.config', mergedServers);

      console.log('[AionuiMcpAgent] Installed MCP servers:', mcpServers.map((s) => s.name).join(', '));
      return { success: true };
    } catch (error) {
      console.error('[AionuiMcpAgent] Failed to install MCP servers:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   *
   * 1. Toggle enabled: false
   *
   * remove
   */
  removeMcpServer(mcpServerName: string): Promise<McpOperationResult> {
    console.log(`[AionuiMcpAgent] Skip removing '${mcpServerName}' - config managed by renderer`);
    return Promise.resolve({ success: true });
  }
}
