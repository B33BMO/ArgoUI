/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ADAPTER_BRIDGE_EVENT_KEY } from '../common/adapter/constant';

/**
 * @description renderer, main
 * */
contextBridge.exposeInMainWorld('electronAPI', {
  emit: (name: string, data: any) => {
    return ipcRenderer
      .invoke(
        ADAPTER_BRIDGE_EVENT_KEY,
        JSON.stringify({
          name: name,
          data: data,
        })
      )
      .catch((error) => {
        console.error('IPC invoke error:', error);
        throw error;
      });
  },
  on: (callback: any) => {
    const handler = (event: any, value: any) => {
      callback({ event, value });
    };
    ipcRenderer.on(ADAPTER_BRIDGE_EVENT_KEY, handler);
    return () => {
      ipcRenderer.off(ADAPTER_BRIDGE_EVENT_KEY, handler);
    };
  },
  // Get absolute path for dragged file/directory
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  // IPC / Direct IPC calls (bypass bridge library)
  webuiResetPassword: () => ipcRenderer.invoke('webui-direct-reset-password'),
  webuiGetStatus: () => ipcRenderer.invoke('webui-direct-get-status'),
  // Change password without current password
  webuiChangePassword: (newPassword: string) => ipcRenderer.invoke('webui-direct-change-password', { newPassword }),
  webuiChangeUsername: (newUsername: string) => ipcRenderer.invoke('webui-direct-change-username', { newUsername }),
  // Generate QR token
  webuiGenerateQRToken: () => ipcRenderer.invoke('webui-direct-generate-qr-token'),
  // WeChat login IPC
  weixinLoginStart: () => ipcRenderer.invoke('weixin:login:start'),
  weixinLoginOnQR: (callback: (data: { qrcodeUrl: string }) => void) => {
    const h = (_event: unknown, data: { qrcodeUrl: string }) => callback(data);
    ipcRenderer.on('weixin:login:qr', h);
    return () => ipcRenderer.off('weixin:login:qr', h);
  },
  weixinLoginOnScanned: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('weixin:login:scanned', h);
    return () => ipcRenderer.off('weixin:login:scanned', h);
  },
  weixinLoginOnDone: (callback: (data: { accountId: string }) => void) => {
    const h = (_event: unknown, data: { accountId: string }) => callback(data);
    ipcRenderer.on('weixin:login:done', h);
    return () => ipcRenderer.off('weixin:login:done', h);
  },
});

// Tray event listeners - convert IPC events to DOM events
const trayEvents = [
  'tray:navigate-to-guid',
  'tray:navigate-to-conversation',
  'tray:open-about',
  'tray:pause-all-tasks',
];

for (const channel of trayEvents) {
  ipcRenderer.on(channel, (_event, ...args) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: args[0] }));
  });
}
