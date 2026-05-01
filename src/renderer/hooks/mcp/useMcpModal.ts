import { useState, useCallback } from 'react';
import type { IMcpServer } from '@/common/config/storage';

/**
 * MCPHook
 */
export const useMcpModal = () => {
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<IMcpServer | undefined>();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);
  const [mcpCollapseKey, setMcpCollapseKey] = useState<Record<string, boolean>>({});

  const showAddMcpModal = useCallback(() => {
    setEditingMcpServer(undefined);
    setShowMcpModal(true);
  }, []);

  const showEditMcpModal = useCallback((server: IMcpServer) => {
    setEditingMcpServer(server);
    setShowMcpModal(true);
  }, []);

  const hideMcpModal = useCallback(() => {
    setShowMcpModal(false);
    setEditingMcpServer(undefined);
  }, []);

  const showDeleteConfirm = useCallback((serverId: string) => {
    setServerToDelete(serverId);
    setDeleteConfirmVisible(true);
  }, []);

  const hideDeleteConfirm = useCallback(() => {
    setDeleteConfirmVisible(false);
    setServerToDelete(null);
  }, []);

  const toggleServerCollapse = useCallback((serverId: string) => {
    setMcpCollapseKey((prev) => ({ ...prev, [serverId]: !prev[serverId] }));
  }, []);

  return {
    showMcpModal,
    editingMcpServer,
    deleteConfirmVisible,
    serverToDelete,
    mcpCollapseKey,

    showAddMcpModal,
    showEditMcpModal,
    hideMcpModal,
    showDeleteConfirm,
    hideDeleteConfirm,
    toggleServerCollapse,
  };
};
