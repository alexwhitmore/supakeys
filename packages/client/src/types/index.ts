import type { SupabaseClient, Session } from "@supabase/supabase-js";

export type AuthenticatorTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

export interface PublicKeyCredentialCreationOptionsJSON {
  rp: {
    name: string;
    id?: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  challenge: string;
  pubKeyCredParams: Array<{
    type: "public-key";
    alg: number;
  }>;
  timeout?: number;
  excludeCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: AuthenticatorTransport[];
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform";
    residentKey?: "discouraged" | "preferred" | "required";
    requireResidentKey?: boolean;
    userVerification?: "required" | "preferred" | "discouraged";
  };
  attestation?: "none" | "indirect" | "direct" | "enterprise";
  extensions?: Record<string, unknown>;
}

export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: AuthenticatorTransport[];
  }>;
  userVerification?: "required" | "preferred" | "discouraged";
  extensions?: Record<string, unknown>;
}

export interface RegistrationResponseJSON {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: AuthenticatorTransport[];
    publicKeyAlgorithm?: number;
    publicKey?: string;
    authenticatorData?: string;
  };
  authenticatorAttachment?: "platform" | "cross-platform";
  clientExtensionResults: Record<string, unknown>;
  type: "public-key";
}

export interface AuthenticationResponseJSON {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  authenticatorAttachment?: "platform" | "cross-platform";
  clientExtensionResults: Record<string, unknown>;
  type: "public-key";
}

export interface PasskeyAuthConfig {
  functionName?: string;
  rpId?: string;
  rpName?: string;
  timeout?: number;
}

export interface ResolvedPasskeyAuthConfig {
  functionName: string;
  rpId: string;
  rpName: string;
  timeout: number;
}

export interface Passkey {
  id: string;
  userId: string;
  webauthnUserId: string;
  authenticatorName: string | null;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: AuthenticatorTransport[];
  aaguid: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface RegisterPasskeyOptions {
  email: string;
  displayName?: string;
  authenticatorName?: string;
}

export interface StartRegistrationResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
  challengeId: string;
}

export interface FinishRegistrationResponse {
  verified: boolean;
  passkey?: Passkey;
  error?: string;
}

export interface RegisterPasskeyResult {
  success: boolean;
  passkey?: Passkey;
  error?: PasskeyError;
}

export interface SignInWithPasskeyOptions {
  email?: string;
}

export interface StartAuthenticationResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}

export interface FinishAuthenticationResponse {
  verified: boolean;
  tokenHash?: string;
  email?: string;
  error?: string;
}

export interface SignInWithPasskeyResult {
  success: boolean;
  session?: Session;
  error?: PasskeyError;
}

export interface LinkPasskeyOptions {
  authenticatorName?: string;
}

export interface LinkPasskeyResult {
  success: boolean;
  passkey?: Passkey;
  error?: PasskeyError;
}

export interface RemovePasskeyOptions {
  credentialId: string;
}

export interface RemovePasskeyResult {
  success: boolean;
  error?: PasskeyError;
}

export interface UpdatePasskeyOptions {
  credentialId: string;
  authenticatorName: string;
}

export interface UpdatePasskeyResult {
  success: boolean;
  passkey?: Passkey;
  error?: PasskeyError;
}

export interface ListPasskeysResult {
  success: boolean;
  passkeys?: Passkey[];
  error?: PasskeyError;
}

export type PasskeyErrorCode =
  | "NOT_SUPPORTED"
  | "INVALID_INPUT"
  | "CANCELLED"
  | "TIMEOUT"
  | "INVALID_STATE"
  | "SECURITY_ERROR"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_MISMATCH"
  | "VERIFICATION_FAILED"
  | "CREDENTIAL_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "CREDENTIAL_EXISTS"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export interface PasskeyError {
  code: PasskeyErrorCode;
  message: string;
  cause?: unknown;
}

export type PasskeyEndpoint =
  | "/register/start"
  | "/register/finish"
  | "/login/start"
  | "/login/finish"
  | "/passkeys/list"
  | "/passkeys/remove"
  | "/passkeys/update";

export interface EdgeFunctionRequest {
  endpoint: PasskeyEndpoint;
  data: unknown;
}

export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: PasskeyErrorCode;
    message: string;
  };
}

export interface PasskeySupport {
  webauthn: boolean;
  platformAuthenticator: boolean;
  conditionalUI: boolean;
}

export type { Session };

export type AnySupabaseClient = SupabaseClient<any, any, any>;
