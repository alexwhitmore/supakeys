# supakeys

Passkey authentication for Supabase - WebAuthn made simple.

## Installation

```bash
npm install supakeys @supabase/supabase-js
```

## Setup

```bash
npx supakeys init
```

This creates the required database migrations and edge function in your Supabase project.

## Quick Start

```typescript
import { createClient } from '@supabase/supabase-js';
import { createPasskeyAuth } from 'supakeys';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const passkeys = createPasskeyAuth(supabase, {
  rpId: 'your-domain.com',
  rpName: 'Your App',
});

// Register a passkey
const { success, passkey } = await passkeys.register({
  email: 'user@example.com',
});

// Sign in with a passkey
const { success, session } = await passkeys.signIn({
  email: 'user@example.com',
});
```

## Documentation

Full documentation at [supakeys.com](https://supakeys.com)

## License

MIT
