/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { FileMetadata } from './FileService';
import { getFileExtension, uploadFileViaHttp } from './FileService';
import { trackUpload, type UploadSource } from '@/renderer/hooks/file/useUploadState';
import { isElectronDesktop } from '@/renderer/utils/platform';

/**
 * Create a temporary file in a platform-aware way.
 * Electron desktop uses IPC, WebUI uses HTTP API.
 */
async function createTempFile(
  fileName: string,
  data: Uint8Array,
  contentType: string,
  conversationId?: string,
  source: UploadSource = 'sendbox'
): Promise<string | null> {
  if (isElectronDesktop()) {
    const tempPath = await ipcBridge.fs.createUploadFile.invoke({ fileName, conversationId });
    if (tempPath) {
      await ipcBridge.fs.writeFile.invoke({ path: tempPath, data });
    }
    return tempPath;
  }
  // WebUI: upload via HTTP multipart
  const arrayBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuf], { type: contentType });
  const file = new File([blob], fileName, { type: contentType });
  const tracker = trackUpload(file.size, source);
  try {
    return await uploadFileViaHttp(file, conversationId || '', tracker.onProgress);
  } finally {
    tracker.finish();
  }
}

type PasteHandler = (event: React.ClipboardEvent | ClipboardEvent) => Promise<boolean>;

function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
  };
  return mimeMap[mimeType] || '.png';
}

class PasteServiceClass {
  private handlers: Map<string, PasteHandler> = new Map();
  private lastFocusedComponent: string | null = null;
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;

    document.addEventListener('paste', this.handleGlobalPaste);
    this.isInitialized = true;
  }

  registerHandler(componentId: string, handler: PasteHandler) {
    this.handlers.set(componentId, handler);
  }

  unregisterHandler(componentId: string) {
    this.handlers.delete(componentId);
  }

  setLastFocusedComponent(componentId: string) {
    this.lastFocusedComponent = componentId;
  }

  private handleGlobalPaste = async (event: ClipboardEvent) => {
    // input/textarea/contentEditable
    if (this.shouldAllowNativePaste(event)) {
      return;
    }

    if (!this.lastFocusedComponent) return;

    const handler = this.handlers.get(this.lastFocusedComponent);
    if (handler) {
      const handled = await handler(event);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  private shouldAllowNativePaste(event: ClipboardEvent): boolean {
    const target = event.target;
    if (!target || !(target instanceof Element)) {
      return false;
    }

    const editableElement = target.closest('input, textarea, [contenteditable]');
    if (!editableElement) {
      return false;
    }

    if (editableElement instanceof HTMLInputElement || editableElement instanceof HTMLTextAreaElement) {
      return true;
    }

    if (editableElement instanceof HTMLElement) {
      if (editableElement.isContentEditable) {
        return true;
      }
      const attr = editableElement.getAttribute('contenteditable');
      return !!attr && attr.toLowerCase() !== 'false';
    }

    return false;
  }

  async handlePaste(
    event: React.ClipboardEvent | ClipboardEvent,
    supportedExts: string[],
    onFilesAdded: (files: FileMetadata[]) => void,
    onTextPaste?: (text: string) => void,
    conversationId?: string,
    source: UploadSource = 'sendbox'
  ): Promise<boolean> {
    event.stopPropagation();
    const clipboardText = event.clipboardData?.getData('text');
    const files = event.clipboardData?.files;
    // If caller passes an empty array, treat it as "allow all file types"
    const allowAll = !supportedExts || supportedExts.length === 0;

    if (files && files.length > 0) {
      const fileList: FileMetadata[] = [];
      const usedFileNames = new Set<string>();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = (file as File & { path?: string }).path;


        if (!filePath && file.type.startsWith('image/')) {
          const fileExt = getFileExtension(file.name) || getExtensionFromMimeType(file.type);

          if (allowAll || supportedExts.includes(fileExt)) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              // Generate a concise filename; replace system-generated default names
              const now = new Date();
              const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;

              const isSystemGenerated = file.name && /^[a-zA-Z]?_?\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/.test(file.name);
              let fileName = file.name && !isSystemGenerated ? file.name : `pasted_image_${timeStr}${fileExt}`;
              // Ensure unique filename within the same paste batch to prevent
              // collisions when multiple images are pasted simultaneously
              if (usedFileNames.has(fileName)) {
                const extIdx = fileName.lastIndexOf('.');
                const baseName = extIdx > 0 ? fileName.slice(0, extIdx) : fileName;
                const ext = extIdx > 0 ? fileName.slice(extIdx) : fileExt;
                let counter = 2;
                while (usedFileNames.has(`${baseName}_${counter}${ext}`)) {
                  counter++;
                }
                fileName = `${baseName}_${counter}${ext}`;
              }
              usedFileNames.add(fileName);

              const tempPath = await createTempFile(fileName, uint8Array, file.type, conversationId, source);

              if (tempPath) {
                fileList.push({
                  name: fileName,
                  path: tempPath,
                  size: file.size,
                  type: file.type,
                  lastModified: Date.now(),
                });
              }
            } catch (error) {
              if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
                throw error;
              }
              console.error('创建临时文件失败:', error);
            }
          } else {
            console.warn(`Unsupported image type: ${file.type}, extension: ${fileExt}`);
          }
        } else if (filePath) {
          const fileExt = getFileExtension(file.name);

          if (allowAll || supportedExts.includes(fileExt)) {
            fileList.push({
              name: file.name,
              path: filePath,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
            });
          } else {
            console.warn(`Unsupported file type: ${file.name}, extension: ${fileExt}`);
          }
        } else if (!file.type.startsWith('image/')) {
          const fileExt = getFileExtension(file.name);

          if (allowAll || supportedExts.includes(fileExt)) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              // Ensure unique filename within the same paste batch
              let fileName = file.name;
              if (usedFileNames.has(fileName)) {
                const extIdx = fileName.lastIndexOf('.');
                const baseName = extIdx > 0 ? fileName.slice(0, extIdx) : fileName;
                const ext = extIdx > 0 ? fileName.slice(extIdx) : fileExt;
                let counter = 2;
                while (usedFileNames.has(`${baseName}_${counter}${ext}`)) {
                  counter++;
                }
                fileName = `${baseName}_${counter}${ext}`;
              }
              usedFileNames.add(fileName);

              const tempPath = await createTempFile(
                fileName,
                uint8Array,
                file.type || 'application/octet-stream',
                conversationId,
                source
              );
              if (tempPath) {
                fileList.push({
                  name: fileName,
                  path: tempPath,
                  size: file.size,
                  type: file.type,
                  lastModified: Date.now(),
                });
              }
            } catch (error) {
              if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
                throw error;
              }
              console.error('创建临时文件失败:', error);
            }
          } else {
            console.warn(`Unsupported file type: ${file.name}, extension: ${fileExt}`);
          }
        }
      }

      // true
      if (fileList.length > 0) {
        onFilesAdded(fileList);
      }
      return true;
    }

    if (clipboardText && (!files || files.length === 0)) {
      const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
      if (isIOS) {
        return false;
      }
      if (onTextPaste) {
        const cleanedText = clipboardText.replace(/\n\s*$/, '');
        onTextPaste(cleanedText);
        return true;
      }
      return false;
    }

    return false;
  }

  destroy() {
    if (this.isInitialized) {
      document.removeEventListener('paste', this.handleGlobalPaste);
      this.handlers.clear();
      this.lastFocusedComponent = null;
      this.isInitialized = false;
    }
  }
}

export const PasteService = new PasteServiceClass();
