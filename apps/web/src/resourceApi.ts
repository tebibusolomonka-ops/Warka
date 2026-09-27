import { requestJson } from './api'
import { z } from 'zod'

function schoolPath(schoolId: string) {
  return '/schools/' + encodeURIComponent(schoolId)
}
function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function postLearningMaterial(
  baseUrl: string,
  schoolId: string,
  input: {
    academicYearId: string
    schoolClassId: string
    subjectId: string
    title: string
    description?: string
    resourceType: 'link' | 'file'
    resourceLocation?: string
    publish: boolean
  },
): Promise<{ id: string }> {
  return z
    .object({ id: z.uuid() })
    .parse(
      await requestJson(
        baseUrl,
        schoolPath(schoolId) + '/materials',
        json(input),
      ),
    )
}

export async function uploadLearningMaterial(
  baseUrl: string,
  schoolId: string,
  materialId: string,
  file: File,
) {
  return requestJson(
    baseUrl,
    `${schoolPath(schoolId)}/materials/${encodeURIComponent(materialId)}/upload`,
    json({
      originalFileName: file.name,
      contentType: file.type,
      base64: await fileBase64(file),
    }),
  )
}

export async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32_768)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)))
  return btoa(chunks.join(''))
}

export function publishLearningMaterial(
  baseUrl: string,
  schoolId: string,
  materialId: string,
) {
  return requestJson(
    baseUrl,
    `${schoolPath(schoolId)}/materials/${encodeURIComponent(materialId)}/publish`,
    { method: 'POST' },
  )
}

export function postAnnouncement(
  baseUrl: string,
  schoolId: string,
  input: {
    schoolClassId?: string
    title: string
    body: string
    publish: boolean
  },
): Promise<unknown> {
  return requestJson(
    baseUrl,
    schoolPath(schoolId) + '/announcements',
    json(input),
  )
}
