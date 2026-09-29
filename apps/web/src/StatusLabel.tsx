export function StatusLabel({
  status,
  context,
}: {
  status: string
  context?: string
}) {
  return (
    <span className={`status status-${status}`}>
      {context ? `${context}: ` : ''}
      {status}
    </span>
  )
}
