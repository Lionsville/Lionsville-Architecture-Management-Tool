// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The activity list, end to end: something happens in the app, and the toolbar
 * can say what it was (ADR-0002, step 9).
 *
 * `model/activity.test.ts` pins what a step is called; this pins that the log
 * reaches the screen at all, in the order a person reads a log in, and that a
 * change nobody made — the settling pass clearing `needsLayout` — stays out of
 * it exactly as it stays off the undo stack.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { placeOn } from '../model/commands';
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import { transaction } from '../model'
import type { Command } from '../model'
import type { EditorHistory } from '../editor'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp, renderShell } from './testing/renderShell'
import { translator } from '../i18n'
import type { Language } from '../i18n'
import { ActivityMenu, mergeActivity } from './ActivityMenu'
import type { ActivityEntry } from './ActivityMenu'
import type { SourceActivityLine } from '../platform/sourceProvider'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      editing: { dispatch: (command: Command) => unknown; history: EditorHistory }
      diagrams: { onRename?: (id: string, name: string) => void }
      layout?: { onSettled?: (diagramId: string) => void }
    }) => (
      <div>
        <button data-testid="rename" onClick={() => props.diagrams.onRename?.('d1', 'Renamed')}>rename</button>
        <button
          data-testid="draw"
          onClick={() => props.editing.dispatch(transaction([
            {
              type: 'element.create',
              element: {
                id: 'warehouse', kind: 'application', name: 'Warehouse',
                lifecycle: 'live', isManaged: true, aspects: {},
              },
            },
            placeOn('d1', [{ id: 'warehouse', x: 0, y: 0}]),
          ]))}
        >draw</button>
        <button data-testid="settled" onClick={() => props.layout?.onSettled?.('d1')}>settled</button>
      </div>
    ),
  }
})

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [], needsLayout: true })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function show() {
  const initial = project()
  renderApp({ repositories: heldRepositories([initial]), boot: { initialProject: initial } })
}

const click = (id: string) => act(() => { fireEvent.click(screen.getByTestId(id)) })
// By its words, not its accessible name: every button on this bar takes that
// from its tooltip.
const openActivity = () => act(() => { fireEvent.click(screen.getByText('Activity')) })
// What each line says it was, without the tags and the moment beside it.
const lines = () => screen.getAllByTestId('activity-summary').map((item) => item.textContent ?? '')

describe('the activity list', () => {
  it('says nothing has happened yet', () => {
    show()
    openActivity()
    expect(screen.getByText('Nothing yet')).toBeDefined()
  })

  it('names what happened, newest first, whichever half of the app did it', () => {
    show()
    click('draw')
    click('rename')
    openActivity()

    expect(lines()).toEqual(['Renamed a diagram to Renamed', 'Added Warehouse'])
  })

  it('leaves out a change nobody made', () => {
    show()
    click('settled')
    openActivity()
    expect(screen.getByText('Nothing yet')).toBeDefined()
  })
})

/**
 * Whose step it was. A change nobody at this keyboard made, appearing on the
 * board unattributed, is indistinguishable from a fault — which is the same
 * reasoning that put AGENT on an agent's step (ADR-0007), applied to a step
 * that arrived from somewhere else.
 */
describe('who took the step', () => {
  const entry = (over: Partial<ActivityEntry>): ActivityEntry =>
    ({ summary: { key: 'activity.diagramRenamed', name: 'L7' }, at: 0, ...over })

  const list = (entries: ActivityEntry[], language: Language = 'en') =>
    renderShell(
      <ActivityMenu
        anchorEl={document.body}
        onClose={() => {}}
        entries={entries}
        language={language}
        s={translator(language)}
      />,
      { language },
    )

  it('says nothing about a step the person took', () => {
    list([entry({})])
    expect(screen.queryByTestId('activity-origin')).toBeNull()
  })

  it('tags an agent’s step, as it always has', () => {
    list([entry({ origin: 'agent' })])
    expect(screen.getByTestId('activity-origin').textContent).toBe('AGENT')
  })

  it('names the author of a step made elsewhere', () => {
    list([entry({ origin: 'remote', by: 'A. Author' })])
    expect(screen.getByTestId('activity-origin').textContent).toBe('BY A. Author')
  })

  it('still says it was not ours when the step arrived with no name on it', () => {
    list([entry({ origin: 'remote' })])
    expect(screen.getByTestId('activity-origin').textContent).toBe('BY ANOTHER AUTHOR')
  })

  it('says it in the language the app is in', () => {
    list([entry({ origin: 'remote', by: 'A. Author' })], 'nl')
    expect(screen.getByTestId('activity-origin').textContent).toBe('DOOR A. Author')
  })

  /**
   * And what they made it with, where the step said. One author working from two
   * clients and two authors are not the same thing to read about, so the line
   * says both rather than choosing.
   */
  it('names the client the author made it with, where the step said', () => {
    list([entry({ origin: 'remote', by: 'A. Author', via: 'their client' })])
    expect(screen.getByTestId('activity-origin').textContent).toBe('BY A. Author VIA their client')
  })

  it('names the client in each of the three languages', () => {
    const said = (language: Language) => {
      cleanup()
      list([entry({ origin: 'remote', by: 'A. Author', via: 'their client' })], language)
      return screen.getByTestId('activity-origin').textContent
    }
    expect(said('nl')).toBe('DOOR A. Author VIA their client')
    expect(said('de')).toBe('VON A. Author \u00dcBER their client')
    expect(said('en')).toBe('BY A. Author VIA their client')
  })

  /** A step with a client and no author is still not ours, and still says so. */
  it('falls back to the author nobody named, with the client beside it', () => {
    list([entry({ origin: 'remote', via: 'their client' })])
    expect(screen.getByTestId('activity-origin').textContent)
      .toBe('BY ANOTHER AUTHOR VIA their client')
  })

  /** Every step in this repository: no client said, and the line as it was. */
  it('says only the name where no client was said', () => {
    list([entry({ origin: 'remote', by: 'A. Author' })])
    expect(screen.getByTestId('activity-origin').textContent).toBe('BY A. Author')
  })
})

/**
 * A source that keeps a log of the scope (`SourceRecentActivity`): the list is
 * that log and the session's steps as one, each step once, and every line says
 * whose it was — *you*, or the author.
 */
describe('the list over a source that keeps a log', () => {
  const renamed = (name: string) => ({ key: 'activity.diagramRenamed' as const, name })
  const own = (over: Partial<ActivityEntry> = {}): ActivityEntry =>
    ({ summary: renamed('Mine'), at: 3_000, stepId: 'step-own', folds: [{ changeId: 'change-own' }], ...over })
  const logged = (over: Partial<SourceActivityLine> = {}): SourceActivityLine =>
    ({ summary: renamed('Theirs'), at: 1_000, stepId: 'step-theirs', by: 'B. Colleague', ...over })

  it('is the session alone, word for word, where the source says nothing', () => {
    const entries = [own(), own({ origin: 'agent', at: 4_000 })]
    expect(mergeActivity(entries, undefined)).toEqual(entries)
  })

  it('puts the log and the session in the order they happened, oldest first', () => {
    const merged = mergeActivity([own()], [logged(), logged({ stepId: 'later', at: 5_000 })])
    expect(merged.map((line) => line.at)).toEqual([1_000, 3_000, 5_000])
  })

  it('lists a step the session published once, by the name of its announcement', () => {
    const merged = mergeActivity([own()], [logged({ stepId: 'change-own', mine: true, at: 3_001 })])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.summary.name).toBe('Mine')
  })

  it('lists a step that arrived while the scope was open once, as the session holds it', () => {
    const arrived = own({ stepId: 'step-theirs', folds: [], origin: 'remote', by: 'B. Colleague' })
    expect(mergeActivity([arrived], [logged()])).toHaveLength(1)
  })

  it('says whose each line is: the person\'s own, and somebody else\'s', () => {
    const merged = mergeActivity([own()], [logged(), logged({ stepId: 'mine-earlier', mine: true, at: 2_000 })])
    expect(merged.map((line) => [line.you ?? false, line.origin, line.by])).toEqual([
      [false, 'remote', 'B. Colleague'],
      [true, undefined, undefined],
      [true, undefined, undefined],
    ])
  })

  it('says a layout the source marked as the editor\'s own is nobody\'s', () => {
    const merged = mergeActivity([], [logged({ unattended: true, mine: true, via: 'Browser' })])
    expect(merged[0]).toMatchObject({ unattended: true })
    expect(merged[0]!.you).toBeUndefined()
    expect(merged[0]!.origin).toBeUndefined()
    expect(merged[0]!.by).toBeUndefined()
    expect(merged[0]!.via).toBeUndefined()
  })

  it('draws it as laid out automatically, with no author', async () => {
    list(async () => [logged({ stepId: 'layout', unattended: true, mine: true })])
    expect(await screen.findByText('LAID OUT AUTOMATICALLY')).toBeDefined()
    expect(screen.queryByText('YOU')).toBeNull()
  })

  it('does the same for a layout the session made by itself', async () => {
    list(async () => [], [own({ unattended: true })])
    expect(await screen.findByText('LAID OUT AUTOMATICALLY')).toBeDefined()
    expect(screen.queryByText('YOU')).toBeNull()
  })

  it('leaves an agent\'s step tagged as an agent\'s', () => {
    const merged = mergeActivity([own({ origin: 'agent' })], [])
    expect(merged[0]!.you).toBeUndefined()
    expect(merged[0]!.origin).toBe('agent')
  })

  const list = (recent: () => Promise<readonly SourceActivityLine[] | undefined>, entries: ActivityEntry[] = []) =>
    renderShell(
      <ActivityMenu
        anchorEl={document.body}
        onClose={() => {}}
        entries={entries}
        recent={recent}
        language="en"
        s={translator('en')}
      />,
      { language: 'en' },
    )

  it('asks the source when it opens, and names every author', async () => {
    const recent = vi.fn(async () => [logged(), logged({ stepId: 'mine', mine: true, via: 'Browser', at: 2_000 })])
    list(recent, [own()])
    expect(await screen.findByText('BY B. Colleague')).toBeDefined()
    expect(recent).toHaveBeenCalledTimes(1)
    const tags = screen.getAllByTestId('activity-origin').map((tag) => tag.textContent)
    // Newest first: the session's own step, the person's earlier one, the colleague's.
    expect(tags).toEqual(['YOU', 'YOU VIA Browser', 'BY B. Colleague'])
    expect(lines()).toEqual(['Renamed a diagram to Mine', 'Renamed a diagram to Theirs', 'Renamed a diagram to Theirs'])
  })

  it('says it is reading while the log has not answered and there is nothing else to show', () => {
    list(() => new Promise(() => {}))
    expect(screen.getByText('Reading what was done here…')).toBeDefined()
  })

  it('shows the session alone where the log could not be read', async () => {
    list(async () => { throw new Error('offline') }, [own()])
    expect(await screen.findByText('Renamed a diagram to Mine')).toBeDefined()
    expect(screen.queryByTestId('activity-origin')).toBeNull()
  })
})
