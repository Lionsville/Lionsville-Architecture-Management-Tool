// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The topic screens (ADR-0042): the catalogue and a picked topic, *Relevant
 * topics* on a home, the tree's ↗ rows and the card — each reading the access
 * a home hands down, and asking it to write.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import type { ScopeSummary } from '../../projects/scope'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { RelevantTopics } from './RelevantTopics'
import { TopicsPage } from './TopicsPage'
import { TopicsProvider } from './TopicsContext'
import type { TopicsAccess } from './TopicsContext'
import { topicsAccess } from './useTopicsAccess'
import type { TopicsDeps } from './useTopicsAccess'

afterEach(cleanup)

const DAY = '2026-11-02'
const s = translator('en')

const scope = (path: string, name: string, over: Partial<ScopeSummary> = {}): ScopeSummary => ({ path, name, diagrams: 0, children: [], ...over })
const TREE = scope('', 'Acme', {
  children: [
    scope('sales', 'Sales'),
    scope('stock', 'Stock'),
    scope('topics', 'Topics', {
      children: [
        scope('topics/security', 'Security', {
          relevantTo: [{ path: 'sales', from: '2026-01-01' }, { path: 'stock', from: '2025-01-01', until: '2025-12-31' }],
          children: [scope('topics/security/identity', 'Identity')],
        }),
        scope('topics/data', 'Data'),
      ],
    }),
  ],
})

/** The access as a home makes it over the tree, its writes caught. */
function accessOver(over: Partial<TopicsDeps> = {}) {
  const deps = {
    tree: TREE, principlesAt: undefined, scopes: {} as never, index: {} as never, writable: () => true, written: vi.fn(), notify: vi.fn(),
    today: DAY, open: vi.fn(), goHome: vi.fn(), openCatalogue: vi.fn(), s, ...over,
  } satisfies TopicsDeps
  const real = topicsAccess(deps, 1)
  const access: TopicsAccess = {
    ...real,
    relate: vi.fn(), endLink: vi.fn(), stopHere: vi.fn(), setLink: vi.fn(), removeLink: vi.fn(), update: vi.fn(),
    create: vi.fn(async () => 'topics/privacy'), remove: vi.fn(async () => true),
  }
  return { access, deps }
}

describe('the catalogue', () => {
  it('lists every topic nested, says how many scopes it reaches, and opens one only when it is selected', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    const rows = within(screen.getByTestId('topics-catalogue')).getAllByRole('row').map((row) => row.textContent)
    expect(rows).toEqual([`Data${s('topics.notLinked')}`, 'Security1 scope', 'Identity1 scope'])
    expect(screen.getByRole('row', { name: /Identity/ }).getAttribute('aria-level')).toBe('2')
    expect(screen.queryByTestId('topic-detail')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('picks the topic it is asked for, with its links, its ended link folded and its subtopic', () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    const detail = screen.getByTestId('topic-detail')
    expect(screen.getByRole('heading', { name: 'Security' })).toBeTruthy()
    expect(within(screen.getByTestId('topic-link-sales')).getByText(/since/)).toBeTruthy()
    expect(within(detail).getByText('Ended links (1)')).toBeTruthy()
    expect(within(detail).getByText('Identity')).toBeTruthy()
  })

  it('links a scope from this end, from the day said', () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/data" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('topic-add-scope'))
    fireEvent.click(screen.getByRole('option', { name: 'Stock' }))
    fireEvent.click(screen.getByTestId('topic-link-add'))
    expect(access.relate).toHaveBeenCalledWith('topics/data', 'stock', DAY)
  })

  it('offers a link\'s three changes in one More, each saying what it keeps', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(within(screen.getByTestId('topic-link-sales')).getByRole('button'))
    expect(await screen.findByRole('menuitem', { name: s('topics.end') })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: s('topics.editDays') })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: s('topics.removeLink') }))
    expect(access.removeLink).toHaveBeenCalled()
  })

  it('says why a topic that keeps a subtopic cannot go before the press, and asks before removing one that keeps nothing', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect((await screen.findByRole('menuitem', { name: new RegExp(s('topics.remove')) })).textContent).toContain(s('topics.removeRefusedShort'))
    cleanup()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/data" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: `${s('topics.remove')}…` }))
    fireEvent.click(await screen.findByRole('button', { name: s('topics.remove') }))
    await waitFor(() => expect(access.remove).toHaveBeenCalledWith('topics/data'))
  })

  it('offers no change to a person who may only read the topic, nor a new topic where they may not write the place', () => {
    const { access } = accessOver({ writable: () => false })
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    expect(screen.queryByTestId('topics-new')).toBeNull()
    expect(screen.queryByTestId('topic-edit')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    expect(screen.queryByTestId('topic-add-scope')).toBeNull()
    expect(within(screen.getByTestId('topic-link-sales')).queryByRole('button')).toBeNull()
  })

  it('makes a topic with the scopes it is relevant to, and picks it', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('topics-new'))
    fireEvent.change(screen.getByTestId('topic-name'), { target: { value: 'Privacy' } })
    fireEvent.click(screen.getByTestId('topic-create'))
    await waitFor(() => expect(access.create).toHaveBeenCalledWith('Privacy', undefined, []))
  })
})

describe('a topic on a home', () => {
  it('shows the topics relevant here, opens one in the catalogue, and stops its own link with the ×', async () => {
    const { access, deps } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="sales" /></TopicsProvider>)
    const chip = screen.getByTestId('relevant-topics/security')
    fireEvent.click(chip)
    expect(deps.openCatalogue).toHaveBeenCalledWith('topics/security')
    // Through its topic, the subtopic is relevant too, and goes with its topic's chip as the tree lists it.
    expect(screen.queryByTestId('relevant-topics/security/identity')).toBeNull()
    fireEvent.click(chip.querySelector('svg')!)
    expect(access.stopHere).toHaveBeenCalledWith('topics/security', 'sales')
    expect(await axeFindings()).toEqual([])
  })

  it('adds topics here from the chooser, writing the link each topic keeps', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="stock" /></TopicsProvider>)
    expect(screen.getByText(s('topics.relevantNone'))).toBeTruthy()
    fireEvent.click(screen.getByTestId('relevant-add'))
    const chooser = await screen.findByRole('dialog', { name: 'Topics relevant to Stock' })
    // Nested as the catalogue nests them, each saying where it applies and what it keeps.
    expect(within(chooser).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'DataNot relevant anywhere yet',
      'SecurityRelevant to Sales',
      'IdentityRelevant to Sales',
    ])
    fireEvent.click(within(chooser).getByRole('checkbox', { name: 'Security' }))
    // The subtopic comes with its topic.
    expect(within(screen.getByTestId('topic-choice-topics/security/identity')).getByRole('checkbox')).toHaveProperty('disabled', true)
    expect(within(screen.getByTestId('topic-choice-topics/security/identity')).getByText('With Security')).toBeTruthy()
    fireEvent.click(within(chooser).getByRole('checkbox', { name: 'Data' }))
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 topics' }))
    expect(access.relate).toHaveBeenCalledWith('topics/security', 'stock')
    expect(access.relate).toHaveBeenCalledWith('topics/data', 'stock')
    await waitFor(() => expect(screen.queryByTestId('topic-chooser')).toBeNull())
  })

  it('finds a topic by what it is about, keeps the topic a match is under, and says those already here', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="sales" /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('relevant-add'))
    fireEvent.change(await screen.findByTestId('topic-chooser-find'), { target: { value: 'ident' } })
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(['topic-choice-topics/security', 'topic-choice-topics/security/identity'])
    expect(within(rows[0]!).getByText('Relevant here')).toBeTruthy()
    expect(screen.getByText('1 of 3 topics')).toBeTruthy()
    expect(within(screen.getByTestId('topic-chooser-about')).getByRole('heading', { name: 'Identity' })).toBeTruthy()
    fireEvent.change(screen.getByTestId('topic-chooser-find'), { target: { value: 'privacy' } })
    expect(screen.getByText(s('topics.chooseNone'))).toBeTruthy()
    // Nothing found: a new topic, named as typed and relevant here.
    fireEvent.click(screen.getByTestId('topic-chooser-new'))
    expect((screen.getByTestId('topic-name') as HTMLInputElement).value).toBe('privacy')
    fireEvent.click(screen.getByTestId('topic-create'))
    await waitFor(() => expect(access.create).toHaveBeenCalledWith('privacy', undefined, ['sales']))
  })

  it('says on a topic\'s own home that it is one, and opens it in the catalogue', () => {
    const { access, deps } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="topics/data" /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('topic-in-catalogue'))
    expect(deps.openCatalogue).toHaveBeenCalledWith('topics/data')
  })
})
