// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing on the sheet, read first: the one panel, over the page, with what
 * real sheets use at the top. *Covered by* and *Who holds it* lead, because every
 * function says *live* and almost none has a description; *Lifecycle* and *Place*
 * are folded lines that show their value, so three date fields no longer push the
 * links below the fold.
 *
 * A function or a step, and the difference between them is two rows: a function
 * says what covers it, a step says whose path it is on. Everything else they
 * share, because in the model they are the same shape (ADR-0012 §3).
 *
 * **The page writes nothing itself.** Every change is an action the caller turns
 * into a `Command`, so a capability renamed here is one undo step and one Activity
 * line, exactly as a node renamed on the canvas is.
 *
 * **Re-parenting is refused, not repaired.** A parent that would make a loop
 * is offered as a disabled option with the reason beside it
 * (`business/tree.wouldCycle`), because a cycle is not a state a person can
 * see and mend on a page that is drawn from the tree the cycle broke.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { DATED_PHASES, LIFECYCLE_ORDER, datesInOrder } from '../../model'
import type { Command, DesignDiagram, DesignElement, DesignModel, ElementId, Lifecycle, Relation } from '../../model'
import type { AspectScale } from '../../model/aspectScale'
import { ratingOn, withRating } from '../../model/aspectScale'
import { MarkdownField } from '../../documentation/ui/MarkdownField'
import type { MarkdownRenderOptions } from '../../documentation'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import { CompactForms } from '../../widgets/CompactForms'
import { plural } from '../../i18n/strings'
import type { StringKey } from '../../i18n'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { CaretIcon, CloseIcon } from '../../widgets/icons'
import { OrderedDateFields } from '../../widgets/OrderedDateFields'
import { PickToAdd } from '../../widgets/PickToAdd'
import type { PickOption } from '../../widgets/PickToAdd'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Select } from '../../widgets/kit/Field'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { mayRemove } from '../authoring'
import { coverageFor, coverageOf } from '../coverage'
import { MAX_SPAN, withSpan } from '../grid'
import type { MapDescribe } from '../map'
import { childrenOf, descendantsOf, wouldCycle } from '../tree'

/**
 * A new thing in one of the sheet's trees.
 *
 * No id: it is minted from the name where the command is built, the way every
 * other new element in this app gets the key the file would have given it
 * (ADR-0002). What a depth MEANS — a phase, a step, a grouping, a capability
 * — is the parent it is given and nothing else, which is why one shape serves
 * every *+* on the page.
 */
export type NewElement = {
  kind: 'step' | 'function' | 'actor'
  name: string
  /** Nothing makes it a root: a journey, an area, a stakeholder group. */
  parentId?: ElementId
  /** A step only: whose path it is on. */
  lane?: ElementId
  /** An actor only: not part of this organisation. */
  outside?: true
}

/** A lane, which is an actor and the first step that puts it on the page. */
export type NewLane = {
  /** A stakeholder the organisation already holds… */
  actorId?: ElementId
  /** …or one made in the same step, when the person typed a name instead. */
  name?: string
  outside?: true
  /** Where its first step goes, so the row has somewhere to be. */
  phaseId: ElementId
  stepName: string
}

/** One tick in the coverage of a capability (ADR-0012 §5, §9). */
export type CoverageChange = {
  /** An application supports it, or an actor is assigned to it. */
  type: 'supports' | 'assigned'
  /** The application or the actor. */
  sourceId: ElementId
  functionId: ElementId
  /** Ticked adds the row; unticked takes every row that says the same thing. */
  on: boolean
}

/**
 * What the sheet and its inspector may ask the session to do.
 *
 * Every one of these is a `Command` through the same dispatch a keystroke on
 * the canvas takes, so anything made here is one undo step and one Activity
 * line. The four that make something answer with the id it was given, because
 * the page selects what it just made and puts the cursor in its name — the
 * whole gesture is click, type, Enter.
 */
export type SheetActions = {
  /**
   * A field on an element. `coalesce` makes a run of keystrokes one step —
   * the same key the canvas's own field edits use.
   */
  updateElement(id: ElementId, patch: Partial<DesignElement>, coalesce?: string): void
  /** Move one among its neighbours, up or down. One step, however many rows it renumbers. */
  moveElement(id: ElementId, by: -1 | 1): void
  /** The sheet's own fields: the rail, the journey, which areas, in which order and how wide. */
  updateSheet(patch: Partial<Pick<DesignDiagram, 'journeyId' | 'lanes' | 'areas' | 'showActors' | 'areaSpans' | 'columns' | 'paper' | 'asOf' | 'colourBy' | 'labels' | 'poster' | 'author' | 'client' | 'documentDate'>>): void
  /** Show an application where it is drawn — where the coverage links go. */
  onOpenElement(id: ElementId): void

  // --- making things (the gestures on the page) ------------------------------
  /** A phase, a step, a grouping, a capability, a stakeholder. */
  addElement(seed: NewElement): ElementId | undefined
  /** A journey and the first thing it does, and this sheet drawing it. One step. */
  addJourney(names: { journey: string; phase: string }): ElementId | undefined
  /** An area, on this sheet from the moment it exists. One step. */
  addArea(name: string): ElementId | undefined
  /** A lane: its actor, and the first step that makes the row appear. One step. */
  addLane(lane: NewLane): ElementId | undefined
  /**
   * Take it out of the model, with its relations and whatever the sheet said
   * about it. Refused while something is inside it — ask `mayRemove` first,
   * which is what the page says out loud rather than finding out here — but
   * where `via` is given: a unit's delete, which the host makes and which
   * decides where the units inside go, is handed the commands instead.
   */
  removeElement(id: ElementId, via?: (commands: Command[]) => void): void
  /** Tick or untick what covers a capability. One transaction per tick. */
  setCoverage(change: CoverageChange): void
}

/**
 * Something that may support a capability: an application, wherever in the
 * organisation it is defined (ADR-0012 §2).
 *
 * The organisation's capabilities are supported by a landscape's
 * applications, and this scope's own model holds those, if at all, as
 * stand-ins. So the list to pick from is the register — every application in
 * the tree — handed in by the host, because `business` may not read the
 * scope index. `where` names the scope that defines it, where that is not
 * this one, the way the map's columns say it.
 */
export type Supporter = {
  id: ElementId
  name: string
  where?: string
}

/**
 * Who is responsible for what on the sheet (ADR-0036, amended 11 October
 * 2026): the `assigned` rows, from a unit anywhere in the organisation.
 *
 * Handed in by the host, because `business` may not read the scope index nor
 * the organisation's units: the units to pick from, grouped by type in their
 * rank and each saying where it is filed, with this scope's other actors
 * after them; what an actor kept elsewhere is called; and whether a unit
 * serves the domain of the area, grouping or capability it answers for. A
 * unit filed in another scope is the row's far end (ADR-0012 §5): the row is
 * kept here, and the unit is drawn on no board here for it.
 */
export type SheetResponsible = {
  choices: readonly PickOption[]
  name(id: ElementId): string | undefined
  /** False only for a unit that serves neither the function's domain nor sits under one that does. */
  serves(actorId: ElementId, functionId: ElementId): boolean
  /**
   * The unit an actor is, where it is one (ADR-0036, amended 13 October
   * 2026): what the label on a function names, and the scopes it serves
   * itself, each with its name. Nothing for an actor that is not a unit.
   */
  unit?(actorId: ElementId): { name: string; serves: readonly { scope: string; name: string }[] } | undefined
  /** A scope's home, opened from the label of a unit that serves it. Absent: the label opens nothing. */
  openScope?(scope: string): void
  /** A unit where it is kept, opened from the label of a unit that serves no scope. */
  openUnit?(actorId: ElementId): void
  /**
   * Who stops being what if this actor is deleted — a unit's assignments go
   * with it (ADR-0036, amended 12 October 2026) — drawn by the host, which
   * knows the people and the roles; nothing where deleting it ends no role,
   * and the delete then asks nothing.
   */
  rolesEnded?(actorId: ElementId): ReactNode | undefined
  /**
   * Deleting a unit (3.6.2), drawn and made by the host, which reads the
   * tree: ending it offered first, who stops being what, where the units
   * inside it go and what else goes — `render` with the choice the dialog
   * holds, `initial` first — and `run` with the sheet's own commands for the
   * delete. Nothing for an actor that is not a unit kept here.
   */
  unitDeletion?(actorId: ElementId): {
    initial: string
    render(choice: string, onChoice: (choice: string) => void, onDone: () => void): ReactNode
    run(choice: string, here: readonly Command[]): void
  } | undefined
}

/**
 * Which domains a function is handed to, and which took it up (ADR-0040 §4,
 * §5): the function's `scopes`, written here, and the scopes below that hold
 * a stand-in of it, read off the tree. Handed in by the host, because
 * `business` may not read the scope index nor know what a scope is called.
 */
export type SheetDomains = {
  /** The scopes below the one that defines the function, by name and type, less the ones it is handed to. */
  choices(functionId: ElementId): readonly PickOption[]
  /** What a scope is called, as a trail from the organisation down. */
  name(scope: string): string
  /** Is there such a scope? A path the tree does not hold is a domain nobody can open. Absent: every one is. */
  known?(scope: string): boolean
  /** The scopes holding a stand-in of it: the domains that took it up. */
  takenUpBy(functionId: ElementId): readonly string[]
  /** A scope's home, opened from its name. Absent: the names open nothing. */
  openScope?(scope: string): void
  /**
   * The applications filed in a scope, read off the register: what a subscope a
   * function is handed to has, which does not count as what covers it until mapped.
   */
  applicationsIn?(scope: string): readonly { id: ElementId; name: string }[]
}

/** What a poster says about the one record the panel is on: this view's, and no fact. */
export type PosterPanel = {
  /** Whether its answering unit shows on the tile at reading distance. */
  labelled: boolean
  onLabel(on: boolean): void
  /** Its hand-placed cell. Absent: it flows. */
  cell?: { col: number; row: number } | undefined
  onCell(cell: { col: number; row: number } | undefined): void
  /** The icon a step or a stakeholder carries, chosen in a dialog of the poster's. */
  onChooseIcon?: (() => void) | undefined
}

export type FunctionInspectorProps = {
  /** Absent when nothing on the sheet is chosen. */
  element: DesignElement | undefined
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  /**
   * How wide the panel is. The page's, because the page has the seam that
   * changes it. Absent = the default.
   */
  width?: number
  /**
   * Every application that may support a capability, from the whole tree.
   * Absent = this scope's own applications, which on an organisation's sheet
   * is usually none — a landscape's are what support its capabilities.
   */
  applications?: readonly Supporter[]
  /**
   * The way to the element's own page: its documentation with room, its
   * history, the plans that name it. Absent = no link.
   */
  onOpenDocumentation?(id: ElementId): void
  /**
   * Rows written in another scope (ADR-0012 §2): the `supports` rows behind
   * "2 apps" on an organisation's capability are a landscape's. The line
   * says what covers it counting those; the picker writes only this scope's
   * own rows, because those are the only ones it can take away again.
   */
  elsewhere?: readonly Relation[]
  /**
   * A nonce: put the cursor in the name field. The page bumps it when
   * something has just been made, which is what turns *+ capability* into
   * click, type, Enter — a flag would only work once, and the inspector is
   * not remounted between two things made one after the other.
   */
  nameFocus?: number
  /** Who may be made responsible, and what they are called. Absent: this scope's own actors. */
  responsible?: SheetResponsible
  /** The domains a function is handed to and taken up by. Absent: no *Domains*. */
  domains?: SheetDomains
  /** Something was deleted from here, so nothing is chosen any more. */
  onRemoved?(): void
  /** The panel closed: nothing is chosen. */
  onClose?(): void
  /** What is inside picked instead, from a delete that was refused for it. */
  onSelect?(id: ElementId): void
  /** The organisation's numeric scales (ADR-0046): a function's ratings. */
  scales?: readonly AspectScale[]
  /** What an application kept elsewhere is called and its dates, for *Covered by*. */
  describe?: MapDescribe
  /** The day read. */
  today?: string
  /** What this poster says about it; absent off a poster. */
  poster?: PosterPanel | undefined
  /** How wide an area is in a picture: the sheet's, since the window reflows. */
  columnsInPrint?: { span: number; drawn: boolean; spans: Record<ElementId, number> | undefined; onSpan(spans: Record<ElementId, number> | undefined): void }
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
  /**
   * Another scope answers for the record that is chosen (ADR-0012 §10): it is
   * a stand-in, drawn on this sheet and defined there.
   *
   * The same shape the canvas's inspector takes, and for the same reason:
   * `business` may not know what a scope tree is, so the fields and the words
   * are handed in. Asked per element rather than given as a value, because the
   * page keeps one inspector and the selection moves under it.
   */
  ownerOf?(id: ElementId): {
    label: string
    fields: readonly string[]
    onOpen?(): void
  } | undefined
}

/** The panel's default, and the least and most a seam may make it. */
export const INSPECTOR_WIDTH = { default: 320, min: 240, max: 640 } as const

/** What the record is called on the panel: a function by where it stands in its tree. */
function kindWord(element: DesignElement, model: DesignModel): StringKey {
  switch (element.kind) {
    case 'actor': return 'sheet.bandActor'
    case 'step': return element.parentId === undefined ? 'sheet.bandJourney' : model.elements.find((held) => held.id === element.parentId)?.parentId === undefined ? 'sheet.bandPhase' : 'sheet.bandStep'
    default:
      if (element.parentId === undefined) return 'sheet.bandArea'
      return model.elements.some((held) => held.parentId === element.id) ? 'sheet.bandGrouping' : 'sheet.bandCapability'
  }
}

const capitalised = (word: string) => word.charAt(0).toLocaleUpperCase() + word.slice(1)

/** The way down to it, from the top of its tree. */
function pathOf(element: DesignElement, model: DesignModel): string {
  const names: string[] = []
  const seen = new Set<string>([element.id])
  for (let at = element.parentId; at !== undefined && !seen.has(at);) {
    seen.add(at)
    const parent = model.elements.find((held) => held.id === at)
    if (!parent) break
    names.unshift(parent.name)
    at = parent.parentId
  }
  return names.join(' › ')
}

/** A line that shows its value, with its fields when asked. */
function FoldLine({ label, value, children, testId }: { label: string; value: string; children: ReactNode; testId?: string }) {
  return (
    <details className="sheet-fold" data-testid={testId}>
      <summary><span>{label}</span><span>{value}</span></summary>
      <div className="sheet-fold__body">{children}</div>
    </details>
  )
}

/** What a function adds to what every record has: what covers it, who holds it, its ratings. */
function FunctionBlocks({ props, owned }: { props: FunctionInspectorProps & { element: DesignElement }; owned(field: string): boolean }) {
  const { element, model, readOnly, actions } = props
  const { t } = useStrings()
  return (
    <>
      <CoveredBy
        element={element} model={model} readOnly={readOnly} actions={actions} applications={props.applications}
        elsewhere={props.elsewhere} responsible={props.responsible} describe={props.describe}
      />
      <InSubscope element={element} model={model} readOnly={readOnly} actions={actions} domains={props.domains} />
      <PanelSection title={t('sheet.whoHolds')}>
        <AssignedTo element={element} model={model} readOnly={readOnly} actions={actions} responsible={props.responsible} elsewhere={props.elsewhere} describe={props.describe} applications={props.applications} />
        <Domains element={element} model={model} readOnly={readOnly} owned={owned('scopes')} actions={actions} domains={props.domains} />
        {props.domains && <div className="sheet-held__say">{t('sheet.handingSay')}</div>}
      </PanelSection>
      <Ratings element={element} readOnly={readOnly || owned('ratings')} actions={actions} scales={props.scales ?? []} />
      <Inside element={element} model={model} onSelect={props.onSelect} />
      {props.poster && <OnThisPoster poster={props.poster} readOnly={readOnly} />}
    </>
  )
}

/** The folded lines: when it lives, and where it sits. */
function FoldedLines({ props, owned }: { props: FunctionInspectorProps & { element: DesignElement }; owned(field: string): boolean }) {
  const { element, model, readOnly, actions } = props
  const { t, language } = useStrings()
  const siblings = childrenOf(model.elements.filter((held) => held.kind === element.kind), element.parentId)
  const at = siblings.findIndex((held) => held.id === element.id)
  const parent = model.elements.find((held) => held.id === element.parentId)
  const place = at >= 0 && parent ? t('sheet.placeOf', { at: at + 1, count: siblings.length, name: parent.name }) : t('sheet.parentRoot')
  const lifeWord = t(`lifecycle.${element.lifecycle}` as StringKey)
  const dated = DATED_PHASES.find((phase) => phase === element.lifecycle && element.lifecycleDates?.[phase] !== undefined)
  const print = props.columnsInPrint
  return (
    <>
      <FoldLine label={t('sheet.lifecycle')} value={dated ? `${lifeWord} · ${formatDay(element.lifecycleDates![dated]!, language)}` : lifeWord} testId="sheet-fold-lifecycle">
        <TextField
          select fullWidth label={t('sheet.lifecycle')} value={element.lifecycle} disabled={readOnly || owned('lifecycle')}
          onChange={(e) => actions.updateElement(element.id, { lifecycle: e.target.value as Lifecycle })}
        >
          {LIFECYCLE_ORDER.map((phase) => <MenuItem key={phase} value={phase}>{t(`lifecycle.${phase}` as StringKey)}</MenuItem>)}
        </TextField>
        <OrderedDateFields
          keys={DATED_PHASES} values={element.lifecycleDates}
          label={(phase) => t(`sheet.date.${phase}` as StringKey)}
          ariaLabel={(phase) => `${element.name}: ${t(`sheet.date.${phase}` as StringKey)}`}
          size="small" fullWidth sx={{ minWidth: 0 }} disabled={readOnly || owned('lifecycleDates')}
          accepts={datesInOrder} refusal={t('command.datesOutOfOrder')}
          onChange={(lifecycleDates) => actions.updateElement(element.id, { lifecycleDates })}
        />
      </FoldLine>
      <FoldLine label={t('sheet.place')} value={place} testId="sheet-fold-place">
        <ParentField element={element} model={model} readOnly={readOnly} actions={actions} keptIn={props.ownerOf?.(element.id)?.label} />
        {print?.drawn && !readOnly && (
          <label className="kit-field">
            <span>{t('sheet.widthInPrint')}</span>
            <Select
              aria-label={t('sheet.widthInPrint')} value={String(print.span)}
              options={Array.from({ length: MAX_SPAN }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
              onChange={(event) => print.onSpan(withSpan(print.spans, element.id, Number(event.target.value)))}
            />
          </label>
        )}
      </FoldLine>
    </>
  )
}

/** Where it is really kept, said once at the top: everything below it that will not change will not for this. */
function KeptElsewhere({ owner }: { owner: NonNullable<ReturnType<NonNullable<FunctionInspectorProps['ownerOf']>>> }) {
  const { t } = useStrings()
  return (
    <span data-testid="owned-elsewhere">
      {t('standIn.definedIn', { scope: owner.label })}{' '}
      {owner.onOpen && <button type="button" className="sheet-page__link" onClick={owner.onOpen}>{t('standIn.open', { scope: owner.label })}</button>}
    </span>
  )
}

export function FunctionInspector(props: FunctionInspectorProps) {
  const { element, model, readOnly, actions } = props
  const { t } = useStrings()
  if (!element) return null
  const held = { ...props, element }
  const owner = props.ownerOf?.(element.id)
  /** Is this field the owning scope's? See the canvas inspector's twin of this. */
  const owned = (field: string) => owner?.fields.includes(field) ?? false
  const path = pathOf(element, model)
  const optional = {
    ...(props.width !== undefined ? { width: props.width } : {}),
    ...(!readOnly && !owned('name') ? { onRename: (name: string) => { actions.updateElement(element.id, { name }) } } : {}),
    ...(props.nameFocus !== undefined ? { renameRequest: props.nameFocus, renameAtOnce: true } : {}),
    ...(path !== '' ? { facts: path } : {}),
    ...(owner ? { status: <KeptElsewhere owner={owner} /> } : {}),
    ...(props.onClose ? { onClose: props.onClose } : {}),
  }
  return (
    <div className="sheet-panel__testid" data-testid="sheet-inspector">
      {/* One per record: a name half typed is about the one it was typed on, and must not land on the next. */}
      <Panel
        key={element.id} kind={capitalised(t(kindWord(element, model)))} name={element.name} dataGuide="sheet.inspector" {...optional}
        actions={props.onOpenDocumentation && (
          <button
            type="button" className="sheet-page__link" data-testid="sheet-open-page" aria-label={t('sheet.openPage', { name: element.name })}
            onClick={() => props.onOpenDocumentation?.(element.id)}
          >{t('sheet.pageLink')}</button>
        )}
      >
        <CompactForms>
          {element.kind === 'function' && <FunctionBlocks props={held} owned={owned} />}
          {element.kind === 'step' && <PanelSection><LaneField element={element} model={model} readOnly={readOnly} actions={actions} /><IconRow element={element} readOnly={readOnly} poster={props.poster} /></PanelSection>}
          {element.kind === 'actor' && (
            <PanelSection>
              <label className="sheet-held">
                <input
                  type="checkbox" checked={element.outside === true} disabled={readOnly || owned('outside')} aria-label={t('sheet.outsideOrganisation')}
                  onChange={(e) => actions.updateElement(element.id, { outside: e.target.checked ? true : undefined })}
                />
                {t('sheet.outsideOrganisation')}
              </label>
              <IconRow element={element} readOnly={readOnly} poster={props.poster} />
            </PanelSection>
          )}
          <Description element={element} readOnly={readOnly} actions={actions} renderMarkdown={props.renderMarkdown} />
          <FoldedLines props={held} owned={owned} />
          {!readOnly && (
            <div className="sheet-panel__foot">
              <Remove
                element={element} model={model} actions={actions} onRemoved={props.onRemoved} onSelect={props.onSelect}
                rolesEnded={props.responsible?.rolesEnded?.(element.id)} unit={props.responsible?.unitDeletion?.(element.id)}
              />
            </div>
          )}
        </CompactForms>
      </Panel>
    </div>
  )
}

/** An icon is optional, and a press on a poster's own dialog: no icon, no gap. */
function IconRow({ element, readOnly, poster }: { element: DesignElement; readOnly: boolean; poster: PosterPanel | undefined }) {
  const { t } = useStrings()
  if (!poster?.onChooseIcon || readOnly) return null
  return (
    <div className="sheet-held">
      <span className="sheet-held__label">{t('sheet.poster.icon')}</span>
      <span className="sheet-held__name">{element.icon && !element.icon.startsWith('sha256:') ? element.icon : element.icon ? t('sheet.poster.iconImage') : t('common.none')}</span>
      <Button variant="quiet" size="small" onClick={poster.onChooseIcon}>{t('sheet.poster.iconChoose')}</Button>
    </div>
  )
}

/** A description is asked for: almost none has one, and an empty box would stand where the links are read. */
function Description({ element, readOnly, actions, renderMarkdown }: {
  element: DesignElement
  readOnly: boolean
  actions: SheetActions
  renderMarkdown: FunctionInspectorProps['renderMarkdown']
}) {
  const { t } = useStrings()
  const [asked, setAsked] = useState(false)
  const has = (element.description ?? '') !== ''
  if (!has && readOnly) return null
  if (!has && !asked) {
    return <PanelSection><button type="button" className="sheet-page__link" onClick={() => setAsked(true)}>{t('sheet.addDescription')}</button></PanelSection>
  }
  return (
    <PanelSection>
      <MarkdownField
        value={element.description ?? ''} disabled={readOnly} renderMarkdown={renderMarkdown}
        onChange={(value) => actions.updateElement(element.id, { description: value }, `sheet.description:${element.id}`)}
      />
    </PanelSection>
  )
}

/**
 * A function's numeric ratings (ADR-0046): one line per scale of the
 * organisation's, written where the function is defined, each change one step.
 */
function Ratings({ element, readOnly, actions, scales }: {
  element: DesignElement
  readOnly: boolean
  actions: SheetActions
  scales: readonly AspectScale[]
}) {
  const { t } = useStrings()
  if (scales.length === 0) return null
  return (
    <PanelSection title={t('sheet.ratings')}>
      {scales.map((scale) => {
        const value = ratingOn(element, scale)
        const steps = Array.from({ length: scale.max - scale.min + 1 }, (_, index) => String(scale.min + index))
        return (
          <div className="sheet-held" key={scale.key} data-testid={`sheet-rating-${scale.key}`}>
            <span className="sheet-held__label">{scale.label}</span>
            {readOnly
              ? <span className="sheet-held__name">{value ?? t('sheet.lens.unrated')}</span>
              : (
                <Select
                  aria-label={scale.label} value={value === undefined ? '' : String(value)}
                  options={[{ value: '', label: t('sheet.lens.unrated') }, ...steps.map((step) => ({ value: step, label: step }))]}
                  onChange={(event) => actions.updateElement(element.id, {
                    ratings: withRating(element.ratings, scale.key, event.target.value === '' ? undefined : Number(event.target.value)),
                  })}
                />
              )}
          </div>
        )
      })}
    </PanelSection>
  )
}

/**
 * Taking one thing away.
 *
 * Refused while something is inside it, and refused *visibly*: the button stays
 * where it is with the count beside it and a way to what is inside, because the
 * answer to "why can I not delete this" belongs next to the thing that will not
 * delete. Nothing cascades (`business/authoring.mayRemove`), but a unit's
 * assignments go with it: then the delete asks first, naming who stops being what
 * (ADR-0036, amended 12 October 2026).
 */
function Remove({ element, model, actions, onRemoved, onSelect, rolesEnded, unit }: {
  element: DesignElement
  model: DesignModel
  actions: SheetActions
  onRemoved?(): void
  onSelect?(id: ElementId): void
  rolesEnded?: ReactNode
  unit?: ReturnType<NonNullable<SheetResponsible['unitDeletion']>>
}) {
  const { t } = useStrings()
  // A unit's units inside are its delete's question (3.6.2), so they do not hold it back.
  const removal = unit ? { ok: true as const } : mayRemove(model.elements, element.id)
  const [asking, setAsking] = useState(false)
  const [choice, setChoice] = useState(unit?.initial ?? '')
  const remove = () => {
    if (unit) actions.removeElement(element.id, (here) => unit.run(choice, here))
    else actions.removeElement(element.id)
    onRemoved?.()
  }
  const asks = unit !== undefined || rolesEnded !== undefined
  const inside = model.elements.find((held) => held.parentId === element.id)

  return (
    <>
      <Button
        variant="danger" size="small" aria-label={t('sheet.deleteThis', { name: element.name })}
        {...(!removal.ok ? { reason: t(removal.reason), reasonAt: 'beside' as const } : {})}
        onClick={() => {
          if (!asks) { remove(); return }
          setChoice(unit?.initial ?? '')
          setAsking(true)
        }}
      >
        {t('common.delete')}
      </Button>
      {asks && (
        <ConfirmDialog
          open={asking} title={t('sheet.deleteUnitTitle', { name: element.name })} body={t('sheet.deleteUnitBody')}
          confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
          onCancel={() => setAsking(false)} onConfirm={() => { setAsking(false); remove() }}
        >
          {unit && asking ? unit.render(choice, setChoice, () => setAsking(false)) : rolesEnded}
        </ConfirmDialog>
      )}
      {!removal.ok && (
        <span className="sheet-held__say">
          {plural(t, { one: 'sheet.insideOne', other: 'sheet.insideOther' }, removal.count)}{' '}
          {inside && onSelect && <button type="button" className="sheet-page__link" onClick={() => onSelect(inside.id)}>{t('sheet.insideGo')}</button>}
        </span>
      )}
    </>
  )
}

/**
 * Where it sits, and where among its neighbours.
 *
 * One field rather than two, because they are one question: a thing's place
 * is which tree it hangs from and where in the row it stands. The parents on
 * offer are the same kind's — a capability belongs under a function, never
 * under a journey — and the ones that would make a loop are shown, disabled,
 * so the answer to "why can I not do that" is in the list rather than absent
 * from it.
 */
function ParentField({ element, model, readOnly, actions, keptIn }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  /** The scope that defines it, where this is a stand-in: moved there, and only there. */
  keptIn?: string | undefined
}) {
  const { t } = useStrings()
  const kin = model.elements.filter((held) => held.kind === element.kind && held.id !== element.id)
  const siblings = childrenOf(
    model.elements.filter((held) => held.kind === element.kind),
    element.parentId,
  )
  const at = siblings.findIndex((held) => held.id === element.id)

  return (
    <>
      <TextField
        select fullWidth
        label={t(element.kind === 'function' ? 'sheet.moveTo' : 'sheet.parent')}
        value={element.parentId ?? ''}
        disabled={readOnly || keptIn !== undefined}
        helperText={keptIn !== undefined ? t('standIn.definedIn', { scope: keptIn }) : undefined}
        onChange={(e) => actions.updateElement(
          element.id, { parentId: e.target.value === '' ? undefined : e.target.value },
        )}
      >
        <MenuItem value="">{t('sheet.parentRoot')}</MenuItem>
        {kin.map((candidate) => {
          const loops = wouldCycle(model.elements, element.id, candidate.id)
          return (
            <MenuItem key={candidate.id} value={candidate.id} disabled={loops}>
              {candidate.name}
              {loops && (
                <span> · {t('sheet.parentCycle')}</span>
              )}
            </MenuItem>
          )
        })}
      </TextField>
      {!readOnly && siblings.length > 1 && (
        <div className="sheet-held">
          <span className="sheet-held__name">{t('sheet.order')}</span>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <IconButton size="small" label={t('sheet.moveUp')} disabled={at <= 0} onClick={() => actions.moveElement(element.id, -1)}><CaretIcon size={14} /></IconButton>
          </span>
          <IconButton size="small" label={t('sheet.moveDown')} disabled={at === -1 || at >= siblings.length - 1} onClick={() => actions.moveElement(element.id, 1)}><CaretIcon size={14} /></IconButton>
        </div>
      )}
    </>
  )
}

/**
 * What a subscope it is handed to has filed: read off the register, and a press away
 * from being mapped. It does not feed `coverage.ts`, so it counts for nothing until then.
 */
function InSubscope({ element, model, readOnly, actions, domains }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  domains: SheetDomains | undefined
}) {
  const { t } = useStrings()
  const scope = element.scopes?.[0]
  const apps = scope !== undefined ? domains?.applicationsIn?.(scope) ?? [] : []
  if (scope === undefined || apps.length === 0 || !domains) return null
  const mapped = coverageFor(model.relations, element.id).supportedBy
  return (
    <div data-testid="sheet-in-subscope">
      <PanelSection title={t('sheet.poster.inScope', { name: domains.name(scope) })}>
        {apps.map((app) => (
          <div className="sheet-held" key={app.id}>
            <span className="sheet-held__name">{app.name}</span>
            {!readOnly && !mapped.includes(app.id) && (
              <Button variant="quiet" size="small" aria-label={t('sheet.poster.mapThis', { name: app.name })} onClick={() => actions.setCoverage({ type: 'supports', sourceId: app.id, functionId: element.id, on: true })}>{t('sheet.poster.mapIt')}</Button>
            )}
          </div>
        ))}
        <div className="sheet-held__say">{t('sheet.poster.inScopeSay')}</div>
      </PanelSection>
    </div>
  )
}

/** A capability under this one has no tile of its own on a poster: it opens from here. */
function Inside({ element, model, onSelect }: { element: DesignElement; model: DesignModel; onSelect?: ((id: ElementId) => void) | undefined }) {
  const { t } = useStrings()
  const under = childrenOf(model.elements.filter((held) => held.kind === 'function'), element.id)
  if (under.length === 0 || element.parentId === undefined || !onSelect) return null
  return (
    <PanelSection title={t('sheet.poster.insideHeading')}>
      {under.map((one) => <button type="button" key={one.id} className="sheet-page__link sheet-held" onClick={() => onSelect(one.id)}>{one.name}</button>)}
    </PanelSection>
  )
}

/** This view's say about it: taking a label off the plate is not ending an assignment, so the panel names both. */
function OnThisPoster({ poster, readOnly }: { poster: PosterPanel; readOnly: boolean }) {
  const { t } = useStrings()
  if (readOnly) return null
  const { cell } = poster
  const number = (value: string) => Math.max(1, Math.round(Number(value)) || 1) - 1
  return (
    <div data-testid="sheet-on-poster">
      <PanelSection title={t('sheet.poster.onThis')}>
        <label className="sheet-held">
          <input type="checkbox" checked={poster.labelled} aria-label={t('sheet.poster.showLabel')} onChange={(event) => poster.onLabel(event.target.checked)} />
          {t('sheet.poster.showLabel')}
        </label>
        <div className="sheet-held__say">{t('sheet.poster.showLabelSay')}</div>
        <div className="sheet-held">
          <span className="sheet-held__label">{t('sheet.poster.cell')}</span>
          {cell
            ? (
              <>
                <input type="number" min={1} className="kit-input" style={{ width: 56 }} aria-label={t('sheet.poster.cellColumn')} value={cell.col + 1} onChange={(event) => poster.onCell({ ...cell, col: number(event.target.value) })} />
                <input type="number" min={1} className="kit-input" style={{ width: 56 }} aria-label={t('sheet.poster.cellRow')} value={cell.row + 1} onChange={(event) => poster.onCell({ ...cell, row: number(event.target.value) })} />
                <Button variant="quiet" size="small" onClick={() => poster.onCell(undefined)}>{t('sheet.poster.flow')}</Button>
              </>
            )
            : <Button variant="quiet" size="small" onClick={() => poster.onCell({ col: 0, row: 0 })}>{t('sheet.poster.flows')}</Button>}
        </div>
      </PanelSection>
    </div>
  )
}

/** Whose path a step is on: an actor, or the path everybody takes. */
function LaneField({ element, model, readOnly, actions }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
}) {
  const { t } = useStrings()
  const actors = model.elements.filter((held) => held.kind === 'actor')
  return (
    <TextField
      select fullWidth
      label={t('sheet.lane')}
      value={element.lane ?? ''}
      disabled={readOnly}
      onChange={(e) => actions.updateElement(
        element.id, { lane: e.target.value === '' ? undefined : e.target.value },
      )}
    >
      <MenuItem value="">{t('sheet.laneCommon')}</MenuItem>
      {actors.map((actor) => (
        <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
      ))}
    </TextField>
  )
}

/** What a capability's rows come to, this scope's and the tree's, each row counted once. */
function rowsOf(element: DesignElement, model: DesignModel, elsewhere: readonly Relation[] | undefined) {
  // `coverageOf` rather than a concatenation: the rows elsewhere are the whole
  // tree's, this scope's own saved rows among them, and it counts a row once.
  const own = coverageFor(model.relations, element.id)
  return { own, coverage: elsewhere?.length ? (coverageOf(model.relations, elsewhere).get(element.id) ?? own) : own }
}

/**
 * What a grouping's leaves come to, as the map's row counts them: a grouping is
 * seldom covered itself, and *Nothing and nobody yet* beside a row reading
 * 3 of 4 said the opposite of the page.
 */
function coverageUnder(element: DesignElement, model: DesignModel, elsewhere: readonly Relation[] | undefined) {
  const below = descendantsOf(model.elements, element.id)
  const leaves = below.filter((one) => !below.some((other) => other.parentId === one.id))
  if (leaves.length === 0) return undefined
  const all = coverageOf(model.relations, elsewhere ?? [])
  return { covered: leaves.filter((one) => (all.get(one.id)?.coverage ?? 'uncovered') !== 'uncovered').length, count: leaves.length }
}

/** Whoever can say what an id is called. */
function namer(model: DesignModel, applications: readonly Supporter[] | undefined, responsible: SheetResponsible | undefined, describe: MapDescribe | undefined) {
  return (id: ElementId) => applications?.find((held) => held.id === id)?.name
    ?? describe?.(id)?.name
    ?? model.elements.find((held) => held.id === id)?.name
    ?? responsible?.name(id)
    ?? id
}

/**
 * *Covered by*: each application, whether it is live or on its way out, and its
 * name the way to it. A row kept here is taken off here; one kept in another scope
 * is read here, since this scope can only take away what it wrote. The applications
 * on offer are the whole organisation's: a landscape's are what support an
 * organisation's capabilities, and a list that long is found, not browsed.
 */
function CoveredBy({ element, model, readOnly, actions, applications, elsewhere, responsible, describe }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  applications: readonly Supporter[] | undefined
  elsewhere: readonly Relation[] | undefined
  responsible: SheetResponsible | undefined
  describe: MapDescribe | undefined
}) {
  const { t, language } = useStrings()
  const { own, coverage } = rowsOf(element, model, elsewhere)
  const under = coverageUnder(element, model, elsewhere)
  const supporters: readonly Supporter[] = applications ?? model.elements.filter((held) => held.kind === 'application')
  const named = namer(model, applications, responsible, describe)
  const offered = [...supporters].filter((one) => !coverage.supportedBy.includes(one.id)).sort((a, b) => a.name.localeCompare(b.name))
  const state = (id: ElementId) => {
    const held = model.elements.find((one) => one.id === id)
    const said = describe?.(id)
    const leaving = held?.lifecycleDates?.retiring ?? said?.retiring ?? said?.retired
    if (leaving !== undefined) return t('sheet.retiringOn', { day: formatDay(leaving, language) })
    return held?.lifecycle === 'retiring' ? t('lifecycle.retiring') : t('lifecycle.live')
  }
  return (
    <div data-testid="sheet-inspector-coverage" data-guide="sheet.coverage">
      <PanelSection title={t('sheet.coverage')}>
        {coverage.coverage === 'uncovered' && <div className="sheet-held__say">{under ? t('sheet.coverageUnder', under) : t('sheet.coverageNobody')}</div>}
        {coverage.coverage === 'manual' && <div className="sheet-held__say">{t('sheet.coveragePeople')}</div>}
        {coverage.supportedBy.map((id) => (
          <div className="sheet-held" key={id} data-testid={`sheet-supporter-${id}`}>
            <button type="button" className="sheet-page__link sheet-held__name" aria-label={t('sheet.open', { name: named(id) })} onClick={() => actions.onOpenElement(id)}>{named(id)}</button>
            <span className="sheet-held__note">{state(id)}</span>
            {!readOnly && own.supportedBy.includes(id) && (
              <IconButton size="small" label={t('sheet.takeOff', { name: named(id) })} onClick={() => actions.setCoverage({ type: 'supports', sourceId: id, functionId: element.id, on: false })}><CloseIcon /></IconButton>
            )}
          </div>
        ))}
        {!readOnly && (
          <PickToAdd
            options={offered.map((one) => ({ id: one.id, label: one.name, ...(one.where !== undefined ? { note: one.where } : {}) }))}
            label={t('sheet.addApplication')} field={t('sheet.supportedBy')} nothing={t('sheet.coverageNobody')}
            guide="sheet.supportedBy" testId="sheet-support" disabled={offered.length === 0}
            onPick={(sourceId) => actions.setCoverage({ type: 'supports', sourceId, functionId: element.id, on: true })}
          />
        )}
      </PanelSection>
    </div>
  )
}

/**
 * *Answers for it*: a row per `assigned` row, the ones kept here taken off here, a
 * unit that does not serve this domain marked, and *+ Unit*, which picks from the
 * whole organisation. Where the row is kept is said only where a unit is filed
 * elsewhere.
 */
function AssignedTo({ element, model, readOnly, actions, responsible, elsewhere, describe, applications }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  responsible: SheetResponsible | undefined
  elsewhere: readonly Relation[] | undefined
  describe: MapDescribe | undefined
  applications: readonly Supporter[] | undefined
}) {
  const { t } = useStrings()
  const { own, coverage } = rowsOf(element, model, elsewhere)
  const named = namer(model, applications, responsible, describe)
  const assigned = coverage.assignedTo
  const choices = responsible?.choices
    ?? model.elements.filter((held) => held.kind === 'actor').map((held) => ({ id: held.id, label: held.name }))
  const offered = choices.filter((one) => !assigned.includes(one.id))
  const elsewhereFiled = assigned.some((id) => !model.elements.some((held) => held.id === id))
  return (
    <div className="sheet-held" data-testid="sheet-assigned-to" data-guide="sheet.assignedTo">
      <span className="sheet-held__label">{t('sheet.answersFor')}</span>
      <div className="sheet-held__values">
        {assigned.length === 0 && <span>{t('sheet.assignedNobody')}</span>}
        {assigned.map((id) => {
          const outside = responsible ? !responsible.serves(id, element.id) : false
          return (
            <span className="sheet-held" key={id} data-testid="sheet-assigned" data-outside={outside || undefined} data-warn={outside || undefined}>
              <span className="sheet-held__name">{named(id)}</span>
              {outside && <span className="sheet-held__note">{t('sheet.assignedOutside')}</span>}
              {!readOnly && own.assignedTo.includes(id) && (
                <IconButton size="small" label={t('sheet.takeOff', { name: named(id) })} onClick={() => actions.setCoverage({ type: 'assigned', sourceId: id, functionId: element.id, on: false })}><CloseIcon /></IconButton>
              )}
            </span>
          )
        })}
        {!readOnly && (
          <PickToAdd
            options={offered} label={t('sheet.assignUnit')} field={t('sheet.findUnit')} nothing={t('sheet.noUnit')}
            guide="sheet.doneBy" testId="sheet-assign" disabled={offered.length === 0}
            onPick={(sourceId) => actions.setCoverage({ type: 'assigned', sourceId, functionId: element.id, on: true })}
          />
        )}
        {elsewhereFiled && <span className="sheet-held__say">{t('sheet.assignedFarEnd')}</span>}
      </div>
    </div>
  )
}

/**
 * *Handed to* (ADR-0040 §4) and *Taken up by* (§5). A row per path in its `scopes`,
 * taken off with its ×, and *+ Domain*, which offers the scopes below the one that
 * defines it, each change one `element.update` of `scopes`. A stand-in shows them
 * and no editor: its domains are the definition's (ADR-0012 §10).
 *
 * *Taken up by* is read and never written here. One that took it up without being
 * handed it is marked, and a domain it was handed to that has not taken it up is
 * said to be not started: ADR-0012 §3's two findings, neither an error.
 */
function Domains({ element, model, readOnly, owned, actions, domains }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  owned: boolean
  actions: SheetActions
  domains: SheetDomains | undefined
}) {
  const { t } = useStrings()
  if (!domains || element.kind !== 'function') return null
  const handed = element.scopes ?? []
  const above = handedAbove(model.elements, element)
  const takers = domains.takenUpBy(element.id)
  const within = (path: string, scope: string) => scope === '' || path === scope || path.startsWith(`${scope}/`)
  const started = (scope: string) => takers.some((taker) => within(taker, scope))
  const editable = !readOnly && !owned
  const choices = editable ? domains.choices(element.id) : []
  const place = (scope: string) => (domains.openScope
    ? <button type="button" className="sheet-page__link sheet-held__name" onClick={() => domains.openScope?.(scope)}>{domains.name(scope)}</button>
    : <span className="sheet-held__name">{domains.name(scope)}</span>)
  return (
    <div data-testid="sheet-domains" data-guide="sheet.domains">
      <div className="sheet-held">
        <span className="sheet-held__label">{t('sheet.handedTo')}</span>
        <div className="sheet-held__values">
          {/* A stand-in keeps none of its own: the scope that defines it says them, and they are read there. */}
          {owned && <span>{t('sheet.domainsThere')}</span>}
          {!owned && handed.length === 0 && <span>{t('sheet.domainsNone')}</span>}
          {handed.map((scope) => {
            const unknown = domains.known ? !domains.known(scope) : false
            const notStarted = !started(scope)
            return (
              <span
                className="sheet-held" key={scope} data-testid="sheet-domain" data-scope={scope} data-not-started={notStarted || undefined}
                data-warn={unknown || undefined}
              >
                {place(scope)}
                {unknown
                  ? <span className="sheet-held__note">{t('sheet.domainUnknown')}</span>
                  : notStarted && <span className="sheet-held__note">{t('sheet.notStarted')}</span>}
                {editable && <IconButton size="small" label={t('sheet.takeOff', { name: domains.name(scope) })} onClick={() => actions.updateElement(element.id, { scopes: handed.filter((held) => held !== scope) })}><CloseIcon /></IconButton>}
              </span>
            )
          })}
          {above && (
            <span className="sheet-held__say" data-testid="sheet-domains-above">
              {t('sheet.domainsThrough', { name: above.name, scopes: above.scopes.map(domains.name).join(', ') })}
            </span>
          )}
          {editable && (
            <PickToAdd
              options={choices} label={t('sheet.domainsAdd')} field={t('sheet.domainsFind')} nothing={t('sheet.domainsNothing')}
              testId="sheet-domain-add" disabled={choices.length === 0}
              onPick={(scope) => actions.updateElement(element.id, { scopes: [...handed, scope] })}
            />
          )}
        </div>
      </div>
      <div className="sheet-held" data-testid="sheet-taken-up">
        <span className="sheet-held__label">{t('sheet.takenUpBy')}</span>
        <div className="sheet-held__values">
          {takers.length === 0 && <span>{t('sheet.takenUpNobody')}</span>}
          {takers.map((taker) => {
            const unasked = !owned && ![...handed, ...(above?.scopes ?? [])].some((scope) => within(taker, scope))
            return (
              <span className="sheet-held" key={taker} data-testid="sheet-taker" data-unasked={unasked || undefined} data-warn={unasked || undefined}>
                {place(taker)}
                {unasked && <span className="sheet-held__note">{t('sheet.takenUpUnasked')}</span>}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * The nearest function above this one on the sheet that is handed to a
 * domain, and the domains it is handed to: a capability goes where its area
 * was handed, so a domain that took the capability up was handed it with the
 * area. Nothing where nothing above it is handed on.
 */
function handedAbove(
  elements: readonly DesignElement[], element: DesignElement,
): { name: string; scopes: readonly string[] } | undefined {
  const seen = new Set<string>([element.id])
  let at = element.parentId
  while (at !== undefined && !seen.has(at)) {
    seen.add(at)
    const parent = elements.find((held) => held.id === at)
    if (!parent) return undefined
    if (parent.scopes?.length) return { name: parent.name, scopes: parent.scopes }
    at = parent.parentId
  }
  return undefined
}
