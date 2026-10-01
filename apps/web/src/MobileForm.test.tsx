import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MobileForm } from './MobileForm'

it('retains visible labels and associated errors', () => {
  render(
    <MobileForm>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        inputMode="email"
        aria-describedby="email-error"
      />
      <p id="email-error" role="alert">
        Enter a valid email address
      </p>
      <button>Continue</button>
    </MobileForm>,
  )
  expect(
    screen
      .getByRole('textbox', { name: 'Email' })
      .getAttribute('aria-describedby'),
  ).toBe('email-error')
  expect(screen.getByRole('alert')).toBeTruthy()
})
