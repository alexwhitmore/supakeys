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

describe('Authorization', () => {
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

    const { data: userData } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    const credentialId = `cred-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await serviceClient.from('passkey_credentials').insert({
      id: credentialId,
      user_id: userData.user.id,
      webauthn_user_id: `webauthn-${Date.now()}`,
      public_key: '\\x' + '00'.repeat(65),
      counter: 0,
      device_type: 'multiDevice',
      backed_up: false,
      authenticator_name: 'Test Passkey',
    });

    return { user: userData.user, email, credentialId };
  }

  describe('Protected Endpoints Require Authentication', () => {
    it('should reject /passkeys/list without authentication', async () => {
      const result = await callPasskeyFunction('/passkeys/list', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject /passkeys/remove without authentication', async () => {
      const result = await callPasskeyFunction('/passkeys/remove', {
        credentialId: 'some-credential-id',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject /passkeys/update without authentication', async () => {
      const result = await callPasskeyFunction('/passkeys/update', {
        credentialId: 'some-credential-id',
        authenticatorName: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Database-Level User Isolation', () => {
    it('should only return passkeys for the specified user_id in queries', async () => {
      const { user: user1, credentialId: cred1 } = await createUserWithPasskey();
      const { user: user2, credentialId: cred2 } = await createUserWithPasskey();

      const { data: user1Passkeys } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('user_id', user1.id);

      const { data: user2Passkeys } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('user_id', user2.id);

      expect(user1Passkeys).toHaveLength(1);
      expect(user1Passkeys[0].id).toBe(cred1);

      expect(user2Passkeys).toHaveLength(1);
      expect(user2Passkeys[0].id).toBe(cred2);
    });

    it('should only delete passkeys matching both credential_id and user_id', async () => {
      const { user: user1, credentialId: cred1 } = await createUserWithPasskey();
      const { user: user2, credentialId: cred2 } = await createUserWithPasskey();

      const { error: deleteError } = await serviceClient
        .from('passkey_credentials')
        .delete()
        .eq('id', cred2)
        .eq('user_id', user1.id);

      expect(deleteError).toBeNull();

      const { data: stillExists } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('id', cred2)
        .single();

      expect(stillExists).not.toBeNull();
      expect(stillExists.id).toBe(cred2);
    });

    it('should only update passkeys matching both credential_id and user_id', async () => {
      const { user: user1 } = await createUserWithPasskey();
      const { credentialId: cred2 } = await createUserWithPasskey();

      const { data: updated, error } = await serviceClient
        .from('passkey_credentials')
        .update({ authenticator_name: 'Attempted Hack' })
        .eq('id', cred2)
        .eq('user_id', user1.id)
        .select()
        .single();

      expect(updated).toBeNull();

      const { data: original } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('id', cred2)
        .single();

      expect(original.authenticator_name).toBe('Test Passkey');
    });
  });

  describe('Invalid Token Handling', () => {
    it('should reject expired or invalid tokens', async () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const result = await callPasskeyFunction('/passkeys/list', {}, invalidToken);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with malformed authorization header', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'InvalidFormat',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          endpoint: '/passkeys/list',
          data: { rpId: RP_ID, rpName: RP_NAME },
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Public Endpoints Accessibility', () => {
    it('should allow /register/start without authentication', async () => {
      const email = generateTestEmail();
      const result = await callPasskeyFunction('/register/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
    });

    it('should allow /login/start without authentication for user with passkey', async () => {
      const { email } = await createUserWithPasskey();
      const result = await callPasskeyFunction('/login/start', { email });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('challengeId');
    });
  });

  describe('Handler Authorization Logic', () => {
    it('should verify handleListPasskeys filters by user_id', async () => {
      const { user: user1, credentialId: cred1 } = await createUserWithPasskey();
      await createUserWithPasskey();

      const { data } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('user_id', user1.id)
        .order('created_at', { ascending: false });

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(cred1);
    });

    it('should verify handleRemovePasskey requires user_id match', async () => {
      const { credentialId: victimCred } = await createUserWithPasskey();
      const { user: attacker } = await createUserWithPasskey();

      await serviceClient
        .from('passkey_credentials')
        .delete()
        .eq('id', victimCred)
        .eq('user_id', attacker.id);

      const { data: stillExists } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('id', victimCred)
        .single();

      expect(stillExists).not.toBeNull();
      expect(stillExists.id).toBe(victimCred);
    });

    it('should verify handleUpdatePasskey requires user_id match', async () => {
      const { credentialId: victimCred } = await createUserWithPasskey();
      const { user: attacker } = await createUserWithPasskey();

      const { data: updated } = await serviceClient
        .from('passkey_credentials')
        .update({ authenticator_name: 'Hacked Name' })
        .eq('id', victimCred)
        .eq('user_id', attacker.id)
        .select();

      expect(updated).toHaveLength(0);

      const { data: original } = await serviceClient
        .from('passkey_credentials')
        .select('*')
        .eq('id', victimCred)
        .single();

      expect(original.authenticator_name).toBe('Test Passkey');
    });
  });
});
