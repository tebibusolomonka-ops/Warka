import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MobileNavigation } from './MobileNavigation'

describe('mobile navigation', () => {
  it('names, focuses, closes with Escape and restores its trigger', async () => {
    render(
      <MobileNavigation label="Navigation">
        <a href="#current" aria-current="page">
          Current
        </a>
      </MobileNavigation>,
    )
    const trigger = screen.getByRole('button', { name: 'Navigation' })
    fireEvent.click(trigger)
    expect(screen.getByRole('link', { name: 'Current' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(trigger).toHaveFocus()
  })
})
