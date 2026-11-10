import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build id (SPT-124): the SAME value goes into the bundle (__APP_VERSION__) and into dist/version.json,
// so the running app can tell when the server holds a newer build. Order: APP_VERSION env (CI can pass
// the git sha) → git sha → build time. The Docker build has no .git, so it falls back to the build time:
// still unique per build, which is all the comparison needs.
function buildVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return String(Date.now())
  }
}
const version = buildVersion()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { host: true, port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
})
