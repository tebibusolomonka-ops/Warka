import { useEffect, useState, type FormEvent } from 'react'
import {
  addContact,
  assignTraining,
  completeOnboarding,
  finishTraining,
  getChecklist,
  getContacts,
  getOnboarding,
  getReadiness,
  getTraining,
  pauseOnboarding,
  startOnboarding,
  submitOnboarding,
  updateChecklist,
  type ChecklistItem,
  type OnboardingState,
  type Readiness,
  type SchoolContact,
  type TrainingRecord,
} from './onboardingApi'

export function SchoolOnboardingWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<OnboardingState>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [contacts, setContacts] = useState<SchoolContact[]>([])
  const [training, setTraining] = useState<TrainingRecord[]>([])
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('primary')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [trainingUserId, setTrainingUserId] = useState('')
  const [trainingType, setTrainingType] = useState('schoolAdministration')
  const [waiverReason, setWaiverReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function refresh() {
    const [
      nextState,
      nextChecklist,
      nextReadiness,
      nextContacts,
      nextTraining,
    ] = await Promise.all([
      getOnboarding(baseUrl, schoolId),
      getChecklist(baseUrl, schoolId),
      getReadiness(baseUrl, schoolId),
      getContacts(baseUrl, schoolId),
      getTraining(baseUrl, schoolId),
    ])
    setState(nextState)
    setChecklist(nextChecklist)
    setReadiness(nextReadiness)
    setContacts(nextContacts)
    setTraining(nextTraining)
  }
  useEffect(() => {
    if (open)
      void refresh().catch(() => setMessage('Could not load school operations'))
  }, [open, baseUrl, schoolId])
  async function act(task: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage('')
    try {
      await task()
      await refresh()
      setMessage(success)
    } catch {
      setMessage('Action could not be completed')
    } finally {
      setBusy(false)
    }
  }
  async function add(event: FormEvent) {
    event.preventDefault()
    await act(
      () =>
        addContact(baseUrl, schoolId, {
          name: contactName,
          role: contactRole,
          email: contactEmail || null,
          phone: contactPhone || null,
        }),
      'Contact saved',
    )
    setContactName('')
    setContactEmail('')
    setContactPhone('')
  }
  return (
    <section aria-label="School onboarding">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        School onboarding
      </button>
      {open && (
        <>
          <h2>School onboarding</h2>
          <p>Onboarding status: {state?.status ?? 'notStarted'}</p>
          {!state && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  () => startOnboarding(baseUrl, schoolId),
                  'Onboarding started',
                )
              }
            >
              Start onboarding
            </button>
          )}
          {state?.status === 'paused' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  () => startOnboarding(baseUrl, schoolId),
                  'Onboarding resumed',
                )
              }
            >
              Resume onboarding
            </button>
          )}
          {state?.status === 'inProgress' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  () => pauseOnboarding(baseUrl, schoolId),
                  'Onboarding paused',
                )
              }
            >
              Pause onboarding
            </button>
          )}
          <h3>Readiness</h3>
          <p>Current readiness: {readiness?.status ?? 'loading'}</p>
          <ul>
            {readiness?.checks.map((check) => (
              <li key={check.key}>
                {check.status}: {check.reason}
              </li>
            ))}
          </ul>
          <nav aria-label="Configuration links">
            <a href="#schools-heading">School profile</a> �{' '}
            <a href="#academic-workspace-heading">Academic setup and results</a>{' '}
            � <a href="#assignments-heading">Staff assignments</a> �{' '}
            <a href="#students-heading">Students</a>
          </nav>
          <h3>Checklist</h3>
          <ul>
            {checklist.map((item) => (
              <li key={item.key}>
                {item.key}: {item.status} (
                {item.source === 'system'
                  ? 'Verified from Warka configuration'
                  : 'Manual confirmation'}
                )
                {item.source === 'manual' && state?.status === 'inProgress' && (
                  <select
                    aria-label={`Set ${item.key}`}
                    value={item.status}
                    disabled={busy}
                    onChange={(event) =>
                      void act(
                        () =>
                          updateChecklist(
                            baseUrl,
                            schoolId,
                            item.key,
                            event.target.value as
                              'pending' | 'complete' | 'notApplicable',
                          ),
                        'Checklist updated',
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="complete">Complete</option>
                    <option value="notApplicable">Not applicable</option>
                  </select>
                )}
              </li>
            ))}
          </ul>
          <h3>Contacts</h3>
          <ul>
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.name} � {contact.role} �{' '}
                {contact.email ?? contact.phone}
              </li>
            ))}
          </ul>
          <form onSubmit={(event) => void add(event)}>
            <label>
              Contact name
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                required
              />
            </label>
            <label>
              Contact role
              <select
                value={contactRole}
                onChange={(event) => setContactRole(event.target.value)}
              >
                <option value="primary">Primary</option>
                <option value="technical">Technical</option>
                <option value="records">Records</option>
                <option value="emergency">Emergency</option>
              </select>
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </label>
            <label>
              Contact phone
              <input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy || (!contactEmail && !contactPhone)}
            >
              Save contact
            </button>
          </form>
          <h3>Staff training</h3>
          <ul>
            {training.map((item) => (
              <li key={item.id}>
                {item.user.displayName} � {item.trainingType} � {item.status}
                {item.status === 'assigned' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            finishTraining(
                              baseUrl,
                              schoolId,
                              item.id,
                              'completed',
                            ),
                          'Training completed',
                        )
                      }
                    >
                      Complete training
                    </button>
                    <button
                      type="button"
                      disabled={busy || waiverReason.trim().length < 5}
                      onClick={() =>
                        void act(
                          () =>
                            finishTraining(
                              baseUrl,
                              schoolId,
                              item.id,
                              'waived',
                              waiverReason,
                            ),
                          'Training waived',
                        )
                      }
                    >
                      Waive training
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <label>
            Waiver reason
            <input
              value={waiverReason}
              onChange={(event) => setWaiverReason(event.target.value)}
            />
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void act(
                () =>
                  assignTraining(
                    baseUrl,
                    schoolId,
                    trainingUserId,
                    trainingType,
                  ),
                'Training assigned',
              )
            }}
          >
            <label>
              Staff user ID
              <input
                value={trainingUserId}
                onChange={(event) => setTrainingUserId(event.target.value)}
                required
              />
            </label>
            <label>
              Training type
              <select
                value={trainingType}
                onChange={(event) => setTrainingType(event.target.value)}
              >
                <option value="schoolAdministration">
                  School administration
                </option>
                <option value="studentRegistration">
                  Student registration
                </option>
                <option value="academicResults">Academic results</option>
                <option value="documentProcessing">Document processing</option>
              </select>
            </label>
            <button type="submit" disabled={busy}>
              Assign training
            </button>
          </form>
          {state?.status === 'inProgress' && (
            <button
              type="button"
              disabled={
                busy ||
                readiness?.status === 'blocked' ||
                checklist.some(
                  (item) =>
                    item.source === 'manual' && item.status === 'pending',
                )
              }
              onClick={() =>
                void act(
                  () => submitOnboarding(baseUrl, schoolId),
                  'Onboarding submitted for review',
                )
              }
            >
              Submit onboarding for review
            </button>
          )}
          {state?.status === 'readyForReview' && (
            <button
              type="button"
              disabled={busy || readiness?.status === 'blocked'}
              onClick={() =>
                void act(
                  () => completeOnboarding(baseUrl, schoolId),
                  'Onboarding completed',
                )
              }
            >
              Complete onboarding
            </button>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </section>
  )
}
