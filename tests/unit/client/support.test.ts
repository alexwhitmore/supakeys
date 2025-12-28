import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  isConditionalUISupported,
  getPasskeySupport,
  isSecureContext,
  getUnsupportedReason,
} from '../../../packages/client/src/lib/support';

describe('Support Detection', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('isWebAuthnSupported', () => {
    it('should return false in non-browser environment', () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      expect(isWebAuthnSupported()).toBe(false);
    });

    it('should return false when PublicKeyCredential is missing', () => {
      // @ts-expect-error - mocking window
      global.window = {
        navigator: { credentials: {} },
      };

      expect(isWebAuthnSupported()).toBe(false);
    });

    it('should return false when navigator is missing', () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {},
      };

      expect(isWebAuthnSupported()).toBe(false);
    });

    it('should return false when credentials is missing', () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {},
        navigator: {},
      };

      expect(isWebAuthnSupported()).toBe(false);
    });

    it('should return true when WebAuthn is available', () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {},
        navigator: { credentials: {} },
      };

      expect(isWebAuthnSupported()).toBe(true);
    });
  });

  describe('isPlatformAuthenticatorAvailable', () => {
    it('should return false when WebAuthn is not supported', async () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });

    it('should return false when API throws', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(new Error('API error')),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });

    it('should return true when platform authenticator is available', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(true);
    });

    it('should return false when platform authenticator is not available', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });
  });

  describe('isConditionalUISupported', () => {
    it('should return false when WebAuthn is not supported', async () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      const result = await isConditionalUISupported();

      expect(result).toBe(false);
    });

    it('should return false when API is not available', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {},
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isConditionalUISupported();

      expect(result).toBe(false);
    });

    it('should return false when API throws', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isConditionalMediationAvailable: vi.fn().mockRejectedValue(new Error('API error')),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isConditionalUISupported();

      expect(result).toBe(false);
    });

    it('should return true when conditional UI is supported', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isConditionalMediationAvailable: vi.fn().mockResolvedValue(true),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await isConditionalUISupported();

      expect(result).toBe(true);
    });
  });

  describe('getPasskeySupport', () => {
    it('should return all false when WebAuthn is not supported', async () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      const result = await getPasskeySupport();

      expect(result).toEqual({
        webauthn: false,
        platformAuthenticator: false,
        conditionalUI: false,
      });
    });

    it('should return correct support status', async () => {
      // @ts-expect-error - mocking window
      global.window = {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
          isConditionalMediationAvailable: vi.fn().mockResolvedValue(false),
        },
        navigator: { credentials: {} },
      };
      // @ts-expect-error - mocking global
      global.PublicKeyCredential = global.window.PublicKeyCredential;

      const result = await getPasskeySupport();

      expect(result).toEqual({
        webauthn: true,
        platformAuthenticator: true,
        conditionalUI: false,
      });
    });
  });

  describe('isSecureContext', () => {
    it('should return false in non-browser environment', () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      expect(isSecureContext()).toBe(false);
    });

    it('should return false for non-HTTPS', () => {
      // @ts-expect-error - mocking window
      global.window = { isSecureContext: false };

      expect(isSecureContext()).toBe(false);
    });

    it('should return true for secure context', () => {
      // @ts-expect-error - mocking window
      global.window = { isSecureContext: true };

      expect(isSecureContext()).toBe(true);
    });
  });

  describe('getUnsupportedReason', () => {
    it('should return message for non-browser environment', () => {
      // @ts-expect-error - setting window to undefined for testing
      global.window = undefined;

      const reason = getUnsupportedReason();

      expect(reason).toBe('Passkeys are only available in browser environments.');
    });

    it('should return message for non-secure context', () => {
      // @ts-expect-error - mocking window
      global.window = {
        isSecureContext: false,
        PublicKeyCredential: {},
        navigator: { credentials: {} },
      };

      const reason = getUnsupportedReason();

      expect(reason).toBe('Passkeys require a secure connection (HTTPS).');
    });

    it('should return message when WebAuthn is not supported', () => {
      // @ts-expect-error - mocking window
      global.window = {
        isSecureContext: true,
        navigator: {},
      };

      const reason = getUnsupportedReason();

      expect(reason).toBe('Your browser does not support passkeys. Please update to a modern browser.');
    });

    it('should return null when everything is supported', () => {
      // @ts-expect-error - mocking window
      global.window = {
        isSecureContext: true,
        PublicKeyCredential: {},
        navigator: { credentials: {} },
      };

      const reason = getUnsupportedReason();

      expect(reason).toBeNull();
    });
  });
});
