import { createHash } from 'node:crypto'

export const sessionCookieName = 'warka_session'
export const csrfCookieName = 'warka_csrf'
export const csrfTokenForSession = (session: string) =>
  createHash('sha256')
    .update('warka-csrf\0')
    .update(session)
    .digest('base64url')
