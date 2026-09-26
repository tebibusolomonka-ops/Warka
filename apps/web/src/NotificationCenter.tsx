import { useCallback, useEffect, useState } from 'react'
import {
  getNotificationPage,
  getUnreadNotificationCount,
  readAllNotifications,
  readNotification,
  type NotificationItem,
} from './notificationApi'

type Page = {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  items: NotificationItem[]
  nextCursor: string | null
}

export function NotificationCenter({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [page, setPage] = useState<Page>({
    status: 'idle',
    items: [],
    nextCursor: null,
  })
  const [actionError, setActionError] = useState('')

  const refreshCount = useCallback(() => {
    void getUnreadNotificationCount(baseUrl)
      .then(setCount)
      .catch(() => setCount(null))
  }, [baseUrl])

  const load = useCallback(
    (cursor?: string) => {
      setPage((current) => ({ ...current, status: 'loading' }))
      void getNotificationPage(baseUrl, {
        unread: unreadOnly,
        ...(cursor ? { cursor } : {}),
      })
        .then((result) => {
          setPage((current) => ({
            status: 'loaded',
            items: cursor ? [...current.items, ...result.items] : result.items,
            nextCursor: result.nextCursor,
          }))
          setActionError('')
        })
        .catch(() => setPage((current) => ({ ...current, status: 'error' })))
    },
    [baseUrl, unreadOnly],
  )

  useEffect(() => {
    refreshCount()
    window.addEventListener('focus', refreshCount)
    return () => window.removeEventListener('focus', refreshCount)
  }, [refreshCount])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function markRead(id: string) {
    try {
      await readNotification(baseUrl, id)
      setPage((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      }))
      refreshCount()
      setActionError('')
    } catch {
      setActionError('Could not mark the notification as read.')
    }
  }

  async function markAllRead() {
    try {
      await readAllNotifications(baseUrl)
      setPage((current) => ({
        ...current,
        items: unreadOnly
          ? []
          : current.items.map((item) => ({
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
            })),
      }))
      setCount(0)
      setActionError('')
    } catch {
      setActionError('Could not mark notifications as read.')
    }
  }

  return (
    <section className="notification-center" aria-label="Notifications">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Notifications{count !== null && count > 0 ? ` (${count} unread)` : ''}
      </button>
      {open && (
        <div className="notification-panel">
          <h2>Notifications</h2>
          <label>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />{' '}
            Unread only
          </label>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={count === 0}
          >
            Mark all read
          </button>
          {actionError && <p role="alert">{actionError}</p>}
          {page.status === 'loading' && (
            <p role="status">Loading notifications</p>
          )}
          {page.status === 'error' && (
            <div role="alert">
              Could not load notifications.{' '}
              <button type="button" onClick={() => load()}>
                Retry
              </button>
            </div>
          )}
          {page.status === 'loaded' && page.items.length === 0 && (
            <p>No notifications.</p>
          )}
          {page.items.length > 0 && (
            <ul className="notification-list">
              {page.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                  <span className="status">
                    {item.readAt ? 'Read' : 'Unread'}
                  </span>
                  {!item.readAt && (
                    <button
                      type="button"
                      onClick={() => void markRead(item.id)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {page.status === 'loaded' && page.nextCursor && (
            <button type="button" onClick={() => load(page.nextCursor!)}>
              Load more
            </button>
          )}
        </div>
      )}
    </section>
  )
}
