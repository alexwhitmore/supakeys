import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const RP_ID = 'localhost';
export const RP_NAME = 'Test App';
export const TEST_ORIGIN = 'http://localhost:3000';

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function callPasskeyFunction<T = unknown>(
  endpoint: string,
  data: Record<string, unknown>,
  authToken?: string
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/passkey-auth`, {
    method: 'POST',
    headers,
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

export async function getChallenge(serviceClient: SupabaseClient, challengeId: string) {
  const { data, error } = await serviceClient
    .from('passkey_challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  return { data, error };
}

export async function getChallengeByValue(serviceClient: SupabaseClient, challenge: string) {
  const { data, error } = await serviceClient
    .from('passkey_challenges')
    .select('*')
    .eq('challenge', challenge)
    .single();

  return { data, error };
}

export async function getAllChallenges(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient
    .from('passkey_challenges')
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function getCredential(serviceClient: SupabaseClient, credentialId: string) {
  const { data, error } = await serviceClient
    .from('passkey_credentials')
    .select('*')
    .eq('id', credentialId)
    .single();

  return { data, error };
}

export async function getAuditLogs(
  serviceClient: SupabaseClient,
  options?: { eventType?: string; email?: string; limit?: number }
) {
  let query = serviceClient
    .from('passkey_audit_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.eventType) {
    query = query.eq('event_type', options.eventType);
  }
  if (options?.email) {
    query = query.eq('email', options.email);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return { data, error };
}

export async function getRateLimits(serviceClient: SupabaseClient, identifier: string) {
  const { data, error } = await serviceClient
    .from('passkey_rate_limits')
    .select('*')
    .eq('identifier', identifier);

  return { data, error };
}

export async function cleanupChallenges(serviceClient: SupabaseClient) {
  await serviceClient.from('passkey_challenges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function cleanupCredentials(serviceClient: SupabaseClient) {
  await serviceClient.from('passkey_credentials').delete().neq('id', 'placeholder');
}

export async function cleanupAuditLogs(serviceClient: SupabaseClient) {
  await serviceClient.from('passkey_audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function cleanupRateLimits(serviceClient: SupabaseClient) {
  await serviceClient.from('passkey_rate_limits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function cleanupTestUsers(serviceClient: SupabaseClient, emailPattern: string = 'test-') {
  const { data: users } = await serviceClient.auth.admin.listUsers();
  const testUsers = users?.users?.filter((u) => u.email?.includes(emailPattern)) || [];

  for (const user of testUsers) {
    await serviceClient.auth.admin.deleteUser(user.id);
  }
}

export async function cleanupAll(serviceClient: SupabaseClient) {
  await cleanupChallenges(serviceClient);
  await cleanupCredentials(serviceClient);
  await cleanupAuditLogs(serviceClient);
  await cleanupRateLimits(serviceClient);
  await cleanupTestUsers(serviceClient);
}

export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}
