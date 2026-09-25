import { useEffect, useState, type FormEvent } from 'react'
import type { DocumentVerification } from '@warka/shared'
import { apiBaseUrl, verifyDocument } from './api'

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: DocumentVerification }
  | { status: 'error' }

const referencePattern = /^WRK-[A-F0-9]{32}$/

export function DocumentVerificationPage({
  initialReference = '',
}: {
  initialReference?: string
}) {
  const [reference, setReference] = useState(initialReference)
  const [result, setResult] = useState<Result>({ status: 'idle' })
  const baseUrl = (() => {
    try {
      return apiBaseUrl(import.meta.env.VITE_API_URL, window.location.origin)
    } catch {
      return null
    }
  })()

  async function check(value: string) {
    const normalized = value.trim().toUpperCase()
    if (!referencePattern.test(normalized)) {
      setResult({ status: 'loaded', data: { status: 'unavailable' } })
      return
    }
    if (!baseUrl) {
      setResult({ status: 'error' })
      return
    }
    setResult({ status: 'loading' })
    try {
      setResult({
        status: 'loaded',
        data: await verifyDocument(baseUrl, normalized),
      })
    } catch {
      setResult({ status: 'error' })
    }
  }

  useEffect(() => {
    if (initialReference) void check(initialReference)
  }, [initialReference])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = reference.trim().toUpperCase()
    window.history.replaceState(
      null,
      '',
      normalized ? '/verify/' + encodeURIComponent(normalized) : '/verify',
    )
    void check(normalized)
  }

  return (
    <main className="shell">
      <header>
        <h1>Warka</h1>
        <p>Document verification</p>
      </header>
      <section aria-labelledby="verification-heading">
        <h2 id="verification-heading">Check a document reference</h2>
        <p>Check whether a reference matches a Warka issuing-school record.</p>
        <form onSubmit={submit}>
          <label className="field">
            Verification reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button type="submit">Check reference</button>
        </form>
        {result.status === 'loading' && <p role="status">Checking reference</p>}
        {result.status === 'error' && (
          <p role="alert">
            Could not reach the verification service. Try again.
          </p>
        )}
        {result.status === 'loaded' && result.data.status === 'unavailable' && (
          <p role="status">Warka cannot verify this reference.</p>
        )}
        {result.status === 'loaded' && result.data.status === 'corrected' && (
          <p role="status">
            This document version was corrected. Check with the issuing school
            for the current version.
          </p>
        )}
        {result.status === 'loaded' && result.data.status === 'withdrawn' && (
          <p role="status">
            This document was withdrawn by the issuing school.
          </p>
        )}
        {result.status === 'loaded' && result.data.status === 'active' && (
          <section aria-labelledby="verified-heading">
            <h3 id="verified-heading">Verified Warka record</h3>
            <p>Reference matches the current Warka issuing-school record.</p>
            <dl>
              <dt>Issuing school</dt>
              <dd>{result.data.issuingSchool}</dd>
              <dt>Document type</dt>
              <dd>{result.data.documentType}</dd>
              <dt>Student</dt>
              <dd>{result.data.student.displayName}</dd>
              <dt>Student reference</dt>
              <dd>{result.data.student.studentReference}</dd>
              <dt>Issue date</dt>
              <dd>{result.data.issuedAt.slice(0, 10)}</dd>
              <dt>Academic year</dt>
              <dd>{result.data.academicYear}</dd>
              <dt>Status</dt>
              <dd>Active</dd>
            </dl>
            <h4>Published results on this document</h4>
            <ul>
              {result.data.subjects.map((subject) => (
                <li key={subject.gradingPeriod + subject.subject}>
                  {subject.gradingPeriod} · {subject.subject}:{' '}
                  {subject.percentage}% · {subject.gradeLabel}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
      <a href="/">Warka sign in</a>
    </main>
  )
}
