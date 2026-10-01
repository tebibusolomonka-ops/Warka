import type { PropsWithChildren, ReactNode } from 'react'

export function PageContainer({ children }: PropsWithChildren) {
  return <div className="page-container">{children}</div>
}
export function ResponsiveStack({ children }: PropsWithChildren) {
  return <div className="responsive-stack">{children}</div>
}
export function ResponsiveGrid({ children }: PropsWithChildren) {
  return <div className="responsive-grid">{children}</div>
}
export function SidebarLayout({
  sidebar,
  children,
}: PropsWithChildren<{ sidebar: ReactNode }>) {
  return (
    <div className="sidebar-layout">
      <aside>{sidebar}</aside>
      <div>{children}</div>
    </div>
  )
}
export function ActionToolbar({ children }: PropsWithChildren) {
  return <div className="action-toolbar">{children}</div>
}
