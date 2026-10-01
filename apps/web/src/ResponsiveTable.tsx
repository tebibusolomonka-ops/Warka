import type { ReactNode } from 'react'

export type ResponsiveColumn<Row> = {
  key: string
  label: string
  render: (row: Row) => ReactNode
  priority?: 'critical' | 'secondary'
}
export function ResponsiveTable<Row>({
  caption,
  rows,
  columns,
  rowKey,
}: {
  caption: string
  rows: Row[]
  columns: ResponsiveColumn<Row>[]
  rowKey: (row: Row) => string
}) {
  return (
    <div
      className="responsive-table"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.label}
                  data-priority={column.priority ?? 'critical'}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
