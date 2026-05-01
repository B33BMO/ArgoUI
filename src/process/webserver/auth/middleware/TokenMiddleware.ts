/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'http';
import * as cookie from 'cookie';
import { AuthService } from '../service/AuthService';
import { UserRepository } from '../repository/UserRepository';
import { AUTH_CONFIG } from '../../config/constants';

/**
 * Token
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  username: string;
}

/**
 * Token - token
 * Token Extractor - Extract authentication token from request
 *
 * URL query token token Referrer
 * Security: URL query token is no longer supported to prevent token leakage via logs, Referrer, etc.
 */
class TokenExtractor {
  /**
   * token
   * 1. Authorization header (Bearer token)
   * 2. Cookie (aionui-session)
   *
   * Extract token from request, supporting these sources:
   * 1. Authorization header (Bearer token)
   * 2. Cookie (aionui-session)
   *
   * Express request object
   * Token string or null
   */
  static extract(req: Request): string | null {
    // Try to extract from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to extract from Cookie
    if (typeof req.cookies === 'object' && req.cookies) {
      const cookieToken = req.cookies[AUTH_CONFIG.COOKIE.NAME];
      if (typeof cookieToken === 'string' && cookieToken.trim() !== '') {
        return cookieToken;
      }
    }

    // URL query token
    // URL query token is no longer supported (security risk)

    return null;
  }
}

/**
 * Validation Strategy Interface - Define unauthorized handling
 */
interface ValidationStrategy {
  handleUnauthorized(res: Response): void;
}

/**
 * JSON Validation Strategy - Return JSON format error response
 */
class JsonValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).json({ success: false, error: 'Access denied. Please login first.' });
  }
}

/**
 * HTML Validation Strategy - Return HTML format error response
 */
class HtmlValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).send('Access Denied');
  }
}

/**
 * Validator Factory - Create validation strategy based on type
 */
class ValidatorFactory {
  /**
   * Create validation strategy
   * Strategy type (json or html)
   * Validation strategy instance
   */
  static create(type: 'json' | 'html'): ValidationStrategy {
    if (type === 'html') {
      return new HtmlValidationStrategy();
    }
    return new JsonValidationStrategy();
  }
}

/**
 * Create authentication middleware
 *
 * 1. token
 * 2. token
 *
 * This middleware performs the following steps:
 * 1. Extract token from request
 * 2. Verify token validity
 * 3. Find user information
 * 4. Attach user info to request object
 *
 * Response type (json or html)
 * Express middleware function
 */
export const createAuthMiddleware = (type: 'json' | 'html' = 'json') => {
  const strategy = ValidatorFactory.create(type);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. token / Extract token
    const token = TokenExtractor.extract(req);

    if (!token) {
      strategy.handleUnauthorized(res);
      return;
    }

    // 2. token / Verify token
    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      strategy.handleUnauthorized(res);
      return;
    }

    // Find user
    const user = await UserRepository.findById(decoded.userId);
    if (!user) {
      strategy.handleUnauthorized(res);
      return;
    }

    // Attach user info to request object
    req.user = {
      id: user.id,
      username: user.username,
    };

    next();
  };
};

/**
 * Token - token
 * Token Utils - Provide token related helper methods
 */
export const TokenUtils = {
  /**
   * token
   * Extract token from request
   * Express request object
   * Token string or null
   */
  extractFromRequest(req: Request): string | null {
    return TokenExtractor.extract(req);
  },
};

/**
 * TokenMiddleware Utility - Provides unified token authentication interface
 */
export const TokenMiddleware = {
  /*Extract token from request*/
  extractToken(req: Request): string | null {
    return TokenExtractor.extract(req);
  },

  /*Verify token validity*/
  async isTokenValid(token: string | null): Promise<boolean> {
    return Boolean(token && (await AuthService.verifyToken(token)));
  },

  /** / Return auth middleware (JSON response by default)*/
  validateToken(options?: {
    responseType?: 'json' | 'html';
  }): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return createAuthMiddleware(options?.responseType ?? 'json');
  },

  /**
   * WebSocket token
   * Extract token from WebSocket request
   *
   * URL query token token Referrer
   * Security: URL query token is no longer supported to prevent token leakage via logs, Referrer, etc.
   */
  extractWebSocketToken(req: IncomingMessage): string | null {
    // 1. Authorization header
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Cookie
    const cookieHeader = req.headers['cookie'];
    if (typeof cookieHeader === 'string') {
      const cookies = cookie.parse(cookieHeader);
      const cookieToken = cookies[AUTH_CONFIG.COOKIE.NAME];
      if (cookieToken) {
        return cookieToken;
      }
    }

    // 3. sec-websocket-protocol
    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (typeof protocolHeader === 'string' && protocolHeader.trim() !== '') {
      return protocolHeader.split(',')[0]?.trim() ?? null;
    }

    // URL query token
    // URL query token is no longer supported (security risk)

    return null;
  },

  /*Validate WebSocket token*/
  async validateWebSocketToken(token: string | null): Promise<boolean> {
    return Boolean(token && (await AuthService.verifyWebSocketToken(token)));
  },
};
