/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';

/**
 * Channel
 * Channel global event types
 */
export const ChannelEvents = {
  /*Agent message event*/
  AGENT_MESSAGE: 'channel.agent.message',
} as const;

/**
 * Agent
 * Agent message event data
 */
export interface IAgentMessageEvent extends IResponseMessage {
  conversation_id: string;
}

/**
 * ChannelEventBus
 *
 *
 * Usage:
 * ```typescript
 * channelEventBus.emitAgentMessage(conversationId, data);
 *
 * channelEventBus.onAgentMessage((event) => {
 * });
 * ```
 */
class ChannelEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Agent
   * Emit agent message event
   */
  emitAgentMessage(conversationId: string, data: IResponseMessage): void {
    const event: IAgentMessageEvent = {
      ...data,
      conversation_id: conversationId,
    };
    this.emit(ChannelEvents.AGENT_MESSAGE, event);
  }

  /**
   * Agent
   * Listen to agent message event
   */
  onAgentMessage(handler: (event: IAgentMessageEvent) => void): () => void {
    this.on(ChannelEvents.AGENT_MESSAGE, handler);
    return () => {
      this.off(ChannelEvents.AGENT_MESSAGE, handler);
    };
  }

  /**
   * Agent
   * Remove agent message listener
   */
  offAgentMessage(handler: (event: IAgentMessageEvent) => void): void {
    this.off(ChannelEvents.AGENT_MESSAGE, handler);
  }
}

export const channelEventBus = new ChannelEventBus();
