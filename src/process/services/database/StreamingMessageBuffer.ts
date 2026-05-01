/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chat/chatLib';
import { getDatabase } from './index';

/**
 *
 *
 * - chunk
 * - 300ms 20 chunk
 *
 * - 1000 UPDATE
 * - ~10 UPDATE
 *
 */

interface StreamBuffer {
  messageId: string;
  conversationId: string;
  currentContent: string;
  chunkCount: number;
  lastDbUpdate: number;
  updateTimer?: NodeJS.Timeout;
  mode: 'accumulate' | 'replace'; // buffer
}

interface StreamingConfig {
  updateInterval?: number;
  chunkBatchSize?: number; // chunk
}

export class StreamingMessageBuffer {
  private buffers = new Map<string, StreamBuffer>();

  private readonly UPDATE_INTERVAL = 300;
  private readonly CHUNK_BATCH_SIZE = 20; // 20 chunk

  constructor(private config?: StreamingConfig) {
    if (config?.updateInterval) {
      (this as any).UPDATE_INTERVAL = config.updateInterval;
    }
    if (config?.chunkBatchSize) {
      (this as any).CHUNK_BATCH_SIZE = config.chunkBatchSize;
    }
  }

  /**
   * chunk
   *
   * @param id
   * @param messageId - ID
   * @param conversationId - ID
   * @param chunk
   *
   * chunk
   * @param mode
   */
  append(id: string, messageId: string, conversationId: string, chunk: string, mode: 'accumulate' | 'replace'): void {
    let buffer = this.buffers.get(messageId);

    if (!buffer) {
      // chunk
      buffer = {
        messageId,
        conversationId,
        currentContent: chunk,
        chunkCount: 1,
        lastDbUpdate: Date.now(),
        mode, // buffer mode
      };
      this.buffers.set(messageId, buffer);
    } else {
      // buffer
      if (buffer.mode === 'accumulate') {
        buffer.currentContent += chunk;
      } else {
        buffer.currentContent = chunk;
      }
      buffer.chunkCount++;
    }

    if (buffer.updateTimer) {
      clearTimeout(buffer.updateTimer);
      buffer.updateTimer = undefined;
    }

    const shouldUpdate =
      buffer.chunkCount % this.CHUNK_BATCH_SIZE === 0 || // chunk
      Date.now() - buffer.lastDbUpdate > this.UPDATE_INTERVAL;

    if (shouldUpdate) {
      this.flushBuffer(id, messageId, false);
    } else {
      buffer.updateTimer = setTimeout(() => {
        this.flushBuffer(id, messageId, false);
      }, this.UPDATE_INTERVAL);
    }
  }

  /**
   *
   * @param id
   * @param messageId - ID
   * @param clearBuffer -
   */
  private async flushBuffer(id: string, messageId: string, clearBuffer = false): Promise<void> {
    const buffer = this.buffers.get(messageId);
    if (!buffer) return;

    const db = await getDatabase();

    try {
      const message: TMessage = {
        id: id,
        msg_id: messageId,
        conversation_id: buffer.conversationId,
        type: 'text',
        content: { content: buffer.currentContent },
        status: 'pending',
        position: 'left',
        createdAt: Date.now(),
      };

      // Check if message exists in database
      const existing = db.getMessageByMsgId(buffer.conversationId, messageId, 'text');

      if (existing.success && existing.data) {
        // Message exists - update it
        db.updateMessage(existing.data.id, message);
      } else {
        // Message doesn't exist - insert it
        db.insertMessage(message);
      }

      buffer.lastDbUpdate = Date.now();

      if (clearBuffer) {
        this.buffers.delete(messageId);
      }
    } catch (error) {
      console.error(`[StreamingBuffer] Failed to flush buffer for ${messageId}:`, error);
    }
  }
}

export const streamingBuffer = new StreamingMessageBuffer();
