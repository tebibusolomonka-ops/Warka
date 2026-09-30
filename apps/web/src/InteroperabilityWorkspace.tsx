import { useState } from 'react'
export function InteroperabilityWorkspace({
  onRunDryRun,
  onApply,
  onGenerateExchange,
}: {
  onRunDryRun: () => Promise<{
    validRows: number
    invalidRows: number
    warnings: number
    possibleDuplicates: number
  }>
  onApply: () => Promise<void>
  onGenerateExchange: () => Promise<{ version: string }>
}) {
  const [summary, setSummary] = useState<{
    validRows: number
    invalidRows: number
    warnings: number
    possibleDuplicates: number
  } | null>(null)
  const [notice, setNotice] = useState('')
  return (
    <section aria-labelledby="interop-heading">
      <h2 id="interop-heading">Data interoperability</h2>
      <ol>
        <li>Upload CSV or XLSX</li>
        <li>Choose source profile</li>
        <li>Map approved columns</li>
        <li>Preview transformations</li>
      </ol>
      <button type="button" onClick={() => void onRunDryRun().then(setSummary)}>
        Run dry run
      </button>
      {summary && (
        <div role="status">
          <p>Valid records: {summary.validRows}</p>
          <p>Invalid records: {summary.invalidRows}</p>
          <p>Warnings: {summary.warnings}</p>
          <p>Possible duplicates: {summary.possibleDuplicates}</p>
          <button
            type="button"
            disabled={summary.invalidRows > 0}
            onClick={() =>
              void onApply().then(() => setNotice('Import applied'))
            }
          >
            Apply validated import
          </button>
        </div>
      )}
      <h3>Student transfer exchange</h3>
      <button
        type="button"
        onClick={() =>
          void onGenerateExchange().then((item) =>
            setNotice(`Exchange package ${item.version} generated`),
          )
        }
      >
        Generate exchange package
      </button>
      {notice && <p role="status">{notice}</p>}
    </section>
  )
}
