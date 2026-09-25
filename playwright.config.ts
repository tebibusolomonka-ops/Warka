import { defineConfig, devices } from '@playwright/test'

if (!process.env.TEST_DATABASE_URL || !process.env.DATABASE_URL) {
  throw new Error('Browser tests require TEST_DATABASE_URL and DATABASE_URL')
}
if (process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) {
  throw new Error(
    'Browser tests must use the same dedicated database as the API',
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'pnpm --filter @warka/api start',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      env: { DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'test' },
    },
    {
      command:
        'pnpm --filter @warka/web dev --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      env: { VITE_API_URL: '/api' },
    },
  ],
})
