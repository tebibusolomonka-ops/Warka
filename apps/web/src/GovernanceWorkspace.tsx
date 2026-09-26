import { useEffect, useState } from 'react'
import {
  actOnSupportGrant,
  completeReview,
  createReview,
  decideReviewEntry,
  evaluateRetention,
  getReview,
  listAudit,
  listRetention,
  listReviews,
  listSupportGrants,
  listSupportUsers,
  requestSupportGrant,
  saveRetention,
  type AccessReview,
  type AuditEvent,
  type RetentionCategory,
  type RetentionEvaluation,
  type RetentionPolicy,
  type SupportGrant,
  type SupportIdentity,
} from './governanceApi'

const categories: Array<{ value: RetentionCategory; label: string }> = [
  { value: 'messages', label: 'Messages' },
  { value: 'auditEvents', label: 'Audit events' },
  { value: 'issuedDocuments', label: 'Issued documents' },
  { value: 'academicRecords', label: 'Academic records' },
  { value: 'enrollmentRecords', label: 'Enrollment records' },
]

export function GovernanceWorkspace({
  baseUrl,
  organizationId,
  schoolId,
}: {
  baseUrl: string
  organizationId: string
  schoolId?: string
}) {
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [review, setReview] = useState<AccessReview>()
  const [supportUsers, setSupportUsers] = useState<SupportIdentity[]>([])
  const [grants, setGrants] = useState<SupportGrant[]>([])
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [supportUserId, setSupportUserId] = useState('')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  )
  const [category, setCategory] = useState<RetentionCategory>('auditEvents')
  const [retentionDays, setRetentionDays] = useState(365)
  const [evaluation, setEvaluation] = useState<RetentionEvaluation>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const [events, reviews, nextPolicies] = await Promise.all([
      listAudit(baseUrl, organizationId),
      listReviews(baseUrl, organizationId),
      listRetention(baseUrl, organizationId),
    ])
    setAudit(events)
    setPolicies(nextPolicies)
    const latest = reviews[0]
    if (latest) setReview(await getReview(baseUrl, organizationId, latest.id))
    if (schoolId) {
      const [identities, nextGrants] = await Promise.all([
        listSupportUsers(baseUrl, organizationId, schoolId),
        listSupportGrants(baseUrl, organizationId, schoolId),
      ])
      setSupportUsers(identities)
      setGrants(nextGrants)
      setSupportUserId((current) => current || identities[0]?.id || '')
    }
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load governance records.'))
  }, [baseUrl, organizationId, schoolId])

  const act = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
      await refresh()
      setMessage(success)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Governance action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const currentPolicy = policies.find((item) => item.category === category)
  const allDecided =
    review?.entries.length &&
    review.entries.every((entry) => entry.decision !== 'pending')

  return (
    <section aria-labelledby="governance-heading">
      <h2 id="governance-heading">Security governance</h2>
      <nav aria-label="Governance sections">
        Audit history · Access reviews · Support access · Data retention
      </nav>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <article aria-labelledby="access-review-heading">
        <h3 id="access-review-heading">Access reviews</h3>
        <p>
          Creating a review changes no access. Confirmed assignments remain;
          assignments marked revoke are removed only when the review is
          completed.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const created = await createReview(baseUrl, organizationId)
              setReview(await getReview(baseUrl, organizationId, created.id))
            }, 'Access review created.')
          }
        >
          Create access review
        </button>
        {review && (
          <>
            <p>
              Review status: <strong>{review.status}</strong>
            </p>
            <ul>
              {review.entries.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.user?.displayName ?? entry.userId}</strong> —{' '}
                  {entry.currentRole} ({entry.accessType}) — {entry.decision}
                  {review.status === 'open' && (
                    <span>
                      {' '}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              decideReviewEntry(
                                baseUrl,
                                organizationId,
                                review.id,
                                entry.id,
                                'confirmed',
                              ),
                            'Assignment confirmed.',
                          )
                        }
                      >
                        Confirm {entry.user?.displayName ?? entry.currentRole}
                      </button>{' '}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              decideReviewEntry(
                                baseUrl,
                                organizationId,
                                review.id,
                                entry.id,
                                'revoke',
                              ),
                            'Assignment marked for revocation.',
                          )
                        }
                      >
                        Mark {entry.user?.displayName ?? entry.currentRole} for
                        revocation
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {review.status === 'open' && (
              <button
                type="button"
                disabled={busy || !allDecided}
                onClick={() =>
                  void act(
                    () => completeReview(baseUrl, organizationId, review.id),
                    'Access review completed.',
                  )
                }
              >
                Complete access review
              </button>
            )}
          </>
        )}
      </article>

      {schoolId && (
        <article aria-labelledby="support-access-heading">
          <h3 id="support-access-heading">Temporary support access</h3>
          <p>
            Access is limited to school administration diagnostics and expires
            on the server at the stated time.
          </p>
          {supportUsers.length ? (
            <>
              <label>
                Support user
                <select
                  value={supportUserId}
                  onChange={(event) => setSupportUserId(event.target.value)}
                >
                  {supportUsers.map((supportUser) => (
                    <option key={supportUser.id} value={supportUser.id}>
                      {supportUser.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Support reason
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label>
                Expires at
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || !supportUserId || reason.trim().length < 5}
                onClick={() =>
                  void act(
                    () =>
                      requestSupportGrant(baseUrl, organizationId, {
                        supportUserId,
                        schoolId,
                        reason,
                        expiresAt: new Date(expiresAt).toISOString(),
                      }),
                    'Support access requested.',
                  )
                }
              >
                Request support access
              </button>
            </>
          ) : (
            <p>No support identities are configured.</p>
          )}
          <ul>
            {grants.map((grant) => {
              const expired = new Date(grant.expiresAt) <= new Date()
              const state =
                expired && grant.status === 'approved'
                  ? 'expired'
                  : grant.status
              return (
                <li key={grant.id}>
                  {grant.supportUser?.displayName ?? grant.supportUserId} —{' '}
                  {state} — expires {new Date(grant.expiresAt).toLocaleString()}
                  <br />
                  {grant.reason}
                  {grant.status === 'pending' && !expired && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            actOnSupportGrant(
                              baseUrl,
                              organizationId,
                              grant.id,
                              'approve',
                            ),
                          'Support access approved.',
                        )
                      }
                    >
                      Approve support access
                    </button>
                  )}
                  {grant.status !== 'revoked' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            actOnSupportGrant(
                              baseUrl,
                              organizationId,
                              grant.id,
                              'revoke',
                            ),
                          'Support access revoked.',
                        )
                      }
                    >
                      Revoke support access
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </article>
      )}

      <article aria-labelledby="retention-heading">
        <h3 id="retention-heading">Data retention</h3>
        <p>
          Evaluation is informational. It does not archive or delete records.
        </p>
        <label>
          Retention category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as RetentionCategory)
            }
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Retention days
          <input
            type="number"
            min="1"
            max="36500"
            value={retentionDays}
            onChange={(event) => setRetentionDays(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={busy || retentionDays < 1}
          onClick={() =>
            void act(
              () =>
                saveRetention(baseUrl, organizationId, category, retentionDays),
              currentPolicy
                ? 'Retention policy updated.'
                : 'Retention policy created.',
            )
          }
        >
          Save retention policy
        </button>{' '}
        <button
          type="button"
          disabled={busy || !currentPolicy}
          onClick={() =>
            void act(async () => {
              setEvaluation(
                await evaluateRetention(baseUrl, organizationId, category),
              )
            }, 'Retention evaluation completed.')
          }
        >
          Run retention evaluation
        </button>
        <ul>
          {policies.map((policy) => (
            <li key={policy.id}>
              {policy.category}: {policy.retentionDays} days
            </li>
          ))}
        </ul>
        {evaluation && (
          <p>
            Eligible records: {evaluation.eligibleCount}. Oldest eligible:{' '}
            {evaluation.oldestEligibleAt
              ? new Date(evaluation.oldestEligibleAt).toLocaleString()
              : 'none'}
          </p>
        )}
      </article>

      <article aria-labelledby="audit-history-heading">
        <h3 id="audit-history-heading">Audit history</h3>
        {audit.length ? (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.occurredAt).toLocaleString()}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.resourceType} {event.resourceId ?? ''}
                  </td>
                  <td>{event.actorUserId ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No audit events in this scope.</p>
        )}
      </article>
    </section>
  )
}
