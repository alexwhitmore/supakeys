import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createServiceClient,
  callPasskeyFunction,
  cleanupAll,
  generateTestEmail,
  getChallenge,
  getCredential,
  getAuditLogs,
} from '../helpers/supabase';

describe('Registration Flow', () => {
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

  describe('Registration Start', () => {
    it('should create registration options for new user', async () => {
      const email = generateTestEmail();

      const result = await callPasskeyFunction('/register/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
      expect(result.data).toHaveProperty('options');
      expect(result.data.options).toHaveProperty('challenge');
      expect(result.data.options).toHaveProperty('rp');
      expect(result.data.options).toHaveProperty('user');
      expect(result.data.options).toHaveProperty('pubKeyCredParams');
      expect(result.data.options.user.name).toBe(email);
    });

    it('should store challenge in database', async () => {
      const email = generateTestEmail();

      const result = await callPasskeyFunction('/register/start', { email });

      const { data: challenge } = await getChallenge(serviceClient, result.data.challengeId);

      expect(challenge).not.toBeNull();
      expect(challenge.email).toBe(email);
      expect(challenge.type).toBe('registration');
      expect(challenge.webauthn_user_id).toBeDefined();
    });

    it('should log registration_started audit event', async () => {
      const email = generateTestEmail();

      await callPasskeyFunction('/register/start', { email });

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'registration_started',
        email,
        limit: 1,
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].email).toBe(email);
    });

    it('should include excludeCredentials for existing user', async () => {
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'existing-credential',
        user_id: user.user.id,
        webauthn_user_id: 'existing-webauthn-id',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const result = await callPasskeyFunction('/register/start', { email });

      expect(result.success).toBe(true);
      expect(result.data.options.excludeCredentials).toBeDefined();
      expect(result.data.options.excludeCredentials.length).toBeGreaterThan(0);
    });

    it('should reject empty email', async () => {
      const result = await callPasskeyFunction('/register/start', { email: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject missing email', async () => {
      const result = await callPasskeyFunction('/register/start', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Registration Verification', () => {
    it('should reject invalid attestation object', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      const challengeId = startResult.data.challengeId;

      const result = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: {
          id: 'fake-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: btoa(JSON.stringify({ type: 'webauthn.create', challenge: '', origin: 'http://localhost:3000' })),
            attestationObject: 'invalid-attestation',
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it('should log registration_failed on verification failure', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      const challengeId = startResult.data.challengeId;

      await callPasskeyFunction('/register/finish', {
        challengeId,
        response: {
          id: 'fake-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: '',
            attestationObject: '',
          },
        },
      });

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'registration_failed',
        email,
        limit: 1,
      });

      expect(logs).toHaveLength(1);
    });

    it('should reject missing challengeId', async () => {
      const result = await callPasskeyFunction('/register/finish', {
        response: {
          id: 'fake-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: '',
            attestationObject: '',
          },
        },
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing response data', async () => {
      const email = generateTestEmail();
      const startResult = await callPasskeyFunction('/register/start', { email });

      const result = await callPasskeyFunction('/register/finish', {
        challengeId: startResult.data.challengeId,
      });

      expect(result.success).toBe(false);
    });
  });
});
