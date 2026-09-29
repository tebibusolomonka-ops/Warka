export function AsyncStatus({
  message,
  urgent = false,
}: {
  message: string
  urgent?: boolean
}) {
  return (
    <p
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
    >
      {message}
    </p>
  )
}
