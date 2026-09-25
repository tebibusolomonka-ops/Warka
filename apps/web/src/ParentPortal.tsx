import { useEffect, useState, type FormEvent } from 'react'
import type {
  ParentIdentity,
  ParentChild,
  StudentResult,
  StudentMaterial,
  StudentAnnouncement,
  FamilyConversationSummary,
  FamilyConversationDetail,
  TeacherContact,
} from '@warka/shared'
import { ApiError } from './api'
import {
  getParentChildren,
  getParentResults,
  getParentMaterials,
  getParentAnnouncements,
  getParentConversations,
  getParentConversation,
  getTeacherContacts,
  createParentConversation,
  sendParentMessage,
} from './parentApi'

type Load<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: T }
type Section =
  'Overview' | 'Results' | 'Materials' | 'Announcements' | 'Messages'

function safeResource(url: string) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function ParentPortal({
  baseUrl,
  identity,
  onSessionExpired,
  onSignOut,
}: {
  baseUrl: string
  identity: ParentIdentity
  onSessionExpired: () => void
  onSignOut: () => void
}) {
  const [children, setChildren] = useState<Load<ParentChild[]>>({
    status: 'loading',
  })
  const [selectedReference, setSelectedReference] = useState('')
  const [section, setSection] = useState<Section>('Overview')
  const [contentFor, setContentFor] = useState<Section>('Overview')
  const [content, setContent] = useState<
    Load<StudentResult[] | StudentMaterial[] | StudentAnnouncement[]>
  >({ status: 'loading' })
  const [conversations, setConversations] = useState<
    Load<FamilyConversationSummary[]>
  >({ status: 'loading' })
  const [contacts, setContacts] = useState<Load<TeacherContact[]>>({
    status: 'loading',
  })
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversation, setConversation] = useState<
    Load<FamilyConversationDetail>
  >({ status: 'loading' })
  const [route, setRoute] = useState<'schoolOffice' | 'teacher'>('schoolOffice')
  const [teacherUserId, setTeacherUserId] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const selected =
    children.status === 'loaded'
      ? children.data.find(
          (item) => item.studentReference === selectedReference,
        )
      : undefined

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
    else setError('Could not complete the request. Refresh and try again.')
  }

  useEffect(() => {
    let active = true
    setChildren({ status: 'loading' })
    getParentChildren(baseUrl)
      .then((data) => {
        if (!active) return
        setChildren({ status: 'loaded', data })
        setSelectedReference((current) =>
          data.some((child) => child.studentReference === current)
            ? current
            : (data[0]?.studentReference ?? ''),
        )
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setChildren({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh, onSessionExpired])

  useEffect(() => {
    if (
      !selected ||
      !['Results', 'Materials', 'Announcements'].includes(section)
    )
      return
    let active = true
    setContentFor(section)
    setContent({ status: 'loading' })
    const request =
      section === 'Results'
        ? getParentResults(baseUrl, selected.studentReference)
        : section === 'Materials'
          ? getParentMaterials(baseUrl, selected.studentReference)
          : getParentAnnouncements(baseUrl, selected.studentReference)
    request
      .then((data) => {
        if (active) setContent({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setContent({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, selected, section, refresh, onSessionExpired])

  useEffect(() => {
    if (section !== 'Messages' || !selected) return
    let active = true
    setConversations({ status: 'loading' })
    setContacts({ status: 'loading' })
    Promise.all([
      getParentConversations(baseUrl),
      getTeacherContacts(baseUrl, selected.studentReference),
    ])
      .then(([threads, teachers]) => {
        if (!active) return
        setConversations({
          status: 'loaded',
          data: threads.filter(
            (item) => item.studentReference === selected.studentReference,
          ),
        })
        setContacts({ status: 'loaded', data: teachers })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else {
          setConversations({ status: 'error' })
          setContacts({ status: 'error' })
        }
      })
    return () => {
      active = false
    }
  }, [baseUrl, selected, section, refresh, onSessionExpired])

  useEffect(() => {
    if (section !== 'Messages' || !selectedConversationId) return
    let active = true
    setConversation({ status: 'loading' })
    getParentConversation(baseUrl, selectedConversationId)
      .then((data) => {
        if (active) setConversation({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setConversation({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, selectedConversationId, section, refresh, onSessionExpired])

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const created = await createParentConversation(baseUrl, {
        studentReference: selected.studentReference,
        route,
        ...(route === 'teacher' ? { teacherUserId } : {}),
        body,
      })
      setBody('')
      setSelectedConversationId(created.id)
      setMessage('Conversation started.')
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedConversationId) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await sendParentMessage(baseUrl, selectedConversationId, reply)
      setReply('')
      setMessage('Message sent.')
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  const visibleContent =
    contentFor === section ? content : { status: 'loading' as const }

  return (
    <section className="parent-portal" aria-labelledby="parent-portal-heading">
      <div className="account">
        <h2 id="parent-portal-heading">Parent portal</h2>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <p>Welcome, {identity.displayName}</p>
      {children.status === 'loading' && <p role="status">Loading children</p>}
      {children.status === 'error' && (
        <div role="alert">
          <p>Could not load children.</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {children.status === 'loaded' && children.data.length === 0 && (
        <p>No children are currently available in the parent portal.</p>
      )}
      {children.status === 'loaded' && children.data.length > 0 && (
        <>
          <label className="field">
            Child
            <select
              value={selectedReference}
              onChange={(event) => {
                setSelectedReference(event.target.value)
                setSelectedConversationId('')
                setSection('Overview')
              }}
            >
              {children.data.map((child) => (
                <option
                  key={child.studentReference}
                  value={child.studentReference}
                >
                  {child.displayName} - {child.school}
                </option>
              ))}
            </select>
          </label>
          <nav className="workspace-nav" aria-label="Parent portal sections">
            {(
              [
                'Overview',
                'Results',
                'Materials',
                'Announcements',
                'Messages',
              ] as const
            ).map((item) => (
              <button
                key={item}
                type="button"
                aria-current={section === item ? 'page' : undefined}
                onClick={() => setSection(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          {selected && section === 'Overview' && (
            <div className="academic-panel">
              <h3>{selected.displayName}</h3>
              <p>Warka reference: {selected.studentReference}</p>
              <dl>
                <dt>School</dt>
                <dd>{selected.school}</dd>
                <dt>Academic year</dt>
                <dd>{selected.academicYear}</dd>
                <dt>Grade</dt>
                <dd>{selected.gradeLevel}</dd>
                <dt>Class</dt>
                <dd>{selected.schoolClass ?? 'Not assigned'}</dd>
                <dt>Relationship</dt>
                <dd>{selected.relationship}</dd>
              </dl>
            </div>
          )}
          {['Results', 'Materials', 'Announcements'].includes(section) && (
            <div className="academic-panel">
              <h3>{section === 'Results' ? 'Published results' : section}</h3>
              {visibleContent.status === 'loading' && (
                <p role="status">Loading {section.toLowerCase()}</p>
              )}
              {visibleContent.status === 'error' && (
                <div role="alert">
                  <p>Could not load {section.toLowerCase()}.</p>
                  <button
                    type="button"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    Retry
                  </button>
                </div>
              )}
              {visibleContent.status === 'loaded' &&
                visibleContent.data.length === 0 && (
                  <p>No {section.toLowerCase()} available.</p>
                )}
              {visibleContent.status === 'loaded' && section === 'Results' && (
                <ul>
                  {(visibleContent.data as StudentResult[]).map((item) => (
                    <li
                      key={
                        item.academicYear + item.gradingPeriod + item.subject
                      }
                    >
                      {item.subject}: {item.percentage}% - {item.gradeLabel}
                      {item.corrected && ' (corrected)'}
                    </li>
                  ))}
                </ul>
              )}
              {visibleContent.status === 'loaded' &&
                section === 'Materials' && (
                  <ul>
                    {(visibleContent.data as StudentMaterial[]).map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong> - {item.subject}
                        {item.description && <p>{item.description}</p>}
                        {safeResource(item.resourceLocation) && (
                          <p>
                            <a
                              href={item.resourceLocation}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open resource
                            </a>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              {visibleContent.status === 'loaded' &&
                section === 'Announcements' && (
                  <ul>
                    {(visibleContent.data as StudentAnnouncement[]).map(
                      (item) => (
                        <li key={item.id}>
                          <h4>{item.title}</h4>
                          <p>{item.body}</p>
                          <small>
                            {item.scope.type === 'class'
                              ? item.scope.name
                              : 'School-wide'}
                          </small>
                        </li>
                      ),
                    )}
                  </ul>
                )}
            </div>
          )}
          {section === 'Messages' && (
            <div className="academic-panel">
              <h3>Messages</h3>
              <form
                onSubmit={(event) => void createConversation(event)}
                aria-label="Start family conversation"
              >
                <label className="field">
                  Contact route
                  <select
                    value={route}
                    onChange={(event) =>
                      setRoute(event.target.value as 'schoolOffice' | 'teacher')
                    }
                  >
                    <option value="schoolOffice">School office</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </label>
                {route === 'teacher' && (
                  <label className="field">
                    Current teacher
                    <select
                      value={teacherUserId}
                      onChange={(event) => setTeacherUserId(event.target.value)}
                      required
                    >
                      <option value="">Choose teacher</option>
                      {contacts.status === 'loaded' &&
                        contacts.data.map((teacher) => (
                          <option
                            key={teacher.id + teacher.subject}
                            value={teacher.id}
                          >
                            {teacher.displayName} - {teacher.subject}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Message
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    maxLength={5000}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !body.trim() ||
                    (route === 'teacher' && !teacherUserId)
                  }
                >
                  Start conversation
                </button>
              </form>
              {contacts.status === 'error' && (
                <p role="alert">Could not load current teachers.</p>
              )}
              {conversations.status === 'loading' && (
                <p role="status">Loading conversations</p>
              )}
              {conversations.status === 'error' && (
                <p role="alert">Could not load conversations.</p>
              )}
              {conversations.status === 'loaded' && (
                <div className="conversation-layout">
                  <ul>
                    {conversations.data.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedConversationId(item.id)}
                        >
                          {item.route === 'schoolOffice'
                            ? 'School office'
                            : 'Teacher'}{' '}
                          - {item.status}
                        </button>
                        <p>{item.lastMessage?.body}</p>
                      </li>
                    ))}
                  </ul>
                  {selectedConversationId && (
                    <div>
                      <h4>Conversation</h4>
                      {conversation.status === 'loading' && (
                        <p role="status">Loading messages</p>
                      )}
                      {conversation.status === 'error' && (
                        <p role="alert">Could not load messages.</p>
                      )}
                      {conversation.status === 'loaded' && (
                        <>
                          <ol>
                            {conversation.data.messages.map((item) => (
                              <li key={item.id}>
                                <strong>
                                  {item.sender === 'guardian'
                                    ? 'You'
                                    : 'School'}
                                  :
                                </strong>{' '}
                                {item.body}
                              </li>
                            ))}
                          </ol>
                          {conversation.data.status === 'open' && (
                            <form onSubmit={(event) => void sendMessage(event)}>
                              <label className="field">
                                Reply
                                <textarea
                                  value={reply}
                                  onChange={(event) =>
                                    setReply(event.target.value)
                                  }
                                  required
                                  maxLength={5000}
                                />
                              </label>
                              <button
                                type="submit"
                                disabled={busy || !reply.trim()}
                              >
                                Send message
                              </button>
                            </form>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
