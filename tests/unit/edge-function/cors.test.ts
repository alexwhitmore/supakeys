import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests to verify CORS headers are properly configured in edge function templates.
 * These ensure cross-origin requests work correctly.
 */
describe('CORS Configuration', () => {
  const clientInitPath = join(__dirname, '../../../packages/client/src/commands/init.ts');
  const cliInitPath = join(__dirname, '../../../packages/cli/src/commands/init.ts');
  const edgeFunctionPath = join(__dirname, '../../../supabase/functions/passkey-auth/index.ts');

  describe('Client Package Template CORS', () => {
    let templateContent: string;

    try {
      templateContent = readFileSync(clientInitPath, 'utf-8');
    } catch {
      templateContent = '';
    }

    it('should include Access-Control-Allow-Origin header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Origin');
    });

    it('should include Access-Control-Allow-Methods header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Methods');
    });

    it('should include Access-Control-Allow-Headers header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Headers');
    });

    it('should handle OPTIONS preflight requests', () => {
      expect(templateContent).toContain("req.method === 'OPTIONS'");
    });

    it('should allow POST method', () => {
      expect(templateContent).toMatch(/Access-Control-Allow-Methods.*POST/);
    });

    it('should allow Content-Type header', () => {
      expect(templateContent).toMatch(/Access-Control-Allow-Headers.*[Cc]ontent-[Tt]ype/);
    });

    it('should allow Authorization header', () => {
      expect(templateContent).toMatch(/Access-Control-Allow-Headers.*[Aa]uthorization/);
    });
  });

  describe('CLI Package Template CORS', () => {
    let templateContent: string;

    try {
      templateContent = readFileSync(cliInitPath, 'utf-8');
    } catch {
      templateContent = '';
    }

    it('should include Access-Control-Allow-Origin header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Origin');
    });

    it('should include Access-Control-Allow-Methods header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Methods');
    });

    it('should include Access-Control-Allow-Headers header', () => {
      expect(templateContent).toContain('Access-Control-Allow-Headers');
    });

    it('should handle OPTIONS preflight requests', () => {
      expect(templateContent).toContain("req.method === 'OPTIONS'");
    });
  });

  describe.skip('Edge Function Source CORS', () => {
    let functionContent: string;

    try {
      functionContent = readFileSync(edgeFunctionPath, 'utf-8');
    } catch {
      functionContent = '';
    }

    it('should include Access-Control-Allow-Origin header', () => {
      expect(functionContent).toContain('Access-Control-Allow-Origin');
    });

    it('should include Access-Control-Allow-Methods header', () => {
      expect(functionContent).toContain('Access-Control-Allow-Methods');
    });

    it('should include Access-Control-Allow-Headers header', () => {
      expect(functionContent).toContain('Access-Control-Allow-Headers');
    });

    it('should handle OPTIONS preflight requests', () => {
      expect(functionContent).toContain("req.method === 'OPTIONS'");
    });

    it('should return a response for OPTIONS requests', () => {
      // When handling OPTIONS, should return a Response (status defaults to 200 if not specified)
      expect(functionContent).toMatch(/OPTIONS.*new Response/s);
    });
  });
});
