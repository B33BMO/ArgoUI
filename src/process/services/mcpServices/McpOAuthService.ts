/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { MCPOAuthProvider, OAUTH_DISPLAY_MESSAGE_EVENT } from '@office-ai/aioncli-core/dist/src/mcp/oauth-provider.js';
import { MCPOAuthTokenStorage } from '@office-ai/aioncli-core/dist/src/mcp/oauth-token-storage.js';
import type { MCPOAuthConfig } from '@office-ai/aioncli-core/dist/src/mcp/oauth-provider.js';
import { EventEmitter } from 'node:events';
import type { IMcpServer } from '@/common/config/storage';

export interface OAuthStatus {
  isAuthenticated: boolean;
  needsLogin: boolean;
  error?: string;
}

/**
 * MCP OAuth
 *
 * @office-ai/aioncli-core OAuth
 */
export class McpOAuthService {
  private oauthProvider: MCPOAuthProvider;
  private tokenStorage: MCPOAuthTokenStorage;
  private eventEmitter: EventEmitter;

  constructor() {
    this.tokenStorage = new MCPOAuthTokenStorage();
    this.oauthProvider = new MCPOAuthProvider(this.tokenStorage);
    this.eventEmitter = new EventEmitter();

    this.eventEmitter.on(OAUTH_DISPLAY_MESSAGE_EVENT, (message: string) => {
      console.log('[McpOAuthService] OAuth Message:', message);
    });
  }

  /**
   */
  async checkOAuthStatus(server: IMcpServer): Promise<OAuthStatus> {
    try {
      if (server.transport.type !== 'http' && server.transport.type !== 'sse') {
        return {
          isAuthenticated: true,
          needsLogin: false,
        };
      }

      const url = server.transport.url;
      if (!url) {
        return {
          isAuthenticated: false,
          needsLogin: false,
          error: 'No URL provided',
        };
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      // 401 Unauthorized
      if (response.status === 401) {
        const wwwAuthenticate = response.headers.get('WWW-Authenticate');

        if (wwwAuthenticate) {
          // OAuth
          // token
          const credentials = await this.tokenStorage.getCredentials(server.name);

          if (credentials && credentials.token) {
            // token
            const isExpired = this.tokenStorage.isTokenExpired(credentials.token);

            return {
              isAuthenticated: !isExpired,
              needsLogin: isExpired,
              error: isExpired ? 'Token expired' : undefined,
            };
          }

          // token
          return {
            isAuthenticated: false,
            needsLogin: true,
          };
        }
      }

      return {
        isAuthenticated: true,
        needsLogin: false,
      };
    } catch (error) {
      console.error('[McpOAuthService] Error checking OAuth status:', error);
      return {
        isAuthenticated: false,
        needsLogin: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * OAuth
   */
  async login(server: IMcpServer, oauthConfig?: MCPOAuthConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (server.transport.type !== 'http' && server.transport.type !== 'sse') {
        return {
          success: false,
          error: 'OAuth only supported for HTTP/SSE transport',
        };
      }

      const url = server.transport.url;
      if (!url) {
        return {
          success: false,
          error: 'No URL provided',
        };
      }

      let config = oauthConfig;
      if (!config) {
        // OAuth provider
        config = {
          enabled: true,
        };
      }

      // OAuth
      await this.oauthProvider.authenticate(server.name, config, url);

      console.log(`[McpOAuthService] OAuth login successful for ${server.name}`);
      return { success: true };
    } catch (error) {
      console.error('[McpOAuthService] OAuth login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * token
   */
  async getValidToken(server: IMcpServer, oauthConfig?: MCPOAuthConfig): Promise<string | null> {
    try {
      const config = oauthConfig || { enabled: true };
      return await this.oauthProvider.getValidToken(server.name, config);
    } catch (error) {
      console.error('[McpOAuthService] Failed to get valid token:', error);
      return null;
    }
  }

  /**
   */
  async logout(serverName: string): Promise<void> {
    try {
      await this.tokenStorage.deleteCredentials(serverName);
      console.log(`[McpOAuthService] Logged out from ${serverName}`);
    } catch (error) {
      console.error('[McpOAuthService] Failed to logout:', error);
      throw error;
    }
  }

  /**
   */
  async getAuthenticatedServers(): Promise<string[]> {
    try {
      return await this.tokenStorage.listServers();
    } catch (error) {
      console.error('[McpOAuthService] Failed to list servers:', error);
      return [];
    }
  }

  /**
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}

export const mcpOAuthService = new McpOAuthService();
