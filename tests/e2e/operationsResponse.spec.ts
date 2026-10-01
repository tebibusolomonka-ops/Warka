import { expect, test } from '@playwright/test'

test('operations response controls remain operator scoped', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Operations response' }),
  ).toHaveCount(0)
})
