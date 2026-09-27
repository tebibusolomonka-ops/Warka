import { useEffect, useState, type FormEvent } from 'react'
import {
  closeSupportCase,
  createSupportCase,
  getSupportCase,
  getSupportCaseSchools,
  getSupportCases,
  replyToSupportCase,
  resolveSupportCase,
  type SupportDetail,
  type SupportItem,
} from './supportApi'

export function SupportWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId?: string
}) {
  const [open, setOpen] = useState(false)
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>(
    [],
  )
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const activeSchoolId = schoolId ?? selectedSchoolId
  const [cases, setCases] = useState<SupportItem[]>([])
  const [detail, setDetail] = useState<SupportDetail | null>(null)
  const [category, setCategory] = useState('technical')
  const [severity, setSeverity] = useState('normal')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reply, setReply] = useState('')
  const [summary, setSummary] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (schoolId) return
    void getSupportCaseSchools(baseUrl)
      .then((value) => {
        setSchools(value)
        setSelectedSchoolId(value[0]?.id ?? '')
      })
      .catch(() => setMessage('Could not load support scopes'))
  }, [open, schoolId, baseUrl])
  async function refresh(requestId?: string) {
    if (!activeSchoolId) return
    const items = await getSupportCases(baseUrl, activeSchoolId)
    setCases(items)
    if (requestId)
      setDetail(await getSupportCase(baseUrl, activeSchoolId, requestId))
  }
  useEffect(() => {
    if (open && activeSchoolId)
      void refresh().catch(() => setMessage('Could not load support requests'))
  }, [open, activeSchoolId, baseUrl])
  async function act(
    task: () => Promise<void>,
    success: string,
    requestId?: string,
  ) {
    setBusy(true)
    setMessage('')
    try {
      await task()
      await refresh(requestId)
      setMessage(success)
    } catch {
      setMessage('Support action failed')
    } finally {
      setBusy(false)
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault()
    await act(async () => {
      const created = await createSupportCase(baseUrl, activeSchoolId, {
        category,
        severity,
        title,
        description,
      })
      setDetail(await getSupportCase(baseUrl, activeSchoolId, created.id))
    }, 'Support request created')
    setTitle('')
    setDescription('')
  }
  if (!schoolId && schools.length === 0) return null
  return (
    <section
      id="support"
      aria-label={schoolId ? 'School support' : 'Warka support'}
    >
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {schoolId ? 'School support' : 'Warka support'}
      </button>
      {open && (
        <>
          <h2>{schoolId ? 'School support' : 'Warka support'}</h2>
          {!schoolId && (
            <label>
              Support school
              <select
                value={selectedSchoolId}
                onChange={(event) => {
                  setSelectedSchoolId(event.target.value)
                  setDetail(null)
                }}
              >
                {schools.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!activeSchoolId && <p>No active support school scope.</p>}
          {schoolId && (
            <form onSubmit={(event) => void create(event)}>
              <h3>New support request</h3>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="account">Account</option>
                  <option value="studentRecords">Student records</option>
                  <option value="academicResults">Academic results</option>
                  <option value="documents">Documents</option>
                  <option value="reporting">Reporting</option>
                  <option value="technical">Technical</option>
                </select>
              </label>
              <label>
                Severity
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label>
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  minLength={5}
                />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  minLength={10}
                />
              </label>
              <button type="submit" disabled={busy}>
                Create support request
              </button>
            </form>
          )}
          <h3>Requests</h3>
          <ul>
            {cases.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    void getSupportCase(baseUrl, activeSchoolId, item.id)
                      .then(setDetail)
                      .catch(() => setMessage('Could not open request'))
                  }
                >
                  {item.title} � {item.status}
                </button>
              </li>
            ))}
          </ul>
          {detail && (
            <article>
              <h3>{detail.title}</h3>
              <p>
                {detail.category} � {detail.severity} � {detail.status}
              </p>
              <p>{detail.description}</p>
              {detail.resolutionSummary && (
                <p>Resolution: {detail.resolutionSummary}</p>
              )}
              <h4>Responses</h4>
              <ul>
                {detail.messages.map((item) => (
                  <li key={item.id}>{item.body}</li>
                ))}
              </ul>
              {detail.status !== 'closed' && detail.status !== 'resolved' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void act(
                      () =>
                        replyToSupportCase(
                          baseUrl,
                          activeSchoolId,
                          detail.id,
                          reply,
                        ),
                      'Response sent',
                      detail.id,
                    )
                    setReply('')
                  }}
                >
                  <label>
                    Response
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    Send response
                  </button>
                </form>
              )}
              {!schoolId &&
                detail.status !== 'resolved' &&
                detail.status !== 'closed' && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void act(
                        () =>
                          resolveSupportCase(
                            baseUrl,
                            activeSchoolId,
                            detail.id,
                            summary,
                          ),
                        'Request resolved',
                        detail.id,
                      )
                      setSummary('')
                    }}
                  >
                    <label>
                      Resolution summary
                      <textarea
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        required
                        minLength={10}
                      />
                    </label>
                    <button type="submit" disabled={busy}>
                      Resolve request
                    </button>
                  </form>
                )}
              {schoolId && detail.status === 'resolved' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        closeSupportCase(baseUrl, activeSchoolId, detail.id),
                      'Request closed',
                      detail.id,
                    )
                  }
                >
                  Close resolved request
                </button>
              )}
            </article>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}
