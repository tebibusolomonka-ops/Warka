import { useEffect, useRef } from 'react'

export function FormErrorSummary({
  id,
  message,
}: {
  id: string
  message: string
}) {
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (message) summary.current?.focus()
  }, [message])
  if (!message) return null
  return (
    <div id={id} ref={summary} tabIndex={-1} role="alert">
      {message}
    </div>
  )
}
