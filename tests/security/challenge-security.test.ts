import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createServiceClient,
  callPasskeyFunction,
  getChallenge,
  cleanupAll,
  generateTestEmail,
} from '../helpers/supabase';

describe('Challenge Security', () => {
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

  describe('Single-Use Challenges', () => {
    it('should create a challenge on registration start', async () => {
      const email = generateTestEmail();

      const result = await callPasskeyFunction('/register/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
      expect(result.data).toHaveProperty('options');
      expect(result.data.options).toHaveProperty('challenge');

      const { data: challenge } = await getChallenge(serviceClient, result.data.challengeId);
      expect(challenge).not.toBeNull();
      expect(challenge.type).toBe('registration');
      expect(challenge.email).toBe(email);
    });

    it('should delete challenge after registration verification attempt', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      expect(startResult.success).toBe(true);

      const challengeId = startResult.data.challengeId;
      const challengeValue = startResult.data.options.challenge;

      const { data: beforeChallenge } = await getChallenge(serviceClient, challengeId);
      expect(beforeChallenge).not.toBeNull();

      const finishResult = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: {
          id: 'fake-credential-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: btoa(JSON.stringify({ challenge: challengeValue, origin: 'http://localhost:3000', type: 'webauthn.create' })),
            attestationObject: 'fake-attestation',
          },
        },
      });

      expect(finishResult.success).toBe(false);

      const { data: afterChallenge, error } = await getChallenge(serviceClient, challengeId);
      expect(afterChallenge).toBeNull();
      expect(error).not.toBeNull();
    });

    it('should not allow challenge reuse after deletion', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      const challengeId = startResult.data.challengeId;

      await callPasskeyFunction('/register/finish', {
        challengeId,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      const secondAttempt = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.error?.code).toBe('CHALLENGE_MISMATCH');
    });

    it('should create a challenge on authentication start', async () => {
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'test-credential-id',
        user_id: user.user.id,
        webauthn_user_id: 'test-webauthn-user-id',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
      expect(result.data).toHaveProperty('options');

      const { data: challenge } = await getChallenge(serviceClient, result.data.challengeId);
      expect(challenge).not.toBeNull();
      expect(challenge.type).toBe('authentication');
    });

    it('should delete authentication challenge after verification attempt', async () => {
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'test-credential-id-2',
        user_id: user.user.id,
        webauthn_user_id: 'test-webauthn-user-id-2',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const startResult = await callPasskeyFunction('/login/start', { email });
      const challengeId = startResult.data.challengeId;

      const { data: beforeChallenge } = await getChallenge(serviceClient, challengeId);
      expect(beforeChallenge).not.toBeNull();

      await callPasskeyFunction('/login/finish', {
        challengeId,
        response: {
          id: 'test-credential-id-2',
          rawId: 'test-credential-id-2',
          type: 'public-key',
          response: {
            clientDataJSON: '',
            authenticatorData: '',
            signature: '',
          },
        },
      });

      const { data: afterChallenge } = await getChallenge(serviceClient, challengeId);
      expect(afterChallenge).toBeNull();
    });
  });

  describe('Challenge Expiration', () => {
    it('should reject expired challenges', async () => {
      const email = generateTestEmail();

      const { data: challenge } = await serviceClient
        .from('passkey_challenges')
        .insert({
          challenge: 'test-expired-challenge-' + Date.now(),
          email,
          type: 'registration',
          expires_at: new Date(Date.now() - 60000).toISOString(),
          webauthn_user_id: 'test-user-id',
        })
        .select()
        .single();

      const result = await callPasskeyFunction('/register/finish', {
        challengeId: challenge.id,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CHALLENGE_EXPIRED');
    });

    it('should delete expired challenge after rejection', async () => {
      const email = generateTestEmail();

      const { data: challenge } = await serviceClient
        .from('passkey_challenges')
        .insert({
          challenge: 'test-expired-challenge-delete-' + Date.now(),
          email,
          type: 'registration',
          expires_at: new Date(Date.now() - 60000).toISOString(),
          webauthn_user_id: 'test-user-id',
        })
        .select()
        .single();

      await callPasskeyFunction('/register/finish', {
        challengeId: challenge.id,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      const { data: afterChallenge } = await getChallenge(serviceClient, challenge.id);
      expect(afterChallenge).toBeNull();
    });

    it('should accept challenges within TTL window', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      expect(startResult.success).toBe(true);

      const { data: challenge } = await getChallenge(serviceClient, startResult.data.challengeId);

      const expiresAt = new Date(challenge.expires_at);
      const now = new Date();
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(4);
      expect(diffMinutes).toBeLessThanOrEqual(5);
    });

    it('should log challenge expiration events', async () => {
      const email = generateTestEmail();

      const { data: challenge } = await serviceClient
        .from('passkey_challenges')
        .insert({
          challenge: 'test-audit-expired-' + Date.now(),
          email,
          type: 'registration',
          expires_at: new Date(Date.now() - 60000).toISOString(),
          webauthn_user_id: 'test-user-id',
        })
        .select()
        .single();

      await callPasskeyFunction('/register/finish', {
        challengeId: challenge.id,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      const { data: logs } = await serviceClient
        .from('passkey_audit_log')
        .select('*')
        .eq('event_type', 'challenge_expired')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(logs).toHaveLength(1);
      expect(logs[0].email).toBe(email);
    });
  });

  describe('Challenge Entropy', () => {
    it('should generate unique challenges for each request', async () => {
      const email1 = generateTestEmail();
      const email2 = generateTestEmail();

      const result1 = await callPasskeyFunction('/register/start', { email: email1 });
      const result2 = await callPasskeyFunction('/register/start', { email: email2 });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      expect(result1.data.options.challenge).not.toBe(result2.data.options.challenge);
    });

    it('should generate sufficiently long challenges', async () => {
      const email = generateTestEmail();

      const result = await callPasskeyFunction('/register/start', { email });
      expect(result.success).toBe(true);

      const challenge = result.data.options.challenge;
      expect(challenge.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('Challenge Type Validation', () => {
    it('should not allow registration challenge for authentication', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      const challengeId = startResult.data.challengeId;

      const authResult = await callPasskeyFunction('/login/finish', {
        challengeId,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', authenticatorData: '', signature: '' } },
      });

      expect(authResult.success).toBe(false);
      expect(authResult.error?.code).toBe('CHALLENGE_MISMATCH');
    });

    it('should not allow authentication challenge for registration', async () => {
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'test-cred-type-check',
        user_id: user.user.id,
        webauthn_user_id: 'test-webauthn-type-check',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const startResult = await callPasskeyFunction('/login/start', { email });
      const challengeId = startResult.data.challengeId;

      const regResult = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: { id: 'fake', rawId: 'fake', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' } },
      });

      expect(regResult.success).toBe(false);
      expect(regResult.error?.code).toBe('CHALLENGE_MISMATCH');
    });
  });
});
