import { describe, it, expect } from 'vitest';
import { createError, mapWebAuthnError, getErrorMessage, isPasskeyError } from '../../packages/client/src/lib/errors';
import type { PasskeyError } from '../../packages/client/src/types';

describe('errors', () => {
  describe('createError', () => {
    it('should create a PasskeyError object', () => {
      const error = createError('NOT_SUPPORTED', 'WebAuthn not supported');
      expect(error.code).toBe('NOT_SUPPORTED');
      expect(error.message).toBe('WebAuthn not supported');
    });
  });

  describe('mapWebAuthnError', () => {
    it('should map NotSupportedError', () => {
      const webAuthnError = new Error('Not supported');
      webAuthnError.name = 'NotSupportedError';
      const error = mapWebAuthnError(webAuthnError);
      expect(error.code).toBe('NOT_SUPPORTED');
    });

    it('should map NotAllowedError to CANCELLED', () => {
      const webAuthnError = new Error('User cancelled');
      webAuthnError.name = 'NotAllowedError';
      const error = mapWebAuthnError(webAuthnError);
      expect(error.code).toBe('CANCELLED');
    });
  });

  describe('isPasskeyError', () => {
    it('should return true for valid PasskeyError', () => {
      const error: PasskeyError = { code: 'NOT_SUPPORTED', message: 'Test' };
      expect(isPasskeyError(error)).toBe(true);
    });

    it('should return false for non-PasskeyError', () => {
      expect(isPasskeyError(null)).toBe(false);
      expect(isPasskeyError('string')).toBe(false);
    });
  });
});
