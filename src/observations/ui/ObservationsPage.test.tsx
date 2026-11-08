// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The observations page as a user meets it (ADR-0021, ADR-0032): the chain, with
 * this scope's own and those of the scopes below, a record made in the right list
 * under the right number, seen again from its preview, asked why of, merged into
 * another, and the map drawn from the same lists. Writes are handlers: the page proposes both lists, the caller keeps
 * them.
 */
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { HostModel } from '../../model/hostModel'
import type { Cause, Observation, ScopeAnalysis } from '../observation'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'
import type { ChangeAcross, ObservationsPageProps } from './ObservationsPage'
import { renderShell } from '../../app/testing/renderShell'
import { SeamWidthsProvider } from '../../widgets/useSeamWidth'
import type { SeamWidths } from '../../widgets/useSeamWidth'

afterEach(() => cleanup())

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Nightly batch overruns', date: '2026-09-08', where: 'Claims run', impact: 'major', seen: 4,
  body: '## What we saw\n\nStill running at 08:40.', history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window sized for 2019', state: 'assumed', body: '## Why\n\nVolumes doubled.', explains: [], ...over,
})

const model: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [
    observation({}),
    observation({ id: 'o2', number: 2, title: 'Same change released twice', impact: 'minor', seen: 1, where: undefined }),
  ],
  causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] })],
}
/** A scope below, local to itself and read here with nothing shared first (ADR-0032 §1). */
const below: ScopeAnalysis[] = [{
  scope: 'acme/claims/intake',
  observations: [observation({ id: 'in1', number: 1, title: 'Two records for one policyholder', seen: 2 })],
  causes: [], solutions: [], experiments: [],
}]

let ids = 0
function mount({ wrap, ...over }: Partial<ObservationsPageProps> & { wrap?: SeamWidths } = {}) {
  const onChange = vi.fn()
  const onOpenScope = vi.fn()
  const seamed = (page: ReactElement) => (wrap ? <SeamWidthsProvider value={wrap}>{page}</SeamWidthsProvider> : page)
  const utils = renderShell(seamed(
    <ObservationsPage
      open
      onClose={() => {}}
      model={model}
      groupName="Acme"
      below={below}
      scopeLabel={(path) => (path === 'acme/claims/intake' ? 'Intake' : path)}
      onOpenScope={onOpenScope}
      onChange={onChange}
      s={translator('en')}
      language="en"
      makeId={(prefix) => `${prefix}-${++ids}`}
      today={() => '2026-09-20'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />}
      {...over}
    />,
  ))
  return { ...utils, onChange, onOpenScope }
}

const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as { observations: Observation[]; causes: Cause[] }

/** Selects a row: its preview opens over the list. */
const openRow = (key: string) => fireEvent.click(screen.getByTestId(`observation-row-${key}`))
/** Opens the ⋯ of what is on show; its entries are found by their test id, as a reader's buttons were. */
const more = () => fireEvent.click(screen.getAllByRole('button', { name: 'More actions' }).at(-1)!)
const toStage = (stage: 'register' | 'analysis' | 'solutions' | 'results') => fireEvent.click(screen.getByTestId(`observation-tab-${stage}`))
/** Why as its list, since it opens as its map. */
const whyList = () => { toStage('analysis'); fireEvent.click(screen.getByRole('radio', { name: 'List' })) }
const openFull = () => fireEvent.click(screen.getByRole('button', { name: 'Open full record' }))

describe('ObservationsPage, as axe reads it', () => {
  it.each(['register', 'analysis', 'solutions', 'results'] as const)('finds nothing on the %s stage', async (stage) => {
    mount({ model: { ...model, causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] })] } })
    toStage(stage)
    expect(await axeFindings()).toEqual([])
  })

  it('finds nothing with a preview open, or a record’s panel beside the map', async () => {
    mount()
    openRow('o2')
    expect(await axeFindings()).toEqual([])
    cleanup()
    mount({ initialId: 'c1', initialTab: 'analysis-map', initialNonce: 1 })
    expect(await axeFindings()).toEqual([])
  })
})

describe('the chain', () => {
  it('lists what waits first, then what has a why, then each scope below under its name', () => {
    mount()
    const groups = screen.getByRole('treegrid', { name: 'Seen' })
    expect(within(groups).getByText('Waiting for a why · 1')).toBeDefined()
    expect(within(groups).getByText('Has a why · 1')).toBeDefined()
    expect(within(groups).getByText('Local to Intake · 1')).toBeDefined()
    expect(screen.getByTestId('observation-row-o1').textContent).toBe('Nightly batch overruns')
    expect(screen.getByTestId('observation-row-acme/claims/intake#in1').textContent).toContain('Two records')
    const order = [...groups.querySelectorAll('[data-key]')].map((one) => one.getAttribute('data-key'))
    expect(order).toEqual(['o2', 'o1', 'acme/claims/intake#in1'])
  })

  it('is the item and nothing else, with what else is known brought back as a column on asking', () => {
    mount()
    expect(screen.queryByText('Claims run')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Where' }))
    expect(screen.getByTestId('observation-row-o1').textContent).toContain('Claims run')
  })

  it('says what each stage waits for, and has a stage for whether it worked', () => {
    mount()
    expect(screen.getByTestId('stage-said').textContent).toBe('2 seen · 1 wait for a why')
    toStage('analysis')
    expect(screen.getByTestId('stage-said').textContent).toBe('1 causes · 1 open ends')
    toStage('results')
    expect(screen.getByTestId('stage-said').textContent).toBe('Nothing built yet')
  })

  it('says the chain once on a scope with nothing yet, with one first step, and not where nothing may be written', () => {
    mount({ model: { ...model, observations: [], causes: [] }, below: [] })
    expect(screen.getByTestId('chain-empty').textContent).toContain('Write down what you see, before anyone explains it')
    const start = screen.getByTestId('observation-empty-new')
    // The bar's button carries the guide's name; this one is a second way in, and has none.
    expect(start.getAttribute('data-guide')).toBeNull()
    fireEvent.click(start)
    expect(screen.getByRole('form', { name: 'New observation' })).toBeTruthy()
    cleanup()
    mount({ model: { ...model, observations: [], causes: [] }, below: [], readOnly: true })
    expect(screen.queryByTestId('observation-empty-new')).toBeNull()
  })

  it('opens on no record, since a preview opens only by selecting a row', () => {
    const onShown = vi.fn()
    mount({ onShown, initialNonce: 1 })
    expect(screen.queryByTestId('observation-reader')).toBeNull()
    expect(onShown).toHaveBeenLastCalledWith(undefined, 1, 'register')
  })

  it('goes back to a record asked for again after another was chosen, and says which it shows', () => {
    const onShown = vi.fn()
    const { rerender } = mount({ initialId: 'o1', initialNonce: 1, onShown })
    const title = () => screen.getByRole('dialog', { name: /Nightly batch|Same change/ }).textContent
    expect(title()).toContain('OB-0001')
    expect(onShown).toHaveBeenLastCalledWith('o1', 1, 'register')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    openRow('o2')
    expect(onShown).toHaveBeenLastCalledWith('o2', 1, 'register')
    const again = (nonce: number) => (
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" below={below} onChange={() => {}}
        initialId="o1" initialNonce={nonce} onShown={onShown} s={translator('en')} language="en"
        makeId={(prefix) => prefix} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />
    )
    rerender(again(1))
    expect(title()).toContain('OB-0002')
    rerender(again(2))
    expect(title()).toContain('OB-0001')
    expect(onShown).toHaveBeenLastCalledWith('o1', 2, 'register')
  })

  /**
   * A tab asked for (ADR-0019, amended): the page opens on it, with the record
   * asked for selected there where one is, and says which stage is up whenever
   * the person changes it.
   */
  it('opens on a stage asked for, with the record asked for selected on it, and says the stage', () => {
    const onShown = vi.fn()
    mount({ initialTab: 'analysis', initialNonce: 1, onShown })
    expect(screen.getByTestId('observation-tab-analysis').getAttribute('aria-selected')).toBe('true')
    expect(onShown).toHaveBeenLastCalledWith(undefined, 1, 'analysis')
    toStage('solutions')
    expect(onShown).toHaveBeenLastCalledWith(undefined, 1, 'solutions')
    cleanup()
    // A record and a tab: the tab named wins, and the record is selected on it.
    mount({ initialId: 'c1', initialTab: 'register', initialNonce: 2, onShown })
    expect(screen.getByTestId('observation-tab-register').getAttribute('aria-selected')).toBe('true')
    expect(onShown).toHaveBeenLastCalledWith('c1', 2, 'register')
  })

  it('lands on the stage a record belongs to, and on the lens a tab names', () => {
    mount({ initialId: 'c1', initialNonce: 1 })
    expect(screen.getByTestId('observation-tab-analysis').getAttribute('aria-selected')).toBe('true')
    cleanup()
    mount({ initialTab: 'analysis-list', initialNonce: 1 })
    expect(screen.queryByTestId('analysis-picture')).toBeNull()
    expect(screen.getByTestId('cause-row-c1')).toBeTruthy()
  })

  it('reads an observation in its preview, and the whole record adds its links, history and comments', () => {
    mount()
    openRow('o1')
    const reader = screen.getByTestId('observation-reader')
    expect(reader.textContent).toContain('Still running at 08:40')
    expect(screen.getByTestId('observation-seen').textContent).toBe('4×')
    expect(screen.queryByTestId('observation-history')).toBeNull()
    expect(screen.getByRole('list', { name: 'Where it stands' }).textContent).toContain('Why')
    openFull()
    expect(screen.getByTestId('observation-explained-by').textContent).toContain('CA-0001 Window sized for 2019')
    expect(screen.getByTestId('observation-history').textContent).toContain(formatDay('2026-09-08', 'en'))
    expect(screen.getByTestId('observation-history').textContent).toContain('Recorded')
    fireEvent.click(screen.getByRole('button', { name: 'Seen' }))
    expect(screen.queryByTestId('observation-history')).toBeNull()
  })

  it('walks the group from the preview, and letting go comes back to the row', () => {
    const many = { ...model, causes: [] }
    mount({ model: many, below: [] })
    openRow('o1')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Same change released twice' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('dialog', { name: 'Nightly batch overruns' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('observation-reader')).toBeNull()
  })

  it('records a new observation in a panel beside the list, under the next number, and asks once why', () => {
    const { onChange } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'New observation' }))
    // The list stays: a repeat is checked against it.
    expect(screen.getByTestId('observation-row-o1')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /^Title/ }), { target: { value: 'Duplicate customers' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^Where seen/ }), { target: { value: 'CRM' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^Observed by/ }), { target: { value: 'W.S.' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^Who or what it affected/ }), { target: { value: 'Sales' } })
    // Date seen starts at today, and waits behind More.
    expect((screen.getByTestId('form-date') as HTMLInputElement).value).toBe('2026-09-20')
    expect(screen.queryByLabelText('Share with the scopes above')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }))
    const next = lastChange(onChange)
    expect(next.observations).toHaveLength(3)
    expect(next.observations[2]).toMatchObject({ number: 3, title: 'Duplicate customers', where: 'CRM', by: 'W.S.', seen: 1, date: '2026-09-20' })
    expect(next.observations[2].history.map((one) => one.kind)).toEqual(['recorded'])
    expect(next.causes).toEqual(model.causes)
  })

  it('seen again is a dated operation on the record, and there is no share to take', () => {
    const { onChange } = mount()
    openRow('o2')
    fireEvent.click(screen.getByTestId('observation-seen-again'))
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(lastChange(onChange).observations[1]).toMatchObject({ seen: 2 })
    expect(lastChange(onChange).observations[1].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'seen' })
    expect(screen.queryByTestId('observation-share')).toBeNull()
  })

  it('takes an observation off the waiting list with Noted, a reason kept in its history, and puts it back (decision 13)', () => {
    const { onChange } = mount()
    openRow('o2')
    more()
    fireEvent.click(screen.getByTestId('observation-note'))
    fireEvent.change(screen.getByTestId('noted-reason'), { target: { value: 'A fact worth keeping' } })
    fireEvent.click(screen.getByTestId('noted-confirm'))
    const noted = lastChange(onChange).observations[1]
    expect(noted.noted).toBe(true)
    expect(noted.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'noted', note: 'A fact worth keeping' })
    cleanup()
    const reopened = mount({ model: { ...model, observations: [model.observations![0], noted] } })
    const groups = screen.getByRole('treegrid', { name: 'Seen' })
    expect(within(groups).getByText('Noted · 1')).toBeDefined()
    expect(within(groups).queryByText(/Waiting for a why/)).toBeNull()
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('A fact worth keeping')
    openRow('o2')
    expect(screen.getByTestId('observation-noted-note').textContent).toContain('A fact worth keeping')
    more()
    fireEvent.click(screen.getByTestId('observation-unnote'))
    expect(lastChange(reopened.onChange).observations[1].noted).toBeUndefined()
  })

  it('archives an observation with a note, hides it until asked, and restores it', async () => {
    const { onChange } = mount()
    openRow('o2')
    more()
    fireEvent.click(screen.getByTestId('observation-archive'))
    fireEvent.change(screen.getByLabelText('Why (optional)'), { target: { value: 'Release checklist fixed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const closed = lastChange(onChange).observations[1]
    expect(closed.archived).toBe(true)
    expect(closed.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'archived', note: 'Release checklist fixed' })
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Why (optional)'))

    // The page is handed the closed record back, as the workspace would.
    cleanup()
    const reopened = mount({ model: { ...model, observations: [model.observations![0], closed] } })
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }))
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Show archived' }), { key: 'Escape' })
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('Archived')
    openRow('o2')
    expect(screen.getByTestId('observation-archived-note').textContent).toBe(`Archived on ${formatDay('2026-09-20', 'en')}`)
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
    fireEvent.click(screen.getByTestId('observation-restore'))
    const back = lastChange(reopened.onChange).observations[1]
    expect(back.archived).toBeUndefined()
    expect(back.history.map((one) => one.kind)).toEqual(['recorded', 'archived', 'restored'])
    // Closed, it is out of the analysis: the map no longer counts it.
    cleanup()
    mount({ model: { ...model, observations: [model.observations![0], closed] }, initialTab: 'analysis-map', initialNonce: 1 })
    fireEvent.click(screen.getByTestId('map-all'))
    const drawn = within(screen.getByTestId('analysis-picture')).getAllByTestId('analysis-observation').map((node) => node.getAttribute('data-key'))
    expect(drawn).toEqual(['acme/claims/intake#in1', 'o1'])
  })

  it('edits a record in a full window: one save, one step, and Cancel asks where anything changed', async () => {
    const { onChange } = mount({ model: { ...model, observations: [model.observations![0], observation({ id: 'o2', number: 2, title: 'Same change released twice', by: 'W.S.', where: 'Release' })] } })
    openRow('o2')
    fireEvent.click(screen.getByTestId('reader-edit'))
    const title = screen.getByTestId('editor-title')
    fireEvent.change(title, { target: { value: 'Same change released three times' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Leave without saving?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Leave without saving?' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastChange(onChange).observations[1].title).toBe('Same change released three times')
  })

  it('writes the three parts apart and saves them in the same text; a body of other headings is one field', () => {
    const body = '## What we saw\n\nA\n\n## Evidence\n\nB\n\n## Who or what it affected\n\nC\n'
    const { onChange } = mount({ model: { ...model, observations: [observation({ id: 'o2', number: 2, body, by: 'W.S.' })], causes: [] }, below: [] })
    openRow('o2')
    fireEvent.click(screen.getByTestId('reader-edit'))
    const saw = screen.getByRole('textbox', { name: 'What we saw' })
    expect((saw as HTMLTextAreaElement).value).toBe('A')
    fireEvent.change(saw, { target: { value: 'A and more' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(lastChange(onChange).observations[0].body).toContain('## What we saw\n\nA and more')
    expect(lastChange(onChange).observations[0].body).toContain('## Evidence\n\nB')
    cleanup()
    mount({ model: { ...model, observations: [observation({ id: 'o2', number: 2, body: 'Plain text', by: 'W.S.' })], causes: [] }, below: [] })
    openRow('o2')
    fireEvent.click(screen.getByTestId('reader-edit'))
    expect(screen.queryByRole('textbox', { name: 'What we saw' })).toBeNull()
    expect((screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement).value).toBe('Plain text')
  })

  it('never blanks a fact: the save button and the field both say what is missing, and Write and Preview show the same text', () => {
    const { onChange } = mount()
    openRow('o1')
    fireEvent.click(screen.getByTestId('reader-edit'))
    fireEvent.change(screen.getByTestId('editor-title'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByText('Say what was seen, in a few words.').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByTestId('editor-title'), { target: { value: 'Back' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Preview' }))
    expect(screen.getByTestId('editor-preview').textContent).toContain('Back')
  })
  describe('written as the document it will be read as', () => {
    const BODY = '## What we saw\n\nA line\n\n## Evidence\n\n## Who or what it affected\n\nC\n'
    const openEditor = () => {
      mount({ model: { ...model, observations: [observation({ id: 'o2', number: 2, title: 'Late runs', body: BODY, by: 'W.S.', where: 'Release' })], causes: [] }, below: [] })
      openRow('o2')
      fireEvent.click(screen.getByTestId('reader-edit'))
    }
    const wideFrom = (width: number) => vi.stubGlobal('matchMedia', (query: string) => {
      const from = /min-width:\s*(\d+)px/.exec(query)
      const upTo = /max-width:\s*(\d+)px/.exec(query)
      return {
        matches: from ? width >= Number(from[1]) : upTo ? width <= Number(upTo[1]) : false,
        media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      }
    })
    afterEach(() => { vi.unstubAllGlobals() })

    it('holds the title and the parts in one flow under one bar, with no box of their own', () => {
      openEditor()
      expect(screen.getAllByTestId('markdown-part')).toHaveLength(3)
      expect(screen.getAllByRole('toolbar')).toHaveLength(1)
      expect((screen.getByTestId('editor-title') as HTMLTextAreaElement).closest('.kit-focused__main')).toBeTruthy()
      for (const name of ['What we saw', 'Evidence', 'Who or what it affected']) expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
    })

    it('previews what its reader draws, with the facts read beside it where they stood, and keeps what was being written', () => {
      openEditor()
      const saw = screen.getByRole('textbox', { name: 'What we saw' })
      fireEvent.change(saw, { target: { value: 'A longer line' } })
      fireEvent.change(screen.getByTestId('editor-where'), { target: { value: 'The night run' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Preview' }))
      const preview = screen.getByTestId('editor-preview')
      expect(preview.textContent).toContain('A longer line')
      // A heading left empty says what a reader will see under it.
      expect(preview.textContent).toContain('Nothing yet')
      expect(screen.getByText('The night run')).toBeTruthy()
      expect(screen.queryByTestId('editor-where')).toBeNull()
      expect((screen.getByRole('textbox', { name: 'What we saw', hidden: true }) as HTMLTextAreaElement).value).toBe('A longer line')
      fireEvent.click(screen.getByRole('radio', { name: 'Write' }))
      expect(screen.queryByTestId('editor-preview')).toBeNull()
      expect(screen.getByTestId('editor-where')).toBeTruthy()
    })

    it('offers side by side only where it fits, and opens on it on a wide window', () => {
      wideFrom(1100)
      openEditor()
      expect(screen.queryByRole('radio', { name: 'Side by side' })).toBeNull()
      cleanup()
      wideFrom(1440)
      openEditor()
      expect((screen.getByRole('radio', { name: 'Write' }) as HTMLInputElement).getAttribute('aria-checked')).toBe('true')
      fireEvent.click(screen.getByRole('radio', { name: 'Side by side' }))
      expect(screen.getByRole('textbox', { name: 'What we saw' })).toBeTruthy()
      expect(screen.getByTestId('editor-preview')).toBeTruthy()
      expect(screen.getByTestId('editor-where')).toBeTruthy()
      cleanup()
      wideFrom(2000)
      openEditor()
      expect(screen.getByRole('radio', { name: 'Side by side' }).getAttribute('aria-checked')).toBe('true')
      expect(screen.getByTestId('editor-preview')).toBeTruthy()
    })

    it('reads a record whole on its page with no heading of its own over the text', () => {
      mount({ model: { ...model, observations: [observation({ id: 'o2', number: 2, title: 'Late runs', body: BODY, by: 'W.S.', where: 'Release' })], causes: [] }, below: [] })
      openRow('o2')
      fireEvent.click(screen.getByRole('button', { name: 'Open full record' }))
      expect(screen.queryByRole('heading', { name: 'Full record' })).toBeNull()
      expect(screen.getByTestId('observation-explained-by')).toBeTruthy()
      expect(screen.getByTestId('observation-history')).toBeTruthy()
    })
  })
})

describe('the overview\'s rows', () => {
  it('mark each observation\'s kind with a rail at its start, said in words where the row does not say it', () => {
    mount({ model: { ...model, observations: [
      observation({ id: 'o1', tone: 'problem' }),
      observation({ id: 'o2', number: 2, title: 'Claims settle same day', tone: 'bright' }),
      observation({ id: 'o3', number: 3, title: 'Two forms for one claim' }),
    ], causes: [] }, below: [] })
    const rowOf = (id: string) => screen.getByTestId(`observation-row-${id}`)
    expect(rowOf('o1').dataset.rail).toBe('bad')
    expect(within(rowOf('o1')).getByRole('img', { name: 'Problem' })).toBeTruthy()
    expect(rowOf('o2').dataset.rail).toBe('good')
    expect(within(rowOf('o2')).queryByRole('img')).toBeNull()
    expect(rowOf('o2').textContent).toContain('Bright spots')
    expect(rowOf('o3').dataset.rail).toBe('neutral')
    expect(within(rowOf('o3')).getByRole('img', { name: 'Neutral' })).toBeTruthy()
  })
})

describe('the ladder', () => {
  it('asks why in one field, for one observation, with the defaults said, and goes on to the next rung', () => {
    const { onChange } = mount()
    openRow('o2')
    fireEvent.click(screen.getByTestId('observation-cause'))
    expect(screen.getByRole('complementary', { name: 'Why does this happen?' })).toBeTruthy()
    expect(screen.getByTestId('ladder-made-as').textContent).toContain('CA-0002, assumed')
    fireEvent.change(screen.getByTestId('ladder-title'), { target: { value: 'Two teams own one rule' } })
    fireEvent.click(screen.getByTestId('ladder-add'))
    const next = lastChange(onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(next.causes[1]).toMatchObject({ number: 2, title: 'Two teams own one rule', state: 'assumed', explains: [{ id: 'o2', strength: 'normal' }] })
    expect(screen.getByRole('complementary', { name: 'And why is that?' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('ladder-stop'))
    expect(screen.queryByTestId('why-ladder')).toBeNull()
  })

  it('says the question of a bright spot its own way', () => {
    mount({ model: { ...model, observations: [observation({ id: 'o2', number: 2, tone: 'bright' })], causes: [] }, below: [] })
    openRow('o2')
    fireEvent.click(screen.getByTestId('observation-cause'))
    expect(screen.getByRole('complementary', { name: 'Why does this work?' })).toBeTruthy()
  })

  it('asks of a group at once, one step, one cause, every link', () => {
    const { onChange } = mount({ model: { ...model, causes: [] } })
    fireEvent.click(within(screen.getByTestId('observation-row-o1')).getByRole('checkbox'))
    fireEvent.click(within(screen.getByTestId('observation-row-o2')).getByRole('checkbox'))
    fireEvent.click(screen.getByTestId('bulk-ask-why'))
    expect(screen.getByRole('complementary', { name: 'Why do these 2 happen?' })).toBeTruthy()
    fireEvent.change(screen.getByTestId('ladder-title'), { target: { value: 'One release train' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add cause and 2 links' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastChange(onChange).causes[0].explains.map((one) => one.id).sort()).toEqual(['o1', 'o2'])
  })

  it('refuses a group across scopes, in words, since a cause explains its own scope', () => {
    mount()
    fireEvent.click(within(screen.getByTestId('observation-row-o1')).getByRole('checkbox'))
    fireEvent.click(within(screen.getByTestId('observation-row-acme/claims/intake#in1')).getByRole('checkbox'))
    expect(screen.getByTestId('bulk-ask-why').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByTestId('bulk-ask-why').parentElement?.textContent ?? '').toBeDefined()
  })

  it('opens the merge screen on what was ticked, with the first as the survivor', async () => {
    mount({ below: [] })
    fireEvent.click(within(screen.getByTestId('observation-row-o1')).getByRole('checkbox'))
    fireEvent.click(within(screen.getByTestId('observation-row-o2')).getByRole('checkbox'))
    fireEvent.click(screen.getByTestId('bulk-merge'))
    const merge = await screen.findByRole('dialog', { name: 'Merge observations' })
    expect(within(merge).getByTestId('merge-confirm').textContent).toMatch(/^Merge 1 observation into OB-000/)
  })

  it('offers what is already written down, once it reads alike', () => {
    const { onChange } = mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, title: 'Nobody owns the release train', explains: [] }),
    ] } })
    openRow('o1')
    fireEvent.click(screen.getByTestId('observation-cause'))
    fireEvent.change(screen.getByTestId('ladder-title'), { target: { value: 'Nobody owns the release' } })
    fireEvent.click(within(screen.getByTestId('ladder-alike')).getByRole('button', { name: 'Use this one' }))
    expect(lastChange(onChange).causes[1].explains).toEqual([{ id: 'o1', strength: 'normal' }])
  })

  it('says what the question still needs at the field', () => {
    const { onChange } = mount()
    openRow('o2')
    fireEvent.click(screen.getByTestId('observation-cause'))
    fireEvent.click(screen.getByTestId('ladder-add'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Say why it happens, in a few words.')).toBeTruthy()
  })

  it('links an existing cause, offering only what the rules allow', () => {
    const { onChange } = mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, title: 'Nobody owns releases', explains: [] }),
    ] } })
    openRow('o1')
    fireEvent.click(screen.getByTestId('observation-cause'))
    fireEvent.click(screen.getByTestId('ladder-existing'))
    // CA-0001 explains it already, so the one to pick is CA-0002.
    expect(within(screen.getByTestId('ladder-candidates')).getAllByRole('button').map((one) => one.textContent)).toEqual(['CA-0002 Nobody owns releases'])
    fireEvent.click(screen.getByTestId('ladder-candidate-c2'))
    expect(lastChange(onChange).causes[1].explains).toEqual([{ id: 'o1', strength: 'normal' }])
  })

  it('opens on what is written down from Link an existing cause on a preview', () => {
    mount({ model: { ...model, causes: [cause({ id: 'c2', number: 2, title: 'Nobody owns releases', explains: [] })] }, below: [] })
    openRow('o2')
    fireEvent.click(screen.getByTestId('observation-link-existing'))
    expect(screen.getByTestId('ladder-candidates')).toBeTruthy()
  })
})

describe('merging, moving, and a cause’s root step', () => {
  it('merges one observation into another on the merge screen, as one step here, and the page says where it went', async () => {
    const { onChange, rerender } = mount()
    openRow('o2')
    more()
    fireEvent.click(screen.getByTestId('observation-merge'))
    const merge = await screen.findByRole('dialog', { name: 'Merge observations' })
    // Opened from OB-0002, which survives until another is chosen.
    expect(within(merge).getByTestId('merge-confirm').textContent).toBe('Merge 0 observations into OB-0002')
    fireEvent.click(within(within(merge).getByTestId('merge-hit-#o1')).getByRole('checkbox'))
    fireEvent.click(within(merge).getByRole('radio', { name: /Nightly batch/ }))
    const confirm = within(merge).getByTestId('merge-confirm')
    expect(confirm.textContent).toBe('Merge 1 observation into OB-0001')
    fireEvent.click(confirm)
    const next = lastChange(onChange)
    const survivor = next.observations.find((one) => one.id === 'o1')!
    expect(survivor.seen).toBe(5)
    expect(survivor.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'absorbed', id: 'o2', seen: 1 })
    expect(next.observations.find((one) => one.id === 'o2')!.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'merged', id: 'o1' })
    // Shown again with the merged one: it is history, read but not analysed.
    rerender(<ObservationsPage
      open onClose={() => {}} model={{ ...model, observations: next.observations, causes: next.causes }} groupName="Acme"
      onChange={onChange} s={translator('en')} language="en" makeId={(p) => p} today={() => '2026-09-20'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
    />)
    // Hidden too: a dialog on its way out still hides the page from role queries.
    await waitFor(() => expect(screen.queryAllByRole('dialog', { name: 'Merge observations', hidden: true })).toHaveLength(0))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('observation-reader')).toBeNull())
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show merged' }))
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('Merged into OB-0001')
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Show merged' }), { key: 'Escape' })
    openRow('o2')
    // Where it went is a link to it, in the reader.
    const link = within(screen.getByTestId('observation-merged')).getByTestId('observation-merged-link')
    expect(link.tagName).toBe('BUTTON')
    fireEvent.click(link)
    expect(screen.getByRole('dialog', { name: 'Nightly batch overruns' })).toBeTruthy()
  })

  it('merges an observation of a scope below into one here across both scopes, each written where it lives', async () => {
    // Before ADR-0035 this absorbed it here and wrote nothing below; now the
    // record below is told where it went, in its own scope, in the same step.
    const onChangeAcross = vi.fn<ChangeAcross>(async () => ({ ok: true, changed: ['acme/claims/intake', ''] }))
    const { onChange, onOpenScope } = mount({ onChangeAcross })
    openRow('acme/claims/intake#in1')
    expect(screen.getByTestId('observation-from-below').textContent).toContain('Local to Intake')
    // Nothing below may be written here, so nothing is added to it: it is merged, and changed there.
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
    expect(screen.queryByTestId('observation-cause')).toBeNull()

    more()
    fireEvent.click(screen.getByTestId('observation-merge'))
    const merge = await screen.findByRole('dialog', { name: 'Merge observations' })
    fireEvent.click(within(within(merge).getByTestId('merge-hit-#o1')).getByRole('checkbox'))
    fireEvent.click(within(merge).getByRole('radio', { name: /Nightly batch/ }))
    fireEvent.click(within(merge).getByTestId('merge-confirm'))
    await waitFor(() => expect(onChangeAcross).toHaveBeenCalled())
    expect(onChange).not.toHaveBeenCalled()
    const [paths, change] = onChangeAcross.mock.calls[0]!
    expect([...paths].sort()).toEqual(['', 'acme', 'acme/claims', 'acme/claims/intake'])
    const work = (one: ScopeAnalysis) => ({ observations: [...one.observations], causes: [...one.causes], solutions: [], experiments: [] })
    const held = new Map(paths.map((path) => [path, path === 'acme/claims/intake' ? work(below[0]!)
      : path === '' ? { observations: [...model.observations!], causes: [...model.causes!], solutions: [], experiments: [] }
        : { observations: [], causes: [], solutions: [], experiments: [] }]))
    const written = change(held) as ReadonlyMap<string, { observations: Observation[] }>
    expect([...written.keys()]).toEqual(['', 'acme/claims/intake'])
    expect(written.get('')!.observations[0]!.history.at(-1)).toEqual({
      date: '2026-09-20', kind: 'absorbed', id: 'in1', scope: 'acme/claims/intake', seen: 2,
    })
    expect(written.get('acme/claims/intake')!.observations[0]!.history.at(-1)).toEqual({ date: '2026-09-20', kind: 'merged', id: 'o1', scope: '' })
    expect((await screen.findByTestId('merge-note')).textContent).toContain('It changed Intake and')

    await waitFor(() => expect(screen.queryAllByRole('dialog', { name: 'Merge observations' })).toHaveLength(0))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    openRow('acme/claims/intake#in1')
    fireEvent.click(screen.getByRole('button', { name: 'Open Intake' }))
    expect(onOpenScope).toHaveBeenCalledWith('acme/claims/intake')
  })

  it('opens the merge screen on a cause, and reads a merged cause as history, saying where it went', async () => {
    const merged = { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }], history: [{ date: '2026-09-19', kind: 'absorbed', id: 'c2' }] }),
      cause({ id: 'c2', number: 2, title: 'Batch window too short', explains: [] }),
      cause({ id: 'c3', number: 3, title: 'Volumes doubled', history: [{ date: '2026-09-19', kind: 'merged', id: 'in9', scope: 'acme/claims/intake' }] }),
    ] }
    mount({ model: merged })
    whyList()
    expect(screen.queryByTestId('cause-row-c2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show merged' }))
    expect(screen.getByTestId('cause-row-c2').textContent).toContain('Merged into CA-0001 Window sized for 2019')
    // One merged into a scope it cannot read names it by its id, with the scope.
    expect(screen.getByTestId('cause-row-c3').textContent).toContain('Merged into in9 (Intake)')
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Show merged' }), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('cause-row-c2'))
    const reader = screen.getByTestId('cause-reader')
    expect(within(reader).getByTestId('cause-merged').textContent).toContain('Merged into CA-0001')
    expect(screen.queryByTestId('reader-edit')).toBeNull()
    fireEvent.click(within(within(reader).getByTestId('cause-merged')).getByTestId('observation-merged-link'))
    expect(screen.getByRole('dialog', { name: 'Window sized for 2019' })).toBeTruthy()

    more()
    fireEvent.click(screen.getByTestId('cause-merge'))
    const page = await screen.findByRole('dialog', { name: 'Merge causes' })
    // The merged ones are history: not offered.
    expect(within(page).getAllByTestId(/^merge-hit-/).map((one) => one.dataset.testid)).toEqual(['merge-hit-#c1'])
  })

  it('does not merge across scopes where no other scope may be written from here, and says why', async () => {
    mount()
    openRow('acme/claims/intake#in1')
    more()
    fireEvent.click(screen.getByTestId('observation-merge'))
    const merge = await screen.findByRole('dialog', { name: 'Merge observations' })
    fireEvent.click(within(within(merge).getByTestId('merge-hit-#o1')).getByRole('checkbox'))
    expect(within(merge).getByTestId('merge-confirm')).toHaveProperty('disabled', true)
    expect(within(merge).getByTestId('merge-blocked').textContent).toContain('only this one may be changed from here')
  })

  it('offers Move to scope on its own standing observation where two scopes may be written, and opens the move screen (ADR-0038 §5)', async () => {
    const onChangeAcross = vi.fn<ChangeAcross>(async () => ({ ok: true, changed: [] }))
    mount({ onChangeAcross, scopes: ['', 'acme', 'acme/claims/intake'] })
    // Not on one of a scope below: that one moves from its own scope.
    openRow('acme/claims/intake#in1')
    more()
    expect(screen.queryByTestId('observation-move')).toBeNull()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    openRow('o1')
    more()
    fireEvent.click(screen.getByTestId('observation-move'))
    const move = await screen.findByRole('dialog', { name: 'Move an observation to another scope' })
    expect(within(move).getByTestId('move-record').textContent).toBe('OB-0001 Nightly batch overruns')
    expect(within(move).getAllByTestId(/^move-target-/).map((one) => one.dataset.testid)).toEqual(['move-target-acme', 'move-target-acme/claims/intake'])
    fireEvent.click(within(within(move).getByTestId('move-target-acme/claims/intake')).getByRole('radio'))
    expect(within(move).getAllByTestId('move-cut').map((one) => one.textContent)).toEqual(['CA-0001 Window sized for 2019 explains it'])
    expect(within(move).getByTestId('move-becomes').textContent).toBe('It will be OB-0002 in Intake.')
  })

  it('does not offer Move to scope where only this scope may be written from here', () => {
    mount()
    openRow('o1')
    more()
    expect(screen.queryByTestId('observation-move')).toBeNull()
  })

  it('reads a tombstone a move left as history, saying where it went and opening it there', () => {
    const moved = { ...model, observations: [
      observation({}),
      observation({ id: 'o2', number: 2, title: 'Same change released twice', history: [
        { date: '2026-09-08', kind: 'recorded' }, { date: '2026-10-16', kind: 'moved', id: 'o2', scope: 'acme/rail', number: 12 },
      ] }),
    ] }
    const { onOpenScope } = mount({ model: moved, path: 'acme/claims', scopeLabel: (path) => (path === 'acme/rail' ? 'Rail' : path) })
    expect(screen.queryByTestId('observation-row-o2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show merged' }))
    expect(screen.getByTestId('observation-row-o2').textContent).toContain('Moved to OB-0012 in Rail')
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Show merged' }), { key: 'Escape' })
    openRow('o2')
    expect(screen.queryByTestId('reader-edit')).toBeNull()
    openFull()
    expect(within(screen.getByTestId('observation-history')).getByText('Moved to OB-0012 in Rail')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('observation-merged')).getByTestId('observation-merged-link'))
    expect(onOpenScope).toHaveBeenCalledWith('acme/rail', 'o2')
  })

  it('draws the analysis: observations and causes on cards, a root, and the lines between', () => {
    mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }, { id: 'in1', scope: 'acme/claims/intake', strength: 'weak' }] }),
      cause({ id: 'c2', number: 2, title: 'Nobody owns the batch', state: 'verified', root: true, explains: [{ id: 'c1', strength: 'normal' }] }),
    ] } })
    toStage('analysis')
    const picture = screen.getByTestId('analysis-picture')
    // OB-0002 has no chain: it is on the pile, offered, not drawn.
    expect(within(picture).getAllByTestId('analysis-observation')).toHaveLength(2)
    expect(within(picture).getByTestId('analysis-more').getAttribute('aria-label')).toBe('1 with no why yet')
    const causes = within(picture).getAllByTestId('analysis-cause')
    expect(causes).toHaveLength(2)
    expect(causes.find((node) => node.getAttribute('data-key') === 'c2')?.getAttribute('data-root')).toBe('true')
    expect(within(picture).getAllByTestId('analysis-link').map((line) => line.getAttribute('data-strength')).sort()).toEqual(['normal', 'strong', 'weak'])
    fireEvent.click(causes.find((node) => node.getAttribute('data-key') === 'c2')!)
    expect(screen.getByTestId('cause-reader').textContent).toContain('Why')
    expect(screen.getByRole('complementary', { name: 'Nobody owns the batch' })).toBeTruthy()
    expect(screen.getByTestId('cause-root')).toBeDefined()
    fireEvent.click(screen.getByTestId('how-to-read'))
    expect(screen.getByTestId('analysis-phases').textContent).toContain('1 root cause')
  })

  it('a cause can be made a root cause, verified, and asked further', async () => {
    const { onChange } = mount()
    whyList()
    fireEvent.click(screen.getByTestId('cause-row-c1'))
    // Explained by nothing is not a root: nobody has said so yet.
    expect(screen.queryByTestId('cause-root')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Window sized for 2019' }).textContent).toContain('And why is that?')
    // Making it one is asked first, saying what it becomes.
    fireEvent.click(screen.getByTestId('cause-root-toggle'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('cause-root-ask').textContent).toContain('Make CA-0001 a root cause? It becomes RC-0001.')
    fireEvent.click(screen.getByTestId('cause-root-ask-confirm'))
    expect(lastChange(onChange).causes[0].root).toBe(true)
    onChange.mockClear()
    // Its body says why, but not how it was verified: the page asks what confirmed it.
    fireEvent.click(screen.getByTestId('cause-verify'))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('verify-answer'), { target: { value: 'The June run log' } })
    fireEvent.click(screen.getByTestId('verify-confirm'))
    expect(lastChange(onChange).causes[0].state).toBe('verified')
    expect(lastChange(onChange).causes[0].body).toContain('2026-09-20: The June run log')
    // The dialog fades out; until it is gone the page behind it is hidden from role queries.
    await waitForElementToBeRemoved(() => screen.queryByTestId('verify-answer'))
    fireEvent.click(screen.getByTestId('cause-deeper'))
    fireEvent.change(screen.getByTestId('ladder-title'), { target: { value: 'No capacity planning' } })
    fireEvent.click(screen.getByTestId('ladder-add'))
    const next = lastChange(onChange)
    expect(next.causes[1]).toMatchObject({ title: 'No capacity planning', explains: [{ id: 'c1', strength: 'normal' }] })
  })

  it('refuses a root cause a deeper cause explains, and a cause again a solution addresses, saying which', async () => {
    const { onChange } = mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, title: 'No capacity planning', explains: [{ id: 'c1', strength: 'normal' }] }),
      cause({ id: 'c3', number: 3, title: 'Nobody owns the batch', root: true }),
    ], solutions: [{
      id: 's1', number: 1, title: 'Give the batch an owner', state: 'idea', addresses: [{ id: 'c3', strength: 'strong' }],
      validatedWith: [], attempts: [], body: '', history: [],
    }] } })
    whyList()
    fireEvent.click(screen.getByTestId('cause-row-c1'))
    fireEvent.click(screen.getByTestId('cause-root-toggle'))
    // The refusal names the cause in the way, and how to put it right.
    const refused = screen.getByRole('alert')
    expect(refused.textContent).toContain('CA-0001 can’t become a root cause while a cause explains it.')
    expect(refused.textContent).toContain('CA-0002 No capacity planning explains it. Unlink that, or make that one the root cause instead.')
    fireEvent.click(within(refused).getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('cause-row-c3'))
    more()
    fireEvent.click(screen.getByTestId('cause-root-toggle'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SO-0001 Give the batch an owner addresses it'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('asks on which day it was seen again, with a note, and never a day in the future', () => {
    const { onChange } = mount()
    openRow('o1')
    fireEvent.click(screen.getByTestId('observation-seen-again'))
    expect((screen.getByTestId('seen-date') as HTMLInputElement).value).toBe('2026-09-20')
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-21' } })
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('1 field needs filling in.')
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-01' } })
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('seen-date'), { target: { value: '2026-09-15' } })
    fireEvent.change(screen.getByTestId('seen-note'), { target: { value: 'Monday run' } })
    fireEvent.click(screen.getByTestId('seen-confirm'))
    expect(lastChange(onChange).observations[0].history.at(-1)).toEqual({ date: '2026-09-15', kind: 'seen', note: 'Monday run' })
  })

  it('says how many are archived when none is open, and shows them from there', () => {
    const archived = (one: Observation): Observation => ({ ...one, archived: true, history: [...one.history, { date: '2026-09-19', kind: 'archived' }] })
    mount({ model: { ...model, observations: model.observations!.map(archived), causes: [] }, below: [] })
    const empty = screen.getByTestId('observation-register-empty')
    expect(empty.textContent).toContain('No open observations here · 2 archived')
    fireEvent.click(screen.getByTestId('observation-show-archived'))
    expect(screen.getByTestId('observation-row-o1')).toBeTruthy()
  })

  it('marks every row for the guide', () => {
    mount({ groupName: '' })
    expect(screen.getByTestId('observation-row-o1').getAttribute('data-guide')).toBe('observations.row')
  })

  it('has a seam the panel beside a map is resized at, with the keyboard too', () => {
    mount({ initialId: 'c1', initialTab: 'analysis-map', initialNonce: 1 })
    const seam = screen.getByRole('separator', { name: 'Resize the reading pane' })
    expect(seam.getAttribute('aria-valuenow')).toBe('480')
    fireEvent.keyDown(seam, { key: 'ArrowLeft' })
    expect(seam.getAttribute('aria-valuenow')).toBe('488')
    fireEvent.doubleClick(seam)
    expect(seam.getAttribute('aria-valuenow')).toBe('480')
  })

  it('is read-only where told: no record, no verbs, no ticks', () => {
    mount({ readOnly: true })
    expect(screen.queryByRole('button', { name: 'New observation' })).toBeNull()
    expect(within(screen.getByTestId('observation-row-o1')).queryByRole('checkbox')).toBeNull()
    openRow('o1')
    expect(screen.queryByTestId('observation-seen-again')).toBeNull()
    expect(screen.queryByTestId('reader-edit')).toBeNull()
  })
})

describe('the map’s right-click, and the whole record', () => {
  const rightClick = (element: Element) => fireEvent.contextMenu(element, { clientX: 40, clientY: 60 })
  const onMap = () => screen.getByTestId('analysis-picture')

  it('offers a cause’s own actions, in the reader’s words, and Edit opens the full window', () => {
    mount({ model: { ...model, causes: [cause({ root: true, explains: [{ id: 'o1', strength: 'strong' }] })] }, initialTab: 'analysis-map', initialNonce: 1 })
    rightClick(onMap().querySelector('[data-key="c1"]')!)
    const menu = screen.getByTestId('picture-menu')
    // A root cause ends the chain, so nothing deeper.
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Solution…', 'Not the root after all…', 'Verify…', 'Edit', 'Merge…', 'Delete…',
    ])
    fireEvent.click(screen.getByTestId('picture-menu-edit'))
    expect(screen.getByRole('dialog', { name: 'Editing a cause' })).toBeTruthy()
  })

  it('asks before This is the root cause from the menu, in the reader, and says why where it is refused', () => {
    const { onChange } = mount({ initialTab: 'analysis-map', initialNonce: 1 })
    rightClick(onMap().querySelector('[data-key="c1"]')!)
    fireEvent.click(screen.getByTestId('picture-menu-root-toggle'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('cause-root-ask').textContent).toContain('Make CA-0001 a root cause? It becomes RC-0001.')
    fireEvent.click(screen.getByTestId('cause-root-ask-confirm'))
    expect(lastChange(onChange).causes[0].root).toBe(true)
    cleanup()
    const refused = mount({ model: { ...model, causes: [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, title: 'No capacity planning', explains: [{ id: 'c1', strength: 'normal' }] }),
    ] }, initialTab: 'analysis-map', initialNonce: 1 })
    rightClick(onMap().querySelector('[data-key="c1"]')!)
    fireEvent.click(screen.getByTestId('picture-menu-root-toggle'))
    expect(screen.getByRole('alert').textContent).toContain('CA-0002 No capacity planning explains it.')
    expect(refused.onChange).not.toHaveBeenCalled()
  })

  it('goes back to the list from its one named crumb or Escape on the whole record, and closes on the next press (ADR-0044 §2)', () => {
    const onClose = vi.fn()
    mount({ onClose, below: [] })
    const full = () => {
      openRow('o1')
      openFull()
      expect(screen.getByTestId('observation-history')).toBeTruthy()
      // One way back: the crumb, and no second ‹ or × on the tab row.
      expect(screen.queryByTestId('page-back')).toBeNull()
      expect(screen.queryByTestId('page-close')).toBeNull()
    }
    for (const leave of [
      () => fireEvent.click(screen.getByRole('button', { name: 'Seen' })),
      () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }),
    ]) {
      full()
      leave()
      expect(screen.queryByTestId('observation-history')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    }
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('page-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('makes a link stronger or weaker, or takes it away, from the line', () => {
    const { onChange } = mount({ initialTab: 'analysis-map', initialNonce: 1 })
    rightClick(screen.getAllByTestId('analysis-link-hit')[0])
    expect(screen.getByTestId('picture-menu-strength-strong').textContent).toContain('✓')
    fireEvent.click(screen.getByTestId('picture-menu-strength-weak'))
    expect(lastChange(onChange).causes[0].explains).toEqual([{ id: 'o1', strength: 'weak' }])
    rightClick(screen.getAllByTestId('analysis-link-hit')[0])
    fireEvent.click(screen.getByTestId('picture-menu-unlink'))
    expect(lastChange(onChange).causes[0].explains).toEqual([])
  })

  it('offers nothing where the scope is read-only', () => {
    mount({ readOnly: true, initialTab: 'analysis-map', initialNonce: 1 })
    rightClick(onMap().querySelector('[data-key="c1"]')!)
    expect(screen.queryByTestId('picture-menu')).toBeNull()
  })
})

describe('a map opens readable', () => {
  const chains = (count: number) => ({
    observations: Array.from({ length: count }, (_, index) => observation({ id: `o${index + 1}`, number: index + 1, title: `Seen ${index + 1}` })),
    causes: Array.from({ length: count }, (_, index) => cause({ id: `c${index + 1}`, number: index + 1, title: `Why ${index + 1}`, explains: [{ id: `o${index + 1}`, strength: 'normal' }] })),
  })

  it('opens at 100%, on the heaviest chains, and offers the rest', () => {
    mount({ model: { ...model, ...chains(20) }, below: [], initialTab: 'analysis-map', initialNonce: 1 })
    expect(screen.getByTestId('zoom-value').textContent).toBe('100%')
    expect(screen.getByTestId('map-window').textContent).toContain('The 6 chains with the highest impact, of 20')
    const drawn = () => within(screen.getByTestId('analysis-picture')).getAllByTestId('analysis-observation').length
    expect(drawn()).toBe(6)
    fireEvent.click(screen.getByTestId('map-more'))
    expect(drawn()).toBe(16)
    fireEvent.click(screen.getByTestId('map-all'))
    expect(drawn()).toBe(20)
    fireEvent.click(screen.getByTestId('map-top'))
    expect(drawn()).toBe(6)
  })

  it('offers Show all under the map, says how many are hidden, and keeps the choice past a reopening', () => {
    const held: Record<string, number> = {}
    const seams = { widthOf: (seam: string) => (held[seam] && held[seam] > 0 ? held[seam] : undefined), keep: (seam: string, width: number) => { held[seam] = width } }
    const open = () => mount({ model: { ...model, ...chains(20) }, below: [], initialTab: 'analysis-map', initialNonce: 1, wrap: seams })
    open()
    const bar = screen.getByTestId('map-window')
    expect(bar.textContent).toContain('14 hidden')
    expect(screen.getByTestId('observation-body').contains(bar)).toBe(true)
    const frame = screen.getByTestId('analysis-frame')
    expect(frame.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByTestId('map-all'))
    cleanup()
    open()
    expect(within(screen.getByTestId('analysis-picture')).getAllByTestId('analysis-observation')).toHaveLength(20)
    expect(screen.getByTestId('map-top')).toBeTruthy()
  })

  it('folds a long list into a card that opens it, and puts what has no chain on a pile that lists it', () => {
    const list = Array.from({ length: 9 }, (_, index) => observation({ id: `o${index + 1}`, number: index + 1, title: `Seen ${index + 1}` }))
    mount({ model: { ...model, observations: [...list, observation({ id: 'alone', number: 10, title: 'Alone' })], causes: [cause({ explains: list.map((one) => ({ id: one.id, strength: 'normal' as const })) })] }, below: [], initialTab: 'analysis-map', initialNonce: 1 })
    const picture = () => within(screen.getByTestId('analysis-picture'))
    expect(picture().getAllByTestId('analysis-observation')).toHaveLength(4)
    const fold = picture().getByRole('button', { name: 'and 5 more' })
    fireEvent.click(fold)
    expect(picture().getAllByTestId('analysis-observation')).toHaveLength(9)
    fireEvent.click(picture().getByRole('button', { name: '1 with no why yet' }))
    expect(screen.getByTestId('observation-tab-register').getAttribute('aria-selected')).toBe('true')
  })

  it('zooms down to a floor of 60% and no further, and a card far out drops to one line', () => {
    mount({ initialTab: 'analysis-map', initialNonce: 1 })
    for (let press = 0; press < 8; press += 1) fireEvent.click(screen.getByTestId('zoom-out'))
    expect(screen.getByTestId('zoom-value').textContent).toBe('60%')
    fireEvent.click(screen.getByTestId('zoom-home'))
    expect(screen.getByTestId('zoom-value').textContent).toBe('100%')
  })

  it('asks why from the + on a card, by press or by key, and is not there where nothing may be written', () => {
    mount({ initialTab: 'analysis-map', initialNonce: 1 })
    const card = screen.getByTestId('analysis-picture').querySelector('[data-key="o1"]')!
    fireEvent.mouseEnter(card)
    fireEvent.click(screen.getByTestId('analysis-handle'))
    expect(screen.getByRole('complementary', { name: 'Why does this happen?' })).toBeTruthy()
    cleanup()
    mount({ readOnly: true, initialTab: 'analysis-map', initialNonce: 1 })
    const read = screen.getByTestId('analysis-picture').querySelector('[data-key="o1"]')!
    fireEvent.mouseEnter(read)
    expect(screen.queryByTestId('analysis-handle')).toBeNull()
  })

  it('does not overprint a card with a link leaving the picture: the marker has a line of its own', () => {
    mount({ below: [], explainedAbove: new Map([['c1', [{ scope: 'acme', cause: cause({ id: 'up', number: 9, root: true, title: 'Above' }), strength: 'normal' as const }]]]), initialTab: 'analysis-map', initialNonce: 1 })
    const card = screen.getByTestId('analysis-picture').querySelector('[data-key="c1"]')!
    const marker = within(card as HTMLElement).getByTestId('picture-marker')
    const ys = [...card.querySelectorAll('text')].filter((one) => (one as Element) !== marker).map((one) => one.getAttribute('y'))
    expect(ys).not.toContain(marker.getAttribute('y'))
  })
})
