import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FileValidationError, validateUpload } from './fileValidation.js'

const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII=',
  'base64',
)

describe('upload validation', () => {
  it('accepts inspected PDF, text, and safe raster content with server checksum', async () => {
    const result = await validateUpload({
      bytes: pdf,
      originalFileName: 'Lesson.pdf',
      claimedContentType: 'application/pdf',
      purpose: 'learningMaterial',
    })
    expect(result.contentType).toBe('application/pdf')
    expect(result.checksum).toBe(createHash('sha256').update(pdf).digest('hex'))
    expect(
      (
        await validateUpload({
          bytes: Buffer.from('Synthetic learning notes'),
          originalFileName: 'notes.txt',
          claimedContentType: 'text/plain',
          purpose: 'learningMaterial',
        })
      ).contentType,
    ).toBe('text/plain')
    expect(
      (
        await validateUpload({
          bytes: png,
          originalFileName: 'logo.png',
          claimedContentType: 'image/png',
          purpose: 'schoolBranding',
        })
      ).contentType,
    ).toBe('image/png')
  })

  it('quarantines mismatched, unsafe, oversized, or executable-like uploads', async () => {
    const cases = [
      {
        bytes: pdf,
        originalFileName: 'lesson.exe',
        claimedContentType: 'application/pdf',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: pdf,
        originalFileName: 'lesson.pdf',
        claimedContentType: 'text/plain',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: pdf,
        originalFileName: '../lesson.pdf',
        claimedContentType: 'application/pdf',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: pdf,
        originalFileName: 'lesson\r\n.pdf',
        claimedContentType: 'application/pdf',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: Buffer.from('<html><script>alert(1)</script></html>'),
        originalFileName: 'page.txt',
        claimedContentType: 'text/plain',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: Buffer.from('#!/bin/sh\nexit 0'),
        originalFileName: 'script.txt',
        claimedContentType: 'text/plain',
        purpose: 'learningMaterial' as const,
      },
      {
        bytes: Buffer.alloc(2 * 1024 * 1024 + 1),
        originalFileName: 'logo.png',
        claimedContentType: 'image/png',
        purpose: 'schoolBranding' as const,
      },
    ]
    for (const input of cases)
      await expect(validateUpload(input)).rejects.toBeInstanceOf(
        FileValidationError,
      )
  })
})
