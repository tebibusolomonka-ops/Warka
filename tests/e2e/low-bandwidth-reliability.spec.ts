import { expect, test } from '@playwright/test'

test('manifest and service worker enforce a static shell boundary', async ({
  request,
}) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  const worker = await request.get('/service-worker.js')
  expect(await worker.text()).toContain("pathname.startsWith('/api/')")
})
