/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProviderWithModel } from '@/common/config/storage';
import { getPlatformServices } from '@/common/platform';
import { uuid } from '@/common/utils';
import type { GeminiClient } from '@office-ai/aioncli-core';
import { AuthType, Config } from '@office-ai/aioncli-core';
import { mkdirSync } from 'fs';
import path from 'path';
import { WebFetchTool } from './web-fetch';
import { WebSearchTool } from './web-search';

interface ConversationToolConfigOptions {
  proxy: string;
  webSearchEngine?: 'google' | 'default';
}

const getGeminiWebSearchRuntimeDir = () => {
  const dataDir = getPlatformServices().paths.getDataDir();
  return path.join(dataDir, 'runtime', 'gemini-websearch');
};

/**
 */
export class ConversationToolConfig {
  private useGeminiWebSearch = false;
  private useAionuiWebFetch = false;
  private geminiModel: TProviderWithModel | null = null;
  private excludeTools: string[] = [];
  private dedicatedGeminiClient: GeminiClient | null = null;
  private dedicatedConfig: Config | null = null; // Config
  private webSearchEngine: 'google' | 'default' = 'default';
  private proxy: string = '';
  constructor(options: ConversationToolConfigOptions) {
    this.proxy = options.proxy;
    this.webSearchEngine = options.webSearchEngine ?? 'default';
  }

  /**
   * @param authType
   */
  async initializeForConversation(authType: AuthType): Promise<void> {
    this.useAionuiWebFetch = true;
    this.excludeTools.push('web_fetch');

    // gemini_web_search can only be used with Google OAuth auth, as it requires creating a Google OAuth client
    if (this.webSearchEngine === 'google') {
      if (authType === AuthType.LOGIN_WITH_GOOGLE || authType === AuthType.USE_VERTEX_AI) {
        // Google OAuth gemini_web_search
        // Only enable gemini_web_search for Google OAuth authentication
        this.useGeminiWebSearch = true;
        this.excludeTools.push('google_web_search'); // Google
      } else {
        // For all non-Google OAuth auth types (USE_OPENAI, USE_GEMINI, USE_ANTHROPIC, etc.),
        // don't enable gemini_web_search as it attempts to create a dedicated Google OAuth client
        this.useGeminiWebSearch = false;
      }
    }
    // webSearchEngine === 'default' Google
    // When webSearchEngine === 'default', don't enable Google search (useGeminiWebSearch stays false)
  }

  /**
   */
  private async findBestGeminiModel(): Promise<TProviderWithModel | null> {
    try {
      const hasGoogleAuth = this.webSearchEngine === 'google';
      if (hasGoogleAuth) {
        return {
          id: uuid(),
          name: 'Gemini Google Auth',
          platform: 'gemini-with-google-auth',
          baseUrl: '',
          apiKey: '',
          useModel: 'gemini-2.5-flash',
        };
      }

      return null;
    } catch (error) {
      console.error('[ConversationTools] Error finding Gemini model:', error);
      return null;
    }
  }

  /**
   * Gemini
   */
  private createDedicatedGeminiConfig(geminiModel: TProviderWithModel): Config {
    const runtimeDir = getGeminiWebSearchRuntimeDir();

    mkdirSync(runtimeDir, { recursive: true });

    return new Config({
      sessionId: 'gemini-websearch-' + Date.now(),
      // Keep Gemini tool sessions out of the repository tree so Bun does not
      // scan source and node_modules. Use the platform data directory so the
      // runtime location is stable across Electron and standalone server modes.
      targetDir: runtimeDir,
      cwd: runtimeDir,
      debugMode: false,
      question: '',
      // fullContext aioncli-core v0.18.4
      userMemory: '',
      geminiMdFileCount: 0,
      model: geminiModel.useModel,
    });
  }

  /**
   */
  getConfig() {
    return {
      useGeminiWebSearch: this.useGeminiWebSearch,
      useAionuiWebFetch: this.useAionuiWebFetch,
      geminiModel: this.geminiModel,
      excludeTools: this.excludeTools,
    };
  }

  /**
   */
  async registerCustomTools(config: Config, geminiClient: GeminiClient): Promise<void> {
    const toolRegistry = await config.getToolRegistry();

    // aionui_web_fetch
    if (this.useAionuiWebFetch) {
      const customWebFetchTool = new WebFetchTool(geminiClient, config.getMessageBus());
      toolRegistry.registerTool(customWebFetchTool);
    }

    // gemini_web_search
    if (this.useGeminiWebSearch) {
      try {
        // Config
        if (!this.dedicatedConfig) {
          const geminiModel = await this.findBestGeminiModel();
          if (geminiModel) {
            this.geminiModel = geminiModel;
            this.dedicatedConfig = this.createDedicatedGeminiConfig(geminiModel);
            const authType = AuthType.LOGIN_WITH_GOOGLE; // Google

            await this.dedicatedConfig.initialize();
            await this.dedicatedConfig.refreshAuth(authType);

            // GeminiClient
            this.dedicatedGeminiClient = this.dedicatedConfig.getGeminiClient();
          }
        }

        if (this.dedicatedConfig && this.dedicatedGeminiClient) {
          const customWebSearchTool = new WebSearchTool(this.dedicatedConfig, this.dedicatedConfig.getMessageBus());
          toolRegistry.registerTool(customWebSearchTool);
        }
      } catch (error) {
        console.warn('Failed to register gemini_web_search tool:', error);
      }
    }

    await geminiClient.setTools();
  }
}
