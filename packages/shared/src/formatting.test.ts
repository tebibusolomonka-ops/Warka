import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatPercentage,
  formatTime,
} from './formatting.js'

const localeTags = { en: 'en-ET', am: 'am-ET', om: 'om-ET' } as const

describe('locale formatting', () => {
  it.each(Object.entries(localeTags))(
    'formats values for %s',
    (locale, tag) => {
      const instant = '2026-09-30T09:15:00.000Z'
      expect(formatNumber(12345.6, locale)).toBe(
        new Intl.NumberFormat(tag).format(12345.6),
      )
      expect(formatPercentage(87.5, locale)).toBe(
        new Intl.NumberFormat(tag, {
          style: 'percent',
          maximumFractionDigits: 2,
        }).format(0.875),
      )
      expect(formatDate(instant, locale, { timeZone: 'UTC' })).toBeTruthy()
      expect(formatTime(instant, locale, { timeZone: 'UTC' })).toBeTruthy()
      expect(formatDateTime(instant, locale, { timeZone: 'UTC' })).toBeTruthy()
      expect(formatFileSize(1536, locale)).toContain('KB')
    },
  )

  it('keeps timezone independent from language selection', () => {
    const instant = '2026-09-30T21:30:00.000Z'
    expect(formatTime(instant, 'en', { timeZone: 'UTC' })).not.toBe(
      formatTime(instant, 'en', { timeZone: 'Africa/Addis_Ababa' }),
    )
    expect(instant).toBe('2026-09-30T21:30:00.000Z')
  })

  it('falls back safely for an unsupported locale', () => {
    expect(formatNumber(1200, 'unsupported')).toBe(formatNumber(1200, 'en'))
  })
})
