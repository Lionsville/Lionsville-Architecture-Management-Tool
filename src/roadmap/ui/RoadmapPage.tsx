/**
 * The landscape on a time axis, and the plans over it (ADR-0009).
 *
 * One page rather than two. ADR-0009 sketched a transitions page beside a
 * roadmap page; a plan and a timeline turned out to be the same view — a plan
 * IS a band on the axis, and reading one always means asking what else is
 * happening that month. So the axis is the left three-quarters, the plan you
 * picked is the right, and the findings sit under both.
 *
 * The scrubber is the join between this page and the canvas behind it: dragging
 * it sets the open diagram's `asOf`, so the board and the axis cannot disagree
 * about which day is being discussed. That is an ordinary undoable command, not
 * a view state, for the reason ADR-0009 gives: one mechanism cannot contradict
 * itself.
 *
 * A fullscreen dialog, and it takes `windowChrome` for the same reason
 * `DocumentationPage` and `AdrPage` do — Electron computes drag regions from
 * geometry, so the shell toolbar's drag strip stays live underneath and would
 * swallow every click on a control placed there.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { addDays, daysBetween, isDay, transitionLabel } from '../../model'
import type {
  DesignModel, ElementId, Lifecycle, Transition, TransitionStatus,
} from '../../model'
import { TRANSITION_STATUSES, transitionStatusesFrom } from '../../model'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { BackIcon } from '../../widgets/icons'
import type { WindowChrome } from '../../platform/windowChrome'
import { findings } from '../../model/checks'
import type { Finding } from '../../model/checks'
import { fractionOf, roadmapOf } from '../timeline'

/** The colour each phase is drawn in. The canvas's own tokens, said once here. */
const PHASE_COLOUR: Record<Lifecycle, string> = {
  planned: '#8a8f98',
  live: '#2e7d32',
  retiring: '#ed6c02',
  retired: '#9e9e9e',
}

const STATUS_LABEL: Record<TransitionStatus, StringKey> = {
  draft: 'plan.draft',
  agreed: 'plan.agreed',
  running: 'plan.running',
  done: 'plan.done',
  abandoned: 'plan.abandoned',
}

const CHECK_SENTENCE: Record<Finding['kind'], StringKey> = {
  retiresWithDependants: 'check.retiresWithDependants',
  successorTooLate: 'check.successorTooLate',
  successorMissing: 'check.successorMissing',
  lineOutlivesEnd: 'check.lineOutlivesEnd',
  planOverdue: 'check.planOverdue',
}

export type RoadmapActions = {
  /** Write a plan. The caller mints the id and the number. */
  addTransition(title: string): void
  updateTransition(id: string, patch: Partial<Transition>): void
  removeTransition(id: string): void
  /** Move a plan and the dates it owns by a number of days, as one step. */
  shiftTransition(id: string, days: number): void
  /** Put the board behind this page on a day. */
  setAsOf(day: string | undefined): void
  /** Show an element on the canvas. */
  onOpenElement(id: ElementId): void
}

export type RoadmapPageProps = {
  open: boolean
  model: DesignModel
  /** The day "now" is; the caller reads the clock so this stays testable. */
  today: string
  /** The day the open board is showing, so the scrubber starts where it is. */
  asOf?: string
  readOnly: boolean
  actions: RoadmapActions
  onClose(): void
  windowChrome?: WindowChrome
}

export function RoadmapPage(props: RoadmapPageProps) {
  const { model, today, readOnly, actions } = props
  const { t } = useStrings()
  const theme = useTheme()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [newTitle, setNewTitle] = useState<string | null>(null)
  const [shiftBy, setShiftBy] = useState<string>('')

  const roadmap = useMemo(() => roadmapOf(model, today), [model, today])
  const problems = useMemo(
    () => findings({ model, today }),
    [model, today],
  )
  const selected = roadmap.transitions.find((one) => one.id === selectedId)

  const span = daysBetween(roadmap.from, roadmap.to)
  const at = (day: string) => `${fractionOf(roadmap.from, roadmap.to, day) * 100}%`
  const scrubDay = props.asOf && isDay(props.asOf) ? props.asOf : today
  const chrome = props.windowChrome ?? { controlsInset: 0, draggable: false }
  const empty = roadmap.tracks.length === 0 && roadmap.transitions.length === 0

  return (
    <Dialog
      open={props.open}
      fullScreen
      onClose={props.onClose}
      aria-label={t('roadmap.title')}
      slotProps={{ paper: { sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' } } }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + chrome.controlsInset}px`,
          WebkitAppRegion: chrome.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('roadmap.close')}>
          <IconButton size="small" aria-label={t('roadmap.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('roadmap.title')}</Typography>
        <Box sx={{ flex: 1 }} />
        {!readOnly && (
          <Button size="small" variant="outlined" onClick={() => setNewTitle('')}>
            {t('roadmap.newPlan')}
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', flex: 1, minHeight: 0 }}>
        {/* the axis */}
        <Box sx={{ overflow: 'auto', p: 2, minWidth: 0 }}>
          {empty ? (
            <Box sx={{ color: 'text.secondary' }}>
              <Typography>{t('roadmap.empty')}</Typography>
              <Typography variant="body2">{t('roadmap.emptyHint')}</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">{roadmap.from}</Typography>
                <Box sx={{ flex: 1 }}>
                  <Slider
                    size="small"
                    aria-label={t('roadmap.showing')}
                    value={Math.max(0, daysBetween(roadmap.from, scrubDay))}
                    min={0}
                    max={Math.max(1, span)}
                    disabled={readOnly}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(days: number) => addDays(roadmap.from, days)}
                    onChange={(_event, value) => {
                      const day = addDays(roadmap.from, Array.isArray(value) ? value[0] : value)
                      actions.setAsOf(day === today ? undefined : day)
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">{roadmap.to}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('roadmap.scrubHelp')}
              </Typography>

              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
                {t('roadmap.applications')}
              </Typography>
              {roadmap.tracks.map((track) => (
                <Box key={track.element.id} sx={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography
                    sx={{ fontSize: 12, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => actions.onOpenElement(track.element.id)}
                  >
                    {track.element.name}
                  </Typography>
                  <Box data-testid={`track-${track.element.id}`} sx={{ position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1 }}>
                    {track.spans.map((span_, index) => (
                      <Tooltip key={index} title={`${t(`lifecycle.${span_.phase}` as StringKey)} · ${span_.from}`}>
                        <Box
                          data-phase={span_.phase}
                          sx={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: at(span_.from),
                            right: span_.to ? `calc(100% - ${at(span_.to)})` : 0,
                            bgcolor: PHASE_COLOUR[span_.phase],
                            opacity: span_.phase === 'retired' ? 0.35 : 0.85,
                            borderRadius: 1,
                          }}
                        />
                      </Tooltip>
                    ))}
                    <Marker left={at(today)} colour={theme.palette.text.primary} label={t('roadmap.today')} />
                    {props.asOf && isDay(props.asOf) && (
                      <Marker left={at(props.asOf)} colour={theme.palette.primary.main} label={props.asOf} />
                    )}
                  </Box>
                </Box>
              ))}

              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 2, mb: 0.5 }}>
                {t('roadmap.plans')}
              </Typography>
              {roadmap.transitions.length === 0 && (
                <Typography variant="body2" color="text.secondary">{t('roadmap.noPlans')}</Typography>
              )}
              {roadmap.transitions.map((plan) => (
                <Box key={plan.id} sx={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography
                    sx={{ fontSize: 12, fontWeight: plan.id === selectedId ? 700 : 400, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => setSelectedId(plan.id)}
                  >
                    {transitionLabel(plan)} {plan.title}
                  </Typography>
                  <Box
                    data-testid={`plan-${plan.id}`}
                    onClick={() => setSelectedId(plan.id)}
                    sx={{ position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, cursor: 'pointer' }}
                  >
                    {isDay(plan.from) && (
                      <Box
                        sx={{
                          position: 'absolute', top: 3, bottom: 3,
                          left: at(plan.from),
                          right: isDay(plan.to) ? `calc(100% - ${at(plan.to)})` : 0,
                          bgcolor: 'primary.main', opacity: 0.5, borderRadius: 1,
                        }}
                      />
                    )}
                    {plan.milestones.filter((m) => isDay(m.date)).map((milestone, index) => (
                      <Tooltip key={index} title={`${milestone.name} · ${milestone.date}`}>
                        <Box
                          data-testid="milestone"
                          sx={{
                            position: 'absolute', top: 4, left: at(milestone.date), width: 8, height: 10,
                            ml: '-4px', bgcolor: 'primary.dark', transform: 'rotate(45deg)',
                          }}
                        />
                      </Tooltip>
                    ))}
                    <Marker left={at(today)} colour={theme.palette.text.primary} label={t('roadmap.today')} />
                  </Box>
                </Box>
              ))}

              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                  {t('check.title')}
                </Typography>
                {problems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">{t('check.none')}</Typography>
                ) : (
                  <Box component="ul" sx={{ pl: '1.2em', my: 0.5 }}>
                    {problems.map((problem, index) => (
                      <Box component="li" key={`${problem.kind}-${problem.id}-${index}`} sx={{ fontSize: 13, my: 0.25 }}>
                        {t(CHECK_SENTENCE[problem.kind], {
                          name: problem.name,
                          detail: problem.detail ?? '',
                          count: String(problem.count ?? 0),
                        })}
                      </Box>
                    ))}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {t('check.staleness')}
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* the plan you picked */}
        <Box sx={{ borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto', p: 2 }}>
          {selected ? (
            <PlanDetail
              plan={selected}
              model={model}
              readOnly={readOnly}
              actions={actions}
              shiftBy={shiftBy}
              onShiftByChange={setShiftBy}
              onDeleted={() => setSelectedId(undefined)}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">{t('roadmap.noPlans')}</Typography>
          )}
        </Box>
      </Box>

      <Dialog open={newTitle !== null} onClose={() => setNewTitle(null)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>{t('roadmap.newPlanTitle')}</Typography>
          <TextField
            size="small"
            autoFocus
            value={newTitle ?? ''}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle?.trim()) {
                actions.addTransition(newTitle.trim())
                setNewTitle(null)
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setNewTitle(null)}>{t('common.cancel')}</Button>
            <Button
              variant="contained"
              disabled={!newTitle?.trim()}
              onClick={() => {
                if (newTitle?.trim()) actions.addTransition(newTitle.trim())
                setNewTitle(null)
              }}
            >
              {t('roadmap.newPlan')}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Dialog>
  )
}

/** Today, and the day the board shows, as lines down a track. */
function Marker({ left, colour, label }: { left: string; colour: string; label: string }) {
  return (
    <Tooltip title={label}>
      <Box sx={{ position: 'absolute', top: -2, bottom: -2, left, width: '2px', ml: '-1px', bgcolor: colour, opacity: 0.7 }} />
    </Tooltip>
  )
}

function PlanDetail(
  { plan, model, readOnly, actions, shiftBy, onShiftByChange, onDeleted }: {
    plan: Transition
    model: DesignModel
    readOnly: boolean
    actions: RoadmapActions
    shiftBy: string
    onShiftByChange(value: string): void
    onDeleted(): void
  },
) {
  const { t } = useStrings()
  const named = new Map(model.elements.map((element) => [element.id, element.name]))
  const set = (patch: Partial<Transition>) => actions.updateTransition(plan.id, patch)
  const days = Number(shiftBy)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{transitionLabel(plan)}</Typography>
      <TextField
        size="small" label={t('common.name')} value={plan.title} disabled={readOnly}
        onChange={(e) => set({ title: e.target.value })}
      />
      <TextField
        size="small" select label={t('roadmap.status')} value={plan.status} disabled={readOnly}
        onChange={(e) => set({ status: e.target.value as TransitionStatus })}
      >
        {TRANSITION_STATUSES
          // Only where the machine allows, plus where it already is.
          .filter((status) => status === plan.status || transitionStatusesFrom(plan.status).includes(status))
          .map((status) => (
            <MenuItem key={status} value={status}>{t(STATUS_LABEL[status])}</MenuItem>
          ))}
      </TextField>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          type="date" size="small" fullWidth label={t('roadmap.planWindow', { from: '', to: '' }).trim()}
          value={plan.from ?? ''} disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => set({ from: e.target.value || undefined })}
        />
        <TextField
          type="date" size="small" fullWidth label={t('roadmap.planOpen')}
          value={plan.to ?? ''} disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => set({ to: e.target.value || undefined })}
        />
      </Box>
      <TextField
        size="small" label={t('roadmap.owner')} value={plan.owner ?? ''} disabled={readOnly}
        onChange={(e) => set({ owner: e.target.value || undefined })}
      />

      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>{t('roadmap.touches')}</Typography>
        {plan.elements.length === 0 && <Typography variant="body2" color="text.secondary">—</Typography>}
        <Box component="ul" sx={{ pl: '1.2em', my: 0.5 }}>
          {plan.elements.map((one) => (
            <Box component="li" key={one.elementId} sx={{ fontSize: 13 }}>
              {t(`plan.${one.role}` as StringKey)} — {named.get(one.elementId) ?? one.elementId}
            </Box>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>{t('roadmap.milestones')}</Typography>
        {plan.milestones.length === 0 && <Typography variant="body2" color="text.secondary">—</Typography>}
        <Box component="ul" sx={{ pl: '1.2em', my: 0.5 }}>
          {plan.milestones.map((milestone, index) => (
            <Box component="li" key={index} sx={{ fontSize: 13 }}>{milestone.date} — {milestone.name}</Box>
          ))}
        </Box>
      </Box>

      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            size="small" type="number" label={t('roadmap.shiftDays')} value={shiftBy}
            onChange={(e) => onShiftByChange(e.target.value)}
            helperText={t('roadmap.shiftHelp')}
          />
          <Button
            size="small"
            disabled={!Number.isFinite(days) || days === 0}
            onClick={() => { actions.shiftTransition(plan.id, days); onShiftByChange('') }}
          >
            {t('roadmap.shift')}
          </Button>
        </Box>
      )}

      {!readOnly && (
        <Button
          size="small" color="error"
          onClick={() => { actions.removeTransition(plan.id); onDeleted() }}
        >
          {t('roadmap.delete')}
        </Button>
      )}
    </Box>
  )
}
