import { createHash } from 'node:crypto'
import { fileTypeFromBuffer } from 'file-type'

export type UploadPurpose =
  | 'learningMaterial'
  | 'schoolBranding'
  | 'issuedDocument'
  | 'courseworkAssignment'

export class FileValidationError extends Error {
  readonly status = 'quarantined' as const
  constructor() {
    super('File did not pass upload validation')
  }
}

const accepted = {
  learningMaterial: {
    maxBytes: 20 * 1024 * 1024,
    types: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  },
  schoolBranding: {
    maxBytes: 2 * 1024 * 1024,
    types: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  },
  issuedDocument: {
    maxBytes: 20 * 1024 * 1024,
    types: { 'application/pdf': ['.pdf'] },
  },
  courseworkAssignment: {
    maxBytes: 20 * 1024 * 1024,
    types: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  },
} as const

function safeFileName(value: string) {
  const name = value.normalize('NFC').trim()
  if (
    !name ||
    name.length > 120 ||
    [...name].some((character) => {
      const code = character.codePointAt(0) ?? 0
      return (
        code < 32 ||
        code === 127 ||
        code === 0x2028 ||
        code === 0x2029 ||
        character === '/' ||
        character === '\\'
      )
    }) ||
    name === '.' ||
    name === '..'
  )
    throw new FileValidationError()
  return name.replaceAll('"', '_')
}

function plainText(bytes: Uint8Array) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (
      [...text].some((character) => {
        const code = character.codePointAt(0) ?? 0
        return code < 32 && ![9, 10, 13].includes(code)
      }) ||
      /^\s*(?:<!doctype html|<html|<script|<svg|#!)/iu.test(text)
    )
      return false
    return true
  } catch {
    return false
  }
}

export async function validateUpload(input: {
  bytes: Uint8Array
  originalFileName: string
  claimedContentType: string
  purpose: UploadPurpose
}) {
  const { bytes, purpose } = input
  const rule = accepted[purpose]
  if (!rule || bytes.byteLength < 1 || bytes.byteLength > rule.maxBytes)
    throw new FileValidationError()
  const originalFileName = safeFileName(input.originalFileName)
  const detected = await fileTypeFromBuffer(bytes)
  const contentType = detected?.mime ?? (plainText(bytes) ? 'text/plain' : '')
  if (
    !contentType ||
    !(contentType in rule.types) ||
    input.claimedContentType.trim().toLowerCase() !== contentType
  )
    throw new FileValidationError()
  const extensions = rule.types[
    contentType as keyof typeof rule.types
  ] as readonly string[]
  if (
    !extensions.some((extension) =>
      originalFileName.toLowerCase().endsWith(extension),
    )
  )
    throw new FileValidationError()
  return {
    originalFileName,
    contentType,
    sizeBytes: bytes.byteLength,
    checksum: createHash('sha256').update(bytes).digest('hex'),
  }
}
