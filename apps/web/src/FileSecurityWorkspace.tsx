import { useEffect, useState } from 'react'
import { StatusLabel } from './StatusLabel'
import {
  listFileSecurityScans,
  removeQuarantinedAsset,
  rescanFileAsset,
  type FileSecurityScan,
} from './operationsApi'

export function FileSecurityWorkspace({ baseUrl }: { baseUrl: string }) {
  const [scans, setScans] = useState<FileSecurityScan[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    listFileSecurityScans(baseUrl)
      .then((items) => {
        if (active) setScans(items)
      })
      .catch(() => {
        if (active) setError('Could not load file security status.')
      })
    return () => {
      active = false
    }
  }, [baseUrl, refresh])
  async function act(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setRefresh((value) => value + 1)
    } catch {
      setError('File security action could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  const latest = new Map<string, FileSecurityScan>()
  for (const scan of scans)
    if (!latest.has(scan.fileAsset.id)) latest.set(scan.fileAsset.id, scan)
  const groups = [
    {
      title: 'Pending scans',
      statuses: ['pending', 'scanning', 'unavailable'],
    },
    { title: 'Recent clean scans', statuses: ['clean'] },
    { title: 'Quarantined assets', statuses: ['infected'] },
    { title: 'Failed scans', statuses: ['failed'] },
  ]
  return (
    <section id="operations-file-security" aria-label="File security">
      <h3>File security</h3>
      {error && <p role="alert">{error}</p>}
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h4>{group.title}</h4>
          <ul>
            {[...latest.values()]
              .filter((scan) => group.statuses.includes(scan.status))
              .map((scan) => (
                <li key={scan.id}>
                  {scan.fileAsset.originalFileName} · {scan.fileAsset.purpose} ·{' '}
                  <StatusLabel status={scan.status} context="Scan" />
                  {['infected', 'failed', 'unavailable'].includes(
                    scan.status,
                  ) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(() => rescanFileAsset(baseUrl, scan.fileAsset.id))
                      }
                    >
                      Rescan
                    </button>
                  )}
                  {scan.fileAsset.status === 'quarantined' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          removeQuarantinedAsset(baseUrl, scan.fileAsset.id),
                        )
                      }
                    >
                      Remove quarantined file
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
