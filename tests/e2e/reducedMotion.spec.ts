import { expect, test } from '@playwright/test'

test('sign in controls respect reduced motion without hiding progress', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const submit = page.getByRole('button', { name: 'Sign in' })
  await expect(submit).toBeVisible()
  await expect(submit).toHaveCSS('transition-duration', '0s')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(submit).toHaveCSS('transition-duration', '0.15s')
})
