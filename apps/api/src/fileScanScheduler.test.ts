import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { FakeFileScanner } from './fileScanner.js'
import { FileScanScheduler } from './fileScanScheduler.js'
import { processPendingFileScan } from './fileScanWorkflow.js'
import type { FileStorage } from './fileStorage.js'

vi.mock('./fileScanWorkflow.js', () => ({ processPendingFileScan: vi.fn() }))

function fixture(
  result:
    | { status: 'clean' }
    | { status: 'failed'; failureCode: 'SCANNER_UNAVAILABLE' },
) {
  const task = {
    id: randomUUID(),
    resourceId: randomUUID(),
    status: 'pending',
    attempt: 1,
    seriesId: randomUUID(),
  }
  const database = {
    scheduledTaskExecution: {
      findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([task]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({ ...task, id: randomUUID(), attempt: 2 }),
    },
    fileScan: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as PrismaClient
  vi.mocked(processPendingFileScan).mockReset().mockResolvedValue(result)
  const lock = { run: vi.fn(async (work: () => Promise<unknown>) => work()) }
  const scheduler = new FileScanScheduler(
    database,
    { enabled: true, intervalMs: 15000, databaseUrl: 'test' },
    {} as FileStorage,
    new FakeFileScanner(),
    lock,
  )
  return { scheduler, database, lock, task }
}

describe('asynchronous file scan tasks', () => {
  it('claims queued work once and records clean completion', async () => {
    const f = fixture({ status: 'clean' })
    await f.scheduler.tick()
    expect(processPendingFileScan).toHaveBeenCalledOnce()
    expect(f.database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: f.task.id, status: 'pending' } }),
    )
    expect(f.database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: f.task.id,
          status: 'running',
          workerId: expect.stringMatching(/^worker_/),
        }),
        data: expect.objectContaining({ status: 'completed' }),
      }),
    )
  })

  it('records retryable failure without marking the task completed', async () => {
    const f = fixture({ status: 'failed', failureCode: 'SCANNER_UNAVAILABLE' })
    await f.scheduler.tick()
    expect(f.database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: f.task.id,
          status: 'running',
          workerId: expect.stringMatching(/^worker_/),
        }),
        data: expect.objectContaining({
          status: 'failed',
          failureCode: 'SCANNER_UNAVAILABLE',
        }),
      }),
    )
  })

  it('prevents concurrent local ticks while the database lock is held', async () => {
    const f = fixture({ status: 'clean' })
    let release!: () => void
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    f.lock.run.mockImplementationOnce(async (work) => {
      await waiting
      return work()
    })
    const first = f.scheduler.tick()
    await f.scheduler.tick()
    expect(f.lock.run).toHaveBeenCalledTimes(1)
    release()
    await first
  })
})
