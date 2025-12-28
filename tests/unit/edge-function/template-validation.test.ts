import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * These tests validate that the edge function template uses correct Supabase client methods.
 * This would have caught the getUserByEmail bug before it shipped.
 */
describe('Edge Function Template Validation', () => {
  const clientInitPath = join(__dirname, '../../../packages/client/src/commands/init.ts');
  const cliInitPath = join(__dirname, '../../../packages/cli/src/commands/init.ts');
  const edgeFunctionPath = join(__dirname, '../../../supabase/functions/passkey-auth/index.ts');

  describe('Client Package Template', () => {
    let templateContent: string;

    try {
      templateContent = readFileSync(clientInitPath, 'utf-8');
    } catch {
      templateContent = '';
    }

    it('should not use getUserByEmail (does not exist in Supabase client)', () => {
      expect(templateContent).not.toContain('getUserByEmail');
    });

    it('should use listUsers() for finding users by email', () => {
      expect(templateContent).toContain('listUsers()');
    });

    it('should use correct Supabase client version (2.49.0+)', () => {
      const versionMatch = templateContent.match(/@supabase\/supabase-js@(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        const [major, minor] = version.split('.').map(Number);
        expect(major).toBeGreaterThanOrEqual(2);
        if (major === 2) {
          expect(minor).toBeGreaterThanOrEqual(49);
        }
      }
    });

    it('should include proper CORS headers', () => {
      expect(templateContent).toContain('Access-Control-Allow-Origin');
      expect(templateContent).toContain('Access-Control-Allow-Methods');
      expect(templateContent).toContain('Access-Control-Allow-Headers');
    });

    it('should handle OPTIONS requests for CORS preflight', () => {
      expect(templateContent).toContain("req.method === 'OPTIONS'");
    });
  });

  describe('CLI Package Template', () => {
    let templateContent: string;

    try {
      templateContent = readFileSync(cliInitPath, 'utf-8');
    } catch {
      templateContent = '';
    }

    it('should not use getUserByEmail (does not exist in Supabase client)', () => {
      expect(templateContent).not.toContain('getUserByEmail');
    });

    it('should use listUsers() for finding users by email', () => {
      expect(templateContent).toContain('listUsers()');
    });

    it('should use correct Supabase client version (2.49.0+)', () => {
      const versionMatch = templateContent.match(/@supabase\/supabase-js@(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        const [major, minor] = version.split('.').map(Number);
        expect(major).toBeGreaterThanOrEqual(2);
        if (major === 2) {
          expect(minor).toBeGreaterThanOrEqual(49);
        }
      }
    });
  });

  describe('Edge Function Source', () => {
    let functionContent: string;

    try {
      functionContent = readFileSync(edgeFunctionPath, 'utf-8');
    } catch {
      functionContent = '';
    }

    it('should not use getUserByEmail (does not exist in Supabase client)', () => {
      expect(functionContent).not.toContain('getUserByEmail');
    });

    it('should use listUsers() for finding users by email', () => {
      expect(functionContent).toContain('listUsers()');
    });

    it('should use correct Supabase client version (2.49.0+)', () => {
      const versionMatch = functionContent.match(/@supabase\/supabase-js@(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        const [major, minor] = version.split('.').map(Number);
        expect(major).toBeGreaterThanOrEqual(2);
        if (major === 2) {
          expect(minor).toBeGreaterThanOrEqual(49);
        }
      }
    });

    it('should include rate limiting', () => {
      expect(functionContent).toContain('check_passkey_rate_limit');
    });

    it('should include audit logging', () => {
      expect(functionContent).toContain('log_passkey_audit_event');
    });

    it('should verify challenges are single-use', () => {
      // Should delete challenge after use
      expect(functionContent).toContain('.delete()');
    });
  });
});
