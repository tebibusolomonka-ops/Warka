import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { searchSchool, type SearchResult, type SearchType } from './searchApi'

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
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const buttons = useRef<HTMLButtonElement[]>([])
  const items = order.flatMap((type) => groups[type] ?? [])
  useEffect(() => {
    const focus = (event: globalThis.KeyboardEvent) => {
      if (
        (event.key === '/' &&
          !['INPUT', 'TEXTAREA'].includes(
            (event.target as HTMLElement).tagName,
          )) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim().length < 2) return
    setError('')
    try {
      const response = await searchSchool(baseUrl, schoolId, query.trim())
      setGroups(response.groups)
      setActiveIndex(0)
    } catch {
      setError('Search could not be completed.')
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
    if (event.key === 'Enter') {
      event.preventDefault()
      setSelected(items[activeIndex] ?? null)
    }
  }
  let position = 0
  return (
    <section aria-label="Global search" id="global-search">
      <h2>Search</h2>
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
                        onClick={() => setSelected(item)}
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
        </section>
      )}
    </section>
  )
}
