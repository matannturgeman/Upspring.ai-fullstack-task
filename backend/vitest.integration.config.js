import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: './tests/setup.js',
    include: ['tests/integration/**/*.test.js'],
  },
})
