export type InvariantRow = {
  code: string
  entityType: string
  entityId?: string
}

export type InvariantSnapshot = {
  duplicateStudentReferences?: string[]
  orphanEnrollments?: string[]
  invalidResultSnapshots?: string[]
  invalidDocumentSnapshots?: string[]
  inconsistentFileScans?: string[]
  invalidReportingVersions?: string[]
  staleTaskOwners?: string[]
  invalidUploadAssets?: string[]
  invalidSubmissionRevisions?: string[]
}

export function verifyDomainInvariants(
  snapshot: InvariantSnapshot,
): InvariantRow[] {
  const mappings: Array<[keyof InvariantSnapshot, string, string]> = [
    ['duplicateStudentReferences', 'DUPLICATE_STUDENT_REFERENCE', 'Student'],
    ['orphanEnrollments', 'ORPHAN_ENROLLMENT', 'Enrollment'],
    ['invalidResultSnapshots', 'INVALID_RESULT_SNAPSHOT', 'ResultSnapshot'],
    ['invalidDocumentSnapshots', 'INVALID_DOCUMENT_SNAPSHOT', 'IssuedDocument'],
    ['inconsistentFileScans', 'FILE_SCAN_STATE_MISMATCH', 'FileAsset'],
    [
      'invalidReportingVersions',
      'INVALID_REPORTING_VERSION',
      'ReportingSubmission',
    ],
    ['staleTaskOwners', 'STALE_TASK_OWNER', 'ScheduledTask'],
    ['invalidUploadAssets', 'INVALID_UPLOAD_ASSET', 'UploadSession'],
    [
      'invalidSubmissionRevisions',
      'INVALID_SUBMISSION_REVISION',
      'CourseworkSubmission',
    ],
  ]
  return mappings.flatMap(([field, code, entityType]) =>
    (snapshot[field] ?? []).map((entityId) => ({ code, entityType, entityId })),
  )
}
