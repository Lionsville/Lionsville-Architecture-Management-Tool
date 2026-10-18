// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing on the sheet, as fields: the inspector docked to the page.
 *
 * A function or a step, and the difference between them is two rows — a
 * function says what covers it, a step says whose path it is on. Everything
 * else they share, because in the model they are the same shape: a name, a
 * parent, a place among their neighbours, a lifecycle with dates, and a
 * description (ADR-0012 §3).
 *
 * **The page writes nothing itself.** Every keystroke is an action the caller
 * turns into a `Command`, so a capability renamed here is one undo step and
 * one Activity line, exactly as a node renamed on the canvas is. A run of
 * keystrokes into one field coalesces on a key rather than being held back in
 * a draft: the card on the sheet is drawn from the model, so holding the text
 * back would mean watching the name you are typing not appear.
 *
 * **Re-parenting is refused, not repaired.** A parent that would make a loop
 * is offered as a disabled option with the reason beside it
 * (`business/tree.wouldCycle`), because a cycle is not a state a person can
 * see and mend on a page that is drawn from the tree the cycle broke.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { DATED_PHASES, LIFECYCLE_ORDER, datesInOrder } from '../../model'
import type { Command, DesignDiagram, DesignElement, DesignModel, ElementId, Lifecycle, Relation } from '../../model'
import { MarkdownField } from '../../documentation/ui/MarkdownField'
import type { MarkdownRenderOptions } from '../../documentation'
import { useStrings } from '../../i18n'
import { CompactForms, SectionHeading } from '../../widgets/CompactForms'
import { plural } from '../../i18n/strings'
import type { StringKey, Translate } from '../../i18n'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { CaretIcon } from '../../widgets/icons'
import { OrderedDateFields } from '../../widgets/OrderedDateFields'
import { PickToAdd } from '../../widgets/PickToAdd'
import type { PickOption } from '../../widgets/PickToAdd'
import { mayRemove } from '../authoring'
import { coverageFor, coverageOf } from '../coverage'
import { childrenOf, wouldCycle } from '../tree'

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
  updateSheet(patch: Partial<Pick<DesignDiagram, 'journeyId' | 'lanes' | 'areas' | 'showActors' | 'areaSpans' | 'columns' | 'paper'>>): void
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
export const INSPECTOR_WIDTH = { default: 300, min: 240, max: 640 } as const

export function FunctionInspector(props: FunctionInspectorProps) {
  const { element, model, readOnly, actions } = props
  const width = props.width ?? INSPECTOR_WIDTH.default
  const { t } = useStrings()
  const owner = element ? props.ownerOf?.(element.id) : undefined
  /** Is this field the owning scope's? See the canvas inspector's twin of this. */
  const owned = (field: string) => owner?.fields.includes(field) ?? false
  const name = useRef<HTMLInputElement | null>(null)
  const nameFocus = props.nameFocus
  useEffect(() => {
    if (!nameFocus) return
    // Selected, not just focused: what is in the box is a placeholder, and the
    // next keystroke should replace it rather than run on after it.
    name.current?.focus()
    name.current?.select()
  }, [nameFocus])

  return (
    <Box
      data-testid="sheet-inspector" data-guide="sheet.inspector"
      sx={{
        width, flex: `0 0 ${width}px`, overflow: 'auto',
        borderLeft: props.width === undefined ? 1 : 0, borderColor: 'divider',
        bgcolor: 'background.paper', p: 2,
      }}
    >
      {/* The same treatment as the board's inspector (`CompactForms`). */}
      <CompactForms>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <SectionHeading>{t('sheet.details')}</SectionHeading>
        {/* The way to the page, beside the heading rather than among the
            fields — the same place the canvas's inspector keeps it. A
            capability's documentation is a page like an application's, with
            room, a history and the plans that name it; the field below is
            for a line, not for the account of it. */}
        {element && props.onOpenDocumentation && (
          <Button
            size="small"
            data-testid="sheet-open-page"
            aria-label={t('sheet.openPage', { name: element.name })}
            sx={{ fontSize: 11, minWidth: 0, px: 0.5, py: 0, whiteSpace: 'nowrap', textTransform: 'none' }}
            onClick={() => props.onOpenDocumentation?.(element.id)}
          >
            {t('sheet.details')} ›
          </Button>
        )}
      </Box>

      {!element ? (
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {t('sheet.nothingSelected')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Drawn here, defined there (ADR-0012 §3). Above the fields, since
              everything below it that is greyed out is greyed out for this. */}
          {owner && (
            <Box data-testid="owned-elsewhere" sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.75 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {t('standIn.definedIn', { scope: owner.label })}
              </Typography>
              {owner.onOpen && (
                <Button size="small" sx={{ mt: 0.5 }} onClick={owner.onOpen}>
                  {t('standIn.open', { scope: owner.label })}
                </Button>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            label={t('common.name')}
            value={element.name}
            disabled={readOnly || owned('name')}
            inputRef={name}
            onChange={(e) => actions.updateElement(
              element.id, { name: e.target.value }, `sheet.name:${element.id}`,
            )}
          />

          <ParentField element={element} model={model} readOnly={readOnly} actions={actions} />

          {element.kind === 'step' && (
            <LaneField element={element} model={model} readOnly={readOnly} actions={actions} />
          )}

          {element.kind === 'actor' && (
            <FormControlLabel
              sx={{ mt: -1 }}
              control={(
                <Checkbox
                  checked={element.outside === true}
                  disabled={readOnly || owned('outside')}
                  slotProps={{ input: { 'aria-label': t('sheet.outsideOrganisation') } }}
                  onChange={(e) => actions.updateElement(
                    element.id, { outside: e.target.checked ? true : undefined },
                  )}
                />
              )}
              label={(
                <Typography sx={{ fontSize: 11.5 }}>{t('sheet.outsideOrganisation')}</Typography>
              )}
            />
          )}

          <TextField
            select fullWidth
            label={t('sheet.lifecycle')}
            value={element.lifecycle}
            disabled={readOnly || owned('lifecycle')}
            onChange={(e) => actions.updateElement(element.id, { lifecycle: e.target.value as Lifecycle })}
          >
            {LIFECYCLE_ORDER.map((phase) => (
              <MenuItem key={phase} value={phase}>{t(`lifecycle.${phase}` as StringKey)}</MenuItem>
            ))}
          </TextField>

          {/* A row shared three date inputs on `flex: 1`, which in the
              inspector's own narrow column left each clipped to a couple of
              digits. Stacked, each keeps the width the inspector actually
              has; `minWidth: 0` stops a fixed-width native date control from
              forcing the column itself wider than the panel. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <OrderedDateFields
              keys={DATED_PHASES}
              values={element.lifecycleDates}
              label={(phase) => t(`sheet.date.${phase}` as StringKey)}
              ariaLabel={(phase) => `${element.name}: ${t(`sheet.date.${phase}` as StringKey)}`}
              size="small" fullWidth sx={{ minWidth: 0 }}
              disabled={readOnly || owned('lifecycleDates')}
              accepts={datesInOrder}
              refusal={t('command.datesOutOfOrder')}
              onChange={(lifecycleDates) => actions.updateElement(element.id, { lifecycleDates })}
            />
          </Box>

          {element.kind === 'function' && (
            <Coverage
              element={element} model={model} readOnly={readOnly} actions={actions}
              applications={props.applications} elsewhere={props.elsewhere} responsible={props.responsible}
            />
          )}
          <Domains element={element} model={model} readOnly={readOnly} owned={owned('scopes')} actions={actions} domains={props.domains} />

          <MarkdownField
            value={element.description ?? ''}
            disabled={readOnly}
            onChange={(value) => actions.updateElement(
              element.id, { description: value }, `sheet.description:${element.id}`,
            )}
            renderMarkdown={props.renderMarkdown}
          />

          {!readOnly && (
            <Remove element={element} model={model} actions={actions} onRemoved={props.onRemoved}
              rolesEnded={props.responsible?.rolesEnded?.(element.id)} unit={props.responsible?.unitDeletion?.(element.id)} />
          )}
        </Box>
      )}
      </CompactForms>
    </Box>
  )
}

/**
 * Taking one thing away.
 *
 * Refused while something is inside it, and refused *visibly*: the button
 * stays where it is, disabled, with the count beside it, because the answer
 * to "why can I not delete this" belongs next to the thing that will not
 * delete. Nothing cascades — an area is not a request to delete the twenty
 * capabilities in it (`business/authoring.mayRemove`) — but a unit's
 * assignments, which go with it: then the delete asks first, naming who
 * stops being what (ADR-0036, amended 12 October 2026).
 */
function Remove({ element, model, actions, onRemoved, rolesEnded, unit }: {
  element: DesignElement
  model: DesignModel
  actions: SheetActions
  onRemoved?(): void
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

  return (
    <Box>
      <Tooltip title={removal.ok ? '' : t(removal.reason)}>
        <span>
          <Button
            size="small" color="error" variant="outlined" fullWidth
            disabled={!removal.ok}
            aria-label={t('sheet.deleteThis', { name: element.name })}
            onClick={() => {
              if (!asks) { remove(); return }
              setChoice(unit?.initial ?? '')
              setAsking(true)
            }}
          >
            {t('common.delete')}
          </Button>
        </span>
      </Tooltip>
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
        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.5 }}>
          {plural(t, { one: 'sheet.insideOne', other: 'sheet.insideOther' }, removal.count)}
        </Typography>
      )}
    </Box>
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
function ParentField({ element, model, readOnly, actions }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
}) {
  const { t } = useStrings()
  const kin = model.elements.filter((held) => held.kind === element.kind && held.id !== element.id)
  const siblings = childrenOf(
    model.elements.filter((held) => held.kind === element.kind),
    element.parentId,
  )
  const at = siblings.findIndex((held) => held.id === element.id)

  return (
    <Box>
      <TextField
        select fullWidth
        label={t('sheet.parent')}
        value={element.parentId ?? ''}
        disabled={readOnly}
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
                <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', ml: 1 }}>
                  {t('sheet.parentCycle')}
                </Typography>
              )}
            </MenuItem>
          )
        })}
      </TextField>
      {!readOnly && siblings.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', flex: 1 }}>
            {t('sheet.order')}
          </Typography>
          <Tooltip title={t('sheet.moveUp')}>
            <span>
              <IconButton
                size="small" aria-label={t('sheet.moveUp')} disabled={at <= 0}
                sx={{ transform: 'rotate(180deg)' }}
                onClick={() => actions.moveElement(element.id, -1)}
              >
                <CaretIcon size={14} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('sheet.moveDown')}>
            <span>
              <IconButton
                size="small" aria-label={t('sheet.moveDown')} disabled={at === -1 || at >= siblings.length - 1}
                onClick={() => actions.moveElement(element.id, 1)}
              >
                <CaretIcon size={14} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </Box>
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

/**
 * What covers this capability — read-only, because it is derived.
 *
 * The systems are links: a coverage question almost always ends in "and what
 * is that one, then". People with no system beside them is a complete answer
 * and is not drawn as a gap (ADR-0012 §9).
 *
 * The applications on offer are the whole organisation's, when the host hands
 * them in: an organisation's sheet has no applications of its own, and the
 * first person to try mapping a capability from it found "Supported by…"
 * offering nothing. A row naming an id this scope does not hold is ordinary
 * (§5), and the name beside it comes from the same list.
 */
function Coverage({ element, model, readOnly, actions, applications, elsewhere, responsible }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  applications: readonly Supporter[] | undefined
  elsewhere: readonly Relation[] | undefined
  responsible: SheetResponsible | undefined
}) {
  const { t } = useStrings()
  // `coverageOf` rather than a concatenation: the rows elsewhere are the
  // whole tree's, this scope's own saved rows among them, and it counts a
  // row this scope holds once. Concatenating listed every saved app twice.
  const own = coverageFor(model.relations, element.id)
  const coverage = elsewhere?.length ? (coverageOf(model.relations, elsewhere).get(element.id) ?? own) : own
  const supporters: readonly Supporter[] = applications
    ?? model.elements.filter((held) => held.kind === 'application')
  const named = (id: ElementId) => supporters.find((held) => held.id === id)?.name
    ?? model.elements.find((held) => held.id === id)?.name
    ?? responsible?.name(id)
    ?? id

  return (
    <Box data-testid="sheet-inspector-coverage" data-guide="sheet.coverage">
      <Typography sx={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'text.secondary', mb: 0.5,
      }}>
        {t('sheet.coverage')}
      </Typography>
      {coverage.coverage === 'uncovered' && (
        <Typography sx={{ fontSize: 11.5, color: 'warning.main' }}>{t('sheet.coverageNobody')}</Typography>
      )}
      {coverage.supportedBy.map((id) => (
        <Box key={id}>
          <Link
            component="button"
            type="button"
            underline="hover"
            sx={{ fontSize: 11.5 }}
            aria-label={t('sheet.open', { name: named(id) })}
            onClick={() => actions.onOpenElement(id)}
          >
            {named(id)}
          </Link>
        </Box>
      ))}
      {coverage.assignedTo.length > 0 && (
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {coverage.assignedTo.map(named).join(', ')}
          {coverage.coverage === 'manual' && ` — ${t('sheet.coveragePeople')}`}
        </Typography>
      )}

      {!readOnly && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <Picker
            label={t('sheet.supportedBy')}
            named="sheet.supportedBy"
            options={supporters}
            picked={own.supportedBy}
            onPick={(sourceId, on) =>
              actions.setCoverage({ type: 'supports', sourceId, functionId: element.id, on })}
            t={t}
          />
        </Box>
      )}
      <AssignedTo
        element={element} model={model} readOnly={readOnly} actions={actions} responsible={responsible}
        assigned={coverage.assignedTo} own={own.assignedTo} named={named}
      />
    </Box>
  )
}

/**
 * Who is responsible for it (*Assigned to*): a chip per `assigned` row, the
 * rows kept here taken off here, a unit that does not serve this domain
 * marked, and *+ Unit*, which picks from the whole organisation — the row is
 * kept here, with a unit filed elsewhere as its far end.
 */
function AssignedTo({ element, model, readOnly, actions, responsible, assigned, own, named }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  responsible: SheetResponsible | undefined
  assigned: readonly ElementId[]
  own: readonly ElementId[]
  named: (id: ElementId) => string
}) {
  const { t } = useStrings()
  const choices = responsible?.choices
    ?? model.elements.filter((held) => held.kind === 'actor').map((held) => ({ id: held.id, label: held.name }))
  const offered = choices.filter((one) => !assigned.includes(one.id))
  return (
    <Box data-testid="sheet-assigned-to" data-guide="sheet.assignedTo" sx={{ mt: 1.5 }}>
      <SectionHeading sx={{ mb: 0.5 }}>{t('sheet.assignedTo')}</SectionHeading>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {assigned.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('sheet.assignedNobody')}</Typography>}
        {assigned.map((id) => {
          const outside = responsible ? !responsible.serves(id, element.id) : false
          return (
            <Chip
              key={id} variant={outside ? 'outlined' : 'filled'} color={outside ? 'warning' : 'default'}
              data-testid="sheet-assigned" data-outside={outside || undefined}
              label={outside ? `${named(id)} · ${t('sheet.assignedOutside')}` : named(id)}
              {...(!readOnly && own.includes(id)
                ? { onDelete: () => actions.setCoverage({ type: 'assigned', sourceId: id, functionId: element.id, on: false }) }
                : {})}
            />
          )
        })}
      </Box>
      {!readOnly && (
        <PickToAdd
          options={offered} label={t('sheet.assignUnit')} field={t('sheet.findUnit')} nothing={t('sheet.noUnit')}
          guide="sheet.doneBy" testId="sheet-assign" disabled={offered.length === 0}
          onPick={(sourceId) => actions.setCoverage({ type: 'assigned', sourceId, functionId: element.id, on: true })}
        />
      )}
      <Typography sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.5 }}>{t('sheet.assignedFarEnd')}</Typography>
    </Box>
  )
}

/**
 * Which domains it is handed to (ADR-0040 §4), and which took it up (§5).
 *
 * A chip per path in its `scopes`, taken off with its ×, and *+ Domain*,
 * which offers the scopes below the one that defines it. Each change is one
 * `element.update` of `scopes`: one step, one Activity line. A stand-in shows
 * the chips and no editor — its domains are the definition's (ADR-0012 §10).
 *
 * *Taken up by* is the other half, read and never written here: every scope
 * that holds a stand-in of it, a way to that scope's home. One that took it up
 * without being handed it is marked in the warning colour, and a domain it was
 * handed to that has not taken it up is said to be not started. Both are
 * ADR-0012 §3's two findings, neither an error.
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
  const chipLabel = (scope: string) => {
    if (domains.known && !domains.known(scope)) return `${domains.name(scope)} · ${t('sheet.domainUnknown')}`
    return started(scope) ? domains.name(scope) : `${domains.name(scope)} · ${t('sheet.notStarted')}`
  }
  const editable = !readOnly && !owned
  const place = (scope: string, warn: boolean) => (domains.openScope
    ? (
      <Link
        component="button" type="button" underline="hover" key={scope}
        sx={{ fontSize: 11.5, ...(warn ? { color: 'warning.main' } : {}) }}
        onClick={() => domains.openScope?.(scope)}
      >
        {domains.name(scope)}
      </Link>
    )
    : <Typography component="span" key={scope} sx={{ fontSize: 11.5, ...(warn ? { color: 'warning.main' } : {}) }}>{domains.name(scope)}</Typography>)
  return (
    <Box data-testid="sheet-domains" data-guide="sheet.domains">
      <SectionHeading sx={{ mb: 0.5 }}>{t('sheet.domains')}</SectionHeading>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* A stand-in keeps none of its own: the scope that defines it says them, and they are read there. */}
        {owned && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('sheet.domainsThere')}</Typography>}
        {!owned && handed.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('sheet.domainsNone')}</Typography>}
        {handed.map((scope) => {
          const notStarted = !started(scope)
          const unknown = domains.known ? !domains.known(scope) : false
          return (
            <Chip
              key={scope} size="small" data-testid="sheet-domain" data-scope={scope} data-not-started={notStarted || undefined}
              variant={notStarted ? 'outlined' : 'filled'} color={unknown ? 'warning' : 'default'}
              label={chipLabel(scope)}
              {...(editable ? { onDelete: () => actions.updateElement(element.id, { scopes: handed.filter((held) => held !== scope) }) } : {})}
            />
          )
        })}
      </Box>
      {above && (
        <Typography data-testid="sheet-domains-above" sx={{ fontSize: 10.5, color: 'text.secondary', mt: 0.5 }}>
          {t('sheet.domainsThrough', { name: above.name, scopes: above.scopes.map(domains.name).join(', ') })}
        </Typography>
      )}
      {editable && (
        <PickToAdd
          options={domains.choices(element.id)} label={t('sheet.domainsAdd')} field={t('sheet.domainsFind')} nothing={t('sheet.domainsNothing')}
          testId="sheet-domain-add" disabled={domains.choices(element.id).length === 0}
          onPick={(scope) => actions.updateElement(element.id, { scopes: [...handed, scope] })}
        />
      )}
      <Box data-testid="sheet-taken-up" sx={{ mt: 1 }}>
        <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>{t('sheet.takenUpBy')}</Typography>
        {takers.length === 0
          ? <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('sheet.takenUpNobody')}</Typography>
          : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {takers.map((taker) => {
                const unasked = !owned && ![...handed, ...(above?.scopes ?? [])].some((scope) => within(taker, scope))
                return (
                  <Box key={taker} data-testid="sheet-taker" data-unasked={unasked || undefined}>
                    {place(taker, unasked)}
                    {unasked && <Typography component="span" sx={{ fontSize: 10.5, color: 'warning.main', ml: 0.5 }}>{t('sheet.takenUpUnasked')}</Typography>}
                  </Box>
                )
              })}
            </Box>
          )}
      </Box>
    </Box>
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

/**
 * What covers this, as something a person picks by typing.
 *
 * Coverage is derived from rows (`business/coverage.ts`) and this is the one
 * place a row is written by hand: a pick is one `supports` or `assigned`
 * relation, an unpick takes it away, and the line above redraws from the
 * model rather than from anything held here. One pick per change, because
 * the field hands back a whole list and only ever one of them moved — which
 * keeps each pick its own undo step and its own Activity line.
 *
 * Typed rather than scrolled: an organisation's register runs to hundreds of
 * applications, and a list that long is found, not browsed. Ids the scope
 * names in a row and does not hold are ordinary (ADR-0012 §5), so the value
 * is narrowed to what is actually on offer; the row itself stays where it is
 * and the line above still names it.
 */
function Picker({ label, named, options, picked, onPick, t }: {
  label: string
  /** Its stable name (`data-guide`, `CONTROL_NAMES`). */
  named: string
  options: readonly Supporter[]
  picked: readonly ElementId[]
  onPick(id: ElementId, on: boolean): void
  t: Translate
}) {
  const offered = [...options].sort((a, b) => a.name.localeCompare(b.name))
  const held = offered.filter((option) => picked.includes(option.id))

  return (
    <Autocomplete
      multiple
      data-guide={named}
      // The list stays open after a pick: what supports a capability is
      // usually several things, and closing after each was a click per row.
      disableCloseOnSelect
      options={offered}
      value={held}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      noOptionsText={t('sheet.coverageNobody')}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Typography component="span" sx={{ fontSize: 12.5 }}>{option.name}</Typography>
          {option.where && (
            <Typography component="span" aria-hidden sx={{ fontSize: 10.5, color: 'text.secondary', ml: 'auto', pl: 1 }}>
              {option.where}
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} />}
      slotProps={{ chip: { size: 'small', sx: { height: 20, fontSize: 11 } } }}
      onChange={(_event, next) => {
        const ids = next.map((option) => option.id)
        const before = held.map((option) => option.id)
        const added = ids.find((id) => !before.includes(id))
        if (added !== undefined) { onPick(added, true); return }
        const removed = before.find((id) => !ids.includes(id))
        if (removed !== undefined) onPick(removed, false)
      }}
    />
  )
}
