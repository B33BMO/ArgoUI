/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';

// AWS Bedrock is a cloud-only LLM service and is incompatible with the
// CMMC build's local-only posture. The IPC handler is kept so the renderer
// can still call it, but it always reports the test as failed.
export function initBedrockBridge(): void {
  ipcBridge.bedrock.testConnection.provider(async () => {
    return {
      success: false,
      msg: 'AWS Bedrock is disabled in this build. Configure a local LLM endpoint instead.',
    };
  });
}
