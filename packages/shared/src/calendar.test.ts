import { describe, expect, it } from 'vitest'
import {
  ethiopianDateParts,
  formatAdministrativeDate,
  formatCalendarDate,
} from './calendar.js'

describe('Ethiopian calendar presentation', () => {
  it('handles Ethiopian new year and the month boundary', () => {
    expect(ethiopianDateParts('2023-09-11T00:00:00.000Z')).toEqual({
      year: 2015,
      month: 13,
      day: 6,
    })
    expect(ethiopianDateParts('2023-09-12T00:00:00.000Z')).toEqual({
      year: 2016,
      month: 1,
      day: 1,
    })
  })

  it('handles Pagume in common and leap years', () => {
    expect(ethiopianDateParts('2022-09-10T00:00:00.000Z')).toEqual({
      year: 2014,
      month: 13,
      day: 5,
    })
    expect(ethiopianDateParts('2023-09-11T00:00:00.000Z').day).toBe(6)
  })

  it.each(['en', 'am', 'om'])(
    'keeps language and calendar independent for %s',
    (locale) => {
      const canonical = '2026-09-11T00:00:00.000Z'
      expect(formatCalendarDate(canonical, locale, 'gregorian')).not.toBe(
        formatCalendarDate(canonical, locale, 'ethiopian'),
      )
      expect(
        formatAdministrativeDate(canonical, locale, 'ethiopian'),
      ).toContain('Gregorian')
      expect(canonical).toBe('2026-09-11T00:00:00.000Z')
    },
  )
})
