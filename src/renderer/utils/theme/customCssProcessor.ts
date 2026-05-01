/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CSS !important
 */

/**
 * CSS !important
 * @param css - CSS
 * @returns CSS
 */
export const addImportantToAll = (css: string): string => {
  if (!css || !css.trim()) {
    return '';
  }

  return css.replace(/([a-zA-Z-]+)\s*:\s*([^;!}]+);/g, (match, property, value) => {
    const trimmedValue = value.trim();
    // !important
    if (trimmedValue.endsWith('!important')) {
      return match;
    }
    // !important
    return `${property}: ${trimmedValue} !important;`;
  });
};

/**
 * @param css - CSS
 * @returns CSS
 */
export const wrapCustomCss = (css: string): string => {
  if (!css || !css.trim()) {
    return '';
  }

  return `
/*- !important*/
/* User Custom Styles - Auto !important for highest priority */
${css}
  `.trim();
};

/**
 * @param css - CSS
 * @returns CSS
 */
export const processCustomCss = (css: string): string => {
  const processed = addImportantToAll(css);
  return wrapCustomCss(processed);
};

/**
 * @param css - CSS
 * @returns CSS
 */
export const validateCss = (css: string): { valid: boolean; error?: string } => {
  if (!css || !css.trim()) {
    return { valid: true };
  }

  try {
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      return {
        valid: false,
        error: 'Unmatched braces: { and } count does not match',
      };
    }

    if (openBraces > 0 && !css.includes(':')) {
      return {
        valid: false,
        error: 'Invalid CSS: no property declarations found',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
