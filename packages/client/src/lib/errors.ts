import type { PasskeyError, PasskeyErrorCode } from '../types';

export function createError(
  code: PasskeyErrorCode,
  message: string,
  cause?: unknown
): PasskeyError {
  return { code, message, cause };
}

export function mapWebAuthnError(error: unknown): PasskeyError {
  if (error instanceof Error) {
    const name = error.name;
    const message = error.message;

    switch (name) {
      case 'NotSupportedError':
        return createError(
          'NOT_SUPPORTED',
          'WebAuthn is not supported in this browser or context.',
          error
        );

      case 'NotAllowedError':
        if (message.toLowerCase().includes('timeout')) {
          return createError('TIMEOUT', 'The operation timed out. Please try again.', error);
        }
        return createError('CANCELLED', 'The operation was cancelled.', error);

      case 'InvalidStateError':
        return createError(
          'INVALID_STATE',
          'A passkey for this account already exists on this device.',
          error
        );

      case 'SecurityError':
        return createError(
          'SECURITY_ERROR',
          'The operation was blocked due to security restrictions.',
          error
        );

      case 'AbortError':
        return createError('CANCELLED', 'The operation was aborted.', error);

      case 'TypeError':
        if (message.toLowerCase().includes('fetch')) {
          return createError(
            'NETWORK_ERROR',
            'Network request failed. Please check your connection.',
            error
          );
        }
        break;
    }
  }

  return createError(
    'UNKNOWN_ERROR',
    error instanceof Error ? error.message : 'An unknown error occurred.',
    error
  );
}

export function getErrorMessage(code: PasskeyErrorCode): string {
  const messages: Record<PasskeyErrorCode, string> = {
    NOT_SUPPORTED: 'Passkeys are not supported on this device or browser.',
    INVALID_INPUT: 'Invalid input provided.',
    CANCELLED: 'The operation was cancelled.',
    TIMEOUT: 'The operation timed out. Please try again.',
    INVALID_STATE: 'A passkey for this account already exists on this device.',
    SECURITY_ERROR: 'The operation was blocked due to security restrictions.',
    CHALLENGE_EXPIRED: 'Your session has expired. Please try again.',
    CHALLENGE_MISMATCH: 'Verification failed. Please try again.',
    VERIFICATION_FAILED: 'Authentication failed. Please try again.',
    CREDENTIAL_NOT_FOUND: 'Passkey not found. It may have been removed.',
    USER_NOT_FOUND: 'Account not found.',
    CREDENTIAL_EXISTS: 'This passkey is already registered.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  };

  return messages[code] || messages.UNKNOWN_ERROR;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateEmail(email: unknown): { valid: true } | { valid: false; message: string } {
  if (email === null || email === undefined) {
    return { valid: false, message: 'Email is required' };
  }
  if (typeof email !== 'string') {
    return { valid: false, message: 'Email must be a string' };
  }
  if (email.trim() === '') {
    return { valid: false, message: 'Email cannot be empty' };
  }
  if (!isValidEmail(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  return { valid: true };
}

export function validateCredentialId(credentialId: unknown): { valid: true } | { valid: false; message: string } {
  if (credentialId === null || credentialId === undefined) {
    return { valid: false, message: 'Credential ID is required' };
  }
  if (typeof credentialId !== 'string') {
    return { valid: false, message: 'Credential ID must be a string' };
  }
  if (credentialId.trim() === '') {
    return { valid: false, message: 'Credential ID cannot be empty' };
  }
  return { valid: true };
}

export function validateAuthenticatorName(name: unknown): { valid: true } | { valid: false; message: string } {
  if (name === null || name === undefined) {
    return { valid: false, message: 'Authenticator name is required' };
  }
  if (typeof name !== 'string') {
    return { valid: false, message: 'Authenticator name must be a string' };
  }
  if (name.trim() === '') {
    return { valid: false, message: 'Authenticator name cannot be empty' };
  }
  return { valid: true };
}

export function isPasskeyError(error: unknown): error is PasskeyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as PasskeyError).code === 'string' &&
    typeof (error as PasskeyError).message === 'string'
  );
}
