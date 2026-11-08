// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record of the chain, framed three ways with one reading: the large preview over
 * a list, opened by selecting a row; the panel beside a map, where the map must stay
 * in view; and the whole record, which adds its links, history and comments.
 *
 * What each says is read off the record's bar (`observationBar` and its kin), so
 * nothing a reader offered can be lost on the way: the verb of the next question
 * stands in the Next step, the everyday ones stand beside it, and all the others are
 * under More, in the words and the order the right-click has.
 */
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import { useStrings } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { usePersonNames } from '../../people/ui/names'
import { Button } from '../../widgets/kit/Button'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { NextStep, StepLadder } from '../../widgets/kit/NextStep'
import type { NextAction, Step } from '../../widgets/kit/NextStep'
import { Panel } from '../../widgets/kit/Panel'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { RecordPage } from '../../widgets/kit/RecordPage'
import { CHAIN_STEPS, standingOf } from '../chain'
import type { ChainStep } from '../chain'
import { causeLabel, explainedBy, formatObservationNumber, isNoted, isRootCause, toneOf } from '../observation'
import type { Cause, Observation } from '../observation'
import { formatExperimentNumber, formatSolutionNumber, implementedOn, isConcluded, isLive } from '../solution'
import type { ReaderAction } from './ActionButton'
import { RecordBody, causeProps, experimentProps, observationProps, solutionProps, solutionSteps } from './PageReaders'
import type { ReaderContext, Selected } from './PageReaders'
import { causeBar, observationBar, observationFacts } from './Readers'
import type { CausePanel } from './Readers'
import { experimentBar, solutionBar } from './SolutionReaders'

/** What the frames ask of the page beside what the reader wires: going to the editor, and asking a cause's question in its reader. */
export type RecordPageWrites = {
  edit: (key: string) => void
  ask: (key: string, panel: CausePanel) => void
}

/** The actions that stand beside the next question rather than under More. */
const EVERYDAY = new Set(['edit', 'seen', 'verify', 'restore', 'experiment'])

export type RecordView = {
  readonly code: string
  readonly title: string
  readonly bar: readonly ReaderAction[]
  /** What else the right-click has for it: a solution's steps. */
  readonly next?: { readonly question?: string; readonly actions: readonly NextAction[] }
}

const asNext = (action: ReaderAction, primary = action.primary): NextAction => ({
  label: action.label, onPress: action.onClick, ...(primary ? { primary } : {}),
  ...(action.guide ? { dataGuide: action.guide } : {}), ...(action.testId ? { testId: action.testId } : {}),
})

/** An action of the bar, taken for the Next step: it says it once. */
function pick(bar: readonly ReaderAction[], keys: readonly string[]) {
  const taken = keys.flatMap((key) => bar.filter((one) => one.key === key))
  return { taken, rest: bar.filter((one) => !taken.includes(one)) }
}

function observationView(one: Observation, scope: string | undefined, key: string, ctx: ReaderContext, page: RecordPageWrites): RecordView {
  const { s } = ctx
  const props = observationProps(one, scope, key, ctx)
  const bar = observationBar(props, 'read', (next) => { if (next === 'edit') page.edit(key) })
  const base = { code: formatObservationNumber(one.number), title: one.title }
  if (one.archived || props.mergedInto) return { ...base, bar }
  const waiting = props.explainedBy.length === 0 && !isNoted(one)
  const { taken, rest } = pick(bar, ['cause'])
  const ask = taken[0]
  const question = !waiting ? undefined : toneOf(one) === 'bright' ? s('observation.askWhyBright') : s('observation.askWhy')
  const actions: NextAction[] = ask ? [
    asNext(ask, waiting),
    ...(waiting ? [{ label: s('observation.linkExisting'), testId: 'observation-link-existing', onPress: () => ctx.forms.openLink({ mode: 'cause', id: one.id, ...(scope !== undefined ? { scope } : {}), existing: true }) }] : []),
  ] : []
  return { ...base, bar: rest, ...(question || actions.length ? { next: { ...(question ? { question } : {}), actions } } : {}) }
}

function causeView(cause: Cause, scope: string | undefined, key: string, ctx: ReaderContext, page: RecordPageWrites): RecordView {
  const { s } = ctx
  const props = causeProps(cause, scope, ctx)
  const bar = causeBar(props, 'read', (next) => { if (next === 'edit') page.edit(key) }, (panel) => page.ask(key, panel))
  const base = { code: causeLabel(cause), title: cause.title }
  if (props.mergedInto) return { ...base, bar }
  if (isRootCause(cause)) {
    const { taken, rest } = pick(bar, ['solution'])
    const hasOne = (props.solutions?.length ?? 0) > 0
    return { ...base, bar: rest, next: { ...(hasOne ? {} : { question: s('observation.whatTakesAway') }), actions: taken.map((one) => asNext(one, !hasOne)) } }
  }
  const { taken, rest } = pick(bar, ['deeper', 'root-toggle'])
  const deeper = taken.find((one) => one.key === 'deeper')
  const actions: NextAction[] = [
    ...(deeper ? [asNext(deeper, true), { label: s('observation.linkExistingOne'), testId: 'cause-link-existing', onPress: () => ctx.forms.openLink({ mode: 'deeper', id: cause.id, ...(scope !== undefined ? { scope } : {}), existing: true }) }] : []),
    ...taken.filter((one) => one.key === 'root-toggle').map((one) => asNext(one, false)),
  ]
  return { ...base, bar: rest, next: { question: s('observation.andWhy'), actions } }
}

/** What a record is, and what it offers, whatever frames it. */
export function recordViewOf(held: Selected, key: string, ctx: ReaderContext, page: RecordPageWrites): RecordView {
  const { s } = ctx
  const edit = (next: 'read' | 'edit') => { if (next === 'edit') page.edit(key) }
  switch (held.kind) {
    case 'observation': return observationView(held.observation, undefined, key, ctx, page)
    case 'below': return observationView(held.observation, held.scope, key, ctx, page)
    case 'cause': return causeView(held.cause, undefined, key, ctx, page)
    case 'causeBelow': return causeView(held.cause, held.scope, key, ctx, page)
    case 'solution': {
      const props = solutionProps(held.solution, ctx)
      const base = { code: formatSolutionNumber(held.solution.number), title: held.solution.title, bar: solutionBar(props, 'read', edit) }
      const again = props.implemented?.observations.find((one) => one.seenOn)
      if (again) return { ...base, next: { question: s('solution.whyItCameBack'), actions: [{ label: s('solution.openRecord', { name: again.label.split(' ')[0] }), primary: true, onPress: () => ctx.openKey(again.key) }] } }
      if (!ctx.readOnly && held.solution.state === 'adopted' && !held.solution.plan && props.onStartPlan) {
        return { ...base, next: { question: s('solution.whoBuildsIt'), actions: [{ label: s('solution.startPlan'), primary: true, onPress: props.onStartPlan }] } }
      }
      return base
    }
    case 'experiment': {
      const one = held.experiment
      const bar = experimentBar(experimentProps(one, ctx), 'read', edit)
      const base = { code: formatExperimentNumber(one.number), title: one.title }
      if (isConcluded(one.outcome)) return { ...base, bar: [...bar.actions, ...bar.moves.map((move) => ({ ...move, occasional: true }))] }
      return {
        ...base, bar: bar.actions,
        next: { question: one.outcome === 'planned' ? s('solution.nextStart') : s('solution.nextShow'), actions: bar.moves.map((move) => asNext(move)) },
      }
    }
    case 'solutionBelow': return { code: formatSolutionNumber(held.solution.number), title: held.solution.title, bar: [] }
    case 'experimentBelow': return { code: formatExperimentNumber(held.experiment.number), title: held.experiment.title, bar: [] }
  }
}

/** The word of a stage on the stepper. */
const STEP_WORD = { seen: 'observation.stageSeen', why: 'observation.stageWhy', solve: 'observation.stageSolve', results: 'observation.stageResults' } as const

/** How far an observation's chain has got, read up its causes in its own scope. */
function standing(one: Observation, scope: string | undefined, ctx: ReaderContext): ChainStep {
  const lists = scope === undefined ? ctx.work : ctx.below.find((held) => held.scope === scope)
  const causes = lists?.causes ?? []
  const reached = new Set<string>()
  const walk = (id: string) => {
    for (const cause of explainedBy(causes, id)) {
      if (reached.has(cause.id)) continue
      reached.add(cause.id)
      walk(cause.id)
    }
  }
  walk(one.id)
  const solutions = (lists?.solutions ?? []).filter((held) => isLive(held) && held.addresses.some((address) => reached.has(address.id)))
  return standingOf({
    explained: reached.size > 0, solved: solutions.length > 0,
    built: scope === undefined && solutions.some((held) => implementedOn(held, ctx.plans) !== undefined),
  })
}

function steps(at: ChainStep, s: Translate): Step[] {
  const here = CHAIN_STEPS.indexOf(at)
  return CHAIN_STEPS.map((step, index) => ({
    id: step, label: s(STEP_WORD[step]), state: index < here ? 'done' as const : index === here ? 'current' as const : 'todo' as const,
  }))
}

/** The facts beside a preview's text. Only an observation has facts apart from what it says; the others list theirs in the text. */
function PreviewFacts({ held, ctx }: { held: Selected; ctx: ReaderContext }) {
  const names = usePersonNames()
  const { language } = useStrings()
  if (held.kind !== 'observation' && held.kind !== 'below') return null
  const scope = held.kind === 'below' ? held.scope : undefined
  const day = (date: string) => formatDay(date, language)
  const said = observationFacts(held.observation, { names, day, s: ctx.s, fromScope: scope !== undefined ? ctx.scopeLabel(scope) : undefined })
  return (
    <>
      {said.map((one) => <PreviewFact key={one.label} label={one.label}><span data-testid={one.testId}>{one.value}</span></PreviewFact>)}
      <PreviewFact label={ctx.s('observation.whereItStands')}>
        <StepLadder steps={steps(standing(held.observation, scope, ctx), ctx.s)} orientation="down" />
      </PreviewFact>
    </>
  )
}

/** The everyday actions, drawn; the others, the copy link among them, under the one ⋯. */
function BarButtons({ view, ctx, held, editApart = false }: {
  view: RecordView
  ctx: ReaderContext
  held: Selected
  /** Edit is drawn elsewhere: in a preview's head. */
  editApart?: boolean
}) {
  const { s } = ctx
  const everyday = view.bar.filter((one) => EVERYDAY.has(one.key) && one.key !== 'edit')
  const edit = editApart ? undefined : view.bar.find((one) => one.key === 'edit')
  const others = view.bar.filter((one) => !EVERYDAY.has(one.key))
  const steps_ = held.kind === 'solution' ? solutionSteps(solutionProps(held.solution, ctx), s) : []
  const { copyLink } = ctx
  const entry = (one: ReaderAction): MenuEntry => ({
    label: one.opensDialog ? `${one.label}…` : one.label, onSelect: one.onClick, hint: one.tip,
    ...(one.danger ? { final: true } : {}), ...(one.guide ? { 'data-guide': one.guide } : {}), ...(one.testId ? { 'data-testid': one.testId } : {}),
  })
  const items: MenuEntry[] = [
    ...others.map(entry),
    ...steps_.filter((one) => one.key !== 'move').map((one): MenuEntry => ({
      label: one.label, onSelect: one.onClick, ...(one.disabled ? { refused: s('solution.moveHeld') } : {}),
    })),
    ...(copyLink ? [{ label: s('common.copyLink'), hint: s('observation.tipCopyLink'), onSelect: () => copyLink(held), 'data-testid': 'reader-copy-link' }] : []),
  ]
  return (
    <>
      {everyday.map((one) => (
        <Button key={one.key} variant={one.key === 'restore' ? 'primary' : 'quiet'} title={one.tip} onClick={one.onClick} data-testid={one.testId} data-guide={one.guide}>{one.label}</Button>
      ))}
      {items.length > 0 && <MoreMenu items={items} label={s('observation.more')} />}
      {edit && <Button onClick={edit.onClick} title={edit.tip} data-testid={edit.testId}>{edit.label}</Button>}
    </>
  )
}

export type RecordFrameProps = {
  held: Selected
  heldKey: string
  ctx: ReaderContext
  page: RecordPageWrites
}

/** The large preview over a list: the title and the next question stay in view while the text scrolls. */
export function RecordPreview({ held, heldKey, ctx, page, ids, listWord, onSelect, onFull }: RecordFrameProps & {
  ids: readonly string[]
  listWord?: string
  onSelect: (key: string | null) => void
  onFull: () => void
}) {
  const view = recordViewOf(held, heldKey, ctx, page)
  const isObservation = held.kind === 'observation' || held.kind === 'below'
  const edit = view.bar.find((one) => one.key === 'edit')
  return (
    <Preview
      ids={ids} currentId={heldKey} onSelect={onSelect} title={view.title} code={view.code} {...(listWord ? { listWord } : {})}
      openFull={{ label: ctx.s('observation.openFull'), onPress: onFull }}
      {...(edit ? { edit: { label: edit.label, onPress: edit.onClick, ...(edit.tip ? { title: edit.tip } : {}), ...(edit.testId ? { testId: edit.testId } : {}) } } : {})}
      {...(isObservation ? { facts: <PreviewFacts held={held} ctx={ctx} /> } : {})}
      foot={(
        <div className="chain-foot">
          {view.next && <NextStep inline {...view.next} />}
          <span className="chain-foot__end"><BarButtons view={view} ctx={ctx} held={held} editApart /></span>
        </div>
      )}
      dataGuide="observations.preview"
    >
      <RecordBody selected={held} selectedKey={heldKey} ctx={ctx} part="preview" />
    </Preview>
  )
}

/** The panel beside a map: the same record, all of it, with the map still there to walk. */
export function RecordPanel({ held, heldKey, ctx, page, width, onClose }: RecordFrameProps & { width: number; onClose: () => void }) {
  const view = recordViewOf(held, heldKey, ctx, page)
  return (
    <Panel kind={view.code} name={view.title} width={width} onClose={onClose} actions={<BarButtons view={view} ctx={ctx} held={held} />}>
      {view.next && <NextStep {...view.next} />}
      <RecordBody selected={held} selectedKey={heldKey} ctx={ctx} part="full" />
    </Panel>
  )
}

/** The whole record, on a page of its own: named back to the stage it was opened from. */
export function RecordFull({ held, heldKey, ctx, page, backLabel, onBack }: RecordFrameProps & { backLabel: string; onBack: () => void }): ReactNode {
  const view = recordViewOf(held, heldKey, ctx, page)
  return (
    <RecordPage
      back={{ label: backLabel, onPress: onBack }}
      code={view.code}
      title={view.title}
      actions={<BarButtons view={view} ctx={ctx} held={held} />}
      sections={[{
        // The record's title is the page's heading: the text starts straight under the question, as a document does.
        id: 'record', heading: ctx.s('observation.fullRecord'), headless: true,
        children: (
          <>
            {view.next && <div className="chain-read__next"><NextStep inline {...view.next} /></div>}
            <RecordBody selected={held} selectedKey={heldKey} ctx={ctx} part="full" />
          </>
        ),
      }]}
    />
  )
}

