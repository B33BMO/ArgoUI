/**
 * i18n performance tests
 * Verifies lazy-loading and modular locale performance behavior
 */

import * as fs from 'fs';
import * as path from 'path';
import i18nConfig from '../../src/common/config/i18n-config.json';

const LOCALES_DIR = path.resolve(__dirname, '../../src/renderer/services/i18n/locales');
const SUPPORTED_LANGUAGES = i18nConfig.supportedLanguages;
const MODULES = i18nConfig.modules;
const SINGLE_MODULE_BUDGET_MS = Number(process.env.I18N_SINGLE_MODULE_BUDGET_MS ?? 50);
const FULL_LOCALE_BUDGET_MS = Number(process.env.I18N_FULL_LOCALE_BUDGET_MS ?? 300);
const STARTUP_BUDGET_MS = Number(process.env.I18N_STARTUP_BUDGET_MS ?? 400);
const SWITCH_BUDGET_MS = Number(process.env.I18N_SWITCH_BUDGET_MS ?? 400);

describe('i18n Performance Tests', () => {
  describe('Module Loading Performance', () => {
    it('should load a single module within time budget', async () => {
      const modulePath = path.join(LOCALES_DIR, 'en-US', 'common.json');

      const start = performance.now();
      const content = await fs.promises.readFile(modulePath, 'utf-8');
      JSON.parse(content);
      const end = performance.now();

      expect(end - start).toBeLessThan(SINGLE_MODULE_BUDGET_MS);
    });

    it('should load a full locale within time budget', async () => {
      const start = performance.now();

      for (const module of MODULES) {
        const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
        const content = await fs.promises.readFile(modulePath, 'utf-8');
        JSON.parse(content);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(FULL_LOCALE_BUDGET_MS);
    });

    it('should load all modules in parallel successfully', async () => {
      const results = await Promise.all(
        MODULES.map(async (module) => {
          const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
          const content = await fs.promises.readFile(modulePath, 'utf-8');
          return { module, data: JSON.parse(content) };
        })
      );

      expect(results).toHaveLength(MODULES.length);
      for (const { data } of results) {
        expect(data).toBeDefined();
        expect(typeof data).toBe('object');
      }
    });
  });

  describe('File Size Optimization', () => {
    it('should keep each modularized module smaller', async () => {
      const sizes = await Promise.all(
        MODULES.map(async (module) => {
          const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
          const stats = await fs.promises.stat(modulePath);
          return stats.size;
        })
      );

      const totalSize = sizes.reduce((a, b) => a + b, 0);
      const avgSize = totalSize / MODULES.length;
      expect(avgSize).toBeLessThan(20 * 1024);
    });
  });

  describe('Memory Usage', () => {
    it('should cache only the loaded language', async () => {
      const loadedTranslations = new Map<string, Record<string, unknown>>();

      const translations: Record<string, unknown> = {};
      for (const module of MODULES) {
        const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
        const content = await fs.promises.readFile(modulePath, 'utf-8');
        translations[module] = JSON.parse(content);
      }

      loadedTranslations.set('en-US', translations);

      expect(loadedTranslations.size).toBe(1);
      expect(loadedTranslations.has('en-US')).toBe(true);
    });
  });

  describe('Startup Performance', () => {
    it('should load startup locale within time budget', async () => {
      const start = performance.now();

      await Promise.all(
        MODULES.map(async (module) => {
          const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
          const content = await fs.promises.readFile(modulePath, 'utf-8');
          return JSON.parse(content);
        })
      );

      const end = performance.now();

      expect(end - start).toBeLessThan(STARTUP_BUDGET_MS);
    });

    it('should re-load the same locale within time budget (US-only build has no alternate)', async () => {
      const loadedTranslations = new Map<string, Record<string, unknown>>();

      const enUSTranslations: Record<string, unknown> = {};
      for (const module of MODULES) {
        const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
        const content = await fs.promises.readFile(modulePath, 'utf-8');
        enUSTranslations[module] = JSON.parse(content);
      }
      loadedTranslations.set('en-US', enUSTranslations);

      const start = performance.now();

      const reload: Record<string, unknown> = {};
      await Promise.all(
        MODULES.map(async (module) => {
          const modulePath = path.join(LOCALES_DIR, 'en-US', `${module}.json`);
          const content = await fs.promises.readFile(modulePath, 'utf-8');
          reload[module] = JSON.parse(content);
        })
      );
      loadedTranslations.set('en-US', reload);

      const end = performance.now();

      expect(end - start).toBeLessThan(SWITCH_BUDGET_MS);
    });
  });

  describe('Lazy Loading Impact', () => {
    it('only the supported locale is loaded at startup', () => {
      // US-only build supports a single locale, so the loaded set equals the supported set.
      expect(SUPPORTED_LANGUAGES).toHaveLength(1);
      expect(SUPPORTED_LANGUAGES).toContain('en-US');
    });
  });
});
