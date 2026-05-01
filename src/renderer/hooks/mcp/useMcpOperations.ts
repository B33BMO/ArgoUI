import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { acpConversation, mcpService } from '@/common/adapter/ipcBridge';
import { ConfigStorage } from '@/common/config/storage';
import type { IMcpServer } from '@/common/config/storage';
import { globalMessageQueue } from './messageQueue';

/**
 * Truncate long error messages to keep them readable
 */
const truncateErrorMessage = (message: string, maxLength: number = 150): string => {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength) + '...';
};

interface McpOperationResult {
  agent: string;
  success: boolean;
  error?: string;
}

interface McpOperationResponse {
  success: boolean;
  data?: {
    results: McpOperationResult[];
  };
  msg?: string;
}

/**
 * MCPHook
 */
export const useMcpOperations = (
  mcpServers: IMcpServer[],
  message: ReturnType<typeof import('@arco-design/web-react').Message.useMessage>[0]
) => {
  const { t } = useTranslation();

  const handleMcpOperationResult = useCallback(
    async (
      response: McpOperationResponse,
      operation: 'sync' | 'remove',
      successMessage?: string,
      skipRecheck = false
    ) => {
      if (response.success && response.data) {
        const { results } = response.data;
        const failedAgents = results.filter((r: McpOperationResult) => !r.success);

        if (failedAgents.length > 0) {
          const failedNames = failedAgents
            .map((r: McpOperationResult) => `${r.agent}: ${truncateErrorMessage(r.error || '')}`)
            .join(', ');
          const truncatedErrors = truncateErrorMessage(failedNames, 200);
          const partialFailedKey = operation === 'sync' ? 'mcpSyncPartialFailed' : 'mcpRemovePartialFailed';
          await globalMessageQueue.add(() => {
            message.warning({
              content: t(`settings.${partialFailedKey}`, { errors: truncatedErrors }),
              duration: 6000,
            });
          });
        } else {
          if (successMessage) {
            await globalMessageQueue.add(() => {
              message.success(successMessage);
            });
          }
        }

        if (!skipRecheck) {
          void ConfigStorage.get('mcp.config')
            .then((latestServers) => {
              if (latestServers) {
              }
            })
            .catch(() => {
              // Handle loading error silently
            });
        }
      } else {
        const failedKey = operation === 'sync' ? 'mcpSyncFailed' : 'mcpRemoveFailed';
        const errorMsg = truncateErrorMessage(response.msg || t('settings.unknownError'));
        await globalMessageQueue.add(() => {
          message.error({ content: t(`settings.${failedKey}`, { error: errorMsg }), duration: 6000 });
        });
      }
    },
    [message, t]
  );

  // agentsMCP
  const removeMcpFromAgents = useCallback(
    async (serverName: string, successMessage?: string, transportType?: string) => {
      const agentsResponse = await acpConversation.getAvailableAgents.invoke();
      if (agentsResponse.success && agentsResponse.data) {
        // Filter agents by transport type support if transport type is known
        const compatibleCount = transportType
          ? agentsResponse.data.filter((a) => a.supportedTransports?.includes(transportType)).length
          : agentsResponse.data.length;

        await globalMessageQueue.add(() => {
          message.info(t('settings.mcpRemoveStarted', { count: compatibleCount }));
        });

        const removeResponse = await mcpService.removeMcpFromAgents.invoke({
          mcpServerName: serverName,
          agents: agentsResponse.data,
        });
        await handleMcpOperationResult(removeResponse, 'remove', successMessage, true);
      }
    },
    [message, t, handleMcpOperationResult]
  );

  // agentsMCP
  const syncMcpToAgents = useCallback(
    async (server: IMcpServer, skipRecheck = false) => {
      const agentsResponse = await acpConversation.getAvailableAgents.invoke();
      if (agentsResponse.success && agentsResponse.data) {
        // Filter agents by transport type support to show accurate count
        const compatibleCount = agentsResponse.data.filter((a) =>
          a.supportedTransports?.includes(server.transport.type)
        ).length;

        await globalMessageQueue.add(() => {
          message.info(t('settings.mcpSyncStarted', { count: compatibleCount }));
        });

        const syncResponse = await mcpService.syncMcpToAgents.invoke({
          mcpServers: [server],
          agents: agentsResponse.data,
        });

        await handleMcpOperationResult(syncResponse, 'sync', undefined, skipRecheck);
      } else {
        // : agents
        // Fix: Handle case when no agents are available, show user-friendly error message
        console.error('[useMcpOperations] Failed to get available agents:', agentsResponse.msg);
        await globalMessageQueue.add(() => {
          message.error(t('settings.mcpSyncFailedNoAgents'));
        });
      }
    },
    [message, t, handleMcpOperationResult]
  );

  return {
    syncMcpToAgents,
    removeMcpFromAgents,
    handleMcpOperationResult,
  };
};
