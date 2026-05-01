/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, normalizeLanguageCode } from '@/common/config/i18n';

describe('common i18n config module', () => {
  it('should have en-US as the only supported language in this US-only build', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en-US']);
  });

  it('should normalize unsupported languages to the en-US default', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en-US');
    expect(normalizeLanguageCode('en')).toBe('en-US');
    expect(normalizeLanguageCode('uk-UA')).toBe('en-US');
    expect(normalizeLanguageCode('zh-CN')).toBe('en-US');
  });
});
