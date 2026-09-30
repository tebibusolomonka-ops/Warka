import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordChange } from './PasswordChange'
import { PublicRecovery } from './PublicRecovery'

vi.mock('./securityApi', () => ({
  requestRecovery: vi.fn(async () => undefined),
  resetRecovery: vi.fn(async () => undefined),
}))

describe('localized authentication forms', () => {
  it.each([
    ['en', 'Change your password', 'Current password'],
    ['am', 'የይለፍ ቃልዎን ይቀይሩ', 'የአሁኑ የይለፍ ቃል'],
    ['om', 'Jecha iccitii kee jijjiiri', 'Jecha iccitii ammaa'],
  ])('associates password labels in %s', (locale, heading, currentLabel) => {
    render(
      <PasswordChange
        baseUrl="https://api.example.test"
        locale={locale}
        onChanged={vi.fn(async () => undefined)}
        onSignOut={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.getByLabelText(currentLabel)).toHaveProperty(
      'autocomplete',
      'current-password',
    )
  })

  it.each([
    [
      'en',
      'Request recovery',
      'If the account exists, recovery instructions will be sent.',
    ],
    ['am', 'መልሶ ማግኛ ጠይቅ', 'መለያው ካለ፣ የመልሶ ማግኛ መመሪያዎች ይላካሉ።'],
    [
      'om',
      'Deebisanii argachuu gaafadhu',
      'Herregichi yoo jiraate, qajeelfamni deebisanii argachuu ni ergama.',
    ],
  ])(
    'uses the same neutral recovery outcome in %s',
    async (locale, requestLabel, message) => {
      const view = render(
        <PublicRecovery baseUrl="https://api.example.test" locale={locale} />,
      )
      const form = within(view.container)
      fireEvent.change(form.getAllByRole('textbox')[0]!, {
        target: { value: 'known-or-unknown@example.test' },
      })
      fireEvent.click(form.getByRole('button', { name: requestLabel }))
      expect(await form.findByRole('status')).toHaveProperty(
        'textContent',
        message,
      )
    },
  )
})
