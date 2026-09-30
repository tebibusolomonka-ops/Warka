import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocalizedNavigation } from './LocalizedNavigation'

describe('LocalizedNavigation', () => {
  it.each([
    ['en', 'Application navigation', 'Search'],
    ['am', 'የመተግበሪያ አሰሳ', 'ፍለጋ'],
    ['om', 'Qajeelcha appii', 'Barbaadi'],
  ])('renders accessible stable links for %s', (locale, label, search) => {
    render(<LocalizedNavigation locale={locale} />)
    const navigation = screen.getByRole('navigation', { name: label })
    expect(navigation).toBeTruthy()
    expect(
      within(navigation)
        .getByRole('link', { name: search })
        .getAttribute('href'),
    ).toBe('#global-search')
    expect(within(navigation).getAllByRole('link')).toHaveLength(11)
  })
})
