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
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceTab } from '../../widgets/placeTab'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogDanger } from '../../widgets/kit/Dialog'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { RecordPage } from '../../widgets/kit/RecordPage'
import type { RecordSection } from '../../widgets/kit/RecordPage'
import { TimeStrip } from '../../widgets/kit/TimeStrip'
import type { DescribeElsewhere } from '../planGateHints'
import { boardsOfPlan, dayToShow } from '../planReading'
import { DeleteActions, PlanStatusLine } from './PlanFacts'
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
    <PageDialog
      open={open} {...(props.windowChrome?.topInset !== undefined ? { topInset: props.windowChrome.topInset } : {})}
      onClose={onClose} aria-label={t('plan.page')}
    >
      {plan
        ? <PlanRecord {...props} plan={plan} />
        : open && <PageState state="empty" title={t('plan.gone')} action={{ label: t('plan.close'), onPress: onClose }} />}
    </PageDialog>
  )
}

function PlanRecord(props: PlanPageProps & { plan: Transition }) {
  const { plan, model, readOnly, actions, today } = props
  const { t, language } = useStrings()
  const set = (patch: Partial<Transition>) => actions.updateTransition(plan.id, patch)
  const [section, setSection] = usePlaceTab('changes')
  const [headRow, setHeadRow] = useState<string>()
  const [milestone, setMilestone] = useState<string>()
  const [adding, setAdding] = useState<'element' | 'milestone' | 'decision'>()
  const [writing, setWriting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The long ones wait to be asked for, so the document is near the top; the address and the outline ask.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())
  const isOpen = (id: string) => unfolded.has(id) || section === id
  const goTo = (id: string) => {
    setUnfolded((was) => new Set(was).add(id))
    setSection(id)
  }
  const goToWay = (way: GateWay) => { if (way === 'window' || way === 'owner') setHeadRow(way); else goTo(way) }

  const progress = portProgress(model, plan)
  const decisions = props.decisions ?? []
  const decidedAbove = props.ancestorDecisions ?? []
  const pickedDay = milestone !== undefined ? plan.milestones[Number(milestone)]?.date : undefined
  const unitCount = plan.moves?.length ?? 0
  const openBoard = props.actions.onOpenBoard
  const boards = useMemo(() => boardsOfPlan(model, plan, today), [model, plan, today])
  const showDay = dayToShow(plan, today, pickedDay)
  const lookOn = openBoard && boards[0] ? (day: string) => openBoard(plan.id, boards[0].diagram.id, day) : undefined

  const more: MenuEntry[] = [
    ...(props.initiativeToggle === true && !readOnly ? [{
      label: t(plan.initiative ? 'plan.initiativeTurnOff' : 'plan.initiativeTurnOn'), checked: plan.initiative === true,
      onSelect: () => set({ initiative: plan.initiative ? undefined : true }),
    }] : []),
    ...(!readOnly ? [{ label: t('roadmap.delete'), final: true, onSelect: () => setDeleting(true) }] : []),
  ]
  const moreFor = (word: 'element' | 'milestone' | 'decision', label: string, guide: string) => (!readOnly
    ? <Button size="small" variant="quiet" data-guide={guide} onClick={() => setAdding(word)}>+ {label}</Button>
    : undefined)
  const body = useMemo(() => outline(plan.body).filter((entry) => entry.level <= 2), [plan.body])
  const sections: RecordSection[] = [
    {
      id: 'changes', heading: t('roadmap.touches'), group: t('plan.groupMoves'), count: plan.elements.length,
      aside: moreFor('element', t('plan.addElement'), 'plan.addElement'),
      children: (
        <>
          <ChangesRows
            plan={plan} model={model} readOnly={readOnly} describe={props.describe} set={set}
            onOpen={actions.onOpenElement} onDates={actions.updateElementDates}
            adding={adding === 'element'} onAdding={(on) => setAdding(on ? 'element' : undefined)}
          />
          <PropertyRows readOnly>
            {!isOpen('interfaces') && progress.total > 0 && (
              <PropertyRow
                label={t('plan.interfaces')} value={t('plan.interfacesRow', { done: progress.done, total: progress.total })}
                aside={<button type="button" className="roadmap-link" onClick={() => goTo('interfaces')}>{t(readOnly ? 'plan.openBoard' : 'plan.setDays')} ▸</button>}
              />
            )}
            {!isOpen('units') && props.organisation?.facts !== undefined && (
              <PropertyRow
                label={t('plan.units')} value={unitCount === 0 ? t('plan.unitsNone') : t('plan.unitsSome', { count: unitCount })}
                aside={<button type="button" className="roadmap-link" onClick={() => goTo('units')}>{t(readOnly ? 'plan.openBoard' : 'plan.moveAUnit')} ▸</button>}
              />
            )}
          </PropertyRows>
        </>
      ),
    },
    {
      id: 'interfaces', heading: t('plan.interfaces'), group: t('plan.groupMoves'), count: t('roadmap.countOf', { count: progress.done, total: progress.total }), folded: !isOpen('interfaces'),
      children: <PlanInterfaces plan={plan} model={model} today={today} readOnly={readOnly} actions={actions} />,
    },
    ...(props.organisation?.facts !== undefined ? [{
      id: 'units', heading: t('plan.units'), group: t('plan.groupMoves'), count: unitCount, folded: !isOpen('units'),
      children: <>{props.organisation.facts}{props.organisation.main}</>,
    }] : []),
    {
      id: 'milestones', heading: t('roadmap.milestones'), group: t('plan.groupMoves'), count: plan.milestones.length,
      aside: !readOnly && plan.milestones.length === 0
        ? moreFor('milestone', t('plan.milestoneName'), 'plan.milestone')
        : !readOnly && <Button size="small" variant="quiet" onClick={() => setAdding('milestone')}>+ {t('plan.milestoneName')}</Button>,
      children: (
        <MilestoneRows
          plan={plan} readOnly={readOnly} set={set} picked={milestone} onPicked={setMilestone}
          adding={adding === 'milestone'} onAdding={(on) => setAdding(on ? 'milestone' : undefined)}
          {...(lookOn ? { onLook: lookOn } : {})}
        />
      ),
    },
    {
      id: 'restsOn', heading: t('roadmap.restsOn'), group: t('plan.groupMoves'), count: plan.decisions.length,
      aside: decisions.some((adr) => !plan.decisions.includes(adr.id)) ? moreFor('decision', t('plan.decision'), 'plan.addDecision') : undefined,
      children: (
        <RestsOnRows
          plan={plan} decisions={decisions} decidedAbove={decidedAbove} readOnly={readOnly} set={set} onOpen={actions.onOpenDecision}
          adding={adding === 'decision'} onAdding={(on) => setAdding(on ? 'decision' : undefined)}
        />
      ),
    },
    {
      id: 'document', heading: t('plan.document'), group: t('plan.document'),
      aside: !readOnly ? <Button size="small" onClick={() => setWriting(true)} data-guide="plan.editText">{t('plan.editText')}</Button> : undefined,
      within: body.map((entry) => ({
        id: entry.id, label: entry.text,
        onPress: () => {
          const found = [...document.querySelectorAll<HTMLElement>('[data-document] [role="heading"]')].find((one) => one.textContent?.trim() === entry.text)
          found?.scrollIntoView?.({ block: 'start' })
        },
      })),
      children: <PlanBody plan={plan} model={model} onOpenElement={actions.onOpenElement} renderMarkdown={props.renderMarkdown} />,
    },
    {
      id: 'boards', heading: t('plan.boards'), group: t('plan.groupAround'), count: boards.length,
      children: boards.length === 0 ? <p className="plan-sentence">{t('plan.noBoards')}</p> : (
        <>
          <PropertyRows readOnly>
            {boards.map(({ diagram, draws, total }) => (
              <PropertyRow
                key={diagram.id} label={draws === total ? t('plan.boardDrawsAll', { count: total }) : t('plan.boardDraws', { count: draws, total })} value={diagram.name}
                aside={openBoard && (
                  <span className="plan-boardrow">
                    {isDay(diagram.asOf) && t('plan.boardFixed')}
                    <Button size="small" onClick={() => openBoard(plan.id, diagram.id, isDay(diagram.asOf) ? undefined : showDay)}>
                      {!isDay(diagram.asOf) && showDay ? t('plan.openOn', { day: formatDay(showDay, language) }) : t('plan.openBoard')}
                    </Button>
                    {!readOnly && actions.onDuplicateBoard && isDay(plan.to) && (
                      <Button size="small" variant="quiet" onClick={() => actions.onDuplicateBoard?.(diagram.id, plan.to!)}>
                        {t('plan.duplicateAsOf', { day: formatDay(plan.to, language) })}
                      </Button>
                    )}
                  </span>
                )}
              />
            ))}
          </PropertyRows>
          <p className="plan-note">{t('plan.boardsHelp')}</p>
        </>
      ),
    },
    {
      id: 'principles', heading: t('plan.principles'), group: t('plan.groupAround'),
      children: <CitationsSection about={{ kind: 'transition', id: plan.id }} subject={`${plan.title}\n${plan.body}`} />,
    },
    {
      id: 'history', heading: t('plan.changesLog'), group: t('plan.groupAround'),
      children: <RecordChanges about={{ kind: 'transition', id: plan.id }} first="proposed" />,
    },
    {
      id: 'comments', heading: t('plan.comments'), group: t('plan.groupAround'),
      children: <CommentThread about={{ kind: 'transition', id: plan.id }} />,
    },
  ]
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
            plan={plan} model={model} decisions={[...decisions, ...decidedAbove]} today={today} readOnly={readOnly}
            describe={props.describe} set={set} goTo={goToWay} editing={headRow} onEditing={setHeadRow} initiative={props.initiativeToggle === true}
          />
        )}
        actions={(
          <>
            {!readOnly && <Button size="small" onClick={() => setMoving(true)} data-guide="plan.move">{t('roadmap.shift')}</Button>}
            {props.onCopyLink && <Button size="small" onClick={props.onCopyLink} data-testid="plan-copy-link">{t('common.copyLink')}</Button>}
            {more.length > 0 && <MoreMenu items={more} label={t('plan.page')} />}
          </>
        )}
        band={(
          <TimeStrip
            label={t('plan.strip')} today={today} data-guide="plan.strip"
            {...(isDay(plan.from) ? { from: plan.from } : {})} {...(isDay(plan.to) ? { to: plan.to } : {})}
            items={plan.milestones.map((one, at) => ({ id: String(at), day: one.date, label: one.name })).filter((one) => isDay(one.day))}
            {...(milestone !== undefined ? { pickedId: milestone } : {})}
            onPick={(id) => { goTo('milestones'); setMilestone(id) }}
          />
        )}
        {...(section !== 'changes' ? { section } : {})}
        onSection={goTo}
        sections={sections}
      />
      {writing && <WritePlan plan={plan} model={model} chrome={props.windowChrome ?? NO_WINDOW_CHROME} {...writeProps(props)} onDone={() => setWriting(false)} onSave={(text) => set({ body: text })} />}
      {moving && <PlanMoveDialog plan={plan} model={model} onClose={() => setMoving(false)} onMove={(days) => { actions.shiftTransition(plan.id, days); setMoving(false) }} />}
      <Dialog
        open={deleting} title={t('roadmap.deleteConfirm', { name: plan.title })} onClose={() => setDeleting(false)}
        actions={<DeleteActions onCancel={() => setDeleting(false)} onDelete={() => { actions.removeTransition(plan.id); setDeleting(false); props.onClose() }} />}
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
function WritePlan({ plan, model, chrome, renderMarkdown, onAddImage, images, onSave, onDone }: {
  plan: Transition
  model: DesignModel
  chrome: WindowChrome
  renderMarkdown?: RenderMarkdown
  onAddImage?(file: File): Promise<string | undefined>
  images?: DocumentImages
  onSave: (text: string) => void
  onDone: () => void
}) {
  const { t } = useStrings()
  const [draft, setDraft] = useState(plan.body)
  return (
    <FocusedWindow
      open title={t('plan.editing')} number={transitionLabel(plan)} windowChrome={chrome} data-guide="plan.writing"
      changed={draft !== plan.body} saveLabel={t('plan.saveText')} onCancel={onDone}
      onSave={() => { if (draft !== plan.body) onSave(draft); onDone() }}
    >
      <MarkdownEditor
        variant="pane" autoFocus value={draft} onChange={setDraft} label={t('plan.source')} attachable
        {...(onAddImage ? { onAddImage } : {})} {...(images ? { images } : {})}
        template={{ label: t('md.fromTemplate'), text: planBodyTemplate(t) }}
        renderPreview={(text) => <div className="plan-document" data-document=""><PlanText text={text} model={model} onOpenElement={() => undefined} renderMarkdown={renderMarkdown} /></div>}
      />
    </FocusedWindow>
  )
}
