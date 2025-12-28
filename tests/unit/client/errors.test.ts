import { describe, it, expect } from 'vitest';
import {
  createError,
  mapWebAuthnError,
  getErrorMessage,
  isPasskeyError,
} from '../../../packages/client/src/lib/errors';
import type { PasskeyErrorCode } from '../../../packages/client/src/types';

describe('Error Handling', () => {
  describe('createError', () => {
    it('should return correct structure with all fields', () => {
      const error = createError('NOT_SUPPORTED', 'Test message', new Error('cause'));

      expect(error).toEqual({
        code: 'NOT_SUPPORTED',
        message: 'Test message',
        cause: expect.any(Error),
      });
    });

    it('should work without cause', () => {
      const error = createError('CANCELLED', 'User cancelled');

      expect(error).toEqual({
        code: 'CANCELLED',
        message: 'User cancelled',
        cause: undefined,
      });
    });
  });

  describe('mapWebAuthnError', () => {
    it('should map NotSupportedError to NOT_SUPPORTED', () => {
      const originalError = new Error('Not supported');
      originalError.name = 'NotSupportedError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('NOT_SUPPORTED');
      expect(result.cause).toBe(originalError);
    });

    it('should map NotAllowedError to CANCELLED', () => {
      const originalError = new Error('User denied');
      originalError.name = 'NotAllowedError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('CANCELLED');
    });

    it('should map NotAllowedError with timeout message to TIMEOUT', () => {
      const originalError = new Error('A timeout occurred during the request');
      originalError.name = 'NotAllowedError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('TIMEOUT');
    });

    it('should map InvalidStateError to INVALID_STATE', () => {
      const originalError = new Error('Credential exists');
      originalError.name = 'InvalidStateError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('INVALID_STATE');
    });

    it('should map SecurityError to SECURITY_ERROR', () => {
      const originalError = new Error('Security violation');
      originalError.name = 'SecurityError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('SECURITY_ERROR');
    });

    it('should map AbortError to CANCELLED', () => {
      const originalError = new Error('Aborted');
      originalError.name = 'AbortError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('CANCELLED');
    });

    it('should map TypeError with fetch message to NETWORK_ERROR', () => {
      const originalError = new TypeError('Failed to fetch');
      originalError.name = 'TypeError';

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should map unknown errors to UNKNOWN_ERROR', () => {
      const originalError = new Error('Something went wrong');

      const result = mapWebAuthnError(originalError);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle non-Error objects', () => {
      const result = mapWebAuthnError('string error');

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('An unknown error occurred.');
    });

    it('should handle null', () => {
      const result = mapWebAuthnError(null);

      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle undefined', () => {
      const result = mapWebAuthnError(undefined);

      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getErrorMessage', () => {
    const errorCodes: PasskeyErrorCode[] = [
      'NOT_SUPPORTED',
      'CANCELLED',
      'TIMEOUT',
      'INVALID_STATE',
      'SECURITY_ERROR',
      'CHALLENGE_EXPIRED',
      'CHALLENGE_MISMATCH',
      'VERIFICATION_FAILED',
      'CREDENTIAL_NOT_FOUND',
      'USER_NOT_FOUND',
      'CREDENTIAL_EXISTS',
      'RATE_LIMITED',
      'NETWORK_ERROR',
      'UNKNOWN_ERROR',
    ];

    it.each(errorCodes)('should return user-friendly message for %s', (code) => {
      const message = getErrorMessage(code);

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return UNKNOWN_ERROR message for unrecognized codes', () => {
      const message = getErrorMessage('FAKE_CODE' as PasskeyErrorCode);

      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('isPasskeyError', () => {
    it('should return true for valid PasskeyError objects', () => {
      const error = { code: 'NOT_SUPPORTED', message: 'Test' };

      expect(isPasskeyError(error)).toBe(true);
    });

    it('should return true for PasskeyError with cause', () => {
      const error = { code: 'CANCELLED', message: 'Test', cause: new Error() };

      expect(isPasskeyError(error)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPasskeyError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPasskeyError(undefined)).toBe(false);
    });

    it('should return false for strings', () => {
      expect(isPasskeyError('error')).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isPasskeyError(123)).toBe(false);
    });

    it('should return false for objects without code', () => {
      expect(isPasskeyError({ message: 'Test' })).toBe(false);
    });

    it('should return false for objects without message', () => {
      expect(isPasskeyError({ code: 'NOT_SUPPORTED' })).toBe(false);
    });

    it('should return false for objects with non-string code', () => {
      expect(isPasskeyError({ code: 123, message: 'Test' })).toBe(false);
    });

    it('should return false for objects with non-string message', () => {
      expect(isPasskeyError({ code: 'NOT_SUPPORTED', message: 123 })).toBe(false);
    });

    it('should return false for regular Error objects', () => {
      expect(isPasskeyError(new Error('Test'))).toBe(false);
    });
  });
});
