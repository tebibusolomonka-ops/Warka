import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalizationSettings } from './LocalizationSettings'
import {
  saveCalendarPreference,
  saveLanguagePreference,
} from './localizationApi'

vi.mock('./localizationApi', () => ({
  saveLanguagePreference: vi.fn(async (_baseUrl, locale) => locale),
  saveCalendarPreference: vi.fn(async (_baseUrl, calendar) => calendar),
}))

afterEach(cleanup)

describe('LocalizationSettings', () => {
  it('changes language without changing calendar', async () => {
    const localeChanged = vi.fn()
    const calendarChanged = vi.fn()
    render(
      <LocalizationSettings
        baseUrl="/api"
        locale="en"
        calendar="ethiopian"
        onLocaleChanged={localeChanged}
        onCalendarChanged={calendarChanged}
      />,
    )
    fireEvent.change(screen.getByTestId('language-preference'), {
      target: { value: 'am' },
    })
    await vi.waitFor(() => expect(localeChanged).toHaveBeenCalledWith('am'))
    expect(calendarChanged).not.toHaveBeenCalled()
    expect(saveLanguagePreference).toHaveBeenCalledWith('/api', 'am')
  })

  it('changes calendar without changing language', async () => {
    const localeChanged = vi.fn()
    const calendarChanged = vi.fn()
    render(
      <LocalizationSettings
        baseUrl="/api"
        locale="om"
        calendar="gregorian"
        onLocaleChanged={localeChanged}
        onCalendarChanged={calendarChanged}
      />,
    )
    fireEvent.change(screen.getByTestId('calendar-preference'), {
      target: { value: 'ethiopian' },
    })
    await vi.waitFor(() =>
      expect(calendarChanged).toHaveBeenCalledWith('ethiopian'),
    )
    expect(localeChanged).not.toHaveBeenCalled()
    expect(saveCalendarPreference).toHaveBeenCalledWith('/api', 'ethiopian')
  })
})
