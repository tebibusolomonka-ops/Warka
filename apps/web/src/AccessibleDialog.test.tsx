import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useState } from 'react'
import { AccessibleDialog } from './AccessibleDialog'

it('moves focus into a dialog, traps Tab, cancels with Escape, and restores focus', () => {
  function Example() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && (
          <AccessibleDialog
            title="Confirm action"
            description="Review the action"
            onClose={() => setOpen(false)}
          >
            <button onClick={() => setOpen(false)}>Cancel</button>
            <button>Confirm</button>
          </AccessibleDialog>
        )}
      </>
    )
  }
  render(<Example />)
  const opener = screen.getByRole('button', { name: 'Open' })
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Confirm action' })
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Cancel' }),
  )
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})
