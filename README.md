# supakeys

Passkey authentication for Supabase - WebAuthn made simple.

[![npm version](https://badge.fury.io/js/supakeys.svg)](https://www.npmjs.com/package/supakeys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** This package is in early development (v0.x) and the API may change between minor versions.

## Features

- Full WebAuthn Level 2 compliance
- Secure by default (audited crypto via SimpleWebAuthn)
- Passwordless authentication
- Works with Touch ID, Face ID, Windows Hello, security keys
- Synced passkeys support (iCloud, Google Password Manager)
- Easy Supabase integration

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PASSKEY REGISTRATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User                    Your App                 Supabase Edge Function    │
│   │                         │                              │                │
│   │  1. Enter email         │                              │                │
│   │ ───────────────────────>│                              │                │
│   │                         │  2. Start registration       │                │
│   │                         │ ────────────────────────────>│                │
│   │                         │                              │                │
│   │                         │  3. Challenge + options      │                │
│   │                         │ <────────────────────────────│                │
│   │  4. Biometric prompt    │                              │                │
│   │ <───────────────────────│                              │                │
│   │                         │                              │                │
│   │  5. Create passkey      │                              │                │
│   │ ───────────────────────>│                              │                │
│   │                         │  6. Finish registration      │                │
│   │                         │ ────────────────────────────>│                │
│   │                         │                              │                │
│   │                         │     ┌─────────────────────┐  │                │
│   │                         │     │ • Verify credential │  │                │
│   │                         │     │ • Create/find user  │  │                │
│   │                         │     │ • Store passkey     │  │                │
│   │                         │     │ • Generate magic    │  │                │
│   │                         │     │   link token        │  │                │
│   │                         │     └─────────────────────┘  │                │
│   │                         │                              │                │
│   │                         │  7. Token + session          │                │
│   │                         │ <────────────────────────────│                │
│   │  8. Logged in!          │                              │                │
│   │ <───────────────────────│                              │                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PASSKEY SIGN IN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User                    Your App                 Supabase Edge Function    │
│   │                         │                              │                │
│   │  1. Click sign in       │                              │                │
│   │ ───────────────────────>│                              │                │
│   │                         │  2. Start authentication     │                │
│   │                         │ ────────────────────────────>│                │
│   │                         │                              │                │
│   │                         │  3. Challenge                │                │
│   │                         │ <────────────────────────────│                │
│   │  4. Biometric prompt    │                              │                │
│   │ <───────────────────────│                              │                │
│   │                         │                              │                │
│   │  5. Use passkey         │                              │                │
│   │ ───────────────────────>│                              │                │
│   │                         │  6. Finish authentication    │                │
│   │                         │ ────────────────────────────>│                │
│   │                         │                              │                │
│   │                         │     ┌─────────────────────┐  │                │
│   │                         │     │ • Verify signature  │  │                │
│   │                         │     │ • Update counter    │  │                │
│   │                         │     │ • Generate magic    │  │                │
│   │                         │     │   link token        │  │                │
│   │                         │     └─────────────────────┘  │                │
│   │                         │                              │                │
│   │                         │  7. Token + session          │                │
│   │                         │ <────────────────────────────│                │
│   │  8. Logged in!          │                              │                │
│   │ <───────────────────────│                              │                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Security features:
• Challenges expire after 5 minutes
• Rate limiting per IP and email
• RLS policies protect user data
• Audit logging for all events
• Magic link tokens for secure session creation
```

## Quick Start

### 1. Install

```bash
npm install supakeys @supabase/supabase-js
```

### 2. Set up your Supabase project

```bash
npx supakeys init
```

This creates the required database migrations and edge function.

### 3. Use in your app

```typescript
import { createClient } from '@supabase/supabase-js'
import { createPasskeyAuth } from 'supakeys'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const passkeys = createPasskeyAuth(supabase, {
  rpId: 'your-domain.com',
  rpName: 'Your App',
})

// Register a new passkey
const { success, passkey } = await passkeys.register({
  email: 'user@example.com',
})

// Sign in with a passkey
const { success, session } = await passkeys.signIn({
  email: 'user@example.com',
})
```

## API

### Authentication

- `register(options)` - Register a new passkey for a user
- `signIn(options)` - Sign in with a passkey
- `linkPasskey(options)` - Add a passkey to a logged-in user

### Passkey Management

- `listPasskeys()` - List the current user's passkeys
- `removePasskey(options)` - Remove a passkey
- `updatePasskey(options)` - Rename a passkey

### Support Detection

- `isSupported()` - Check if passkeys are supported
- `getPasskeySupport()` - Get detailed platform support info

## Documentation

Full documentation available at [supakeys.dev](https://supakeys.dev)

## Credits

This project is built on the shoulders of giants:

- [WebAuthn](https://webauthn.guide/) - The W3C standard that makes passwordless authentication possible
- [SimpleWebAuthn](https://simplewebauthn.dev/) - The excellent TypeScript library powering the cryptographic operations
- [Supabase](https://supabase.com/) - The open source Firebase alternative providing auth, database, and edge functions

## License

MIT
