# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-25

### Added

- Initial release
- `createPasskeyAuth()` - Create a passkey auth client
- `register()` - Register new passkeys
- `signIn()` - Authenticate with passkeys
- `linkPasskey()` - Add passkeys to existing accounts
- `listPasskeys()` - List user's registered passkeys
- `removePasskey()` - Delete passkeys
- `updatePasskey()` - Rename passkeys
- `isSupported()` - Check browser passkey support
- `getPasskeySupport()` - Get detailed platform support info
- CLI tool for project setup (`npx supakeys init`)
- Database migrations for passkey storage
- Supabase Edge Function for WebAuthn operations
