import { useEffect, useState } from 'react'
import {
  changeStaffStatus,
  getStaffAccess,
  offboardStaffAccess,
  type StaffAccess,
  type StaffAccessPage,
} from './staffAccessApi'

type Action = 'suspended' | 'deactivated' | 'active' | 'offboard'

export function StaffLifecycleWorkspace({
  baseUrl,
  schoolId,
  currentUserId,
}: {
  baseUrl: string
  schoolId: string
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<StaffAccessPage | null>(null)
  const [skip, setSkip] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [endOrganizationMembership, setEndOrganizationMembership] =
    useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selected: StaffAccess | undefined = page?.items.find(
    (item) => item.id === selectedId,
  )

  async function refresh(offset = skip) {
    setPage(await getStaffAccess(baseUrl, schoolId, offset))
    setSkip(offset)
  }
  useEffect(() => {
    if (!open) return
    let active = true
    getStaffAccess(baseUrl, schoolId, 0)
      .then((result) => {
        if (active) {
          setPage(result)
          setSkip(0)
        }
      })
      .catch(() => {
        if (active) setMessage('Could not load staff access')
      })
    return () => {
      active = false
    }
  }, [open, baseUrl, schoolId])

  async function confirmAction() {
    if (!selected || !action || reason.trim().length < 3) return
    setBusy(true)
    setMessage('')
    try {
      if (action === 'offboard')
        await offboardStaffAccess(
          baseUrl,
          schoolId,
          selected.id,
          reason.trim(),
          endOrganizationMembership,
        )
      else
        await changeStaffStatus(
          baseUrl,
          schoolId,
          selected.id,
          action,
          reason.trim(),
        )
      await refresh()
      setMessage(
        action === 'offboard' ? 'Staff offboarded' : 'Account status updated',
      )
      setAction(null)
      setReason('')
      setEndOrganizationMembership(false)
    } catch {
      setMessage('Could not change staff access')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Staff lifecycle">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        Staff lifecycle
      </button>
      {open && (
        <>
          <h3>Staff access</h3>
          <p>
            School records and audit history remain intact when staff access
            ends.
          </p>
          {page?.items.length === 0 && <p>No staff in this scope.</p>}
          {page && (
            <>
              <ul>
                {page.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id)
                        setAction(null)
                      }}
                    >
                      {item.displayName} � {item.email} � {item.accountStatus}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={skip === 0 || busy}
                onClick={() => void refresh(Math.max(0, skip - 25))}
              >
                Previous staff
              </button>
              <button
                type="button"
                disabled={skip + page.take >= page.total || busy}
                onClick={() => void refresh(skip + page.take)}
              >
                Next staff
              </button>
            </>
          )}
          {selected && (
            <article>
              <h4>{selected.displayName}</h4>
              <p>Account: {selected.accountStatus}</p>
              <p>
                Organization role:{' '}
                {selected.organizationMembership
                  ? `${selected.organizationMembership.role} (${selected.organizationMembership.periodStatus})`
                  : 'none'}
              </p>
              <p>
                School role:{' '}
                {selected.schoolMembership
                  ? `${selected.schoolMembership.role} (${selected.schoolMembership.periodStatus})`
                  : 'none'}
              </p>
              <p>
                Organization access period:{' '}
                {selected.organizationMembership
                  ? `${selected.organizationMembership.startsAt.toLocaleDateString()} � ${selected.organizationMembership.endsAt?.toLocaleDateString() ?? 'open'}`
                  : 'none'}
              </p>
              <p>
                School access period:{' '}
                {selected.schoolMembership
                  ? `${selected.schoolMembership.startsAt.toLocaleDateString()} � ${selected.schoolMembership.endsAt?.toLocaleDateString() ?? 'open'}`
                  : 'none'}
              </p>
              <h5>Teaching assignments</h5>
              <ul>
                {selected.teachingAssignments.map((assignment) => (
                  <li key={assignment.id}>
                    Class {assignment.schoolClassId}, subject{' '}
                    {assignment.subjectId}: {assignment.periodStatus} (
                    {assignment.startsAt.toLocaleDateString()} �{' '}
                    {assignment.endsAt?.toLocaleDateString() ?? 'open'})
                  </li>
                ))}
              </ul>
              {selected.id !== currentUserId && (
                <>
                  {selected.accountStatus === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAction('suspended')}
                      >
                        Suspend account
                      </button>
                      <button
                        type="button"
                        onClick={() => setAction('deactivated')}
                      >
                        Deactivate account
                      </button>
                    </>
                  )}
                  {selected.accountStatus !== 'active' && (
                    <button type="button" onClick={() => setAction('active')}>
                      Reactivate account
                    </button>
                  )}
                  {selected.schoolMembership?.periodStatus === 'active' &&
                    (selected.organizationMembership?.periodStatus !==
                      'active' ||
                      page?.canManageOrganization) && (
                      <button
                        type="button"
                        onClick={() => setAction('offboard')}
                      >
                        Offboard staff
                      </button>
                    )}
                </>
              )}
              {action && (
                <div role="group" aria-label="Confirm staff access change">
                  <p>
                    Confirm {action} for {selected.displayName}. Historical
                    school records remain intact.
                  </p>
                  <label>
                    Reason
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  {action === 'offboard' &&
                    selected.organizationMembership?.periodStatus ===
                      'active' && (
                      <label>
                        <input
                          type="checkbox"
                          checked={endOrganizationMembership}
                          onChange={(event) =>
                            setEndOrganizationMembership(event.target.checked)
                          }
                        />
                        End organization membership too
                      </label>
                    )}
                  <button
                    type="button"
                    disabled={
                      busy ||
                      reason.trim().length < 3 ||
                      (action === 'offboard' &&
                        selected.organizationMembership?.periodStatus ===
                          'active' &&
                        !endOrganizationMembership)
                    }
                    onClick={() => void confirmAction()}
                  >
                    Confirm {action}
                  </button>
                  <button type="button" onClick={() => setAction(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </article>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}
