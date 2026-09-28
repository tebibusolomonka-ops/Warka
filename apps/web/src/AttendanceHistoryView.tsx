import { useEffect, useRef, useState } from 'react'
import type { AttendanceHistory } from './attendanceApi'

export function AttendanceHistoryView({
  load,
  requestKey,
}: {
  load: () => Promise<AttendanceHistory>
  requestKey: string
}) {
  const loadRef = useRef(load)
  loadRef.current = load
  const [history, setHistory] = useState<AttendanceHistory | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setHistory(null)
    setError(false)
    loadRef
      .current()
      .then((value) => {
        if (active) setHistory(value)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [requestKey])
  if (error) return <p role="alert">Could not load attendance history.</p>
  if (!history) return <p role="status">Loading attendance history</p>
  return (
    <section aria-label="Attendance history">
      <h3>Attendance history</h3>
      {history.records.length === 0 ? (
        <p>No finalized attendance records yet.</p>
      ) : (
        <table>
          <caption>Finalized attendance</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Class</th>
              <th scope="col">Subject</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.records.map((record) => (
              <tr key={record.id}>
                <td>{record.date.slice(0, 10)}</td>
                <td>{record.className}</td>
                <td>{record.subjectName ?? 'Class session'}</td>
                <td>{record.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
