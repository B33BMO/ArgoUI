/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BasePlugin } from '@process/channels/plugins/BasePlugin';
import type { LoadedExtension, ExtChannelPlugin } from '../types';

const DEBUG_ENABLED = process.env.AIONUI_EXTENSION_DEBUG === '1' || process.env.AIONUI_EXTENSION_DEBUG === 'true';

function logSecurity(message: string): void {
  if (DEBUG_ENABLED) {
    console.log(`[Extension Security] ${message}`);
  }
}

type ChannelPluginEntry = {
  constructor: typeof BasePlugin;
  meta: ExtChannelPlugin;
};

// Channel plugins were loaded via `eval('require')` and ran with full Node.js +
// Electron main-process privileges. That loader is disabled in this build —
// re-enable only after a SandboxHost (Worker Thread) implementation lands.
// See docs/specs/extension-market/research/security-model.md.
export function resolveChannelPlugins(extensions: LoadedExtension[]): Map<string, ChannelPluginEntry> {
  const result = new Map<string, ChannelPluginEntry>();
  for (const ext of extensions) {
    const plugins = ext.manifest.contributes.channelPlugins;
    if (!plugins || plugins.length === 0) continue;
    for (const plugin of plugins) {
      console.warn(
        `[Extension] Channel plugin "${plugin.type}" from "${ext.manifest.name}" was rejected: ` +
          `unsandboxed plugin loading is disabled in this build.`
      );
      logSecurity(`Rejected channel plugin "${plugin.type}" — loader disabled.`);
    }
  }
  return result;
}
