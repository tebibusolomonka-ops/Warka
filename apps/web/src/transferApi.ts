import {
  TransferOptionsSchema,
  TransferViewSchema,
  type TransferOptions,
  type TransferView,
} from '@warka/shared'
import { requestJson } from './api'

const path = (schoolId: string) => '/schools/' + schoolId + '/transfers'

export async function getTransferOptions(
  baseUrl: string,
  schoolId: string,
): Promise<TransferOptions> {
  return TransferOptionsSchema.parse(
    await requestJson(baseUrl, path(schoolId) + '/options'),
  )
}
export async function getSchoolTransfers(
  baseUrl: string,
  schoolId: string,
  direction: 'outgoing' | 'incoming',
): Promise<TransferView[]> {
  return TransferViewSchema.array().parse(
    await requestJson(baseUrl, path(schoolId) + '/' + direction),
  )
}
export async function getTransferDetail(
  baseUrl: string,
  schoolId: string,
  transferId: string,
): Promise<TransferView> {
  return TransferViewSchema.parse(
    await requestJson(baseUrl, path(schoolId) + '/' + transferId),
  )
}
export async function createTransferRequest(
  baseUrl: string,
  schoolId: string,
  studentId: string,
  sourceEnrollmentId: string,
  receivingSchoolId: string,
): Promise<TransferView> {
  return TransferViewSchema.parse(
    await requestJson(baseUrl, path(schoolId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId,
        sourceEnrollmentId,
        receivingSchoolId,
      }),
    }),
  )
}
export async function actOnTransfer(
  baseUrl: string,
  schoolId: string,
  transferId: string,
  action: 'approve' | 'accept' | 'reject' | 'cancel',
  body: Record<string, unknown> = {},
): Promise<TransferView> {
  return TransferViewSchema.parse(
    await requestJson(
      baseUrl,
      path(schoolId) + '/' + transferId + '/' + action,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),
  )
}
