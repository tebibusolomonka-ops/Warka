import type { FormHTMLAttributes, PropsWithChildren } from 'react'

export function MobileForm({
  children,
  ...props
}: PropsWithChildren<FormHTMLAttributes<HTMLFormElement>>) {
  return (
    <form className={`mobile-form ${props.className ?? ''}`.trim()} {...props}>
      {children}
    </form>
  )
}
