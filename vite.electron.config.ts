import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

const ENTRIES: Record<string, string> = { main: 'electron/main.ts', preload: 'electron/preload.ts' };

export default defineConfig(({ mode }) => {
  const name = mode === 'preload' ? 'preload' : 'main';
  return {
    publicDir: false,
    build: {
      outDir: 'dist-electron',
      emptyOutDir: name === 'main',
      target: 'node22',
      minify: false,
      lib: { entry: ENTRIES[name], formats: ['cjs'], fileName: () => `${name}.cjs` },
      rollupOptions: {
        external: ['electron', ...builtinModules, ...builtinModules.map((module) => `node:${module}`)],
      },
    },
  };
});
