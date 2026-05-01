/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authentication module unified export entry
 *
 * Directory Structure:
 * - middleware/ :
 * - repository/ :
 * - service/ :
 */

// Middleware
export { AuthMiddleware } from './middleware/AuthMiddleware';
export { TokenMiddleware, TokenUtils, createAuthMiddleware } from './middleware/TokenMiddleware';
export type { TokenPayload } from './middleware/TokenMiddleware';

// Repository
export { UserRepository } from './repository/UserRepository';
export { RateLimitStore } from './repository/RateLimitStore';
export type { AuthUser } from './repository/UserRepository';

// Service
export { AuthService } from './service/AuthService';
