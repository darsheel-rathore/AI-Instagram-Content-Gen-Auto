import { defineConfig } from 'vitest/config'
import path from 'path'

// No @vitejs/plugin-react here: nothing renders JSX in tests yet (Vite's
// default esbuild transform handles .tsx syntax fine for that on its own).
// Add the plugin back if/when a component test needs React Fast Refresh /
// Babel-based JSX niceties — as of vitest@3.2.7 it pulls in a second, slightly
// mismatched copy of `vite` that trips `tsc --noEmit` on the plugin's type
// (harmless at runtime, but worth avoiding until actually needed).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Default env is node — right for API routes and lib/ code, which is most
    // of what this project needs tested, and faster than jsdom. A component
    // test that needs a DOM should opt in per-file with a docblock at the very
    // top of the file:
    //   // @vitest-environment jsdom
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
})
