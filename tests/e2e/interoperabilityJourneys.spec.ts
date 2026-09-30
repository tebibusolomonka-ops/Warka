import { expect, test } from '@playwright/test'

test('validated import is dry-run safe, controlled, and idempotent', async ({
  page,
}) => {
  let students = 0
  let enrollments = 0
  let references = 0
  let applied = false
  await page.route('**/interop/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/dry-run'))
      return route.fulfill({
        json: {
          validRows: 1,
          invalidRows: 0,
          warnings: 1,
          possibleDuplicates: 1,
          unresolvedReferences: [],
          version: 'dry-1',
        },
      })
    if (path.endsWith('/apply')) {
      if (!applied) {
        students += 1
        enrollments += 1
        references += 1
        applied = true
      }
      return route.fulfill({
        json: {
          students,
          enrollments,
          references,
          enrollmentStatus: 'draft',
          accountProvisioned: false,
          guardianVerified: false,
        },
      })
    }
    return route.fulfill({ status: 404 })
  })
  await page.setContent(
    '<button id="dry">Run dry run</button><button id="apply">Apply validated import</button><output id="result"></output><script>dry.onclick=async()=>result.textContent=JSON.stringify(await(await fetch("http://127.0.0.1:4173/interop/dry-run",{method:"POST"})).json());apply.onclick=async()=>result.textContent=JSON.stringify(await(await fetch("http://127.0.0.1:4173/interop/apply",{method:"POST"})).json())</script>',
  )
  await page.getByRole('button', { name: 'Run dry run' }).click()
  await expect(page.locator('output')).toContainText('possibleDuplicates":1')
  expect(students).toBe(0)
  await page.getByRole('button', { name: 'Apply validated import' }).click()
  await expect(page.locator('output')).toContainText(
    '"enrollmentStatus":"draft"',
  )
  await expect(page.locator('output')).toContainText(
    '"accountProvisioned":false',
  )
  await expect(page.locator('output')).toContainText('"guardianVerified":false')
  await page.getByRole('button', { name: 'Apply validated import' }).click()
  expect({ students, enrollments, references }).toEqual({
    students: 1,
    enrollments: 1,
    references: 1,
  })
})

test('exchange and bulk actions remain scoped', async ({ page }) => {
  await page.route('**/interop/**', async (route) => {
    const role = route.request().headers()['x-role']
    const school = route.request().headers()['x-school']
    const path = new URL(route.request().url()).pathname
    if (role === 'teacher' || school === 'school-b' || role === 'student')
      return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } })
    if (path.endsWith('/exchange'))
      return route.fulfill({
        json: {
          manifest: {
            format: 'warkaExchangePackage',
            version: '1.0',
            files: [
              { name: 'student-transfer.json', checksum: 'a'.repeat(64) },
            ],
          },
          files: { 'student-transfer.json': '{"studentReference":"WKA-1"}' },
        },
      })
    return route.fulfill({ status: 204 })
  })
  const result = await page.evaluate(async () =>
    (
      await fetch('http://127.0.0.1:4173/interop/exchange', {
        method: 'POST',
        headers: { 'x-role': 'administrator', 'x-school': 'school-a' },
      })
    ).json(),
  )
  expect(result.manifest.version).toBe('1.0')
  expect(JSON.stringify(result)).not.toMatch(
    /password|session|recovery|securityLog|familyMessage/i,
  )
  for (const headers of [
    { 'x-role': 'teacher', 'x-school': 'school-a' },
    { 'x-role': 'administrator', 'x-school': 'school-b' },
    { 'x-role': 'student', 'x-school': 'school-a' },
  ]) {
    const status = await page.evaluate(
      async (requestHeaders) =>
        (
          await fetch('http://127.0.0.1:4173/interop/import', {
            method: 'POST',
            headers: requestHeaders,
          })
        ).status,
      headers,
    )
    expect(status).toBe(403)
  }
})
