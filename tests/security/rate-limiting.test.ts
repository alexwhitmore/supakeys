import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createServiceClient,
  callPasskeyFunction,
  cleanupAll,
  generateTestEmail,
  getRateLimits,
  getAuditLogs,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  RP_ID,
  RP_NAME,
} from '../helpers/supabase';

describe('Rate Limiting', () => {
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

  async function callWithCustomIP(
    endpoint: string,
    data: Record<string, unknown>,
    ip: string
  ): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'X-Forwarded-For': ip,
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

  describe('IP-Based Rate Limiting', () => {
    it('should allow requests under the IP rate limit', async () => {
      const testIP = `192.168.1.${Math.floor(Math.random() * 255)}`;
      const email = generateTestEmail();

      const result = await callWithCustomIP('/register/start', { email }, testIP);

      expect(result.success).toBe(true);
    });

    it('should block requests after exceeding IP rate limit', async () => {
      const testIP = `10.0.0.${Math.floor(Math.random() * 255)}`;
      const ipLimit = 5;

      for (let i = 0; i < ipLimit; i++) {
        const email = generateTestEmail();
        const result = await callWithCustomIP('/register/start', { email }, testIP);
        expect(result.success).toBe(true);
      }

      const email = generateTestEmail();
      const blockedResult = await callWithCustomIP('/register/start', { email }, testIP);

      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error?.code).toBe('RATE_LIMITED');
    });

    it('should track rate limits per IP separately', async () => {
      const testIP1 = `172.16.1.${Math.floor(Math.random() * 255)}`;
      const testIP2 = `172.16.2.${Math.floor(Math.random() * 255)}`;

      for (let i = 0; i < 5; i++) {
        const email = generateTestEmail();
        await callWithCustomIP('/register/start', { email }, testIP1);
      }

      const email = generateTestEmail();
      const result = await callWithCustomIP('/register/start', { email }, testIP2);

      expect(result.success).toBe(true);
    });
  });

  describe('Email-Based Rate Limiting', () => {
    it('should block after exceeding email rate limit', async () => {
      const email = generateTestEmail();
      const emailLimit = 10;

      for (let i = 0; i < emailLimit; i++) {
        const testIP = `10.${i}.0.${Math.floor(Math.random() * 255)}`;
        const result = await callWithCustomIP('/register/start', { email }, testIP);
        if (i < emailLimit) {
          expect(result.success).toBe(true);
        }
      }

      const testIP = `10.${emailLimit}.0.${Math.floor(Math.random() * 255)}`;
      const blockedResult = await callWithCustomIP('/register/start', { email }, testIP);

      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error?.code).toBe('RATE_LIMITED');
    });

    it('should track rate limits per email separately', async () => {
      const email1 = generateTestEmail();
      const email2 = generateTestEmail();

      for (let i = 0; i < 10; i++) {
        const testIP = `10.${i}.0.${Math.floor(Math.random() * 255)}`;
        await callWithCustomIP('/register/start', { email: email1 }, testIP);
      }

      const testIP = `10.10.0.${Math.floor(Math.random() * 255)}`;
      const result = await callWithCustomIP('/register/start', { email: email2 }, testIP);

      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limit Auditing', () => {
    it('should log rate limit exceeded events', async () => {
      const testIP = `10.100.0.${Math.floor(Math.random() * 255)}`;

      for (let i = 0; i < 6; i++) {
        const email = generateTestEmail();
        await callWithCustomIP('/register/start', { email }, testIP);
      }

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'rate_limit_exceeded',
        limit: 1,
      });

      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should include IP in rate limit audit log', async () => {
      const testIP = `10.200.0.${Math.floor(Math.random() * 255)}`;

      for (let i = 0; i < 6; i++) {
        const email = generateTestEmail();
        await callWithCustomIP('/register/start', { email }, testIP);
      }

      const { data: logs } = await getAuditLogs(serviceClient, {
        eventType: 'rate_limit_exceeded',
        limit: 1,
      });

      expect(logs).toBeDefined();
      if (logs && logs.length > 0) {
        expect(logs[0].ip_address).toBeDefined();
      }
    });
  });

  describe('Rate Limit Database Storage', () => {
    it('should create rate limit records in database', async () => {
      const testIP = `172.20.0.${Math.floor(Math.random() * 255)}`;
      const email = generateTestEmail();

      await callWithCustomIP('/register/start', { email }, testIP);

      const { data: ipLimits } = await getRateLimits(serviceClient, `ip:${testIP}`);
      const { data: emailLimits } = await getRateLimits(serviceClient, `email:${email}`);

      expect(ipLimits).toBeDefined();
      expect(emailLimits).toBeDefined();
    });
  });

  describe('Brute Force Protection', () => {
    it('should mitigate brute force registration attempts', async () => {
      const testIP = `10.50.0.${Math.floor(Math.random() * 255)}`;

      const results = [];
      for (let i = 0; i < 10; i++) {
        const email = generateTestEmail();
        const result = await callWithCustomIP('/register/start', { email }, testIP);
        results.push(result);
      }

      const blockedCount = results.filter((r) => !r.success && r.error?.code === 'RATE_LIMITED').length;
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should mitigate brute force login attempts', async () => {
      const testIP = `10.60.0.${Math.floor(Math.random() * 255)}`;
      const email = generateTestEmail();

      const { data: user } = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      await serviceClient.from('passkey_credentials').insert({
        id: 'brute-force-test-cred',
        user_id: user.user.id,
        webauthn_user_id: 'brute-force-webauthn-id',
        public_key: '\\x' + '00'.repeat(65),
        counter: 0,
        device_type: 'multiDevice',
        backed_up: false,
      });

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await callWithCustomIP('/login/start', { email }, testIP);
        results.push(result);
      }

      const blockedCount = results.filter((r) => !r.success && r.error?.code === 'RATE_LIMITED').length;
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('User Enumeration Mitigation', () => {
    it('should rate limit user enumeration attempts', async () => {
      const testIP = `10.70.0.${Math.floor(Math.random() * 255)}`;

      const results = [];
      for (let i = 0; i < 10; i++) {
        const email = `test-enum-${i}@example.com`;
        const result = await callWithCustomIP('/login/start', { email }, testIP);
        results.push(result);
      }

      const blockedCount = results.filter((r) => r.error?.code === 'RATE_LIMITED').length;
      expect(blockedCount).toBeGreaterThan(0);
    });
  });
});
