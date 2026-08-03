import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron-store', 'pdf-parse', 'ts-jobspy']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            // Electron always loads preload scripts as CommonJS, regardless of
            // "type": "module" in package.json. vite-plugin-electron defaults to
            // building preload as ESM when it detects an ESM project, which made
            // contextBridge.exposeInMainWorld() silently never run. Forcing cjs
            // here (both lib.formats and rolldownOptions.output.format) makes the
            // plugin actually emit a require()-based bundle instead.
            lib: {
              formats: ['cjs']
            },
            rolldownOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].js'
              }
            }
          }
        }
      }
    ]),
    renderer(),
  ],
})
