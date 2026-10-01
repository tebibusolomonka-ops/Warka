import { expect, test } from '@playwright/test'

test.describe('mobile responsiveness', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('public sign-in remains usable without horizontal overflow', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
