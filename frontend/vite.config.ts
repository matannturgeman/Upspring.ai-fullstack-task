import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
