import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { ConfigStorage } from '@/common/config/storage';
import type { IMcpServer } from '@/common/config/storage';

/**
 * MCPCRUDHook
 */
export const useMcpServerCRUD = (
  mcpServers: IMcpServer[],
  saveMcpServers: (serversOrUpdater: IMcpServer[] | ((prev: IMcpServer[]) => IMcpServer[])) => Promise<void>,
  syncMcpToAgents: (server: IMcpServer, skipRecheck?: boolean) => Promise<void>,
  removeMcpFromAgents: (serverName: string, successMessage?: string, transportType?: string) => Promise<void>,
  checkSingleServerInstallStatus: (serverName: string) => Promise<void>,
  setAgentInstallStatus: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
) => {
  const { t } = useTranslation();

  const handleAddMcpServer = useCallback(
    async (serverData: Omit<IMcpServer, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = Date.now();
      let serverToSync: IMcpServer | null = null;

      await saveMcpServers((prevServers) => {
        const existingServerIndex = prevServers.findIndex((server) => server.name === serverData.name);

        if (existingServerIndex !== -1) {
          const updatedServers = [...prevServers];
          updatedServers[existingServerIndex] = {
            ...updatedServers[existingServerIndex],
            ...serverData,
            updatedAt: now,
          };
          serverToSync = updatedServers[existingServerIndex];
          return updatedServers;
        } else {
          const newServer: IMcpServer = {
            ...serverData,
            id: `mcp_${now}`,
            createdAt: now,
            updatedAt: now,
          };
          serverToSync = newServer;
          return [...prevServers, newServer];
        }
      });

      if (serverToSync) {
        setTimeout(() => void checkSingleServerInstallStatus(serverToSync.name), 100);
      }

      return serverToSync;
    },
    [saveMcpServers, syncMcpToAgents, t, checkSingleServerInstallStatus]
  );

  const handleBatchImportMcpServers = useCallback(
    async (serversData: Omit<IMcpServer, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const now = Date.now();
      const addedServers: IMcpServer[] = [];

      await saveMcpServers((prevServers) => {
        const updatedServers = [...prevServers];

        serversData.forEach((serverData, index) => {
          const existingServerIndex = updatedServers.findIndex((server) => server.name === serverData.name);

          if (existingServerIndex !== -1) {
            updatedServers[existingServerIndex] = {
              ...updatedServers[existingServerIndex],
              ...serverData,
              updatedAt: now,
            };
          } else {
            const newServer: IMcpServer = {
              ...serverData,
              id: `mcp_${now}_${index}`,
              createdAt: now,
              updatedAt: now,
            };
            updatedServers.push(newServer);
            addedServers.push(newServer);
          }
        });

        return updatedServers;
      });

      setTimeout(() => {
        serversData.forEach((serverData) => {
          void checkSingleServerInstallStatus(serverData.name);
        });
      }, 100);

      return addedServers;
    },
    [saveMcpServers, syncMcpToAgents, t, checkSingleServerInstallStatus]
  );

  const handleEditMcpServer = useCallback(
    async (
      editingMcpServer: IMcpServer | undefined,
      serverData: Omit<IMcpServer, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<IMcpServer | undefined> => {
      if (!editingMcpServer) return undefined;

      let updatedServer: IMcpServer | undefined;

      await saveMcpServers((prevServers) => {
        updatedServer = {
          ...editingMcpServer,
          ...serverData,
          updatedAt: Date.now(),
        };

        return prevServers.map((server) => (server.id === editingMcpServer.id ? updatedServer : server));
      });

      Message.success(t('settings.mcpImportSuccess'));
      setTimeout(() => void checkSingleServerInstallStatus(serverData.name), 100);

      return updatedServer;
    },
    [saveMcpServers, t, checkSingleServerInstallStatus]
  );

  const handleDeleteMcpServer = useCallback(
    async (serverId: string) => {
      let targetServer: IMcpServer | undefined;

      await saveMcpServers((prevServers) => {
        targetServer = prevServers.find((server) => server.id === serverId);
        if (!targetServer) return prevServers;

        return prevServers.filter((server) => server.id !== serverId);
      });

      if (!targetServer) return;

      setAgentInstallStatus((prev) => {
        const updated = { ...prev };
        delete updated[targetServer.name];
        void ConfigStorage.set('mcp.agentInstallStatus', updated).catch(() => {
          // Handle storage error silently
        });
        return updated;
      });

      try {
        if (targetServer.enabled) {
          await removeMcpFromAgents(
            targetServer.name,
            t('settings.mcpDeletedWithCleanup'),
            targetServer.transport.type
          );
        } else {
          Message.success(t('settings.mcpDeleted'));
        }
      } catch (error) {
        Message.error(t('settings.mcpDeleteError'));
      }
    },
    [saveMcpServers, setAgentInstallStatus, removeMcpFromAgents, t]
  );

  const handleToggleMcpServer = useCallback(
    async (serverId: string, enabled: boolean) => {
      let targetServer: IMcpServer | undefined;
      let updatedTargetServer: IMcpServer | undefined;

      await saveMcpServers((prevServers) => {
        targetServer = prevServers.find((server) => server.id === serverId);
        if (!targetServer) return prevServers;

        return prevServers.map((server) => {
          if (server.id === serverId) {
            updatedTargetServer = { ...server, enabled, updatedAt: Date.now() };
            return updatedTargetServer;
          }
          return server;
        });
      });

      if (!targetServer || !updatedTargetServer) return;

      try {
        if (enabled) {
          await syncMcpToAgents(updatedTargetServer, true);
          setTimeout(() => void checkSingleServerInstallStatus(targetServer.name), 100);
        } else {
          await removeMcpFromAgents(targetServer.name, undefined, targetServer.transport.type);
          setAgentInstallStatus((prev) => {
            const updated = { ...prev };
            delete updated[targetServer.name];
            void ConfigStorage.set('mcp.agentInstallStatus', updated).catch(() => {
              // Handle storage error silently
            });
            return updated;
          });
        }
      } catch (error) {
        Message.error(enabled ? t('settings.mcpSyncError') : t('settings.mcpRemoveError'));
      }
    },
    [saveMcpServers, syncMcpToAgents, removeMcpFromAgents, checkSingleServerInstallStatus, setAgentInstallStatus, t]
  );

  return {
    handleAddMcpServer,
    handleBatchImportMcpServers,
    handleEditMcpServer,
    handleDeleteMcpServer,
    handleToggleMcpServer,
  };
};
