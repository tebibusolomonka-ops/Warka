import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { FormErrorSummary } from './FormErrorSummary'

it('announces and focuses a form error summary', () => {
  const { rerender } = render(<FormErrorSummary id="error" message="" />)
  rerender(
    <FormErrorSummary id="error" message="Check the highlighted field" />,
  )
  const summary = screen.getByRole('alert')
  expect(summary.id).toBe('error')
  expect(document.activeElement).toBe(summary)
})
