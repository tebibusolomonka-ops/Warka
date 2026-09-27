import type { PrismaClient } from '@prisma/client'
import { createNotification } from './notifications.js'

type Store = Pick<PrismaClient, 'notification'>
export function notifyPrivacyRequester(
  database: Store,
  userId: string,
  requestId: string,
  event:
    | 'submitted'
    | 'underReview'
    | 'approved'
    | 'rejected'
    | 'fulfilled'
    | 'correctionRouted'
    | 'restrictionApproved',
) {
  const messages = {
    submitted: ['Request received', 'Your data request was received.'],
    underReview: ['Request under review', 'Your data request is under review.'],
    approved: ['Request approved', 'Your data request was approved.'],
    rejected: ['Request reviewed', 'Your data request was not approved.'],
    fulfilled: [
      'Access package ready',
      'Your data request is complete. Open it to view the available package.',
    ],
    correctionRouted: [
      'Correction routed',
      'Your correction request was sent for official record review.',
    ],
    restrictionApproved: [
      'Restriction reviewed',
      'Your processing restriction request was reviewed.',
    ],
  } as const
  const [title, message] = messages[event]
  return createNotification(database, {
    userId,
    type: `privacy.${event}`,
    title,
    message,
    resourceType: 'privacyRequest',
    resourceId: requestId,
  })
}
