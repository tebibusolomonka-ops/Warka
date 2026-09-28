import { requestJson } from './api'
import type { AcademicContext } from './academicApi'

export type GradebookRow = {
  enrollmentId: string
  studentReference: string
  studentName: string
  participation: 'present' | 'absent' | 'excused' | 'notEligible' | null
  makeUpStatus: string | null
  mark: { id: string; score: string } | null
  issues: string[]
  blockingIssues: string[]
}
export type GradebookCompleteness = {
  complete: boolean
  counts: {
    eligible: number
    marksEntered: number
    marksMissing: number
    absent: number
    pendingMakeUp: number
    invalidMarks: number
  }
  rows: GradebookRow[]
}
export type ModerationRequest = {
  id: string
  markId: string
  originalScore: string
  proposedScore: string
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  correction: { previousScore: string; newScore: string } | null
}
export type Readiness = {
  ready: boolean
  warnings: string[]
  blockingIssues: { code: string; assessmentId?: string }[]
  resultStatus: string
}
const path = (schoolId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/gradebook`
const query = (context: AcademicContext) =>
  new URLSearchParams(context).toString()
const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const getCompleteness = (
  baseUrl: string,
  schoolId: string,
  assessmentId: string,
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/assessments/${encodeURIComponent(assessmentId)}/completeness`,
  ) as Promise<GradebookCompleteness>
export const getWindow = (
  baseUrl: string,
  schoolId: string,
  assessmentId: string,
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/assessments/${encodeURIComponent(assessmentId)}/window`,
  ) as Promise<{
    window: { status: string; opensAt: string; closesAt: string } | null
  }>
export const getModeration = (
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/moderation?${query(context)}`,
  ) as Promise<{ requests: ModerationRequest[] }>
export const getLock = (
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
) =>
  requestJson(baseUrl, `${path(schoolId)}/lock?${query(context)}`) as Promise<{
    lock: { locked: boolean } | null
  }>
export const getReadiness = (
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/readiness?${query(context)}`,
  ) as Promise<Readiness>
export const requestModeration = (
  baseUrl: string,
  schoolId: string,
  markId: string,
  proposedScore: string,
  reason: string,
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/moderation`,
    post({ markId, proposedScore, reason }),
  )
export const reviewModeration = (
  baseUrl: string,
  schoolId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
) =>
  requestJson(
    baseUrl,
    `${path(schoolId)}/moderation/${encodeURIComponent(requestId)}/review`,
    post({ decision }),
  )
export const lockGradebook = (
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
) => requestJson(baseUrl, `${path(schoolId)}/lock`, post(context))
export const unlockGradebook = (
  baseUrl: string,
  schoolId: string,
  context: AcademicContext,
  reason: string,
) =>
  requestJson(baseUrl, `${path(schoolId)}/unlock`, post({ ...context, reason }))
