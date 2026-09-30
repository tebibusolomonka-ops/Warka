import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StaffWorkflowNavigation } from './StaffWorkflowNavigation'

afterEach(cleanup)

describe('StaffWorkflowNavigation', () => {
  it.each([
    ['en', 'School workflow navigation', 'Student registration'],
    ['am', 'የትምህርት ቤት ሂደት አሰሳ', 'የተማሪ ምዝገባ'],
    ['om', 'Qajeelcha hojii mana barumsaa', 'Galmee barataa'],
  ])(
    'keeps stable staff workflow targets in %s',
    (locale, label, registration) => {
      render(<StaffWorkflowNavigation locale={locale} />)
      const navigation = screen.getByRole('navigation', { name: label })
      expect(
        navigation.querySelector('a[href="#students-heading"]')?.textContent,
      ).toBe(registration)
      expect(navigation.querySelectorAll('a')).toHaveLength(9)
    },
  )
})
