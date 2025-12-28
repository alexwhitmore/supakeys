import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

import type {
  AnySupabaseClient,
  PasskeyAuthConfig,
  ResolvedPasskeyAuthConfig,
  RegisterPasskeyOptions,
  RegisterPasskeyResult,
  SignInWithPasskeyOptions,
  SignInWithPasskeyResult,
  LinkPasskeyOptions,
  LinkPasskeyResult,
  RemovePasskeyOptions,
  RemovePasskeyResult,
  UpdatePasskeyOptions,
  UpdatePasskeyResult,
  ListPasskeysResult,
  PasskeySupport,
  StartRegistrationResponse,
  FinishRegistrationResponse,
  StartAuthenticationResponse,
  FinishAuthenticationResponse,
  PasskeyEndpoint,
  EdgeFunctionResponse,
  Passkey,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '../types';

import { createError, mapWebAuthnError, isPasskeyError, validateEmail, validateCredentialId, validateAuthenticatorName } from './errors';
import { getPasskeySupport, getUnsupportedReason } from './support';

const DEFAULT_CONFIG: ResolvedPasskeyAuthConfig = {
  functionName: 'passkey-auth',
  rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  rpName: 'My App',
  timeout: 60000,
};

export class PasskeyAuth {
  private supabase: AnySupabaseClient;
  private config: ResolvedPasskeyAuthConfig;

  constructor(supabase: AnySupabaseClient, config: PasskeyAuthConfig = {}) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async isSupported(): Promise<PasskeySupport> {
    return getPasskeySupport();
  }

  async register(options: RegisterPasskeyOptions): Promise<RegisterPasskeyResult> {
    const emailValidation = validateEmail(options.email);
    if (!emailValidation.valid) {
      return { success: false, error: createError('INVALID_INPUT', emailValidation.message) };
    }

    const unsupportedReason = getUnsupportedReason();
    if (unsupportedReason) {
      return { success: false, error: createError('NOT_SUPPORTED', unsupportedReason) };
    }

    try {
      const startResponse = await this.callEdgeFunction<StartRegistrationResponse>(
        '/register/start',
        {
          email: options.email,
          displayName: options.displayName || options.email,
          authenticatorName: options.authenticatorName,
        }
      );

      if (!startResponse.success || !startResponse.data) {
        return {
          success: false,
          error: startResponse.error
            ? createError(startResponse.error.code, startResponse.error.message)
            : createError('UNKNOWN_ERROR', 'Failed to start registration'),
        };
      }

      let registrationResponse: RegistrationResponseJSON;
      try {
        registrationResponse = (await startRegistration({
          optionsJSON: startResponse.data.options,
        })) as unknown as RegistrationResponseJSON;
      } catch (error) {
        return { success: false, error: mapWebAuthnError(error) };
      }

      const finishResponse = await this.callEdgeFunction<FinishRegistrationResponse>(
        '/register/finish',
        {
          challengeId: startResponse.data.challengeId,
          response: registrationResponse,
          authenticatorName: options.authenticatorName,
        }
      );

      if (!finishResponse.success || !finishResponse.data?.verified) {
        return {
          success: false,
          error: finishResponse.error
            ? createError(finishResponse.error.code, finishResponse.error.message)
            : createError('VERIFICATION_FAILED', 'Failed to verify registration'),
        };
      }

      return { success: true, passkey: finishResponse.data.passkey };
    } catch (error) {
      if (isPasskeyError(error)) return { success: false, error };
      return { success: false, error: mapWebAuthnError(error) };
    }
  }

  async signIn(options: SignInWithPasskeyOptions = {}): Promise<SignInWithPasskeyResult> {
    if (options.email !== undefined) {
      const emailValidation = validateEmail(options.email);
      if (!emailValidation.valid) {
        return { success: false, error: createError('INVALID_INPUT', emailValidation.message) };
      }
    }

    const unsupportedReason = getUnsupportedReason();
    if (unsupportedReason) {
      return { success: false, error: createError('NOT_SUPPORTED', unsupportedReason) };
    }

    try {
      const startResponse = await this.callEdgeFunction<StartAuthenticationResponse>(
        '/login/start',
        { email: options.email }
      );

      if (!startResponse.success || !startResponse.data) {
        return {
          success: false,
          error: startResponse.error
            ? createError(startResponse.error.code, startResponse.error.message)
            : createError('UNKNOWN_ERROR', 'Failed to start authentication'),
        };
      }

      let authenticationResponse: AuthenticationResponseJSON;
      try {
        authenticationResponse = (await startAuthentication({
          optionsJSON: startResponse.data.options,
        })) as unknown as AuthenticationResponseJSON;
      } catch (error) {
        return { success: false, error: mapWebAuthnError(error) };
      }

      const finishResponse = await this.callEdgeFunction<FinishAuthenticationResponse>(
        '/login/finish',
        {
          challengeId: startResponse.data.challengeId,
          response: authenticationResponse,
        }
      );

      if (!finishResponse.success || !finishResponse.data?.verified) {
        return {
          success: false,
          error: finishResponse.error
            ? createError(finishResponse.error.code, finishResponse.error.message)
            : createError('VERIFICATION_FAILED', 'Authentication failed'),
        };
      }

      const { tokenHash, email } = finishResponse.data;
      if (!tokenHash || !email) {
        return {
          success: false,
          error: createError('VERIFICATION_FAILED', 'Missing session token'),
        };
      }

      const { data: sessionData, error: sessionError } = await this.supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
      });

      if (sessionError || !sessionData.session) {
        return {
          success: false,
          error: createError(
            'VERIFICATION_FAILED',
            sessionError?.message || 'Failed to create session'
          ),
        };
      }

      return { success: true, session: sessionData.session };
    } catch (error) {
      if (isPasskeyError(error)) return { success: false, error };
      return { success: false, error: mapWebAuthnError(error) };
    }
  }

  async linkPasskey(options: LinkPasskeyOptions = {}): Promise<LinkPasskeyResult> {
    const unsupportedReason = getUnsupportedReason();
    if (unsupportedReason) {
      return { success: false, error: createError('NOT_SUPPORTED', unsupportedReason) };
    }

    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user?.email) {
      return {
        success: false,
        error: createError('USER_NOT_FOUND', 'You must be logged in to link a passkey'),
      };
    }

    return this.register({
      email: user.email,
      authenticatorName: options.authenticatorName,
    });
  }

  async listPasskeys(): Promise<ListPasskeysResult> {
    try {
      const response = await this.callEdgeFunction<{ passkeys: Passkey[] }>('/passkeys/list', {});

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error
            ? createError(response.error.code, response.error.message)
            : createError('UNKNOWN_ERROR', 'Failed to list passkeys'),
        };
      }

      return { success: true, passkeys: response.data.passkeys };
    } catch (error) {
      return { success: false, error: mapWebAuthnError(error) };
    }
  }

  async removePasskey(options: RemovePasskeyOptions): Promise<RemovePasskeyResult> {
    const credentialValidation = validateCredentialId(options.credentialId);
    if (!credentialValidation.valid) {
      return { success: false, error: createError('INVALID_INPUT', credentialValidation.message) };
    }

    try {
      const response = await this.callEdgeFunction<{ removed: boolean }>('/passkeys/remove', {
        credentialId: options.credentialId,
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error
            ? createError(response.error.code, response.error.message)
            : createError('UNKNOWN_ERROR', 'Failed to remove passkey'),
        };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: mapWebAuthnError(error) };
    }
  }

  async updatePasskey(options: UpdatePasskeyOptions): Promise<UpdatePasskeyResult> {
    const credentialValidation = validateCredentialId(options.credentialId);
    if (!credentialValidation.valid) {
      return { success: false, error: createError('INVALID_INPUT', credentialValidation.message) };
    }

    const nameValidation = validateAuthenticatorName(options.authenticatorName);
    if (!nameValidation.valid) {
      return { success: false, error: createError('INVALID_INPUT', nameValidation.message) };
    }

    try {
      const response = await this.callEdgeFunction<{ passkey: Passkey }>('/passkeys/update', {
        credentialId: options.credentialId,
        authenticatorName: options.authenticatorName,
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error
            ? createError(response.error.code, response.error.message)
            : createError('UNKNOWN_ERROR', 'Failed to update passkey'),
        };
      }

      return { success: true, passkey: response.data.passkey };
    } catch (error) {
      return { success: false, error: mapWebAuthnError(error) };
    }
  }

  private async callEdgeFunction<T>(
    endpoint: PasskeyEndpoint,
    data: Record<string, unknown>
  ): Promise<EdgeFunctionResponse<T>> {
    try {
      const { data: responseData, error } = await this.supabase.functions.invoke(
        this.config.functionName,
        {
          body: {
            endpoint,
            data: {
              ...data,
              rpId: this.config.rpId,
              rpName: this.config.rpName,
              clientOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
          },
        }
      );

      if (error) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error.message || 'Edge function request failed',
          },
        };
      }

      return responseData as EdgeFunctionResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }
}

export function createPasskeyAuth(
  supabase: AnySupabaseClient,
  config: PasskeyAuthConfig = {}
): PasskeyAuth {
  return new PasskeyAuth(supabase, config);
}
