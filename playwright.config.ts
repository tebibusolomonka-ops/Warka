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
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'pnpm --filter @warka/api start',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        NODE_ENV: 'test',
        RECOVERY_TEST_DELIVERY: 'enabled',
        PUBLIC_BASE_URL: 'http://127.0.0.1:4173/api',
        BACKUP_STORAGE_DIR: '.backups/e2e',
        FILE_STORAGE_BACKEND: 'local',
        FILE_STORAGE_DIR: '.files/e2e',
        FILE_SCANNER_BACKEND: 'test',
        FILE_SCANNER_TEST_OUTCOME: 'fixture',
        WARKA_FILE_SCAN_CONTROLLED_TEST: 'enabled',
        WARKA_FILE_SCAN_SCHEDULER_ENABLED: 'true',
        WARKA_FILE_SCAN_INTERVAL_MS: '1000',
        WARKA_OPERATOR_USER_IDS: '717ac602-fd66-4400-9116-13a79b8cc3da',
        OPERATIONS_TEST_ADAPTER: 'enabled',
        WARKA_BACKUP_SCHEDULER_ENABLED: 'true',
        WARKA_SCHEDULER_ACTOR_ID: '717ac602-fd66-4400-9116-13a79b8cc3da',
        WARKA_SCHEDULER_CONTROLLED_TEST: 'enabled',
      },
    },
    {
      command:
        'pnpm --filter @warka/web dev --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/api/health',
      reuseExistingServer: false,
      env: { VITE_API_URL: '/api' },
    },
  ],
})
