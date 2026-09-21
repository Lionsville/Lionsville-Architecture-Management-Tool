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
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { transaction } from '../model'
import type { Command } from '../model'
import type { EditorHistory } from '../editor'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp, renderShell } from './testing/renderShell'
import { translator } from '../i18n'
import type { Language } from '../i18n'
import { ActivityMenu } from './ActivityMenu'
import type { ActivityEntry } from './ActivityMenu'

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
  renderApp({ scopes: new InMemoryScopeStore([initial]), initialProject: initial })
}

const click = (id: string) => act(() => { fireEvent.click(screen.getByTestId(id)) })
// By its words, not its accessible name: every button on this bar takes that
// from its tooltip.
const openActivity = () => act(() => { fireEvent.click(screen.getByText('Activity')) })
const lines = () =>
  screen.getAllByRole('menuitem').map((item) => item.textContent?.replace(/\d\d:\d\d$/, '') ?? '')

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

  it('names the client in each of the four languages', () => {
    const said = (language: Language) => {
      cleanup()
      list([entry({ origin: 'remote', by: 'A. Author', via: 'their client' })], language)
      return screen.getByTestId('activity-origin').textContent
    }
    expect(said('nl')).toBe('DOOR A. Author VIA their client')
    expect(said('de')).toBe('VON A. Author \u00dcBER their client')
    expect(said('fy')).toBe('FAN A. Author FIA their client')
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
