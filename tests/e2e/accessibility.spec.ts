import { test, expect } from '@playwright/test'
import { expectAccessiblePage } from './accessibility.js'

test('sign in page has no automated WCAG A or AA violations', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expectAccessiblePage(page)
})
