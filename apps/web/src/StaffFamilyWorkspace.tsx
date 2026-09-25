import { useEffect, useState, type FormEvent } from 'react'
import type {
  FamilyConversationSummary,
  FamilyConversationDetail,
  SchoolParentPortalSetting,
} from '@warka/shared'
import { ApiError } from './api'
import {
  actOnStaffConversation,
  getSchoolParentPortalSetting,
  getStaffConversation,
  getStaffConversations,
  sendStaffMessage,
  updateSchoolParentPortalSetting,
} from './parentApi'

type Load<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: T }

export function StaffFamilyWorkspace({
  baseUrl,
  schoolId,
  canManageSetting,
  onSessionExpired,
}: {
  baseUrl: string
  schoolId: string
  canManageSetting: boolean
  onSessionExpired: () => void
}) {
  const [setting, setSetting] = useState<Load<SchoolParentPortalSetting>>({
    status: 'loading',
  })
  const [list, setList] = useState<Load<FamilyConversationSummary[]>>({
    status: 'loading',
  })
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<Load<FamilyConversationDetail>>({
    status: 'loading',
  })
  const [reply, setReply] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) onSessionExpired()
    else setError('Could not complete the request. Refresh and try again.')
  }

  useEffect(() => {
    if (!canManageSetting) return
    let active = true
    setSetting({ status: 'loading' })
    getSchoolParentPortalSetting(baseUrl, schoolId)
      .then((data) => {
        if (active) setSetting({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setSetting({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, canManageSetting, refresh, onSessionExpired])

  useEffect(() => {
    let active = true
    setList({ status: 'loading' })
    getStaffConversations(baseUrl, schoolId)
      .then((data) => {
        if (active) setList({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setList({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, refresh, onSessionExpired])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    setDetail({ status: 'loading' })
    getStaffConversation(baseUrl, schoolId, selectedId)
      .then((data) => {
        if (active) setDetail({ status: 'loaded', data })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401)
          onSessionExpired()
        else setDetail({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [baseUrl, schoolId, selectedId, refresh, onSessionExpired])

  async function changeSetting(enabled: boolean) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await updateSchoolParentPortalSetting(
        baseUrl,
        schoolId,
        enabled,
      )
      setSetting({ status: 'loaded', data })
      setMessage(enabled ? 'Parent portal enabled.' : 'Parent portal disabled.')
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await sendStaffMessage(baseUrl, schoolId, selectedId, reply)
      setReply('')
      setMessage('Reply sent.')
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function act(action: 'close' | 'escalate') {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await actOnStaffConversation(baseUrl, schoolId, selectedId, action)
      setMessage(
        action === 'close' ? 'Conversation closed.' : 'Conversation escalated.',
      )
      setRefresh((value) => value + 1)
    } catch (cause) {
      handleError(cause)
    } finally {
      setBusy(false)
    }
  }

  const selectedSummary =
    list.status === 'loaded'
      ? list.data.find((item) => item.id === selectedId)
      : undefined
  return (
    <section
      className="academic-workspace"
      aria-labelledby="family-workspace-heading"
    >
      <h2 id="family-workspace-heading">Family communication</h2>
      {canManageSetting && (
        <div className="academic-panel">
          <h3>Parent portal setting</h3>
          {setting.status === 'loading' && (
            <p role="status">Loading parent portal setting</p>
          )}
          {setting.status === 'error' && (
            <p role="alert">Could not load parent portal setting.</p>
          )}
          {setting.status === 'loaded' && (
            <>
              <p>
                {setting.data.parentPortalEnabled ? 'Enabled' : 'Disabled'} for
                this school
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void changeSetting(!setting.data.parentPortalEnabled)
                }
              >
                {setting.data.parentPortalEnabled
                  ? 'Disable parent portal'
                  : 'Enable parent portal'}
              </button>
            </>
          )}
        </div>
      )}
      <div className="academic-panel">
        <div className="account">
          <h3>Conversations</h3>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh conversations
          </button>
        </div>
        {list.status === 'loading' && (
          <p role="status">Loading family conversations</p>
        )}
        {list.status === 'error' && (
          <p role="alert">Could not load family conversations.</p>
        )}
        {list.status === 'loaded' && list.data.length === 0 && (
          <p>No routed conversations yet.</p>
        )}
        {list.status === 'loaded' && (
          <div className="conversation-layout">
            <ul>
              {list.data.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setSelectedId(item.id)}>
                    {item.studentName} -{' '}
                    {item.route === 'teacher' ? 'Teacher' : 'School office'} -{' '}
                    {item.status}
                  </button>
                  {item.lastMessage && <p>{item.lastMessage.body}</p>}
                </li>
              ))}
            </ul>
            {selectedId && (
              <div>
                <h4>{selectedSummary?.studentName ?? 'Conversation'}</h4>
                {detail.status === 'loading' && (
                  <p role="status">Loading family messages</p>
                )}
                {detail.status === 'error' && (
                  <p role="alert">Could not load family messages.</p>
                )}
                {detail.status === 'loaded' && (
                  <>
                    <ol>
                      {detail.data.messages.map((item) => (
                        <li key={item.id}>
                          <strong>
                            {item.sender === 'guardian' ? 'Guardian' : 'School'}
                            :
                          </strong>{' '}
                          {item.body}
                        </li>
                      ))}
                    </ol>
                    {detail.data.status === 'open' && (
                      <>
                        <form onSubmit={(event) => void send(event)}>
                          <label className="field">
                            Staff reply
                            <textarea
                              value={reply}
                              onChange={(event) => setReply(event.target.value)}
                              required
                              maxLength={5000}
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={busy || !reply.trim()}
                          >
                            Send reply
                          </button>
                        </form>
                        <div className="workspace-nav">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void act('close')}
                          >
                            Close conversation
                          </button>
                          {!detail.data.escalatedAt && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void act('escalate')}
                            >
                              Escalate to school leadership
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
