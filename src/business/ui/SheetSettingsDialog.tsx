/**
 * What this sheet draws (ADR-0012 §6).
 *
 * A sheet has no geometry; what it is *of* is four fields — which journey runs
 * across the top, which function roots are the areas and in which order, the
 * order of the lanes, and whether the stakeholder rail is drawn — and until
 * this dialog existed three of them could only be set by an agent or by
 * editing the file. A scope with two journeys seeds none on purpose
 * (`business/sheetDiagram.seedSheet`), so on such a project the band stayed
 * empty with no way to say which one was meant.
 *
 * Each change is its own command, applied as it is made: there is no *save*,
 * because a dialog that batches four toggles into one undo step would make
 * ⌘Z take back three decisions a person did not revisit. The page behind it
 * redraws under the dialog, which is the point — this is a view onto the
 * sheet, not a form about it.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { DesignDiagram, DesignModel, ElementId } from '../../model'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { CaretIcon } from '../../widgets/icons'
import { journeyOf } from '../lanes'
import { DEFAULT_PAPER, MAX_SPAN, PAPER_SIZES, isSheetPaper, paperWidth } from '../grid'
import type { SheetPaper } from '../../model'
import { rootsOfKind } from '../sheetDiagram'
import type { SheetActions } from './FunctionInspector'

export type SheetSettingsDialogProps = {
  model: DesignModel
  sheet: DesignDiagram
  actions: SheetActions
  onClose(): void
}

export function SheetSettingsDialog({ model, sheet, actions, onClose }: SheetSettingsDialogProps) {
  const { t } = useStrings()
  const journeys = rootsOfKind(model.elements, 'step')
  const roots = rootsOfKind(model.elements, 'function')
  // An absent list draws every root, so that is the list this dialog shows —
  // and the moment somebody touches it, it is written down.
  const drawn = sheet.areas ?? roots.map((root) => root.id)
  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id

  // The rows currently under the phases, in the order they are drawn: the
  // sheet's own order first, then the lanes only a step knows about.
  const lanes = sheet.journeyId === undefined
    ? []
    : journeyOf(model.elements, sheet.journeyId, sheet.lanes ?? [])
      .lanes.slice(1)
      .map((lane) => lane.actorId)
      .filter((id): id is ElementId => id !== undefined)

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sheet.settings')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          select size="small" fullWidth
          label={t('sheet.settingsJourney')}
          value={sheet.journeyId ?? ''}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.settingsJourney') } }}
          onChange={(e) => actions.updateSheet({
            journeyId: e.target.value === '' ? undefined : e.target.value,
          })}
        >
          <MenuItem value="">{t('common.none')}</MenuItem>
          {journeys.map((journey) => (
            <MenuItem key={journey.id} value={journey.id}>{journey.name}</MenuItem>
          ))}
        </TextField>

        <Box>
          <Caption text={t('sheet.settingsAreas')} />
          {[...drawn, ...roots.map((root) => root.id).filter((id) => !drawn.includes(id))]
            .map((id) => {
              const on = drawn.includes(id)
              const at = drawn.indexOf(id)
              return (
                <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FormControlLabel
                    sx={{ flex: 1, minWidth: 0 }}
                    control={(
                      <Checkbox
                        size="small"
                        checked={on}
                        inputProps={{ 'aria-label': t('sheet.settingsDraw', { name: named(id) }) }}
                        onChange={() => actions.updateSheet({
                          areas: on ? drawn.filter((held) => held !== id) : [...drawn, id],
                        })}
                      />
                    )}
                    label={<Typography sx={{ fontSize: 12 }}>{named(id)}</Typography>}
                  />
                  {on && (
                    <Move
                      name={named(id)}
                      up={at > 0 ? () => actions.updateSheet({ areas: swapped(drawn, at, -1) }) : undefined}
                      down={at < drawn.length - 1
                        ? () => actions.updateSheet({ areas: swapped(drawn, at, 1) })
                        : undefined}
                      t={t}
                    />
                  )}
                </Box>
              )
            })}
        </Box>

        <Box>
          <Caption text={t('sheet.settingsLanes')} />
          {lanes.length === 0 && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
              {t('sheet.settingsNoLanes')}
            </Typography>
          )}
          {lanes.map((id, at) => (
            <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
              <Typography sx={{ fontSize: 12, flex: 1, minWidth: 0 }}>{named(id)}</Typography>
              <Move
                name={named(id)}
                up={at > 0 ? () => actions.updateSheet({ lanes: swapped(lanes, at, -1) }) : undefined}
                down={at < lanes.length - 1
                  ? () => actions.updateSheet({ lanes: swapped(lanes, at, 1) })
                  : undefined}
                t={t}
              />
            </Box>
          ))}
        </Box>

        <FormControlLabel
          control={(
            <Checkbox
              size="small"
              checked={sheet.showActors !== false}
              inputProps={{ 'aria-label': t('sheet.settingsRail') }}
              onChange={(e) => actions.updateSheet({ showActors: e.target.checked })}
            />
          )}
          label={<Typography sx={{ fontSize: 12 }}>{t('sheet.settingsRail')}</Typography>}
        />

        {/* The canvas: a sheet of paper the page is laid out on, scrolling
            sideways in a window narrower than it, or the window itself. */}
        <TextField
          select size="small" fullWidth
          label={t('sheet.settingsPaper')}
          value={isSheetPaper(sheet.paper) ? sheet.paper : DEFAULT_PAPER}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.settingsPaper') } }}
          onChange={(e) => actions.updateSheet({
            paper: e.target.value === DEFAULT_PAPER ? undefined : e.target.value as SheetPaper,
          })}
        >
          {PAPER_SIZES.map((paper) => (
            <MenuItem key={paper} value={paper}>{paper} · {paperWidth(paper)} px</MenuItem>
          ))}
          <MenuItem value="fit">{t('sheet.paperFit')}</MenuItem>
        </TextField>

        {/* How many columns the areas tile in: as many as the canvas has room
            for, which is the default, or a fixed count. */}
        <TextField
          select size="small" fullWidth
          label={t('sheet.settingsColumns')}
          value={sheet.columns ?? ''}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.settingsColumns') } }}
          onChange={(e) => actions.updateSheet({
            columns: e.target.value === '' ? undefined : Number(e.target.value),
          })}
        >
          <MenuItem value="">{t('sheet.columnsFit')}</MenuItem>
          {COLUMN_CHOICES.map((count) => (
            <MenuItem key={count} value={count}>{count}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

/** One to twice the widest an area may be: an A0 holds about fourteen columns, and nobody reads that. */
const COLUMN_CHOICES = Array.from({ length: MAX_SPAN * 2 }, (_, index) => index + 1)

function Caption({ text }: { text: string }) {
  return (
    <Typography sx={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'text.secondary', mb: 0.5,
    }}>
      {text}
    </Typography>
  )
}

function Move({ name, up, down, t }: {
  name: string
  up?: () => void
  down?: () => void
  t: Translate
}) {
  return (
    <>
      <Tooltip title={t('sheet.moveUp')}>
        <span>
          <IconButton
            size="small" disabled={!up} sx={{ transform: 'rotate(180deg)' }}
            aria-label={`${name}: ${t('sheet.moveUp')}`}
            onClick={up}
          >
            <CaretIcon size={12} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('sheet.moveDown')}>
        <span>
          <IconButton
            size="small" disabled={!down}
            aria-label={`${name}: ${t('sheet.moveDown')}`}
            onClick={down}
          >
            <CaretIcon size={12} />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
}

/** One row past its neighbour, as a whole new list. */
function swapped(order: readonly ElementId[], at: number, by: -1 | 1): ElementId[] {
  const next = [...order]
  next.splice(at + by, 0, ...next.splice(at, 1))
  return next
}
