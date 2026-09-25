import {
  IssuedDocumentSummarySchema,
  StudentDocumentsSchema,
  type IssuedDocumentSummary,
  type StudentDocuments,
} from '@warka/shared'
import { requestJson } from './api'

export async function getStudentDocuments(
  baseUrl: string,
  schoolId: string,
  studentId: string,
): Promise<StudentDocuments> {
  return StudentDocumentsSchema.parse(
    await requestJson(
      baseUrl,
      '/schools/' + schoolId + '/students/' + studentId + '/documents',
    ),
  )
}

export async function issueStudentDocument(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  academicYearId: string,
  documentType: 'reportCard' | 'transcript',
): Promise<IssuedDocumentSummary> {
  return IssuedDocumentSummarySchema.parse(
    await requestJson(
      baseUrl,
      '/schools/' + schoolId + '/students/' + studentId + '/documents',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ academicYearId, documentType }),
      },
    ),
  )
}

export async function actOnStudentDocument(
  baseUrl: string,
  schoolId: string,
  documentId: string,
  action: 'correct' | 'withdraw',
  reason: string,
): Promise<IssuedDocumentSummary> {
  return IssuedDocumentSummarySchema.parse(
    await requestJson(
      baseUrl,
      '/schools/' + schoolId + '/documents/' + documentId + '/' + action,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
    ),
  )
}
