// @vitest-environment jsdom
/**
 * The picker as a tree, now that every scope is the same document.
 *
 * What replaced the group headings is not a rename: a heading used to be
 * derived from the projects filed under it and decorated by a record that could
 * not conjure one. A scope is a scope whether or not anything is under it
 * (ADR-0012 §1), so what this pins is the other shape — a scope that draws
 * nothing is a heading, a scope that draws something is a row, and both are
 * real.
 *
 * This screen is replaced by the organisation screen in the next stretch; what
 * is here is the smallest thing that keeps the tree usable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { ProjectPicker } from './ProjectPicker'
import { scopeTree } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

const at = (path: string, name: string, over: Partial<ScopeSummary> = {}): ScopeSummary => ({
  path,
  name,
  diagrams: 1,
  children: [],
  updatedAt: '2026-09-05T10:00:00.000Z',
  ...over,
})

function show(scopes: ScopeSummary[], over: Partial<Parameters<typeof ProjectPicker>[0]> = {}) {
  const onApplyScopeSettings = vi.fn()
  const onOpen = vi.fn()
  const onCreate = vi.fn()
  renderShell(
    <ProjectPicker
      scopes={{
        list: () => Promise.resolve(scopeTree(scopes, 'Working folder')),
        remove: () => Promise.resolve(),
      }}
      onApplyScopeSettings={onApplyScopeSettings}
      examples={[]}
      order="name"
      onOrderChange={() => {}}
      onOpen={onOpen}
      onCreate={onCreate}
      onCopyExample={() => {}}
      onFailure={() => {}}
      language="en"
      s={s}
      {...over}
    />,
  )
  return { onApplyScopeSettings, onOpen, onCreate }
}

describe('ProjectPicker — the tree', () => {
  it('shows the root the store named, and the scopes under it', async () => {
    show([at('', 'Acme Logistics', { diagrams: 0 }), at('retail', 'Retail', { diagrams: 0 }), at('retail/warehouse', 'Warehouse')])
    expect(await screen.findByText('Acme Logistics')).toBeDefined()
    expect(screen.getByText('Retail')).toBeDefined()
    expect(screen.getByText('Warehouse')).toBeDefined()
  })

  it('nests a scope under its parent, so the screen shows the shape of the folder', async () => {
    show([at('retail', 'Retail', { diagrams: 0 }), at('retail/warehouse', 'Warehouse')])
    expect((await screen.findByTestId('scope-retail')).dataset.depth).toBe('1')
    expect(screen.getByTestId('scope-retail/warehouse').dataset.depth).toBe('2')
    expect(screen.getByTestId('scope-root').dataset.depth).toBe('0')
  })

  /** A scope that draws nothing has no canvas to open; what is under it does. */
  it('opens a scope that holds a view, and offers no canvas for one that does not', async () => {
    const { onOpen } = show([at('retail', 'Retail', { diagrams: 0 }), at('retail/warehouse', 'Warehouse')])
    fireEvent.click(await screen.findByText('Warehouse'))
    expect(onOpen).toHaveBeenCalledWith('retail/warehouse')

    onOpen.mockClear()
    fireEvent.click(screen.getByText('Retail'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows the description and the links a scope carries', async () => {
    show([at('acme', 'Acme', {
      description: 'Rail freight, three programmes.',
      links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    })])
    expect(await screen.findByText('Rail freight, three programmes.')).toBeDefined()
    const link = await screen.findByRole('link', { name: 'Wiki' })
    expect(link.getAttribute('href')).toBe('https://example.test/wiki')
    // The address may have come from a file somebody else wrote.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('offers every scope its own settings, the root included', async () => {
    show([at('', 'Acme Logistics', { diagrams: 0 }), at('acme', 'Acme')])
    expect(await screen.findByRole('button', { name: 'Settings for Acme' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Settings for Acme Logistics' })).toBeDefined()
  })

  /** The root is the folder you opened; there is nowhere to remove it from. */
  it('does not offer to delete the root', async () => {
    show([at('', 'Acme Logistics', { diagrams: 0 }), at('acme', 'Acme')])
    expect(await screen.findByRole('button', { name: 'Delete Acme' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Delete Acme Logistics' })).toBeNull()
  })

  it('creates a scope under the one whose button was pressed', async () => {
    const { onCreate } = show([at('acme', 'Acme')])
    fireEvent.click(await screen.findByRole('button', { name: 'New scope under Acme' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Rail' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onCreate).toHaveBeenCalledWith({ parent: 'acme', name: 'Rail' })
  })

  /** Refused where a person can see it, rather than quietly suffixed. */
  it('will not create a scope named after one of the folders a scope writes into', async () => {
    const { onCreate } = show([at('acme', 'Acme')])
    fireEvent.click(await screen.findByRole('button', { name: 'New scope…' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Decisions' } })
    expect(await screen.findByText(/cannot be called that/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('says so rather than showing an empty tree when the store refuses', async () => {
    const onFailure = vi.fn()
    renderShell(
      <ProjectPicker
        scopes={{ list: () => Promise.reject(new Error('no')), remove: () => Promise.resolve() }}
        onApplyScopeSettings={() => {}}
        examples={[]}
        order="name"
        onOrderChange={() => {}}
        onOpen={() => {}}
        onCreate={() => {}}
        onCopyExample={() => {}}
        onFailure={onFailure}
        language="en"
        s={s}
      />,
    )
    await screen.findByText('Nothing here yet. Start from an example, or create a project.')
    expect(onFailure).toHaveBeenCalledWith('picker.list', expect.anything(), 'picker.listFailed')
  })
})
