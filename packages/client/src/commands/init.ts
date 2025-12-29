import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import ora from "ora";
import enquirer from "enquirer";

const { prompt } = enquirer;

interface InitOptions {
  dir: string;
  skipMigration?: boolean;
  skipFunction?: boolean;
  dryRun?: boolean;
}

interface FrameworkInfo {
  name: string;
  detected: boolean;
  configFile?: string;
}

function detectFramework(): FrameworkInfo {
  const frameworks: { name: string; files: string[] }[] = [
    {
      name: "Next.js",
      files: ["next.config.js", "next.config.mjs", "next.config.ts"],
    },
    { name: "Remix", files: ["remix.config.js", "remix.config.ts"] },
    { name: "SvelteKit", files: ["svelte.config.js"] },
    { name: "Nuxt", files: ["nuxt.config.js", "nuxt.config.ts"] },
    { name: "Astro", files: ["astro.config.mjs", "astro.config.js"] },
  ];

  for (const fw of frameworks) {
    for (const file of fw.files) {
      if (existsSync(file)) {
        return { name: fw.name, detected: true, configFile: file };
      }
    }
  }

  if (existsSync("package.json")) {
    try {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        return { name: "React", detected: true };
      }
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        return { name: "Vue", detected: true };
      }
    } catch {}
  }

  return { name: "Unknown", detected: false };
}

function checkSupabaseProject(dir: string): boolean {
  return existsSync(join(dir, "config.toml"));
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.cyan("\nInitializing passkey authentication...\n"));

  const spinner = ora();
  const framework = detectFramework();

  if (framework.detected) {
    console.log(chalk.dim(`  Detected: ${framework.name}\n`));
  }

  try {
    const isSupabaseProject = checkSupabaseProject(options.dir);

    if (!isSupabaseProject && !existsSync(options.dir)) {
      const { createDir } = await prompt<{ createDir: boolean }>({
        type: "confirm",
        name: "createDir",
        message: `Supabase directory not found at ${options.dir}. Create it?`,
        initial: true,
      });

      if (!createDir) {
        console.log(
          chalk.yellow(
            "\nAborted. Run `supabase init` first to set up Supabase.",
          ),
        );
        process.exit(1);
      }

      if (!options.dryRun) {
        mkdirSync(options.dir, { recursive: true });
      }
    }

    const config = await prompt<{ rpId: string; rpName: string }>([
      {
        type: "input",
        name: "rpId",
        message: "Relying Party ID (your domain):",
        initial: "localhost",
      },
      {
        type: "input",
        name: "rpName",
        message: "Application name:",
        initial: framework.detected ? framework.name + " App" : "My App",
      },
    ]);

    if (options.dryRun) {
      console.log(chalk.yellow("\n[Dry Run] Would create the following:\n"));
    }

    if (!options.skipMigration) {
      spinner.start("Setting up database migrations...");

      const migrationsDir = join(options.dir, "migrations");
      if (!options.dryRun && !existsSync(migrationsDir)) {
        mkdirSync(migrationsDir, { recursive: true });
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .split(".")[0];
      const migrationFile = join(
        migrationsDir,
        `${timestamp}_passkey_auth.sql`,
      );

      if (options.dryRun) {
        spinner.info(`Would create: ${chalk.dim(migrationFile)}`);
      } else {
        writeFileSync(migrationFile, getMigrationSQL());
        spinner.succeed(`Created migration: ${chalk.dim(migrationFile)}`);
      }
    }

    if (!options.skipFunction) {
      spinner.start("Setting up edge function...");

      const functionsDir = join(options.dir, "functions", "passkey-auth");
      if (!options.dryRun && !existsSync(functionsDir)) {
        mkdirSync(functionsDir, { recursive: true });
      }

      const functionFile = join(functionsDir, "index.ts");

      if (options.dryRun) {
        spinner.info(`Would create: ${chalk.dim(functionFile)}`);
      } else {
        writeFileSync(functionFile, getEdgeFunctionCode());
        spinner.succeed(`Created edge function: ${chalk.dim(functionFile)}`);
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow("\n[Dry Run] No files were created.\n"));
      return;
    }

    console.log(chalk.green("\nPasskey authentication initialized!\n"));

    console.log(chalk.bold("Next steps:\n"));
    console.log(`  ${chalk.cyan("1.")} Apply database migrations:`);
    console.log(chalk.dim(`     supabase db push\n`));

    console.log(`  ${chalk.cyan("2.")} Deploy the edge function:`);
    console.log(chalk.dim(`     supabase functions deploy passkey-auth\n`));

    console.log(`  ${chalk.cyan("3.")} Initialize in your app:`);
    console.log(
      chalk.dim(`
     import { createPasskeyAuth } from 'supakeys';
     import { createClient } from '@supabase/supabase-js';

     const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

     const passkeys = createPasskeyAuth(supabase, {
       rpId: '${config.rpId}',
       rpName: '${config.rpName}',
     });

     // Register a new passkey
     const { success, error } = await passkeys.register({ email: 'user@example.com' });

     // Sign in with passkey
     const { success, session } = await passkeys.signIn();
`),
    );

    console.log(chalk.dim("Docs: https://supakeys.dev\n"));
  } catch (error) {
    spinner.fail("Failed to initialize");
    if (error instanceof Error && error.message !== "") {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}

function getMigrationSQL(): string {
  return `CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webauthn_user_id TEXT NOT NULL,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type VARCHAR(32) NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[],
  authenticator_name VARCHAR(255),
  aaguid VARCHAR(36),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT unique_credential_per_user UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id
  ON public.passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_webauthn_user_id
  ON public.passkey_credentials(webauthn_user_id);

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  webauthn_user_id TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires_at
  ON public.passkey_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_challenge
  ON public.passkey_challenges(challenge);

CREATE TABLE IF NOT EXISTS public.passkey_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type VARCHAR(10) NOT NULL CHECK (identifier_type IN ('ip', 'email')),
  endpoint VARCHAR(50) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_rate_limit_window UNIQUE (identifier, identifier_type, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.passkey_rate_limits(identifier, identifier_type, endpoint, window_start);

CREATE TYPE public.passkey_audit_event AS ENUM (
  'registration_started',
  'registration_completed',
  'registration_failed',
  'authentication_started',
  'authentication_completed',
  'authentication_failed',
  'passkey_removed',
  'passkey_updated',
  'rate_limit_exceeded',
  'challenge_expired',
  'counter_mismatch'
);

CREATE TABLE IF NOT EXISTS public.passkey_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.passkey_audit_event NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  credential_id TEXT,
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  origin TEXT,
  metadata JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.passkey_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.passkey_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.passkey_audit_log(created_at);

ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own passkeys"
  ON public.passkey_credentials FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passkeys"
  ON public.passkey_credentials FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own audit logs"
  ON public.passkey_audit_log FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cleanup_expired_passkey_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.passkey_challenges WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_passkey_rate_limit(
  p_identifier TEXT,
  p_identifier_type VARCHAR(10),
  p_endpoint VARCHAR(50),
  p_max_attempts INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', NOW());
  INSERT INTO public.passkey_rate_limits (identifier, identifier_type, endpoint, window_start, attempt_count)
  VALUES (p_identifier, p_identifier_type, p_endpoint, v_window_start, 1)
  ON CONFLICT (identifier, identifier_type, endpoint, window_start)
  DO UPDATE SET attempt_count = public.passkey_rate_limits.attempt_count + 1
  RETURNING attempt_count INTO v_current_count;
  RETURN v_current_count > p_max_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_passkey_audit_event(
  p_event_type public.passkey_audit_event,
  p_user_id UUID DEFAULT NULL,
  p_credential_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.passkey_audit_log (
    event_type, user_id, credential_id, email, ip_address, user_agent, origin, metadata, error_code, error_message
  ) VALUES (
    p_event_type, p_user_id, p_credential_id, p_email, p_ip_address, p_user_agent, p_origin, p_metadata, p_error_code, p_error_message
  ) RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_passkey_challenges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_passkey_rate_limit(TEXT, VARCHAR, VARCHAR, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_passkey_audit_event(public.passkey_audit_event, UUID, TEXT, TEXT, INET, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_passkey_challenges() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_passkey_rate_limit(TEXT, VARCHAR, VARCHAR, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_passkey_audit_event(public.passkey_audit_event, UUID, TEXT, TEXT, INET, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
`;
}

function getEdgeFunctionCode(): string {
  return `import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@11.0.0';

interface RequestBody {
  endpoint: string;
  data: Record<string, unknown>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

const CHALLENGE_TTL_MINUTES = 5;
const SUPPORTED_ALGORITHMS = [-7, -257];
const RATE_LIMITS = { ip: { maxAttempts: 5, windowMinutes: 1 }, email: { maxAttempts: 10, windowMinutes: 1 } };

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message } };
}

function getOrigin(request: Request): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const url = new URL(request.url);
  return \`\${url.protocol}//\${url.host}\`;
}

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    '0.0.0.0';
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function generateWebAuthnUserId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return uint8ArrayToBase64Url(bytes);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const origin = getOrigin(req);
  const clientIP = getClientIP(req);

  try {
    const { endpoint, data }: RequestBody = await req.json();
    const { rpId, rpName, email, challengeId, response: authResponse } = data as Record<string, unknown>;

    let result: ApiResponse;

    switch (endpoint) {
      case '/register/start': {
        const ipBlocked = await supabaseAdmin.rpc('check_passkey_rate_limit', {
          p_identifier: clientIP, p_identifier_type: 'ip', p_endpoint: endpoint, p_max_attempts: RATE_LIMITS.ip.maxAttempts
        });
        if (ipBlocked.error || ipBlocked.data) {
          result = error('RATE_LIMITED', 'Too many requests');
          break;
        }

        const webauthnUserId = generateWebAuthnUserId();
        const { data: existingUser } = await supabaseAdmin.from('passkey_credentials')
          .select('id').eq('webauthn_user_id', webauthnUserId).limit(1);

        const excludeCredentials = existingUser?.map((c: { id: string }) => ({
          id: c.id, type: 'public-key' as const
        })) || [];

        const options = await generateRegistrationOptions({
          rpName: rpName as string,
          rpID: rpId as string,
          userName: email as string,
          userDisplayName: email as string,
          userID: new TextEncoder().encode(webauthnUserId),
          attestationType: 'none',
          excludeCredentials,
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
          supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
        });

        const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);
        const { data: challenge } = await supabaseAdmin.from('passkey_challenges').insert({
          challenge: options.challenge, email, type: 'registration', expires_at: expiresAt.toISOString(), webauthn_user_id: webauthnUserId
        }).select().single();

        await supabaseAdmin.rpc('log_passkey_audit_event', {
          p_event_type: 'registration_started', p_email: email, p_ip_address: clientIP, p_origin: origin
        });

        result = success({ options, challengeId: challenge.id });
        break;
      }

      case '/register/finish': {
        const { data: challenge } = await supabaseAdmin.from('passkey_challenges')
          .select('*').eq('id', challengeId).eq('type', 'registration').single();

        await supabaseAdmin.from('passkey_challenges').delete().eq('id', challengeId);

        if (!challenge) {
          result = error('CHALLENGE_MISMATCH', 'Invalid or expired challenge');
          break;
        }

        if (new Date(challenge.expires_at) < new Date()) {
          await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'challenge_expired', p_email: challenge.email, p_ip_address: clientIP
          });
          result = error('CHALLENGE_EXPIRED', 'Challenge has expired');
          break;
        }

        try {
          const verification = await verifyRegistrationResponse({
            response: authResponse as Parameters<typeof verifyRegistrationResponse>[0]['response'],
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpId as string,
            supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
          });

          if (!verification.verified || !verification.registrationInfo) {
            throw new Error('Verification failed');
          }

          const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
          const publicKeyBytes = credential.publicKey;
          const publicKeyHex = '\\\\x' + uint8ArrayToHex(publicKeyBytes);

          let userId: string;
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find((u) => u.email === challenge.email);

          if (existingUser) {
            userId = existingUser.id;
          } else {
            const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
              email: challenge.email, email_confirm: true
            });
            userId = newUser.user!.id;
          }

          const authenticatorName = (data as { authenticatorName?: string }).authenticatorName || null;

          const { data: insertedCred } = await supabaseAdmin.from('passkey_credentials').insert({
            id: credential.id,
            user_id: userId,
            webauthn_user_id: challenge.webauthn_user_id,
            public_key: publicKeyHex,
            counter: credential.counter,
            device_type: credentialDeviceType,
            backed_up: credentialBackedUp,
            transports: credential.transports,
            authenticator_name: authenticatorName,
          }).select().single();

          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink', email: challenge.email
          });

          await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'registration_completed', p_user_id: userId, p_credential_id: credential.id, p_email: challenge.email, p_ip_address: clientIP
          });

          result = success({
            verified: true,
            tokenHash: linkData.properties?.hashed_token,
            passkey: insertedCred ? {
              id: insertedCred.id,
              authenticatorName: insertedCred.authenticator_name,
              deviceType: insertedCred.device_type,
              backedUp: insertedCred.backed_up,
              createdAt: insertedCred.created_at,
              lastUsedAt: insertedCred.last_used_at,
            } : null
          });
        } catch (e) {
          await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'registration_failed', p_email: challenge.email, p_ip_address: clientIP, p_error_message: e instanceof Error ? e.message : 'Unknown'
          });
          result = error('VERIFICATION_FAILED', 'Registration verification failed');
        }
        break;
      }

      case '/login/start': {
        const ipBlocked = await supabaseAdmin.rpc('check_passkey_rate_limit', {
          p_identifier: clientIP, p_identifier_type: 'ip', p_endpoint: endpoint, p_max_attempts: RATE_LIMITS.ip.maxAttempts
        });
        if (ipBlocked.error || ipBlocked.data) {
          result = error('RATE_LIMITED', 'Too many requests');
          break;
        }

        let allowCredentials: { id: string; type: 'public-key' }[] | undefined;
        let userEmail = email as string | undefined;

        if (email) {
          const { data: users } = await supabaseAdmin.auth.admin.listUsers();
          const user = users?.users?.find((u) => u.email === email);
          if (!user) {
            result = error('CREDENTIAL_NOT_FOUND', 'No passkey found for this email');
            break;
          }

          const { data: credentials } = await supabaseAdmin.from('passkey_credentials')
            .select('id, transports').eq('user_id', user.id);

          if (!credentials?.length) {
            result = error('CREDENTIAL_NOT_FOUND', 'No passkey found for this email');
            break;
          }

          allowCredentials = credentials.map((c) => ({ id: c.id, type: 'public-key' as const }));
        }

        const options = await generateAuthenticationOptions({
          rpID: rpId as string,
          userVerification: 'preferred',
          allowCredentials,
        });

        const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);
        const { data: challenge } = await supabaseAdmin.from('passkey_challenges').insert({
          challenge: options.challenge, email: userEmail, type: 'authentication', expires_at: expiresAt.toISOString()
        }).select().single();

        await supabaseAdmin.rpc('log_passkey_audit_event', {
          p_event_type: 'authentication_started', p_email: userEmail, p_ip_address: clientIP
        });

        result = success({ options, challengeId: challenge.id });
        break;
      }

      case '/login/finish': {
        const { data: challenge } = await supabaseAdmin.from('passkey_challenges')
          .select('*').eq('id', challengeId).eq('type', 'authentication').single();

        await supabaseAdmin.from('passkey_challenges').delete().eq('id', challengeId);

        if (!challenge) {
          result = error('CHALLENGE_MISMATCH', 'Invalid or expired challenge');
          break;
        }

        if (new Date(challenge.expires_at) < new Date()) {
          result = error('CHALLENGE_EXPIRED', 'Challenge has expired');
          break;
        }

        const credentialId = (authResponse as { id: string }).id;
        const { data: credential, error: credError } = await supabaseAdmin.from('passkey_credentials')
          .select('*').eq('id', credentialId).single();

        if (credError || !credential) {
          result = error('CREDENTIAL_NOT_FOUND', 'Credential not found');
          break;
        }

        try {
          const publicKeyHex = credential.public_key.replace('\\\\x', '');
          const publicKeyBytes = hexToUint8Array(publicKeyHex);

          const verification = await verifyAuthenticationResponse({
            response: authResponse as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpId as string,
            credential: {
              id: credential.id,
              publicKey: publicKeyBytes,
              counter: credential.counter,
            },
          });

          if (!verification.verified) {
            throw new Error('Verification failed');
          }

          await supabaseAdmin.from('passkey_credentials').update({
            counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString()
          }).eq('id', credentialId);

          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(credential.user_id);
          const userEmail = userData?.user?.email || challenge.email;
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink', email: userEmail
          });

          await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'authentication_completed', p_user_id: credential.user_id, p_credential_id: credentialId, p_ip_address: clientIP
          });

          result = success({ verified: true, tokenHash: linkData.properties?.hashed_token, email: userEmail });
        } catch (e) {
          await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'authentication_failed', p_credential_id: credentialId, p_ip_address: clientIP, p_error_message: e instanceof Error ? e.message : 'Unknown'
          });
          result = error('VERIFICATION_FAILED', 'Authentication verification failed');
        }
        break;
      }

      case '/passkeys/list': {
        const authHeader = req.headers.get('Authorization');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader || '' } }
        });
        const { data: { user } } = await userClient.auth.getUser();

        if (!user) {
          result = error('UNAUTHORIZED', 'Authentication required');
          break;
        }

        const { data: credentials } = await supabaseAdmin.from('passkey_credentials')
          .select('*').eq('user_id', user.id).order('created_at', { ascending: false });

        result = success({
          passkeys: credentials?.map((c) => ({
            id: c.id, authenticatorName: c.authenticator_name, deviceType: c.device_type,
            backedUp: c.backed_up, createdAt: c.created_at, lastUsedAt: c.last_used_at
          })) || []
        });
        break;
      }

      case '/passkeys/remove': {
        const authHeader = req.headers.get('Authorization');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader || '' } }
        });
        const { data: { user } } = await userClient.auth.getUser();

        if (!user) {
          result = error('UNAUTHORIZED', 'Authentication required');
          break;
        }

        const { credentialId: removeCredId } = data as { credentialId: string };
        await supabaseAdmin.from('passkey_credentials').delete().eq('id', removeCredId).eq('user_id', user.id);

        await supabaseAdmin.rpc('log_passkey_audit_event', {
          p_event_type: 'passkey_removed', p_user_id: user.id, p_credential_id: removeCredId, p_ip_address: clientIP
        });

        result = success({ removed: true });
        break;
      }

      case '/passkeys/update': {
        const authHeader = req.headers.get('Authorization');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader || '' } }
        });
        const { data: { user } } = await userClient.auth.getUser();

        if (!user) {
          result = error('UNAUTHORIZED', 'Authentication required');
          break;
        }

        const { credentialId: updateCredId, authenticatorName } = data as { credentialId: string; authenticatorName: string };
        const { data: updated } = await supabaseAdmin.from('passkey_credentials')
          .update({ authenticator_name: authenticatorName }).eq('id', updateCredId).eq('user_id', user.id).select().single();

        if (!updated) {
          result = error('CREDENTIAL_NOT_FOUND', 'Passkey not found');
          break;
        }

        await supabaseAdmin.rpc('log_passkey_audit_event', {
          p_event_type: 'passkey_updated', p_user_id: user.id, p_credential_id: updateCredId, p_ip_address: clientIP
        });

        result = success({ passkey: updated });
        break;
      }

      default:
        result = error('NOT_FOUND', \`Unknown endpoint: \${endpoint}\`);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify(error('UNKNOWN_ERROR', 'Internal server error')), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
`;
}
