import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InteroperabilityWorkspace } from './InteroperabilityWorkspace'
describe('interoperability administration', () => {
  it('shows dry-run facts before deliberate application and exchange metadata', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    render(
      <InteroperabilityWorkspace
        onRunDryRun={vi
          .fn()
          .mockResolvedValue({
            validRows: 2,
            invalidRows: 0,
            warnings: 1,
            possibleDuplicates: 1,
          })}
        onApply={apply}
        onGenerateExchange={vi.fn().mockResolvedValue({ version: '1.0' })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run dry run' }))
    expect(await screen.findByText('Possible duplicates: 1')).toBeTruthy()
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply validated import' }),
    )
    await waitFor(() => expect(apply).toHaveBeenCalledOnce())
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate exchange package' }),
    )
    expect(
      await screen.findByText('Exchange package 1.0 generated'),
    ).toBeTruthy()
  })
})
