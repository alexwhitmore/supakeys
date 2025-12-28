import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    splitting: false,
    treeshake: true,
    external: ['@supabase/supabase-js'],
  },
  // CLI build
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: false,
    clean: false,
    minify: false,
    splitting: false,
    treeshake: true,
  },
]);
