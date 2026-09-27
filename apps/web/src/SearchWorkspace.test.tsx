import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SearchWorkspace } from './SearchWorkspace'
import { openSearchResult, searchSchool } from './searchApi'

vi.mock('./searchApi', () => ({
  searchSchool: vi.fn(),
  openSearchResult: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('groups authorized results as text and opens one with keyboard', async () => {
  vi.mocked(openSearchResult).mockResolvedValue({
    type: 'student',
    title: 'Ada Learner',
    reference: 'WRK-1',
  })
  vi.mocked(searchSchool).mockResolvedValue({
    groups: {
      student: [
        {
          type: 'student',
          title: 'Ada Learner',
          subtitle: 'WRK-1',
          reference: 'WRK-1',
          schoolId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    },
    limit: 10,
    offset: 0,
  })
  render(
    <SearchWorkspace
      baseUrl="/api"
      schoolId="22222222-2222-4222-8222-222222222222"
    />,
  )
  fireEvent.change(screen.getByLabelText('Search this school'), {
    target: { value: 'Ada' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(searchSchool).toHaveBeenCalled())
  expect(screen.getByRole('heading', { name: 'Students' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Staff' })).toBeNull()
  const result = screen.getByRole('button', { name: /Ada Learner/ })
  fireEvent.keyDown(result.parentElement!.parentElement!.parentElement!, {
    key: 'Enter',
  })
  expect(
    screen.getByRole('region', { name: 'Selected search result' }).textContent,
  ).toContain('WRK-1')
  await waitFor(() => expect(openSearchResult).toHaveBeenCalled())
})
it('waits for a useful query and avoids eager result-body requests', async () => {
  vi.mocked(searchSchool).mockResolvedValue({
    groups: {},
    limit: 10,
    offset: 0,
  })
  render(
    <SearchWorkspace
      baseUrl="/api"
      schoolId="22222222-2222-4222-8222-222222222222"
    />,
  )
  fireEvent.change(screen.getByLabelText('Search this school'), {
    target: { value: 'A' },
  })
  await new Promise((resolve) => setTimeout(resolve, 350))
  expect(searchSchool).not.toHaveBeenCalled()
  expect(openSearchResult).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Search this school'), {
    target: { value: 'Ada' },
  })
  await waitFor(() => expect(searchSchool).toHaveBeenCalledOnce())
  expect(openSearchResult).not.toHaveBeenCalled()
})
