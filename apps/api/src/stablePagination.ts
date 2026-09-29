import { z } from 'zod'

const payload = z.strictObject({ at: z.iso.datetime(), id: z.uuid() })
export type StableCursor = { at: Date; id: string }

export function encodeStableCursor(value: StableCursor) {
  return Buffer.from(
    JSON.stringify({ at: value.at.toISOString(), id: value.id }),
  ).toString('base64url')
}

export function decodeStableCursor(value: string): StableCursor {
  try {
    const parsed = payload.parse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    )
    return { at: new Date(parsed.at), id: parsed.id }
  } catch {
    throw new Error('Invalid pagination cursor')
  }
}

export function beforeStableCursor(cursor: StableCursor, field: string) {
  return {
    OR: [
      { [field]: { lt: cursor.at } },
      { [field]: cursor.at, id: { lt: cursor.id } },
    ],
  }
}
