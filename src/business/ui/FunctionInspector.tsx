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
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { DATED_PHASES, LIFECYCLE_ORDER } from '../../model'
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Lifecycle, Relation } from '../../model'
import { MarkdownField } from '../../documentation/ui/MarkdownField'
import type { MarkdownRenderOptions } from '../../documentation'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { StringKey, Translate } from '../../i18n'
import { CaretIcon } from '../../widgets/icons'
import { mayRemove } from '../authoring'
import { coverageFor } from '../coverage'
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
   * which is what the page says out loud rather than finding out here.
   */
  removeElement(id: ElementId): void
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
      data-testid="sheet-inspector"
      sx={{
        width, flex: `0 0 ${width}px`, overflow: 'auto',
        borderLeft: props.width === undefined ? 1 : 0, borderColor: 'divider',
        bgcolor: 'background.paper', p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Typography sx={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'text.secondary',
        }}>
          {t('sheet.details')}
        </Typography>
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
            size="small" fullWidth
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
                  size="small"
                  checked={element.outside === true}
                  disabled={readOnly || owned('outside')}
                  inputProps={{ 'aria-label': t('sheet.outsideOrganisation') }}
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
            select size="small" fullWidth
            label={t('sheet.lifecycle')}
            value={element.lifecycle}
            disabled={readOnly || owned('lifecycle')}
            onChange={(e) => actions.updateElement(element.id, { lifecycle: e.target.value as Lifecycle })}
          >
            {LIFECYCLE_ORDER.map((phase) => (
              <MenuItem key={phase} value={phase}>{t(`lifecycle.${phase}` as StringKey)}</MenuItem>
            ))}
          </TextField>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {DATED_PHASES.map((phase) => (
              <TextField
                key={phase}
                type="date" size="small" fullWidth
                label={t(`sheet.date.${phase}` as StringKey)}
                value={element.lifecycleDates?.[phase] ?? ''}
                disabled={readOnly || owned('lifecycleDates')}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { 'aria-label': `${element.name}: ${t(`sheet.date.${phase}` as StringKey)}` },
                }}
                onChange={(e) => {
                  const next = { ...element.lifecycleDates }
                  if (e.target.value) next[phase] = e.target.value
                  else delete next[phase]
                  actions.updateElement(
                    element.id,
                    { lifecycleDates: Object.keys(next).length ? next : undefined },
                  )
                }}
              />
            ))}
          </Box>

          {element.kind === 'function' && (
            <Coverage
              element={element} model={model} readOnly={readOnly} actions={actions}
              applications={props.applications} elsewhere={props.elsewhere}
            />
          )}

          <MarkdownField
            value={element.description ?? ''}
            disabled={readOnly}
            onChange={(value) => actions.updateElement(
              element.id, { description: value }, `sheet.description:${element.id}`,
            )}
            renderMarkdown={props.renderMarkdown}
          />

          {!readOnly && (
            <Remove element={element} model={model} actions={actions} onRemoved={props.onRemoved} />
          )}
        </Box>
      )}
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
 * capabilities in it (`business/authoring.mayRemove`).
 */
function Remove({ element, model, actions, onRemoved }: {
  element: DesignElement
  model: DesignModel
  actions: SheetActions
  onRemoved?(): void
}) {
  const { t } = useStrings()
  const removal = mayRemove(model.elements, element.id)

  return (
    <Box>
      <Tooltip title={removal.ok ? '' : t(removal.reason)}>
        <span>
          <Button
            size="small" color="error" variant="outlined" fullWidth
            disabled={!removal.ok}
            aria-label={t('sheet.deleteThis', { name: element.name })}
            onClick={() => { actions.removeElement(element.id); onRemoved?.() }}
          >
            {t('common.delete')}
          </Button>
        </span>
      </Tooltip>
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
        select size="small" fullWidth
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
      select size="small" fullWidth
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
function Coverage({ element, model, readOnly, actions, applications, elsewhere }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  applications: readonly Supporter[] | undefined
  elsewhere: readonly Relation[] | undefined
}) {
  const { t } = useStrings()
  const coverage = coverageFor(
    elsewhere?.length ? [...model.relations, ...elsewhere] : model.relations, element.id,
  )
  const own = elsewhere?.length ? coverageFor(model.relations, element.id) : coverage
  const supporters: readonly Supporter[] = applications
    ?? model.elements.filter((held) => held.kind === 'application')
  const people: readonly Supporter[] = model.elements.filter((held) => held.kind === 'actor')
  const named = (id: ElementId) => supporters.find((held) => held.id === id)?.name
    ?? model.elements.find((held) => held.id === id)?.name
    ?? id

  return (
    <Box data-testid="sheet-inspector-coverage">
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
            options={supporters}
            picked={own.supportedBy}
            onPick={(sourceId, on) =>
              actions.setCoverage({ type: 'supports', sourceId, functionId: element.id, on })}
            t={t}
          />
          <Picker
            label={t('sheet.doneBy')}
            options={people}
            picked={own.assignedTo}
            onPick={(sourceId, on) =>
              actions.setCoverage({ type: 'assigned', sourceId, functionId: element.id, on })}
            t={t}
          />
        </Box>
      )}
    </Box>
  )
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
function Picker({ label, options, picked, onPick, t }: {
  label: string
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
      // The list stays open after a pick: what supports a capability is
      // usually several things, and closing after each was a click per row.
      disableCloseOnSelect
      size="small"
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
