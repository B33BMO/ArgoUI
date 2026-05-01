/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPluginConfig, IUnifiedOutgoingMessage, PluginType } from '../../types';
import { BasePlugin } from '../BasePlugin';

// Why: third-party messaging channels (Telegram, Lark, DingTalk, WeCom, WeChat)
// would route conversation content to vendor-controlled servers, which is
// incompatible with CMMC. The plugin classes are kept as inert stubs so the
// rest of the channel scaffolding compiles, but every lifecycle method
// throws or returns a no-op. ChannelManager also no longer registers them.
const DISABLED_REASON = 'Messaging channel plugins are disabled in this build (CMMC).';

export function createDisabledChannelPlugin(pluginType: PluginType) {
  return class DisabledChannelPlugin extends BasePlugin {
    readonly type: PluginType = pluginType;

    protected async onInitialize(_config: IChannelPluginConfig): Promise<void> {
      throw new Error(DISABLED_REASON);
    }

    protected async onStart(): Promise<void> {
      throw new Error(DISABLED_REASON);
    }

    protected async onStop(): Promise<void> {
      // No-op
    }

    async sendMessage(_chatId: string, _message: IUnifiedOutgoingMessage): Promise<string> {
      throw new Error(DISABLED_REASON);
    }

    async editMessage(_chatId: string, _messageId: string, _message: IUnifiedOutgoingMessage): Promise<void> {
      throw new Error(DISABLED_REASON);
    }

    getActiveUserCount(): number {
      return 0;
    }

    getBotInfo(): { username?: string; displayName?: string } | null {
      return null;
    }
  };
}
