import { describe, expect, it, vi } from 'vitest'
import { completeDeployment, deploymentStatuses } from './deploymentHistory.js'

describe('deployment history', () => {
  it('uses controlled statuses and bounds failure summaries', async () => {
    expect(deploymentStatuses).toEqual([
      'planned',
      'deploying',
      'healthy',
      'failed',
      'rolledBack',
    ])
    const update = vi.fn(async ({ data }) => data)
    await completeDeployment(
      { deploymentRecord: { update } } as never,
      'id',
      'failed',
      'x'.repeat(600),
    )
    expect(update.mock.calls[0]?.[0].data.failureSummary).toHaveLength(500)
  })
})
