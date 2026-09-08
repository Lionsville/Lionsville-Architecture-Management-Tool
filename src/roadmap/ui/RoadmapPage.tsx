/**
 * The landscape on a time axis, and the plans over it (ADR-0009).
 *
 * The axis, the plans as bands over it, and the findings under both. A plan
 * is opened from its band and read on a page of its own (`PlanPage`,
 * ADR-0010); this page only draws it. A window a person chooses cuts the axis
 * to a period and keeps only what is there or changes inside it — a view
 * state, not a model one, because which years you are looking at is not a
 * fact about the landscape.
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
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { addDays, daysBetween, isDay, transitionLabel } from '../../model'
import type { DesignModel, ElementId, Lifecycle } from '../../model'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { BackIcon } from '../../widgets/icons'
import type { WindowChrome } from '../../platform/windowChrome'
import { findings } from '../../model/checks'
import type { Finding } from '../../model/checks'
import { fractionOf, roadmapOf, within } from '../timeline'

/** The colour each phase is drawn in. The canvas's own tokens, said once here. */
const PHASE_COLOUR: Record<Lifecycle, string> = {
  planned: '#8a8f98',
  live: '#2e7d32',
  retiring: '#ed6c02',
  retired: '#9e9e9e',
}

const CHECK_SENTENCE: Record<Finding['kind'], StringKey> = {
  retiresWithDependants: 'check.retiresWithDependants',
  successorTooLate: 'check.successorTooLate',
  successorMissing: 'check.successorMissing',
  lineOutlivesEnd: 'check.lineOutlivesEnd',
  planOverdue: 'check.planOverdue',
}

export type RoadmapActions = {
  /** Write a plan. The caller mints the id and the number, and opens it. */
  addTransition(title: string): void
  /** Read a plan on its own page. */
  onOpenPlan(id: string): void
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
  const [newTitle, setNewTitle] = useState<string | null>(null)
  // The period a person chose to look at. Both ends or neither: one end alone
  // is half a question, and the natural axis answers it until the other is set.
  const [window_, setWindow] = useState<{ from: string; to: string }>({ from: '', to: '' })

  const whole = useMemo(() => roadmapOf(model, today), [model, today])
  const cut = isDay(window_.from) && isDay(window_.to) && window_.from < window_.to
  const roadmap = useMemo(
    () => (cut ? within(whole, window_.from, window_.to) : whole),
    [whole, cut, window_.from, window_.to],
  )
  const problems = useMemo(
    () => findings({ model, today }),
    [model, today],
  )

  const span = daysBetween(roadmap.from, roadmap.to)
  const at = (day: string) => `${fractionOf(roadmap.from, roadmap.to, day) * 100}%`
  const scrubDay = props.asOf && isDay(props.asOf) ? props.asOf : today
  const chrome = props.windowChrome ?? { controlsInset: 0, draggable: false }
  const empty = whole.tracks.length === 0 && whole.transitions.length === 0

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
        <TextField
          type="date" size="small" label={t('roadmap.windowFrom')} value={window_.from}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('roadmap.windowFrom') } }}
          sx={{ width: 160 }}
          onChange={(e) => setWindow((w) => ({ ...w, from: e.target.value }))}
        />
        <TextField
          type="date" size="small" label={t('roadmap.windowTo')} value={window_.to}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('roadmap.windowTo') } }}
          sx={{ width: 160 }}
          onChange={(e) => setWindow((w) => ({ ...w, to: e.target.value }))}
        />
        {cut && (
          <Button size="small" onClick={() => setWindow({ from: '', to: '' })}>{t('roadmap.windowClear')}</Button>
        )}
        {!readOnly && (
          <Button size="small" variant="outlined" onClick={() => setNewTitle('')}>
            {t('roadmap.newPlan')}
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* the axis */}
        <Box sx={{ overflow: 'auto', p: 2, minWidth: 0, flex: 1 }}>
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
                    sx={{ fontSize: 12, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => actions.onOpenPlan(plan.id)}
                  >
                    {transitionLabel(plan)} {plan.title}
                  </Typography>
                  <Box
                    data-testid={`plan-${plan.id}`}
                    onClick={() => actions.onOpenPlan(plan.id)}
                    sx={{ position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, cursor: 'pointer' }}
                  >
                    {isDay(plan.from) && (
                      <Box
                        data-testid="plan-band"
                        sx={{
                          position: 'absolute', top: 3, bottom: 3,
                          left: at(plan.from),
                          right: isDay(plan.to) ? `calc(100% - ${at(plan.to)})` : 0,
                          bgcolor: 'primary.main', opacity: 0.5, borderRadius: 1,
                        }}
                      />
                    )}
                    {plan.milestones.filter((m) => isDay(m.date) && m.date >= roadmap.from && m.date <= roadmap.to).map((milestone, index) => (
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
