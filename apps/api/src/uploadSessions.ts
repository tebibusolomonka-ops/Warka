export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024
export const MAX_CHUNKS = 400
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000
export function validateUploadSession(
  input: { expectedSize: number; chunkCount: number; expiresAt: Date },
  now = new Date(),
) {
  if (input.expectedSize <= 0 || input.expectedSize > MAX_UPLOAD_SIZE)
    throw new Error('uploadSizeInvalid')
  if (input.chunkCount <= 0 || input.chunkCount > MAX_CHUNKS)
    throw new Error('chunkCountInvalid')
  if (input.expiresAt <= now) throw new Error('uploadSessionExpired')
}
export function requireUploadOwner(
  session: { ownerUserId: string; schoolId: string | null },
  actor: { userId: string; schoolId?: string },
) {
  if (
    session.ownerUserId !== actor.userId ||
    (session.schoolId && session.schoolId !== actor.schoolId)
  )
    throw new Error('uploadSessionDenied')
}
