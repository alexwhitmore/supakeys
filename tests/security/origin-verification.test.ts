import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createServiceClient,
  callPasskeyFunction,
  cleanupAll,
  generateTestEmail,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  RP_ID,
  RP_NAME,
} from '../helpers/supabase';

describe('Origin and RP ID Verification', () => {
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

  async function callWithCustomOrigin(
    endpoint: string,
    data: Record<string, unknown>,
    origin: string
  ): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        Origin: origin,
      },
      body: JSON.stringify({
        endpoint,
        data: {
          ...data,
          rpId: RP_ID,
          rpName: RP_NAME,
        },
      }),
    });

    return response.json();
  }

  describe('Registration Origin Verification', () => {
    it('should reject registration finish with mismatched origin in clientDataJSON', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      expect(startResult.success).toBe(true);

      const challengeId = startResult.data.challengeId;
      const challengeValue = startResult.data.options.challenge;

      const wrongOriginClientData = btoa(
        JSON.stringify({
          challenge: challengeValue,
          origin: 'https://evil-site.com',
          type: 'webauthn.create',
        })
      );

      const result = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: {
          id: 'fake-credential-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: wrongOriginClientData,
            attestationObject: 'fake-attestation',
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject registration with subdomain origin trick', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      expect(startResult.success).toBe(true);

      const challengeId = startResult.data.challengeId;
      const challengeValue = startResult.data.options.challenge;

      const subdomainTrickClientData = btoa(
        JSON.stringify({
          challenge: challengeValue,
          origin: 'http://localhost.evil.com:3000',
          type: 'webauthn.create',
        })
      );

      const result = await callPasskeyFunction('/register/finish', {
        challengeId,
        response: {
          id: 'fake-credential-id',
          rawId: 'fake-raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: subdomainTrickClientData,
            attestationObject: 'fake-attestation',
          },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Authentication Origin Verification', () => {
    it('should reject authentication finish with mismatched origin in clientDataJSON', async () => {
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'test-cred-origin',
        user_id: user.user.id,
        webauthn_user_id: 'test-webauthn-origin',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const startResult = await callPasskeyFunction('/login/start', { email });
      expect(startResult.success).toBe(true);

      const challengeId = startResult.data.challengeId;
      const challengeValue = startResult.data.options.challenge;

      const wrongOriginClientData = btoa(
        JSON.stringify({
          challenge: challengeValue,
          origin: 'https://evil-site.com',
          type: 'webauthn.get',
        })
      );

      const result = await callPasskeyFunction('/login/finish', {
        challengeId,
        response: {
          id: 'test-cred-origin',
          rawId: 'test-cred-origin',
          type: 'public-key',
          response: {
            clientDataJSON: wrongOriginClientData,
            authenticatorData: 'fake-auth-data',
            signature: 'fake-signature',
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('RP ID Verification', () => {
    it('should reject registration with wrong RP ID', async () => {
      const email = generateTestEmail();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          endpoint: '/register/start',
          data: {
            email,
            rpId: 'evil-domain.com',
            rpName: RP_NAME,
          },
        }),
      });

      const startResult = await response.json();
      expect(startResult.success).toBe(true);

      const challengeId = startResult.data.challengeId;
      const challengeValue = startResult.data.options.challenge;

      const clientDataWithCorrectOrigin = btoa(
        JSON.stringify({
          challenge: challengeValue,
          origin: 'http://localhost:3000',
          type: 'webauthn.create',
        })
      );

      const finishResponse = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          endpoint: '/register/finish',
          data: {
            challengeId,
            rpId: 'different-domain.com',
            rpName: RP_NAME,
            response: {
              id: 'fake-credential-id',
              rawId: 'fake-raw-id',
              type: 'public-key',
              response: {
                clientDataJSON: clientDataWithCorrectOrigin,
                attestationObject: 'fake-attestation',
              },
            },
          },
        }),
      });

      const result = await finishResponse.json();
      expect(result.success).toBe(false);
    });

    it('should store and validate RP ID consistently during flow', async () => {
      const email = generateTestEmail();

      const startResult = await callPasskeyFunction('/register/start', { email });
      expect(startResult.success).toBe(true);
      expect(startResult.data.options.rp.id).toBe(RP_ID);
    });
  });

  describe('Origin Header Extraction', () => {
    it('should correctly extract origin from request header', async () => {
      const email = generateTestEmail();

      const result = await callWithCustomOrigin('/register/start', { email }, 'http://test-origin.com');

      expect(result.success).toBe(true);
    });
  });
});
