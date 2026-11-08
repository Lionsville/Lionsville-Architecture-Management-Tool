// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One plan, as one document with one scroll (ADR-0010, amended): a head that stays,
 * a strip of its milestones under it, its moves as one line each, then its text,
 * then what is around it. Three nested scrollers made a 10,000-character plan with
 * twenty interfaces unreadable, and a form beside a document read as a form.
 *
 * Reading changes nothing here, so there is no mode. A fact reads as words and a
 * press makes that one row a form; *Edit text* is the prose alone, in a focused
 * window with its preview. A reader sees no + and nothing to press.
 *
 * The page writes nothing itself. Every change is an action the caller turns into
 * a command, so a plan edited here is one undo step and one Activity line like a
 * plan edited anywhere else. The dates on an element the plan introduces or retires
 * are the element's own (ADR-0009); they are set here and written through a separate
 * action rather than into the plan.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { isDay, portProgress, transitionLabel } from '../../model'
import type { DesignModel, ElementId, LifecycleDates, Transition } from '../../model'
import type { Adr } from '../../model/adr'
import { linkElementRefs, outline } from '../../documentation/documentation'
import type { MarkdownRenderOptions } from '../../documentation'
import { CitationsSection } from '../../principles/ui/CitationsSection'
import { CommentThread } from '../../comments/ui/threadPart'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import { planBodyTemplate } from '../planTemplate'
import { useStrings } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceTab } from '../../widgets/placeTab'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogDanger } from '../../widgets/kit/Dialog'
import { FocusedWindow, useWritingView } from '../../widgets/kit/FocusedWindow'
import { RecordActions } from '../../widgets/kit/RecordActions'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { RecordPage } from '../../widgets/kit/RecordPage'
import type { RecordSection } from '../../widgets/kit/RecordPage'
import { TimeStrip } from '../../widgets/kit/TimeStrip'
import type { DescribeElsewhere } from '../planGateHints'
import { boardsOfPlan, dayToShow } from '../planReading'
import type { PlanBoard } from '../planReading'
import { deleteAnswers, PlanStatusLine } from './PlanFacts'
import type { GateWay } from './PlanFacts'
import { PlanInterfaces } from './PlanInterfaces'
import { PlanMoveDialog } from './PlanMoveDialog'
import { ChangesRows, MilestoneRows, RestsOnRows } from './PlanMoves'
import { formatDay } from '../../i18n/dates'
import './Roadmap.css'

export type PlanActions = {
  updateTransition(id: string, patch: Partial<Transition>): void
  removeTransition(id: string): void
  /** Move a plan and the dates it owns by a number of days, as one step. */
  shiftTransition(id: string, days: number): void
  /** The dates on an element the plan names; they are the element's own. */
  updateElementDates(id: ElementId, dates: LifecycleDates | undefined): void
  /** Move one interface, the line with this id, onto an introduced element on a day. */
  port(planId: string, connectionId: string, toId: ElementId, on: string): void
  /** Every interface not yet planned, onto one element on one day, as one step. */
  portAll(planId: string, toId: ElementId, on: string): void
  /** Take a port back: the twin goes and the original is open-ended again. */
  unport(planId: string, connectionId: string): void
  /** Show an element on the canvas. */
  onOpenElement(id: ElementId): void
  /** Open a decision record the plan rests on. */
  onOpenDecision?(id: string): void
  /** Open a board on a day, carrying the plan: it only looks and saves nothing. */
  onOpenBoard?(planId: string, boardId: string, day: string | undefined): void
  /** The tab menu's *Duplicate as of…*, from here with the plan's day. */
  onDuplicateBoard?(boardId: string, day: string): void
}

export type PlanPageProps = {
  open: boolean
  /** Absent while the page is closing, or when the plan was deleted under it. */
  plan: Transition | undefined
  model: DesignModel
  /** The project's decision records, for the list of what the plan rests on. */
  decisions?: readonly Adr[]
  /**
   * The records of the scopes above, which a plan may rest on too: its gate
   * asks whether they are accepted (ADR-0009, amended 28 September 2026).
   */
  ancestorDecisions?: readonly Adr[]
  /** The day "now" is, so a port whose day has come reads as done. */
  today: string
  readOnly: boolean
  actions: PlanActions
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
  /** A picture into the project, and the project's pictures (ADR-0009). */
  onAddImage?(file: File): Promise<string | undefined>
  images?: DocumentImages
  onClose(): void
  /** *Copy link* to this plan (ADR-0033, amended), offered read-only too; absent, none is drawn. */
  onCopyLink?: (() => void) | undefined
  windowChrome?: WindowChrome
  /**
   * Offer the initiative switch (ADR-0012 §7): this scope has scopes above
   * it whose roadmaps could follow the plan. The organisation itself has
   * none, and the switch would promise a roadmap that is not there.
   */
  initiativeToggle?: boolean
  /**
   * What the tree says about an element this scope holds only a stand-in of
   * (ADR-0012 §3): the scope that defines it, and the day that scope says it
   * is gone. A stand-in's dates are kept there, and the gate and the rows
   * say so. Absent in a shell with no tree.
   */
  describe?: DescribeElsewhere
  /**
   * What the plan does to the organisation (ADR-0036 §6), drawn by the host,
   * which knows the units and the people: the units it moves; the organisation
   * before and after and the people to move. Absent in a shell with no organisation.
   */
  organisation?: { facts?: ReactNode; main?: ReactNode }
}

export function PlanPage(props: PlanPageProps) {
  const { plan, open, onClose } = props
  const { t } = useStrings()
  return (
    <PageDialog open={open} topInset={(props.windowChrome ?? NO_WINDOW_CHROME).topInset} onClose={onClose} aria-label={t('plan.page')}>
      {plan
        ? <PlanRecord {...props} plan={plan} />
        : open && <PageState state="empty" title={t('plan.gone')} action={{ label: t('plan.close'), onPress: onClose }} />}
    </PageDialog>
  )
}

/** What the sections of a plan are drawn from. */
type Sections = {
  props: PlanPageProps & { plan: Transition }
  t: Translate
  language: Language
  set: (patch: Partial<Transition>) => void
  isOpen: (id: string) => boolean
  goTo: (id: string) => void
  milestone: string | undefined
  setMilestone: (id: string | undefined) => void
  adding: Adding | undefined
  setAdding: (word: Adding | undefined) => void
  setWriting: (on: boolean) => void
  boards: readonly PlanBoard[]
  showDay: string | undefined
}

type Adding = 'element' | 'milestone' | 'decision'

/** A + to add a row: nothing for a reader. */
function addButton({ props, setAdding }: Sections, word: Adding, label: string, guide?: string) {
  return props.readOnly ? undefined : <Button size="small" variant="quiet" data-guide={guide} onClick={() => setAdding(word)}>+ {label}</Button>
}

/** What it changes, with a line each for what waits to be asked for: the long ones, so the document is near the top. */
function changesSection(on: Sections): RecordSection {
  const { props: { plan, model, readOnly, describe, actions, organisation }, t, set, isOpen, goTo, adding, setAdding } = on
  const progress = portProgress(model, plan)
  const way = (id: string, word: StringKey) => <button type="button" className="roadmap-link" onClick={() => goTo(id)}>{t(readOnly ? 'plan.openBoard' : word)} ▸</button>
  const units = plan.moves?.length ?? 0
  return {
    id: 'changes', heading: t('roadmap.touches'), group: t('plan.groupMoves'), count: plan.elements.length,
    aside: addButton(on, 'element', t('plan.addElement'), 'plan.addElement'),
    children: (
      <>
        <ChangesRows
          plan={plan} model={model} readOnly={readOnly} describe={describe} set={set}
          onOpen={actions.onOpenElement} onDates={actions.updateElementDates}
          adding={adding === 'element'} onAdding={(open) => setAdding(open ? 'element' : undefined)}
        />
        <PropertyRows readOnly>
          {!isOpen('interfaces') && progress.total > 0 && (
            <PropertyRow label={t('plan.interfaces')} value={t('plan.interfacesRow', { done: progress.done, total: progress.total })} aside={way('interfaces', 'plan.setDays')} />
          )}
          {!isOpen('units') && organisation?.facts !== undefined && (
            <PropertyRow label={t('plan.units')} value={units === 0 ? t('plan.unitsNone') : t('plan.unitsSome', { count: units })} aside={way('units', 'plan.moveAUnit')} />
          )}
        </PropertyRows>
      </>
    ),
  }
}

function movesSections(on: Sections): RecordSection[] {
  const { props: { plan, model, readOnly, today, actions, organisation, decisions = [], ancestorDecisions = [] }, t, set, isOpen, milestone, setMilestone, adding, setAdding, boards } = on
  const progress = portProgress(model, plan)
  const openBoard = actions.onOpenBoard
  const first = boards[0]
  const lookOn = openBoard && first ? (day: string) => openBoard(plan.id, first.diagram.id, day) : undefined
  return [
    changesSection(on),
    {
      id: 'interfaces', heading: t('plan.interfaces'), group: t('plan.groupMoves'), count: t('roadmap.countOf', { count: progress.done, total: progress.total }), folded: !isOpen('interfaces'),
      children: <PlanInterfaces plan={plan} model={model} today={today} readOnly={readOnly} actions={actions} />,
    },
    ...(organisation?.facts !== undefined ? [{
      id: 'units', heading: t('plan.units'), group: t('plan.groupMoves'), count: plan.moves?.length ?? 0, folded: !isOpen('units'),
      children: <>{organisation.facts}{organisation.main}</>,
    }] : []),
    {
      id: 'milestones', heading: t('roadmap.milestones'), group: t('plan.groupMoves'), count: plan.milestones.length,
      // The way in for a guide where no row carries the name yet.
      aside: addButton(on, 'milestone', t('plan.milestoneName'), plan.milestones.length === 0 ? 'plan.milestone' : undefined),
      children: (
        <MilestoneRows
          plan={plan} readOnly={readOnly} set={set} picked={milestone} onPicked={setMilestone}
          adding={adding === 'milestone'} onAdding={(open) => setAdding(open ? 'milestone' : undefined)}
          {...(lookOn ? { onLook: lookOn } : {})}
        />
      ),
    },
    {
      id: 'restsOn', heading: t('roadmap.restsOn'), group: t('plan.groupMoves'), count: plan.decisions.length,
      aside: decisions.some((adr) => !plan.decisions.includes(adr.id)) ? addButton(on, 'decision', t('plan.decision'), 'plan.addDecision') : undefined,
      children: (
        <RestsOnRows
          plan={plan} decisions={decisions} decidedAbove={ancestorDecisions} readOnly={readOnly} set={set} onOpen={actions.onOpenDecision}
          adding={adding === 'decision'} onAdding={(open) => setAdding(open ? 'decision' : undefined)}
        />
      ),
    },
  ]
}

function documentSection({ props: { plan, model, actions, renderMarkdown }, t }: Sections): RecordSection {
  return {
    id: 'document', heading: t('plan.document'), group: t('plan.document'),
    within: outline(plan.body).filter((entry) => entry.level <= 2).map((entry) => ({
      id: entry.id, label: entry.text,
      onPress: () => {
        const found = [...document.querySelectorAll<HTMLElement>('[data-document] [role="heading"]')].find((one) => one.textContent?.trim() === entry.text)
        found?.scrollIntoView?.({ block: 'start' })
      },
    })),
    children: <PlanBody plan={plan} model={model} onOpenElement={actions.onOpenElement} renderMarkdown={renderMarkdown} />,
  }
}

function BoardRow({ board: { diagram, draws, total }, on }: { board: PlanBoard; on: Sections }) {
  const { props: { plan, readOnly, actions }, t, language, showDay } = on
  const openBoard = actions.onOpenBoard
  const fixed = isDay(diagram.asOf)
  const duplicate = !readOnly && actions.onDuplicateBoard && isDay(plan.to) && diagram.kind === 'layer7' ? plan.to : undefined
  return (
    <PropertyRow
      label={draws === total ? t('plan.boardDrawsAll', { count: total }) : t('plan.boardDraws', { count: draws, total })} value={diagram.name}
      aside={openBoard && (
        <span className="plan-boardrow">
          {fixed && t('plan.boardFixed')}
          <Button size="small" onClick={() => openBoard(plan.id, diagram.id, fixed ? undefined : showDay)}>
            {!fixed && showDay ? t('plan.openOn', { day: formatDay(showDay, language) }) : t('plan.openBoard')}
          </Button>
          {duplicate && (
            <Button size="small" variant="quiet" onClick={() => actions.onDuplicateBoard?.(diagram.id, duplicate)}>
              {t('plan.duplicateAsOf', { day: formatDay(duplicate, language) })}
            </Button>
          )}
        </span>
      )}
    />
  )
}

function aroundSections(on: Sections): RecordSection[] {
  const { props: { plan }, t, boards } = on
  const about = { kind: 'transition' as const, id: plan.id }
  return [
    {
      id: 'boards', heading: t('plan.boards'), group: t('plan.groupAround'), count: boards.length,
      children: boards.length === 0 ? <p className="plan-sentence">{t('plan.noBoards')}</p> : (
        <>
          <PropertyRows readOnly>{boards.map((board) => <BoardRow key={board.diagram.id} board={board} on={on} />)}</PropertyRows>
          <p className="plan-note">{t('plan.boardsHelp')}</p>
        </>
      ),
    },
    {
      id: 'principles', heading: t('plan.principles'), group: t('plan.groupAround'),
      children: <CitationsSection about={about} subject={`${plan.title}\n${plan.body}`} headed={false} />,
    },
    {
      id: 'history', heading: t('plan.changesLog'), group: t('plan.groupAround'),
      children: <RecordChanges about={about} first="proposed" />,
    },
    {
      id: 'comments', heading: t('plan.comments'), group: t('plan.groupAround'), headless: true,
      children: <CommentThread about={about} />,
    },
  ]
}

function PlanRecord(props: PlanPageProps & { plan: Transition }) {
  const { plan, model, readOnly, actions, today } = props
  const { t, language } = useStrings()
  const set = (patch: Partial<Transition>) => actions.updateTransition(plan.id, patch)
  const [section, setSection] = usePlaceTab('changes')
  const [headRow, setHeadRow] = useState<string>()
  const [milestone, setMilestone] = useState<string>()
  const [adding, setAdding] = useState<Adding>()
  const [writing, setWriting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())
  const goTo = (id: string) => {
    setUnfolded((was) => new Set(was).add(id))
    setSection(id)
  }
  const boards = useMemo(() => boardsOfPlan(model, plan, today), [model, plan, today])
  const on: Sections = {
    props, t, language, set, goTo, milestone, setMilestone, adding, setAdding, setWriting, boards,
    isOpen: (id) => unfolded.has(id) || section === id,
    showDay: dayToShow(plan, today, milestone !== undefined ? plan.milestones[Number(milestone)]?.date : undefined),
  }
  const more: MenuEntry[] = readOnly ? [] : [
    ...(props.initiativeToggle === true ? [{
      label: t(plan.initiative ? 'plan.initiativeTurnOff' : 'plan.initiativeTurnOn'), checked: plan.initiative === true,
      onSelect: () => set({ initiative: plan.initiative ? undefined : true }),
    }] : []),
    { label: `${t('roadmap.delete')}…`, final: true, onSelect: () => setDeleting(true) },
  ]
  const copy: MenuEntry[] = props.onCopyLink ? [{ label: t('common.copyLink'), onSelect: props.onCopyLink, 'data-testid': 'plan-copy-link' }] : []
  const decided = [...(props.decisions ?? []), ...(props.ancestorDecisions ?? [])]
  return (
    <>
      <RecordPage
        dataGuide="plan.page"
        back={{ label: t('plan.back'), onPress: props.onClose }}
        code={transitionLabel(plan)}
        title={plan.title}
        {...(readOnly ? {} : { onRename: (title: string) => set({ title }) })}
        status={(
          <PlanStatusLine
            plan={plan} model={model} decisions={decided} today={today} readOnly={readOnly}
            describe={props.describe} set={set} editing={headRow} onEditing={setHeadRow} initiative={props.initiativeToggle === true}
            goTo={(way: GateWay) => { if (way === 'window' || way === 'owner') setHeadRow(way); else goTo(way) }}
          />
        )}
        actions={(
          <>
            <RecordActions
              verbs={!readOnly && <Button variant="quiet" onClick={() => setMoving(true)} data-guide="plan.move">{t('roadmap.shift')}</Button>}
              {...(readOnly ? {} : { edit: { onPress: () => setWriting(true), guide: 'plan.editText' } })}
              more={[...copy, ...more]} moreLabel={t('plan.page')}
            />
            <PageClose onClose={props.onClose} />
          </>
        )}
        band={(
          <TimeStrip
            label={t('plan.strip')} today={today}
            {...(isDay(plan.from) ? { from: plan.from } : {})} {...(isDay(plan.to) ? { to: plan.to } : {})}
            items={plan.milestones.map((one, at) => ({ id: String(at), day: one.date, label: one.name })).filter((one) => isDay(one.day))}
            {...(milestone !== undefined ? { pickedId: milestone } : {})}
            onPick={(id) => { goTo('milestones'); setMilestone(id) }}
          />
        )}
        {...(section !== 'changes' ? { section } : {})}
        onSection={goTo}
        sections={[...movesSections(on), documentSection(on), ...aroundSections(on)]}
      />
      {writing && <WritePlan plan={plan} model={model} {...writeProps(props)} onDone={() => setWriting(false)} onSave={(text) => set({ body: text })} />}
      {moving && <PlanMoveDialog plan={plan} model={model} onClose={() => setMoving(false)} onMove={(days) => { actions.shiftTransition(plan.id, days); setMoving(false) }} />}
      <Dialog
        open={deleting} title={t('roadmap.deleteConfirm', { name: plan.title })} onClose={() => setDeleting(false)}
        actions={deleteAnswers(t, () => setDeleting(false), () => { actions.removeTransition(plan.id); setDeleting(false); props.onClose() })}
      >
        <DialogDanger title={t('roadmap.deleteBody')} />
      </Dialog>
    </>
  )
}

const writeProps = ({ renderMarkdown, onAddImage, images }: PlanPageProps) => ({
  ...(renderMarkdown ? { renderMarkdown } : {}), ...(onAddImage ? { onAddImage } : {}), ...(images ? { images } : {}),
})

type RenderMarkdown = PlanPageProps['renderMarkdown']

/** The document as it reads. `[[Name]]` becomes a link to the element; a plan that names what it changes should say so. */
function PlanText({ text, model, onOpenElement, renderMarkdown }: { text: string; model: DesignModel; onOpenElement(id: ElementId): void; renderMarkdown: RenderMarkdown }) {
  const { t } = useStrings()
  const source = useMemo(() => linkElementRefs(text, model.elements), [text, model.elements])
  if (!source.trim()) return <p className="plan-sentence">{t('plan.bodyEmpty')}</p>
  return <>{renderMarkdown ? renderMarkdown(source, { onElementLink: onOpenElement }) : <pre style={{ whiteSpace: 'pre-wrap' }}>{source}</pre>}</>
}

function PlanBody({ plan, model, onOpenElement, renderMarkdown }: { plan: Transition; model: DesignModel; onOpenElement(id: ElementId): void; renderMarkdown: RenderMarkdown }) {
  return <div className="plan-document" data-document=""><PlanText text={plan.body} model={model} onOpenElement={onOpenElement} renderMarkdown={renderMarkdown} /></div>
}

/** *Edit text*: the body in the one editor, with nothing else on screen. Saved as one step; Cancel asks if anything changed. */
function WritePlan({ plan, model, renderMarkdown, onAddImage, images, onSave, onDone }: {
  plan: Transition
  model: DesignModel
  renderMarkdown?: RenderMarkdown
  onAddImage?(file: File): Promise<string | undefined>
  images?: DocumentImages
  onSave: (text: string) => void
  onDone: () => void
}) {
  const { t } = useStrings()
  const [draft, setDraft] = useState(plan.body)
  const { view, views } = useWritingView()
  return (
    <FocusedWindow
      open title={t('plan.editing')} number={transitionLabel(plan)} views={views}
      changed={draft !== plan.body} onCancel={onDone}
      onSave={() => { if (draft !== plan.body) onSave(draft); onDone() }}
    >
      <MarkdownEditor
        variant="pane" autoFocus value={draft} onChange={setDraft} label={t('plan.source')} attachable shownAs={view}
        {...(onAddImage ? { onAddImage } : {})} {...(images ? { images } : {})}
        template={{ label: t('md.fromTemplate'), text: planBodyTemplate(t) }}
        renderPreview={(text) => <div className="plan-document plan-preview" data-document=""><PlanText text={text} model={model} onOpenElement={() => undefined} renderMarkdown={renderMarkdown} /></div>}
      />
    </FocusedWindow>
  )
}
