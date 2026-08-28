import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

function readAppVersion(): string {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

type ElectronProcess = ChildProcess & { pid?: number };

function getElectronApp(): ElectronProcess | undefined {
  return (process as NodeJS.Process & { electronApp?: ElectronProcess }).electronApp;
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion()),
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        async onstart({ startup }) {
          try {
            await startup(['.']);
          } catch (error) {
            console.warn('[electron] startup failed, clearing stale process and retrying…', error);
            (process as NodeJS.Process & { electronApp?: ElectronProcess }).electronApp = undefined;
            await startup(['.']);
          }

          const appProcess = getElectronApp();
          if (appProcess) {
            // Plugin binds exit → process.exit, which kills Vite when the window closes.
            appProcess.removeAllListeners('exit');
            appProcess.on('exit', (code) => {
              console.log(
                `[electron] window closed (code ${code ?? 'null'}). Vite still running — run npm run dev again to reopen.`,
              );
            });
          }
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron-store'],
              output: {
                entryFileNames: 'main.js',
                format: 'es',
              },
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                // Must be .cjs — package.json has "type": "module", and the
                // preload bundle is CommonJS (require). A .mjs name makes
                // Electron treat it as ESM and skip contextBridge entirely.
                entryFileNames: 'preload.cjs',
                format: 'cjs',
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
