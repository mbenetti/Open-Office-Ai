import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  // Bundle everything into the shell main (same policy as apps/docs): the
  // imported docs/sheets main modules are TS source with no build artifacts,
  // so externalizing them would break Node ESM resolution at runtime.
  // Exception: @firecrawl/pdf-inspector is a napi-rs native module. Bundling it
  // makes rollup eagerly require EVERY platform's .node binary at module load
  // (they're statically resolvable assets), so only the build host's binary can
  // load and the others throw dlopen errors on any other platform. Externalize
  // it so the loader resolves the correct platform binding from node_modules at
  // runtime (packaged node_modules ships alongside, see electron-builder.cjs).
  main: {
    build: {
      rollupOptions: {
        external: ['@firecrawl/pdf-inspector'],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          // dedicated preload for the auto-update window
          update: resolve(__dirname, 'src/preload/update.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          // strong-guidance update window (see src/main/update-window.ts)
          update: resolve(__dirname, 'src/renderer/update.html'),
        },
      },
    },
    server: {
      port: Number(process.env.SHELL_DEV_PORT) || 5199,
      strictPort: Boolean(process.env.SHELL_DEV_PORT),
    },
  },
})
