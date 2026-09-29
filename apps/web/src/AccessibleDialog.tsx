import { useEffect, useRef, type ReactNode } from 'react'

export function AccessibleDialog({
  title,
  description,
  children,
  onClose,
  allowCancel = true,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  allowCancel?: boolean
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLElement | null>(null)
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => previous.current?.focus()
  }, [])
  const titleId = 'active-dialog-title'
  const descriptionId = 'active-dialog-description'
  return (
    <div className="dialog-backdrop">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="dialog-panel"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && allowCancel) {
            event.preventDefault()
            onClose()
          }
          if (event.key !== 'Tab') return
          const controls = [
            ...(dialog.current?.querySelectorAll<HTMLElement>(
              'button, input, select, textarea, a[href]',
            ) ?? []),
          ].filter((item) => !item.hasAttribute('disabled'))
          if (!controls.length) {
            event.preventDefault()
            return
          }
          const first = controls[0]!
          const last = controls[controls.length - 1]!
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault()
            last.focus()
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <h3 id={titleId}>{title}</h3>
        {description && <p id={descriptionId}>{description}</p>}
        {children}
      </div>
    </div>
  )
}
