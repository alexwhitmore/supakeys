import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createServiceClient,
  callPasskeyFunction,
  cleanupAll,
  generateTestEmail,
  getChallenge,
  getAuditLogs,
} from '../helpers/supabase';

describe('Authentication Flow', () => {
  const serviceClient = createServiceClient();

  beforeAll(async () => {
    const { data, error } = await serviceClient.from('passkey_challenges').select('count');
    if (error) {
      throw new Error(`Supabase not available: ${error.message}. Run 'supabase start' first.`);
    }
  });

  beforeEach(async () => {
    await cleanupAll(serviceClient);
  });

  afterAll(async () => {
    await cleanupAll(serviceClient);
  });

  async function createUserWithPasskey() {
    const email = generateTestEmail();

    const { data: user } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    const credentialId = `cred-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await serviceClient.from('passkey_credentials').insert({
      id: credentialId,
      user_id: user.user.id,
      webauthn_user_id: `webauthn-${Date.now()}`,
      public_key: '\\x' + '00'.repeat(65),
      counter: 0,
      device_type: 'multiDevice',
      backed_up: false,
    });

    return { user: user.user, email, credentialId };
  }

  describe('Authentication Start', () => {
    it('should create authentication options for user with passkey', async () => {
      const { email } = await createUserWithPasskey();

      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
      expect(result.data).toHaveProperty('options');
      expect(result.data.options).toHaveProperty('challenge');
      expect(result.data.options).toHaveProperty('allowCredentials');
    });

    it('should store authentication challenge in database', async () => {
      const { email } = await createUserWithPasskey();

      const result = await callPasskeyFunction('/login/start', { email });

      const { data: challenge } = await getChallenge(serviceClient, result.data.challengeId);

      expect(challenge).not.toBeNull();
      expect(challenge.type).toBe('authentication');
    });

    it('should include user credentials in allowCredentials', async () => {
      const { email, credentialId } = await createUserWithPasskey();

      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.data.options.allowCredentials).toBeDefined();
      expect(result.data.options.allowCredentials.length).toBeGreaterThan(0);
    });

    it('should log authentication_started audit event', async () => {
      const { email } = await createUserWithPasskey();

      await callPasskeyFunction('/login/start', { email });

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'authentication_started',
        email,
        limit: 1,
      });

      expect(logs).toHaveLength(1);
    });

    it('should return error for non-existent email', async () => {
      const email = generateTestEmail();

      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREDENTIAL_NOT_FOUND');
    });

    it('should return error for user with no passkeys', async () => {
      const email = generateTestEmail();

      await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREDENTIAL_NOT_FOUND');
    });
  });

  describe('Authentication Verification', () => {
    it('should reject invalid signature', async () => {
      const { email, credentialId } = await createUserWithPasskey();

      const startResult = await callPasskeyFunction('/login/start', { email });
      const challengeId = startResult.data.challengeId;

      const result = await callPasskeyFunction('/login/finish', {
        challengeId,
        response: {
          id: credentialId,
          rawId: credentialId,
          type: 'public-key',
          response: {
            clientDataJSON: btoa(JSON.stringify({ type: 'webauthn.get', challenge: '', origin: 'http://localhost:3000' })),
            authenticatorData: 'invalid-auth-data',
            signature: 'invalid-signature',
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it('should log authentication_failed on verification failure', async () => {
      const { email, credentialId } = await createUserWithPasskey();

      const startResult = await callPasskeyFunction('/login/start', { email });
      const challengeId = startResult.data.challengeId;

      await callPasskeyFunction('/login/finish', {
        challengeId,
        response: {
          id: credentialId,
          rawId: credentialId,
          type: 'public-key',
          response: {
            clientDataJSON: '',
            authenticatorData: '',
            signature: '',
          },
        },
      });

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'authentication_failed',
        email,
        limit: 1,
      });

      expect(logs).toHaveLength(1);
    });

    it('should reject non-existent credential', async () => {
      const { email } = await createUserWithPasskey();

      const startResult = await callPasskeyFunction('/login/start', { email });
      const challengeId = startResult.data.challengeId;

      const result = await callPasskeyFunction('/login/finish', {
        challengeId,
        response: {
          id: 'non-existent-credential',
          rawId: 'non-existent-credential',
          type: 'public-key',
          response: {
            clientDataJSON: '',
            authenticatorData: '',
            signature: '',
          },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Discoverable Credentials', () => {
    it('should support authentication without email', async () => {
      await createUserWithPasskey();

      const result = await callPasskeyFunction('/login/start', {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
      expect(result.data.options.allowCredentials).toBeUndefined();
    });
  });
});
