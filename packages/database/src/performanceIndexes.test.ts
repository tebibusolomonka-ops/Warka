import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('performance query indexes migration', () => {
  it('covers reviewed scheduler, outbox, enrollment, coursework, and student search paths', () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          '../prisma/migrations/20260930050000_performance_query_indexes/migration.sql',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    for (const expected of [
      'ScheduledTaskExecution_taskType_status_scheduledFor_idx',
      'EmailDelivery_status_failureCode_failedAt_idx',
      'Enrollment_schoolId_studentId_idx',
      'CourseworkAssignment_schoolId_createdAt_id_idx',
      'Student_givenName_trgm_idx',
    ])
      expect(migration).toContain(expected)
  })
})
