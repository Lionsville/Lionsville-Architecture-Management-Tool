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
import { TopicRows } from './TopicRows'
import { TopicsCard } from './TopicsCard'
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
  it('lists every topic nested, says where each is relevant, and shows the first picked', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    const rows = within(screen.getByTestId('topics-catalogue')).getAllByRole('row').slice(1).map((row) => row.textContent)
    expect(rows).toEqual(['Data———', 'SecuritySales——', 'Identityas Security——'])
    const detail = screen.getByTestId('topic-detail')
    expect(within(detail).getByRole('heading', { name: 'Data' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('picks the topic it is asked for, with its links, its ended link folded and its subtopic', () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    const detail = screen.getByTestId('topic-detail')
    expect(within(detail).getByRole('heading', { name: 'Security' })).toBeTruthy()
    expect(within(screen.getByTestId('topic-link-sales')).getByText(/since/)).toBeTruthy()
    expect(within(detail).getByText('Ended links (1)')).toBeTruthy()
    expect(within(detail).getByText('Identity')).toBeTruthy()
  })

  it('links a scope from this end, from the day said', () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/data" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    const field = screen.getByRole('combobox', { name: s('topics.addScope') })
    fireEvent.focus(field)
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: 'Stock' }))
    fireEvent.click(screen.getByTestId('topic-link-add'))
    expect(access.relate).toHaveBeenCalledWith('topics/data', 'stock', DAY)
  })

  it('refuses to remove a topic that keeps a subtopic, and asks before removing one that keeps nothing', async () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('topic-remove'))
    expect(screen.getByText(s('topics.removeRefused'))).toBeTruthy()
    expect(access.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('topic-row-topics/data'))
    fireEvent.click(screen.getByTestId('topic-remove'))
    fireEvent.click(screen.getByRole('button', { name: s('topics.remove') }))
    await waitFor(() => expect(access.remove).toHaveBeenCalledWith('topics/data'))
  })

  it('offers no change to a person who may only read the topic, nor a new topic where they may not write the place', () => {
    const { access } = accessOver({ writable: () => false })
    renderShell(<TopicsProvider value={access}><TopicsPage open select="topics/security" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></TopicsProvider>)
    expect(screen.queryByTestId('topics-new')).toBeNull()
    expect(screen.queryByTestId('topic-edit')).toBeNull()
    expect(screen.queryByTestId('topic-remove')).toBeNull()
    expect(screen.queryByTestId('topic-link-add')).toBeNull()
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
    // Through its topic, the subtopic is relevant too — with no link of its own here to stop.
    expect(screen.getByTestId('relevant-topics/security/identity').querySelector('svg')).toBeNull()
    fireEvent.click(chip.querySelector('svg')!)
    expect(access.stopHere).toHaveBeenCalledWith('topics/security', 'sales')
    expect(await axeFindings()).toEqual([])
  })

  it('adds a topic here, writing the link the topic keeps', () => {
    const { access } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="stock" /></TopicsProvider>)
    expect(screen.getByText(s('topics.relevantNone'))).toBeTruthy()
    fireEvent.click(screen.getByTestId('relevant-add'))
    const field = screen.getByRole('combobox', { name: s('topics.pick') })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: 'Data' }))
    expect(access.relate).toHaveBeenCalledWith('topics/data', 'stock')
  })

  it('says on a topic\'s own home that it is one, and opens it in the catalogue', () => {
    const { access, deps } = accessOver()
    renderShell(<TopicsProvider value={access}><RelevantTopics at="topics/data" /></TopicsProvider>)
    fireEvent.click(screen.getByTestId('topic-in-catalogue'))
    expect(deps.openCatalogue).toHaveBeenCalledWith('topics/data')
  })

  it('draws a ↗ row under a scope a topic is relevant to, which opens the topic\'s home', () => {
    const { access, deps } = accessOver()
    renderShell(<TopicsProvider value={access}><TopicRows at="sales" depth={0} s={s} /><TopicRows at="stock" depth={0} s={s} /></TopicsProvider>)
    expect(screen.queryByTestId('topic-under-sales-topics/security/identity')).toBeNull()
    fireEvent.click(within(screen.getByTestId('topic-under-sales-topics/security')).getByRole('button', { name: 'Security' }))
    expect(deps.goHome).toHaveBeenCalledWith('topics/security')
    expect(screen.queryByTestId('topic-under-stock-topics/security')).toBeNull()
  })

  it('counts the topics on the organisation\'s card, and opens the catalogue', () => {
    const { access } = accessOver()
    const onOpen = vi.fn()
    renderShell(<TopicsProvider value={access}><TopicsCard onOpen={onOpen} s={s} /></TopicsProvider>)
    expect(screen.getByText('3 topics')).toBeTruthy()
    fireEvent.click(screen.getByTestId('open-topic-catalogue'))
    expect(onOpen).toHaveBeenCalled()
  })
})
