import { useEffect, useRef, useState, type ReactNode } from 'react'

export function MobileNavigation({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('a,button')?.focus()
  }, [open])
  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return (
    <div className="mobile-navigation">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <div
          ref={panel}
          id="mobile-navigation-panel"
          role="dialog"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
        >
          {children}
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
