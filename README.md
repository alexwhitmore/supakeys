# supakeys

Passkey authentication for Supabase - WebAuthn made simple.

[![npm version](https://badge.fury.io/js/supakeys.svg)](https://www.npmjs.com/package/supakeys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Full WebAuthn Level 2 compliance
- Secure by default (audited crypto via SimpleWebAuthn)
- Passwordless authentication
- Works with Touch ID, Face ID, Windows Hello, security keys
- Synced passkeys support (iCloud, Google Password Manager)
- Easy Supabase integration

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
import { createClient } from '@supabase/supabase-js';
import { createPasskeyAuth } from 'supakeys';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const passkeys = createPasskeyAuth(supabase, {
  rpId: 'your-domain.com',
  rpName: 'Your App',
});

// Register a new passkey
const { success, passkey } = await passkeys.register({
  email: 'user@example.com',
});

// Sign in with a passkey
const { success, session } = await passkeys.signIn({
  email: 'user@example.com',
});
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

## License

MIT
