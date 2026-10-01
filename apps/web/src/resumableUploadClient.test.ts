import { expect, it, vi } from 'vitest'
import { resumableMetadata, uploadResumably } from './resumableUploadClient'
it('resumes from server-confirmed progress without browser byte persistence', async () => {
  const file = new File(['abcdef'], 'lesson.txt', { type: 'text/plain' })
  const send = vi.fn(async () => {})
  const result = await uploadResumably(file, 'session', 1, send, 2)
  expect(send).toHaveBeenCalledTimes(2)
  expect(result.state).toBe('completed')
  expect(resumableMetadata(file)).toEqual({
    name: 'lesson.txt',
    size: 6,
    type: 'text/plain',
  })
  expect(localStorage.length).toBe(0)
})
