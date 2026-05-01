/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import type { IMcpServer } from '@/common/config/storage';
import { ClaudeMcpAgent } from './agents/ClaudeMcpAgent';
import { CodebuddyMcpAgent } from './agents/CodebuddyMcpAgent';
import { QwenMcpAgent } from './agents/QwenMcpAgent';
import { GeminiMcpAgent } from './agents/GeminiMcpAgent';
import { AionuiMcpAgent } from './agents/AionuiMcpAgent';
import { CodexMcpAgent } from './agents/CodexMcpAgent';
import { OpencodeMcpAgent } from './agents/OpencodeMcpAgent';
import { AionrsMcpAgent } from './agents/AionrsMcpAgent';
import type { IMcpProtocol, DetectedMcpServer, McpConnectionTestResult, McpSyncResult, McpSource } from './McpProtocol';

/**
 *
 * Agent
 * - AcpBackend: ACP
 * - 'aionui': @office-ai/aioncli-core
 */
export class McpService {
  private agents: Map<McpSource, IMcpProtocol>;

  /**
   * Service-level operation lock to serialize heavy MCP operations.
   * Prevents concurrent getAgentMcpConfigs / syncMcpToAgents / removeMcpFromAgents
   * which would otherwise spawn dozens of child processes simultaneously,
   * causing resource exhaustion and potential system freezes.
   */
  private operationQueue: Promise<unknown> = Promise.resolve();

  private withServiceLock<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.operationQueue.then(operation, () => operation());
    // Keep the queue moving even if the operation rejects
    this.operationQueue = queued.catch(() => {});
    return queued;
  }

  private isCliAvailable(cliCommand: string): boolean {
    const isWindows = process.platform === 'win32';
    const whichCommand = isWindows ? 'where' : 'which';

    // Keep original behavior: prefer where/which, then fallback on Windows to Get-Command.
    // where/whichWindows Get-Command
    try {
      execSync(`${whichCommand} ${cliCommand}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 1000,
      });
      return true;
    } catch {
      if (!isWindows) return false;
    }

    if (isWindows) {
      try {
        // PowerShell fallback for shim scripts like *.ps1 (vfox)
        // PowerShell *.ps1 shim
        execSync(
          `powershell -NoProfile -NonInteractive -Command "Get-Command -All ${cliCommand} | Select-Object -First 1 | Out-Null"`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 1000,
          }
        );
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  constructor() {
    this.agents = new Map([
      ['claude', new ClaudeMcpAgent()],
      ['codebuddy', new CodebuddyMcpAgent()],
      ['qwen', new QwenMcpAgent()],
      ['gemini', new GeminiMcpAgent()],
      ['aionui', new AionuiMcpAgent()], // AionUi @office-ai/aioncli-core
      ['codex', new CodexMcpAgent()],
      ['opencode', new OpencodeMcpAgent()],
      ['aionrs', new AionrsMcpAgent()], // Aion CLI (Rust binary, TOML config)
    ]);
  }

  /**
   * backendagent
   */
  private getAgent(backend: McpSource): IMcpProtocol | undefined {
    return this.agents.get(backend);
  }

  /**
   * agent MCP agent
   * Fork Gemini (cliPath=undefined) AionuiMcpAgent
   * Native Gemini (cliPath='gemini') GeminiMcpAgent
   *
   * Get the correct MCP agent instance based on agent config.
   * Fork Gemini (cliPath=undefined) uses AionuiMcpAgent.
   * Native Gemini (cliPath='gemini') uses GeminiMcpAgent.
   */
  private getAgentForConfig(agent: { backend: string; cliPath?: string }): IMcpProtocol | undefined {
    // Fork Gemini AionuiMcpAgent MCP
    // Fork Gemini uses AionuiMcpAgent to manage MCP config
    if (agent.backend === 'gemini' && !agent.cliPath) {
      return this.agents.get('aionui');
    }
    return this.agents.get(agent.backend as McpSource);
  }

  /**
   * Gemini CLI agent
   * AcpDetector fork Gemini (cliPath=undefined) MCP Gemini CLI
   *
   * Ensure native Gemini CLI is in the agent list (if installed but not present).
   * AcpDetector returns fork Gemini (cliPath=undefined), but MCP operations need native Gemini CLI too.
   */
  private addNativeGeminiIfNeeded(
    agents: Array<{ backend: string; name: string; cliPath?: string }>
  ): Array<{ backend: string; name: string; cliPath?: string }> {
    const hasNativeGemini = agents.some((a) => a.backend === 'gemini' && a.cliPath === 'gemini');
    if (hasNativeGemini) return agents;

    try {
      if (!this.isCliAvailable('gemini')) return agents;

      const allAgents = [
        ...agents,
        {
          backend: 'gemini',
          name: 'Google Gemini CLI',
          cliPath: 'gemini',
        },
      ];
      console.log('[McpService] Added native Gemini CLI to agent list');
      return allAgents;
    } catch {
      return agents;
    }
  }

  /**
   * Resolve which MCP agent should be used for config detection and how it
   * should be reported back to the renderer.
   */
  private getDetectionTarget(agent: { backend: string; cliPath?: string }): {
    agentInstance: IMcpProtocol | undefined;
    source: McpSource;
  } {
    const agentInstance = this.getAgentForConfig(agent);
    const source: McpSource = agent.backend === 'gemini' && !agent.cliPath ? 'gemini' : (agent.backend as McpSource);
    return { agentInstance, source };
  }

  /**
   * Merge detection results by source so the UI sees a single entry per agent.
   * This also prevents duplicate Gemini rows when both built-in Gemini and the
   * native Gemini CLI expose the same MCP server names.
   */
  private mergeDetectedServers(results: DetectedMcpServer[]): DetectedMcpServer[] {
    const merged = new Map<McpSource, Map<string, IMcpServer>>();

    results.forEach((result) => {
      const serversByName = merged.get(result.source) ?? new Map<string, IMcpServer>();

      result.servers.forEach((server) => {
        if (!serversByName.has(server.name)) {
          serversByName.set(server.name, server);
        }
      });

      merged.set(result.source, serversByName);
    });

    return Array.from(merged.entries()).map(([source, serversByName]) => ({
      source,
      servers: Array.from(serversByName.values()),
    }));
  }

  /**
   *
   */
  getAgentMcpConfigs(
    agents: Array<{
      backend: string;
      name: string;
      cliPath?: string;
    }>
  ): Promise<DetectedMcpServer[]> {
    return this.withServiceLock(async () => {
      // ACP agents Gemini CLI
      const allAgentsToCheck = this.addNativeGeminiIfNeeded(agents);

      const promises = allAgentsToCheck.map(async (agent) => {
        try {
          const { agentInstance, source } = this.getDetectionTarget(agent);
          if (!agentInstance) {
            console.warn(`[McpService] No agent instance for backend: ${agent.backend}`);
            return null;
          }

          const servers = await agentInstance.detectMcpServers(agent.cliPath);
          console.log(
            `[McpService] Detected ${servers.length} MCP servers for ${agent.backend} (cliPath: ${agent.cliPath || 'default'})`
          );

          if (servers.length > 0) {
            return {
              source,
              servers,
            };
          }
          return null;
        } catch (error) {
          console.warn(`[McpService] Failed to detect MCP servers for ${agent.backend}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      return this.mergeDetectedServers(results.filter((result): result is DetectedMcpServer => result !== null));
    });
  }

  /**
   * Get supported transport types for a given agent config.
   * Fork Gemini (backend='gemini', no cliPath) uses AionuiMcpAgent.
   */
  getSupportedTransportsForAgent(agent: { backend: string; cliPath?: string }): string[] {
    const agentInstance = this.getAgentForConfig(agent as { backend: string; cliPath?: string });
    return agentInstance ? agentInstance.getSupportedTransports() : [];
  }

  /**
   */
  async testMcpConnection(server: IMcpServer): Promise<McpConnectionTestResult> {
    // agent
    const firstAgent = this.agents.values().next().value;
    if (firstAgent) {
      return await firstAgent.testMcpConnection(server);
    }
    return {
      success: false,
      error: 'No agent available for connection testing',
    };
  }

  /**
   */
  syncMcpToAgents(
    mcpServers: IMcpServer[],
    agents: Array<{
      backend: string;
      name: string;
      cliPath?: string;
    }>
  ): Promise<McpSyncResult> {
    const enabledServers = mcpServers.filter((server) => server.enabled);

    if (enabledServers.length === 0) {
      return Promise.resolve({ success: true, results: [] });
    }

    return this.withServiceLock(async () => {
      // Ensure native Gemini CLI is also in the sync list
      const allAgents = this.addNativeGeminiIfNeeded(agents);

      const promises = allAgents.map(async (agent) => {
        try {
          // getAgentForConfig fork Gemini native Gemini
          // Use getAgentForConfig to correctly distinguish fork Gemini from native Gemini
          const agentInstance = this.getAgentForConfig(agent);
          if (!agentInstance) {
            console.warn(`[McpService] Skipping MCP sync for unsupported backend: ${agent.backend}`);
            return {
              agent: agent.name,
              success: true,
            };
          }

          const result = await agentInstance.installMcpServers(enabledServers);
          return {
            agent: agent.name,
            success: result.success,
            error: result.error,
          };
        } catch (error) {
          return {
            agent: agent.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.all(promises);

      const allSuccess = results.every((r) => r.success);

      return { success: allSuccess, results };
    });
  }

  /**
   */
  removeMcpFromAgents(
    mcpServerName: string,
    agents: Array<{
      backend: string;
      name: string;
      cliPath?: string;
    }>
  ): Promise<McpSyncResult> {
    return this.withServiceLock(async () => {
      // Ensure native Gemini CLI is also in the removal list
      const allAgents = this.addNativeGeminiIfNeeded(agents);

      const promises = allAgents.map(async (agent) => {
        try {
          // getAgentForConfig fork Gemini native Gemini
          // Use getAgentForConfig to correctly distinguish fork Gemini from native Gemini
          const agentInstance = this.getAgentForConfig(agent);
          if (!agentInstance) {
            console.warn(`[McpService] Skipping MCP removal for unsupported backend: ${agent.backend}`);
            return {
              agent: `${agent.backend}:${agent.name}`,
              success: true,
            };
          }

          const result = await agentInstance.removeMcpServer(mcpServerName);
          return {
            agent: `${agent.backend}:${agent.name}`,
            success: result.success,
            error: result.error,
          };
        } catch (error) {
          return {
            agent: `${agent.backend}:${agent.name}`,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.all(promises);

      return { success: true, results };
    });
  }
}

export const mcpService = new McpService();
