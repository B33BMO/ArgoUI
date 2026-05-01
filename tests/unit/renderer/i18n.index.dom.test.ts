import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnLanguageChanged = vi.hoisted(() => ({
  handler: undefined as ((payload: { language: string }) => Promise<void>) | undefined,
}));
const mockConfigStorageGet = vi.hoisted(() => vi.fn());
const mockConfigStorageSet = vi.hoisted(() => vi.fn());
const mockChangeLanguageInvoke = vi.hoisted(() => vi.fn());
const mockI18n = vi.hoisted(() => {
  const instance = {
    language: 'en-US',
    use: vi.fn(() => instance),
    init: vi.fn(async () => undefined),
    on: vi.fn((event: string, handler: (lang: string) => Promise<void>) => {
      if (event === 'languageChanged') {
        instance.languageChangedHandler = handler;
      }
      return instance;
    }),
    hasResourceBundle: vi.fn(() => false),
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn(async (lang: string) => {
      instance.language = lang;
      return undefined;
    }),
    languageChangedHandler: undefined as ((lang: string) => Promise<void>) | undefined,
  };

  return instance;
});

vi.mock('i18next', () => ({
  default: mockI18n,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: mockConfigStorageGet,
    set: mockConfigStorageSet,
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    systemSettings: {
      languageChanged: {
        on: (handler: (payload: { language: string }) => Promise<void>) => {
          mockOnLanguageChanged.handler = handler;
        },
      },
      changeLanguage: {
        invoke: mockChangeLanguageInvoke,
      },
    },
  },
}));

describe('renderer i18n localStorage guards', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockI18n.language = 'en-US';
    mockI18n.languageChangedHandler = undefined;
    // US-only build collapses any saved non-en-US language back to en-US.
    mockConfigStorageGet.mockResolvedValue('ja-JP');
    mockConfigStorageSet.mockResolvedValue(undefined);
    mockChangeLanguageInvoke.mockResolvedValue(undefined);
    mockOnLanguageChanged.handler = undefined;

    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'en-US' },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes without localStorage and falls back to en-US (US-only build)', async () => {
    await import('@/renderer/services/i18n');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockI18n.init).toHaveBeenCalledWith(
      expect.objectContaining({
        lng: 'en-US',
      })
    );
    // Any saved language is normalized to en-US in this build.
    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('en-US');
  });

  it('main-process language broadcasts collapse to en-US without touching localStorage', async () => {
    await import('@/renderer/services/i18n');
    await Promise.resolve();

    await mockOnLanguageChanged.handler?.({ language: 'ko-KR' });

    // The renderer normalizes any incoming non-en-US language to en-US, and skips
    // the change since i18n is already on en-US — so changeLanguage is NOT called again.
    expect(mockI18n.changeLanguage).not.toHaveBeenCalledWith('ko-KR');
  });

  it('persists language through ConfigStorage (always en-US in US-only build)', async () => {
    const module = await import('@/renderer/services/i18n');
    await Promise.resolve();

    await module.changeLanguage('tr');

    expect(mockConfigStorageSet).toHaveBeenCalledWith('language', 'en-US');
    expect(mockChangeLanguageInvoke).toHaveBeenCalledWith({ language: 'en-US' });
  });
});
