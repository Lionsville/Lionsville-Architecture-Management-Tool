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
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
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
import type { StringKey } from '../../i18n'
import { CaretIcon } from '../../widgets/icons'
import { coverageFor } from '../coverage'
import { childrenOf, wouldCycle } from '../tree'

/** What the sheet and its inspector may ask the session to do. */
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
  /** Show an application on the canvas — where the coverage links go. */
  onOpenElement(id: ElementId): void
}

export type FunctionInspectorProps = {
  /** Absent when nothing on the sheet is chosen. */
  element: DesignElement | undefined
  model: DesignModel
  readOnly: boolean
  actions: SheetActions
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
}

const WIDTH = 300

export function FunctionInspector(props: FunctionInspectorProps) {
  const { element, model, readOnly, actions } = props
  const { t } = useStrings()

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
            onChange={(e) => actions.updateElement(
              element.id, { name: e.target.value }, `sheet.name:${element.id}`,
            )}
          />

          <ParentField element={element} model={model} readOnly={readOnly} actions={actions} />

          {element.kind === 'step' && (
            <LaneField element={element} model={model} readOnly={readOnly} actions={actions} />
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
            <Coverage element={element} model={model} onOpen={actions.onOpenElement} />
          )}

          <MarkdownField
            value={element.description ?? ''}
            disabled={readOnly}
            onChange={(value) => actions.updateElement(
              element.id, { description: value }, `sheet.description:${element.id}`,
            )}
            renderMarkdown={props.renderMarkdown}
          />
        </Box>
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
function Coverage({ element, model, onOpen }: {
  element: DesignElement
  model: DesignModel
  onOpen(id: ElementId): void
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
            onClick={() => onOpen(id)}
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
    </Box>
  )
}
