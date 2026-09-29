import { useEffect } from 'react'

export function WorkspaceFocus({ name }: { name: string }) {
  useEffect(() => {
    document.title = `${name} | Warka`
    document.getElementById('main-content')?.focus()
  }, [name])
  return null
}
