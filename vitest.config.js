// Vitest config. By default vitest only tracks coverage for files imported
// by tests; setting coverage.include forces v8 to report all source files
// so we get a true picture of test blind spots (P2-3).

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/**/*.contract.test.{js,jsx}',
        'src/main.jsx',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
