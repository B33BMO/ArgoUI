/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@office-ai/aioncli-core';
import { isNewApiPlatform } from './platformConstants';

/**
 * @param platform
 * @returns AuthType
 */
export function getAuthTypeFromPlatform(platform: string): AuthType {
  const platformLower = platform?.toLowerCase() || '';

  // Gemini
  if (platformLower.includes('gemini-with-google-auth')) {
    return AuthType.LOGIN_WITH_GOOGLE;
  }
  if (platformLower.includes('gemini-vertex-ai') || platformLower.includes('vertex-ai')) {
    return AuthType.USE_VERTEX_AI;
  }
  if (platformLower.includes('gemini') || platformLower.includes('google')) {
    return AuthType.USE_GEMINI;
  }

  // Anthropic/Claude
  if (platformLower.includes('anthropic') || platformLower.includes('claude')) {
    return AuthType.USE_ANTHROPIC;
  }

  // AWS Bedrock
  if (platformLower.includes('bedrock')) {
    return AuthType.USE_BEDROCK;
  }

  // New API gateway defaults to OpenAI compatible (per-model protocol handled by getProviderAuthType)
  // OpenRouter, OpenAI, DeepSeek, new-api
  return AuthType.USE_OPENAI;
}

/**
 * Get provider auth type, prefer explicit authType, otherwise infer from platform
 * For new-api platform, supports per-model protocol overrides
 * @param provider platformauthTypeprovider
 * @returns
 */
export function getProviderAuthType(provider: {
  platform: string;
  authType?: AuthType;
  modelProtocols?: Record<string, string>;
  useModel?: string;
}): AuthType {
  if (provider.authType) {
    return provider.authType;
  }

  // new-api platform: look up per-model protocol override
  if (isNewApiPlatform(provider.platform) && provider.useModel && provider.modelProtocols) {
    const protocol = provider.modelProtocols[provider.useModel];
    if (protocol) {
      return getAuthTypeFromPlatform(protocol);
    }
  }

  // platform
  return getAuthTypeFromPlatform(provider.platform);
}
