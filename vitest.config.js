import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.js',
        'types.js',
        'dist/',
        'build/'
      ]
    },
    include: ['__tests__/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'build']
  }
});
