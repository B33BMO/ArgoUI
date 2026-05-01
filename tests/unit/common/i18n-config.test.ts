/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SUPPORTED_LANGUAGES } from '@/common/config/i18n';

describe('i18n config', () => {
  it('should include en-US in supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en-US');
  });

  it('should have en-US as the only language in this US-only build', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en-US']);
  });
});
