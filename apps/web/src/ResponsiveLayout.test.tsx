import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ActionToolbar,
  PageContainer,
  ResponsiveGrid,
  ResponsiveStack,
  SidebarLayout,
} from './ResponsiveLayout'

describe('responsive layout primitives', () => {
  it('retains semantic sidebar and flexible content', () => {
    const { container } = render(
      <PageContainer>
        <ResponsiveStack>
          <ResponsiveGrid>
            <SidebarLayout sidebar={<nav aria-label="Sections">Nav</nav>}>
              Content
            </SidebarLayout>
          </ResponsiveGrid>
          <ActionToolbar>
            <button>Save</button>
          </ActionToolbar>
        </ResponsiveStack>
      </PageContainer>,
    )
    expect(screen.getByRole('complementary')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(container.querySelector('.page-container')).toBeTruthy()
  })
})
