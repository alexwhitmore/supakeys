import type { PasskeySupport } from "../types";

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.navigator !== "undefined" &&
    typeof window.navigator.credentials !== "undefined"
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function isConditionalUISupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    const pubKeyCred = PublicKeyCredential as typeof PublicKeyCredential & {
      isConditionalMediationAvailable?: () => Promise<boolean>;
    };

    if (typeof pubKeyCred.isConditionalMediationAvailable === "function") {
      return await pubKeyCred.isConditionalMediationAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

export async function getPasskeySupport(): Promise<PasskeySupport> {
  const webauthn = isWebAuthnSupported();

  if (!webauthn) {
    return {
      webauthn: false,
      platformAuthenticator: false,
      conditionalUI: false,
    };
  }

  const [platformAuthenticator, conditionalUI] = await Promise.all([
    isPlatformAuthenticatorAvailable(),
    isConditionalUISupported(),
  ]);

  return {
    webauthn,
    platformAuthenticator,
    conditionalUI,
  };
}

export function isSecureContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.isSecureContext === true;
}

export function getUnsupportedReason(): string | null {
  if (typeof window === "undefined") {
    return "Passkeys are only available in browser environments.";
  }

  if (!isSecureContext()) {
    return "Passkeys require a secure connection (HTTPS).";
  }

  if (!isWebAuthnSupported()) {
    return "Your browser does not support passkeys. Please update to a modern browser.";
  }

  return null;
}
