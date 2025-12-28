export { PasskeyAuth, createPasskeyAuth } from './lib/passkey-auth';

export {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  isConditionalUISupported,
  getPasskeySupport,
  isSecureContext,
  getUnsupportedReason,
} from './lib/support';

export { createError, mapWebAuthnError, getErrorMessage, isPasskeyError } from './lib/errors';

export type {
  PasskeyAuthConfig,
  Passkey,
  AuthenticatorTransport,
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
  PasskeyError,
  PasskeyErrorCode,
  PasskeySupport,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  Session,
} from './types';
