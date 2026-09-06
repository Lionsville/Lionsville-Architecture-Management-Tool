// @vitest-environment jsdom
/**
 * The picker's group headings, now that a group can say something about itself.
 *
 * The rule worth pinning is the one that is easy to break later: a profile
 * **decorates** a group, it never conjures one. Groups are still derived from
 * the projects filed under them, so a record for a group with no projects must
 * leave the screen exactly as it found it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { translator } from '../../i18n'
import { ProjectPicker } from './ProjectPicker'
import type { GroupProfile } from '../../projects/group'
import type { ProjectSummary } from '../../projects/project'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

const summary = (group: string, groupName: string, name: string): ProjectSummary => ({
  ref: { group, project: name.toLowerCase().replace(/\W+/g, '-') },
  name,
  groupName,
  updatedAt: '2026-09-05T10:00:00.000Z',
})

function show(projects: ProjectSummary[], profiles: GroupProfile[]) {
  const onApplyGroupSettings = vi.fn()
  renderShell(
    <ProjectPicker
      projects={{ list: () => Promise.resolve(projects), remove: () => Promise.resolve() }}
      groups={{ list: () => Promise.resolve(profiles) }}
      onApplyGroupSettings={onApplyGroupSettings}
      examples={[]}
      order="name"
      onOrderChange={() => {}}
      onOpen={() => {}}
      onCreate={() => {}}
      onCopyExample={() => {}}
      onFailure={() => {}}
      language="en"
      s={s}
    />,
  )
  return { onApplyGroupSettings }
}

describe('ProjectPicker — groups', () => {
  it('shows the name from the record rather than the one on the projects', async () => {
    show([summary('acme', 'Acme', 'Landscape')], [{ group: 'acme', name: 'Acme Logistics' }])
    expect(await screen.findByText('Acme Logistics')).toBeDefined()
    expect(screen.queryByText('Acme')).toBeNull()
  })

  it('shows the description and the links a group carries', async () => {
    show([summary('acme', 'Acme', 'Landscape')], [{
      group: 'acme',
      name: 'Acme',
      description: 'Rail freight, three programmes.',
      links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    }])
    expect(await screen.findByText('Rail freight, three programmes.')).toBeDefined()
    const link = await screen.findByRole('link', { name: 'Wiki' })
    expect(link.getAttribute('href')).toBe('https://example.test/wiki')
    // The address may have come from a file somebody else wrote.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('leaves a group with no record showing the name off its projects', async () => {
    show([summary('other', 'Other Dept', 'Landscape')], [])
    expect(await screen.findByText('Other Dept')).toBeDefined()
  })

  /** A record is decoration. There is still nowhere to keep an empty group. */
  it('does not show a group whose record is all that is left of it', async () => {
    show([summary('acme', 'Acme', 'Landscape')], [
      { group: 'acme', name: 'Acme' },
      { group: 'ghost', name: 'Ghost Department' },
    ])
    expect(await screen.findByText('Acme')).toBeDefined()
    expect(screen.queryByText('Ghost Department')).toBeNull()
  })

  it('offers each group its own settings', async () => {
    show([summary('acme', 'Acme', 'Landscape')], [])
    expect(await screen.findByRole('button', { name: 'Settings for Acme' })).toBeDefined()
  })

  /** Decoration that cannot be read costs the decoration, never the projects. */
  it('still lists the projects when the group records will not load', async () => {
    renderShell(
      <ProjectPicker
        projects={{
          list: () => Promise.resolve([summary('acme', 'Acme', 'Landscape')]),
          remove: () => Promise.resolve(),
        }}
        groups={{ list: () => Promise.reject(new Error('no')) }}
        onApplyGroupSettings={() => {}}
        examples={[]}
        order="name"
        onOrderChange={() => {}}
        onOpen={() => {}}
        onCreate={() => {}}
        onCopyExample={() => {}}
      onFailure={() => {}}
        language="en"
        s={s}
      />,
    )
    expect(await screen.findByText('Landscape')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Acme')).toBeDefined())
  })
})
