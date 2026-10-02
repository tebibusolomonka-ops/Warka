import { expect, test, type Page } from '@playwright/test'
import { expectAccessiblePage } from './accessibility.js'

type Locale = 'en' | 'am' | 'om'
type Calendar = 'gregorian' | 'ethiopian'

async function localizedShell(
  page: Page,
  options: {
    locale?: Locale
    calendar?: Calendar
    student?: boolean
    announcements?: Array<{ id: string; title: string; body: string }>
  } = {},
) {
  let locale = options.locale ?? 'en'
  let calendar = options.calendar ?? 'gregorian'
  const canonicalEventDate = '2023-09-12T09:00:00.000Z'
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api/, '')
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    if (path === '/auth/me')
      return json({
        id: '123e4567-e89b-42d3-a456-426614174000',
        email: 'localized@example.test',
        displayName: 'Localized User',
        preferredLocale: locale,
        preferredCalendar: calendar,
      })
    if (path === '/me/language-preference' && request.method() === 'PUT') {
      locale = (request.postDataJSON() as { preferredLocale: Locale })
        .preferredLocale
      return json({ preferredLocale: locale })
    }
    if (path === '/me/calendar-preference' && request.method() === 'PUT') {
      calendar = (request.postDataJSON() as { preferredCalendar: Calendar })
        .preferredCalendar
      return json({ preferredCalendar: calendar })
    }
    if (
      path === '/organizations' ||
      path === '/schools' ||
      path === '/bureau/access'
    )
      return json([])
    if (path === '/parent/me')
      return json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403)
    if (path === '/student/me') {
      if (!options.student)
        return json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403)
      return json({
        studentReference: 'STUDENT-EXACT-001',
        givenName: 'Amina',
        familyName: null,
        currentEnrollment: {
          schoolId: '123e4567-e89b-42d3-a456-426614174010',
          school: 'Mana Barumsaa Exact',
          academicYear: '2026',
          gradeLevel: 'Grade 8',
          schoolClass: '8A',
        },
      })
    }
    if (path === '/student/announcements')
      return json(
        (options.announcements ?? []).map((item) => ({
          ...item,
          publishedAt: '2026-09-30T00:00:00.000Z',
          scope: { type: 'school' },
        })),
      )
    if (path === '/student/progress')
      return json({
        completedAssessments: 0,
        publishedResultsAvailable: 0,
        subjectsWithPublishedResults: [],
        upcomingAssessments: [],
      })
    if (path.endsWith('/events'))
      return json({
        events: [
          {
            id: '123e4567-e89b-42d3-a456-426614174020',
            schoolId: '123e4567-e89b-42d3-a456-426614174010',
            title: 'Authored event title',
            description: 'Authored event description',
            startsAt: canonicalEventDate,
            endsAt: '2023-09-12T10:00:00.000Z',
            schoolLocation: null,
            status: 'published',
            rsvpEnabled: false,
          },
        ],
      })
    if (path.includes('/events/'))
      return json({
        id: '123e4567-e89b-42d3-a456-426614174020',
        schoolId: '123e4567-e89b-42d3-a456-426614174010',
        title: 'Authored event title',
        description: 'Authored event description',
        startsAt: canonicalEventDate,
        endsAt: '2023-09-12T10:00:00.000Z',
        schoolLocation: null,
        status: 'published',
        rsvpEnabled: false,
      })
    if (request.method() === 'GET') return json([])
    return json({})
  })
  return {
    canonicalEventDate,
    preferences: () => ({ locale, calendar }),
  }
}

test('Amharic preference persists without changing access', async ({
  page,
}) => {
  const state = await localizedShell(page)
  await page.goto('/')
  await page.getByTestId('language-preference').selectOption('am')
  await expect(
    page.getByRole('navigation', { name: 'የመተግበሪያ አሰሳ' }),
  ).toBeVisible()
  expect(state.preferences()).toEqual({ locale: 'am', calendar: 'gregorian' })
  await page.reload()
  await expect(page.getByTestId('language-preference')).toHaveValue('am')
  await expect(
    page.getByText('No schools available for this account.'),
  ).toBeVisible()
  await page.keyboard.press('Tab')
  await expectAccessiblePage(page)
})

test('Afaan Oromo localizes student chrome and preserves authored text', async ({
  page,
}) => {
  await localizedShell(page, {
    locale: 'om',
    student: true,
    announcements: [
      {
        id: '123e4567-e89b-42d3-a456-426614174030',
        title: 'Teacher title exactly as entered',
        body: 'Teacher-authored content: 2 + 2 = 4',
      },
    ],
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Beeksisawwan' })).toBeVisible({
    timeout: 10_000,
  })
  const authored = await page.evaluate(async () =>
    (await fetch('/api/student/announcements')).json(),
  )
  expect(authored[0]).toMatchObject({
    title: 'Teacher title exactly as entered',
    body: 'Teacher-authored content: 2 + 2 = 4',
  })
})

test('Ethiopian calendar display leaves canonical event date unchanged', async ({
  page,
}) => {
  const state = await localizedShell(page, {
    locale: 'en',
    calendar: 'ethiopian',
    student: true,
  })
  await page.goto('/')
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      (button) => button.textContent === 'Events',
    ),
  )
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Events')
      ?.click(),
  )
  await expect(page.getByText(/Authored event title.*Gregorian/)).toBeVisible()
  expect(state.canonicalEventDate).toBe('2023-09-12T09:00:00.000Z')
  expect(state.preferences()).toEqual({ locale: 'en', calendar: 'ethiopian' })
})

test('unsupported browser locale falls back and recovery remains neutral', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'language', { value: 'fr-FR' })
  })
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      }),
    }),
  )
  await page.route('**/api/auth/recovery/request', (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'If the account exists, recovery instructions will be sent.',
      }),
    }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await page.getByLabel('Recovery email').fill('unknown@example.test')
  await page.getByRole('button', { name: 'Request recovery' }).click()
  await expect(
    page.getByText(
      'If the account exists, recovery instructions will be sent.',
    ),
  ).toBeVisible()
})
