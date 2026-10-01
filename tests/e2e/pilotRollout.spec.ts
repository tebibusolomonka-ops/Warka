import { expect, test } from '@playwright/test'

test('pilot rollout controls are absent from the public and school-neutral surface', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Activate pilot' }),
  ).toHaveCount(0)
})
