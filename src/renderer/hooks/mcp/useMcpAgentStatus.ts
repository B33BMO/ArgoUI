import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigStorage } from '@/common/config/storage';
import { acpConversation, mcpService } from '@/common/adapter/ipcBridge';
import type { IMcpServer } from '@/common/config/storage';

/**
 * MCP AgentHook
 */
export const useMcpAgentStatus = () => {
  const [agentInstallStatus, setAgentInstallStatus] = useState<Record<string, string[]>>({});
  const [loadingServers, setLoadingServers] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const agentConfigsCacheRef = useRef<Array<{ source: string; servers: Array<{ name: string }> }> | null>(null);

  // agent
  useEffect(() => {
    void ConfigStorage.get('mcp.agentInstallStatus')
      .then((status) => {
        if (status && typeof status === 'object') {
          setAgentInstallStatus(status as Record<string, string[]>);
        }
      })
      .catch(() => {
        // Handle loading error silently
      });
  }, []);

  // agent
  const saveAgentInstallStatus = useCallback((status: Record<string, string[]>) => {
    void ConfigStorage.set('mcp.agentInstallStatus', status).catch(() => {
      // Handle storage error silently
    });
    setAgentInstallStatus(status);
  }, []);

  // agent
  const processAgentConfigs = useCallback(
    (
      servers: IMcpServer[],
      agentConfigs: Array<{ source: string; servers: Array<{ name: string }> }>,
      targetServerName?: string
    ) => {
      const installStatus: Record<string, string[]> = { ...agentInstallStatus };

      // find
      const serverMap = new Map<string, IMcpServer>();
      const serversToProcess = targetServerName ? servers.filter((s) => s.name === targetServerName) : servers;

      serversToProcess.forEach((server) => {
        if (server.enabled) {
          serverMap.set(server.name, server);
          installStatus[server.name] = [];
        } else {
          delete installStatus[server.name];
        }
      });

      agentConfigs.forEach((agentConfig) => {
        agentConfig.servers.forEach((agentServer) => {
          const localServer = serverMap.get(agentServer.name);
          if (localServer && installStatus[agentServer.name] !== undefined) {
            installStatus[agentServer.name].push(agentConfig.source);
          }
        });
      });

      const currentEnabledServers = new Set(servers.filter((s) => s.enabled).map((s) => s.name));
      const filteredInstallStatus: Record<string, string[]> = {};

      for (const [serverName, agents] of Object.entries(installStatus)) {
        if (currentEnabledServers.has(serverName)) {
          filteredInstallStatus[serverName] = agents;
        }
      }

      saveAgentInstallStatus(filteredInstallStatus);
    },
    [agentInstallStatus, saveAgentInstallStatus]
  );

  const checkAgentInstallStatus = useCallback(
    async (servers: IMcpServer[], forceRefresh = false, targetServerName?: string) => {
      const now = Date.now();
      const CACHE_DURATION = 5000;

      if (!forceRefresh && agentConfigsCacheRef.current && now - lastCheckTimeRef.current < CACHE_DURATION) {
        processAgentConfigs(servers, agentConfigsCacheRef.current, targetServerName);
        return;
      }

      const serversToLoad = targetServerName ? [targetServerName] : servers.filter((s) => s.enabled).map((s) => s.name);
      setLoadingServers((prev) => {
        const newSet = new Set(prev);
        serversToLoad.forEach((name) => newSet.add(name));
        return newSet;
      });

      try {
        const agentsResponse = await acpConversation.getAvailableAgents.invoke();

        if (!agentsResponse.success || !agentsResponse.data) {
          // agent
          if (Object.keys(agentInstallStatus).length === 0) {
            saveAgentInstallStatus({});
          }
          return;
        }

        const mcpConfigsResponse = await mcpService.getAgentMcpConfigs.invoke(agentsResponse.data);

        if (!mcpConfigsResponse.success || !mcpConfigsResponse.data) {
          return;
        }

        agentConfigsCacheRef.current = mcpConfigsResponse.data;
        lastCheckTimeRef.current = now;

        processAgentConfigs(servers, mcpConfigsResponse.data, targetServerName);
      } catch (error) {
      } finally {
        setLoadingServers((prev) => {
          const newSet = new Set(prev);
          serversToLoad.forEach((name) => newSet.delete(name));
          return newSet;
        });
      }
    },
    [agentInstallStatus, processAgentConfigs, saveAgentInstallStatus]
  );

  const debouncedCheckAgentInstallStatus = useCallback(
    (servers: IMcpServer[], forceRefresh = false, targetServerName?: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        checkAgentInstallStatus(servers, forceRefresh, targetServerName).catch(() => {
          // Silently handle errors
        });
      }, 300);
    },
    [checkAgentInstallStatus]
  );

  const checkSingleServerInstallStatus = useCallback(async (serverName: string) => {
    setLoadingServers((prev) => new Set(prev).add(serverName));

    try {
      // agents
      const agentsResponse = await acpConversation.getAvailableAgents.invoke();
      if (!agentsResponse.success || !agentsResponse.data) {
        return;
      }

      // agentsMCP
      const mcpConfigsResponse = await mcpService.getAgentMcpConfigs.invoke(agentsResponse.data);
      if (!mcpConfigsResponse.success || !mcpConfigsResponse.data) {
        return;
      }

      const installedAgents: string[] = [];
      mcpConfigsResponse.data.forEach((agentConfig) => {
        const hasServer = agentConfig.servers.some((server) => server.name === serverName);
        if (hasServer) {
          installedAgents.push(agentConfig.source);
        }
      });

      setAgentInstallStatus((prev) => {
        const updated = { ...prev };
        if (installedAgents.length > 0) {
          updated[serverName] = installedAgents;
        } else {
          delete updated[serverName];
        }

        void ConfigStorage.set('mcp.agentInstallStatus', updated).catch(() => {
          // Handle storage error silently
        });

        return updated;
      });
    } catch (error) {
    } finally {
      setLoadingServers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(serverName);
        return newSet;
      });
    }
  }, []);

  const isServerLoading = useCallback(
    (serverName: string) => {
      return loadingServers.has(serverName);
    },
    [loadingServers]
  );

  return {
    agentInstallStatus,
    setAgentInstallStatus,
    loadingServers,
    isServerLoading,
    checkAgentInstallStatus,
    debouncedCheckAgentInstallStatus,
    checkSingleServerInstallStatus,
  };
};
