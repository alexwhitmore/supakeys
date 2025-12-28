import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for input validation in PasskeyAuth methods.
 * These ensure users get clear error messages for invalid inputs.
 */
describe('Input Validation', () => {
  describe('register() validation', () => {
    it('should reject empty email', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.register({ email: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should reject invalid email format', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.register({ email: 'not-an-email' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should reject null email', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.register({ email: null as any });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('signIn() validation', () => {
    it('should accept empty email for discoverable flow', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn().mockResolvedValue({
          data: { success: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'Test' } },
          error: null
        }) },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      // Should not throw for empty email (discoverable flow)
      const result = await passkeys.signIn({});

      // Will fail at edge function level, but input validation should pass
      expect(result.error?.code).not.toBe('INVALID_INPUT');
    });

    it('should reject invalid email format when provided', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.signIn({ email: 'not-an-email' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('updatePasskey() validation', () => {
    it('should reject empty credentialId', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.updatePasskey({
        credentialId: '',
        authenticatorName: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should reject empty authenticatorName', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.updatePasskey({
        credentialId: 'abc123',
        authenticatorName: ''
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('removePasskey() validation', () => {
    it('should reject empty credentialId', async () => {
      const mockSupabase = {
        functions: { invoke: vi.fn() },
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      };

      const { createPasskeyAuth } = await import('../../../packages/client/src/lib/passkey-auth');
      const passkeys = createPasskeyAuth(mockSupabase as any);

      const result = await passkeys.removePasskey({ credentialId: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });
});
