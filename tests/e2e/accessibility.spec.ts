import { test, expect } from '@playwright/test'
import { expectAccessiblePage } from './accessibility.js'

test('sign in page has no automated WCAG A or AA violations', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Skip to main content' }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Language')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expectAccessiblePage(page)
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.test')
  await page.getByLabel('Password', { exact: true }).fill('InvalidPassword123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  const error = page.getByRole('alert')
  await expect(error).toBeVisible()
  await expect(error).toBeFocused()
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute(
    'aria-describedby',
    'signin-error',
  )
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})
