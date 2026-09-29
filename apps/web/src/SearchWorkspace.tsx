import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  openSearchResult,
  searchSchool,
  type OpenedSearchResult,
  type SearchResult,
  type SearchType,
} from './searchApi'
import { AsyncStatus } from './AsyncStatus'

const labels: Record<SearchType, string> = {
  student: 'Students',
  staff: 'Staff',
  issuedDocument: 'Documents',
  documentRequest: 'Document requests',
  transfer: 'Transfers',
  supportRequest: 'Support',
  incident: 'Incidents',
}
const order: SearchType[] = [
  'student',
  'staff',
  'issuedDocument',
  'documentRequest',
  'transfer',
  'supportRequest',
  'incident',
]

export function SearchWorkspace({
  baseUrl,
  schoolId,
}: {
  baseUrl: string
  schoolId: string
}) {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<
    Partial<Record<SearchType, SearchResult[]>>
  >({})
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [opened, setOpened] = useState<OpenedSearchResult | null>(null)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [searched, setSearched] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const buttons = useRef<HTMLButtonElement[]>([])
  const items = order.flatMap((type) => groups[type] ?? [])
  const generation = useRef(0)
  useEffect(() => {
    const focus = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === 'Escape' && document.activeElement === input.current) {
        input.current?.blur()
        return
      }
      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener('keydown', focus)
    return () => document.removeEventListener('keydown', focus)
  }, [])
  useEffect(() => {
    setGroups({})
    setSelected(null)
  }, [schoolId])
  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    if (query.trim().length < 2) {
      setGroups({})
      return () => controller.abort()
    }
    const timer = setTimeout(() => {
      void searchSchool(baseUrl, schoolId, query.trim(), controller.signal)
        .then((response) => {
          if (generation.current === current) {
            setGroups(response.groups)
            setSearched(true)
            setActiveIndex(0)
            setError('')
          }
        })
        .catch(() => {
          if (generation.current === current && !controller.signal.aborted)
            setError('Search could not be completed.')
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [baseUrl, schoolId, query])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    input.current?.blur()
  }
  async function open(item: SearchResult) {
    setSelected(item)
    setOpened(null)
    if (!['student', 'issuedDocument', 'supportRequest'].includes(item.type))
      return
    try {
      setOpened(await openSearchResult(baseUrl, item))
    } catch {
      setError('Could not open this result.')
    }
  }
  function onResultsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!items.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next =
        (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
        items.length
      setActiveIndex(next)
      buttons.current[next]?.focus()
    }
  }
  let position = 0
  return (
    <section aria-label="Global search" id="global-search">
      <h2>Search</h2>
      <p>Press / to focus search. Press Escape to leave the search field.</p>
      <form onSubmit={submit}>
        <label htmlFor="global-search-input">Search this school</label>
        <input
          id="global-search-input"
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={2}
          maxLength={100}
        />
        <button type="submit">Search</button>
      </form>
      {searched && (
        <AsyncStatus message={`${items.length} search results available.`} />
      )}
      {error && <p role="alert">{error}</p>}
      <div onKeyDown={onResultsKeyDown}>
        {order
          .filter((type) => (groups[type]?.length ?? 0) > 0)
          .map((type) => (
            <section key={type} aria-label={labels[type]}>
              <h3>{labels[type]}</h3>
              <ul>
                {groups[type]?.map((item) => {
                  const index = position++
                  return (
                    <li key={`${type}:${item.reference}`}>
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) buttons.current[index] = element
                        }}
                        onFocus={() => setActiveIndex(index)}
                        onClick={() => void open(item)}
                      >
                        {item.title} · {item.subtitle}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
      </div>
      {selected && (
        <section aria-label="Selected search result">
          <h3>{selected.title}</h3>
          <p>{selected.subtitle}</p>
          <p>Reference: {selected.reference}</p>
          {opened && (
            <p>
              Opened {opened.type}: {opened.title}
              {opened.status ? ` · ${opened.status}` : ''}
              {opened.studentReference ? ` · ${opened.studentReference}` : ''}
            </p>
          )}
        </section>
      )}
    </section>
  )
}
