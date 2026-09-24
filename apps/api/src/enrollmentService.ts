import {
  approveEnrollment,
  submitEnrollment,
  withdrawEnrollment,
  type Enrollment,
  type PrismaClient,
} from '@warka/database'

export type EnrollmentService = {
  submit(schoolId: string, enrollmentId: string): Promise<Enrollment>
  approve(
    schoolId: string,
    enrollmentId: string,
    userId: string,
  ): Promise<Enrollment>
  withdraw(
    schoolId: string,
    enrollmentId: string,
    userId: string,
  ): Promise<Enrollment>
}

export function prismaEnrollmentService(
  database: PrismaClient,
): EnrollmentService {
  return {
    submit: (schoolId, enrollmentId) =>
      submitEnrollment(database, schoolId, enrollmentId),
    approve: (schoolId, enrollmentId, userId) =>
      approveEnrollment(database, schoolId, enrollmentId, userId),
    withdraw: (schoolId, enrollmentId, userId) =>
      withdrawEnrollment(database, schoolId, enrollmentId, userId),
  }
}
