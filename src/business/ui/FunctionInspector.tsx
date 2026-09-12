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
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Lifecycle } from '../../model'
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
  /** The sheet's own fields: the rail, the journey, which areas and in which order. */
  updateSheet(patch: Partial<Pick<DesignDiagram, 'journeyId' | 'lanes' | 'areas' | 'showActors'>>): void
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

export type FunctionInspectorProps = {
  /** Absent when nothing on the sheet is chosen. */
  element: DesignElement | undefined
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
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
}

const WIDTH = 300

export function FunctionInspector(props: FunctionInspectorProps) {
  const { element, model, readOnly, actions } = props
  const { t } = useStrings()
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
        width: WIDTH, flex: `0 0 ${WIDTH}px`, overflow: 'auto',
        borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 2,
      }}
    >
      <Typography sx={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'text.secondary', mb: 1.5,
      }}>
        {t('sheet.details')}
      </Typography>

      {!element ? (
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {t('sheet.nothingSelected')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            size="small" fullWidth
            label={t('common.name')}
            value={element.name}
            disabled={readOnly}
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
                  disabled={readOnly}
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
            disabled={readOnly}
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
                disabled={readOnly}
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
 */
function Coverage({ element, model, readOnly, actions }: {
  element: DesignElement
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
}) {
  const { t } = useStrings()
  const coverage = coverageFor(model.relations, element.id)
  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id

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
          <Ticks
            label={t('sheet.supportedBy')}
            options={model.elements.filter((held) => held.kind === 'application')}
            picked={coverage.supportedBy}
            onPick={(sourceId, on) =>
              actions.setCoverage({ type: 'supports', sourceId, functionId: element.id, on })}
            t={t}
          />
          <Ticks
            label={t('sheet.doneBy')}
            options={model.elements.filter((held) => held.kind === 'actor')}
            picked={coverage.assignedTo}
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
 * What covers this, as something a person ticks.
 *
 * Coverage is derived from rows (`business/coverage.ts`) and this is the one
 * place a row is written by hand: a tick is one `supports` or `assigned`
 * relation, an untick takes it away, and the line above redraws from the model
 * rather than from anything held here. One tick per change, because a
 * multi-select hands back a whole list and only ever one of them moved — which
 * keeps each tick its own undo step and its own Activity line.
 *
 * Ids the scope names in a row and does not hold are ordinary (ADR-0012 §5),
 * so the value is narrowed to what is actually on offer; the row itself stays
 * where it is and the line above still names it.
 */
function Ticks({ label, options, picked, onPick, t }: {
  label: string
  options: readonly DesignElement[]
  picked: readonly ElementId[]
  onPick(id: ElementId, on: boolean): void
  t: Translate
}) {
  const offered = [...options].sort((a, b) => a.name.localeCompare(b.name))
  const held = offered.map((option) => option.id).filter((id) => picked.includes(id))
  const named = (id: ElementId) => offered.find((option) => option.id === id)?.name ?? id

  return (
    <TextField
      select size="small" fullWidth
      label={label}
      value={held}
      slotProps={{
        select: {
          multiple: true,
          renderValue: (value) => (value as ElementId[]).map(named).join(', '),
          displayEmpty: true,
        },
      }}
      onChange={(e) => {
        const next = e.target.value as unknown as ElementId[]
        const added = next.find((id) => !held.includes(id))
        if (added !== undefined) { onPick(added, true); return }
        const removed = held.find((id) => !next.includes(id))
        if (removed !== undefined) onPick(removed, false)
      }}
    >
      {offered.length === 0 && (
        <MenuItem value="" disabled>{t('sheet.coverageNobody')}</MenuItem>
      )}
      {offered.map((option) => (
        <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
      ))}
    </TextField>
  )
}
