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
import type { Theme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import { RELATION_LABEL, addDays, daysBetween, isDay, portProgress, transitionLabel } from '../../model'
import type { DesignModel, ElementId, Lifecycle, Transition } from '../../model'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import type { WindowChrome } from '../../platform/windowChrome'
import { barChromeFor } from '../../platform/windowChrome'
import { findings } from '../../model/checks'
import { CHECK_SENTENCE } from '../labels'
import { fractionOf, roadmapOf, shadowRunOf, within } from '../timeline'

/**
 * The colour each phase is drawn in: the same semantic mapping the canvas's
 * tokens make (planned → info, live → success, retiring → warning, retired →
 * disabled), taken from the palette so both themes answer. Said here rather
 * than imported, because this module may not know how the canvas draws.
 */
function phaseColours(theme: Theme): Record<Lifecycle, string> {
  return {
    planned: theme.palette.info.main,
    live: theme.palette.success.main,
    retiring: theme.palette.warning.main,
    retired: theme.palette.text.disabled,
  }
}

/**
 * Where the axis opens: three calendar years either side of this one, whole
 * years, so what is being planned is in view and what was retired a decade ago
 * is not — and "Whole axis" is one click for when it should be.
 */
export function defaultWindow(today: string): { from: string; to: string } {
  const year = Number(today.slice(0, 4))
  return { from: `${year - 3}-01-01`, to: `${year + 3}-12-31` }
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

/**
 * A plan filed in a scope below this one and flagged as an initiative
 * (ADR-0012 §7): drawn here under its scope's name, edited there.
 */
export type Initiative = {
  scope: string
  /** What to call the scope on screen. */
  label: string
  plan: Transition
}

export type RoadmapPageProps = {
  open: boolean
  model: DesignModel
  /** The initiatives of the scopes below, read off the index; absent or empty draws no band for them. */
  fromBelow?: readonly Initiative[]
  /** Open a plan where it lives. Absent = the rows are drawn and go nowhere. */
  onOpenInitiative?(scope: string, planId: string): void
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
  const phaseColour = phaseColours(theme)
  const [newTitle, setNewTitle] = useState<string | null>(null)
  // The period a person chose to look at. Both ends or neither: one end alone
  // is half a question, and the natural axis answers it until the other is set.
  const [window_, setWindow] = useState<{ from: string; to: string }>(() => defaultWindow(today))

  const below = props.fromBelow ?? []
  // The axis takes the initiatives in: a plan below that runs past this
  // scope's own dates would otherwise be a band cut off at the edge.
  const whole = useMemo(() => {
    const own = roadmapOf(model, today)
    const days = below.flatMap(({ plan }) => [plan.from, plan.to].filter(isDay))
    if (days.length === 0) return own
    return {
      ...own,
      from: days.reduce((first, day) => (day < first ? day : first), own.from),
      to: days.reduce((last, day) => (day > last ? day : last), own.to),
    }
  }, [model, today, below])
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
  const bar = barChromeFor(chrome)
  const empty = whole.tracks.length === 0 && whole.relations.length === 0 && whole.transitions.length === 0
    && below.length === 0

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('roadmap.title')}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
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
              {/* The window's two ends are the axis's two ends, so the fields
                  that set them sit where the ends are, either side of the
                  scrubber, with room for their labels. */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, pt: 1 }}>
                <TextField
                  type="date" size="small" label={t('roadmap.windowFrom')} value={window_.from}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('roadmap.windowFrom') } }}
                  sx={{ width: 160 }}
                  onChange={(e) => setWindow((w) => ({ ...w, from: e.target.value }))}
                />
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
                <TextField
                  type="date" size="small" label={t('roadmap.windowTo')} value={window_.to}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('roadmap.windowTo') } }}
                  sx={{ width: 160 }}
                  onChange={(e) => setWindow((w) => ({ ...w, to: e.target.value }))}
                />
                {cut ? (
                  <Button size="small" onClick={() => setWindow({ from: '', to: '' })}>{t('roadmap.windowClear')}</Button>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>{roadmap.from} – {roadmap.to}</Typography>
                )}
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
                            bgcolor: phaseColour[span_.phase],
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

              {roadmap.relations.length > 0 && (
                <>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 2, mb: 0.5 }}>
                    {t('roadmap.relations')}
                  </Typography>
                  {roadmap.relations.map(({ relation, sourceName, targetName }) => {
                    // An end left open is drawn to the edge of the axis, which is
                    // what "and onwards" looks like on a page with two edges.
                    const opens = isDay(relation.validFrom) ? relation.validFrom! : roadmap.from
                    const closes = isDay(relation.validUntil) ? relation.validUntil! : roadmap.to
                    return (
                      <Box key={relation.id} sx={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {relation.label || `${sourceName} → ${targetName}`}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {t(RELATION_LABEL[relation.type])}
                          </Typography>
                        </Box>
                        <Box data-testid={`relation-${relation.id}`} sx={{ position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Tooltip title={`${sourceName} → ${targetName} · ${opens} – ${isDay(relation.validUntil) ? relation.validUntil : '…'}`}>
                            <Box
                              data-testid="relation-window"
                              data-relation-type={relation.type}
                              sx={{
                                position: 'absolute', top: 3, bottom: 3,
                                left: at(opens), right: `calc(100% - ${at(closes)})`,
                                borderRadius: 1,
                                // The same hatch a shadow run wears: a stretch
                                // that is true for a while and then is not.
                                backgroundImage: `repeating-linear-gradient(135deg, ${theme.palette.primary.main} 0 3px, transparent 3px 7px)`,
                                opacity: 0.6,
                              }}
                            />
                          </Tooltip>
                          <Marker left={at(today)} colour={theme.palette.text.primary} label={t('roadmap.today')} />
                        </Box>
                      </Box>
                    )
                  })}
                </>
              )}

              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 2, mb: 0.5 }}>
                {t('roadmap.plans')}
              </Typography>
              {roadmap.transitions.length === 0 && (
                <Typography variant="body2" color="text.secondary">{t('roadmap.noPlans')}</Typography>
              )}
              {roadmap.transitions.map((plan) => {
                const progress = portProgress(model, plan)
                const shadow = shadowRunOf(model, plan)
                return (
                <Box key={plan.id} sx={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ minWidth: 0, cursor: 'pointer' }} onClick={() => actions.onOpenPlan(plan.id)}>
                    <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {transitionLabel(plan)} {plan.title}
                    </Typography>
                    {progress.total > 0 && (
                      <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {t('roadmap.planPorted', { done: String(progress.done), total: String(progress.total) })}
                      </Typography>
                    )}
                  </Box>
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
                    {shadow && (
                      <Tooltip title={`${t('roadmap.shadowRun')} · ${shadow.from} – ${shadow.to}`}>
                        <Box
                          data-testid="shadow-run"
                          sx={{
                            position: 'absolute', top: 3, bottom: 3,
                            left: at(shadow.from), right: `calc(100% - ${at(shadow.to)})`,
                            borderRadius: 1,
                            backgroundImage: `repeating-linear-gradient(135deg, ${theme.palette.primary.main} 0 3px, transparent 3px 7px)`,
                            opacity: 0.6,
                          }}
                        />
                      </Tooltip>
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
                )
              })}

              {below.length > 0 && (
                <>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 2, mb: 0.5 }}>
                    {t('roadmap.fromBelow')}
                  </Typography>
                  {below.map((held) => (
                    <InitiativeRow
                      key={`${held.scope}/${held.plan.id}`}
                      initiative={held}
                      at={at}
                      from={roadmap.from}
                      to={roadmap.to}
                      today={today}
                      onOpen={props.onOpenInitiative}
                      t={t}
                      colour={theme.palette.text.primary}
                    />
                  ))}
                </>
              )}

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
                          // Which kind of row it was (ADR-0012 §5), in words:
                          // *supports* where the finding means supports.
                          type: problem.relationType
                            ? t(RELATION_LABEL[problem.relationType])
                            : '',
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
    </PageDialog>
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

/**
 * A plan from a scope below, as a band under its scope's name (ADR-0012 §7).
 *
 * Simpler than the rows above it on purpose: what it introduces and retires
 * and the interfaces it ports are that scope's elements, which this model
 * does not hold, so the band says when and the chip says where — and opening
 * it goes there.
 */
function InitiativeRow({ initiative, at, from, to, today, onOpen, t, colour }: {
  initiative: Initiative
  at(day: string): string
  from: string
  to: string
  today: string
  onOpen?(scope: string, planId: string): void
  t: (key: StringKey, values?: Record<string, string | number>) => string
  colour: string
}) {
  const { plan, scope, label } = initiative
  const open = onOpen ? () => onOpen(scope, plan.id) : undefined
  return (
    <Box
      data-testid={`initiative-${scope}-${plan.id}`}
      sx={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', alignItems: 'center', gap: 1, mb: 0.5 }}
    >
      <Box sx={{ minWidth: 0, cursor: open ? 'pointer' : 'default' }} onClick={open}>
        <Typography sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {transitionLabel(plan)} {plan.title}
        </Typography>
        <Tooltip title={open ? t('roadmap.openInitiative', { scope: label }) : label}>
          <Chip size="small" label={label} sx={{ height: 16, fontSize: 10, mt: 0.25 }} />
        </Tooltip>
      </Box>
      <Box
        onClick={open}
        sx={{ position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, cursor: open ? 'pointer' : 'default' }}
      >
        {isDay(plan.from) && (
          <Box
            data-testid="plan-band"
            sx={{
              position: 'absolute', top: 3, bottom: 3,
              left: at(plan.from),
              right: isDay(plan.to) ? `calc(100% - ${at(plan.to)})` : 0,
              bgcolor: 'secondary.main', opacity: 0.5, borderRadius: 1,
            }}
          />
        )}
        {plan.milestones.filter((m) => isDay(m.date) && m.date >= from && m.date <= to).map((milestone, index) => (
          <Tooltip key={index} title={`${milestone.name} · ${milestone.date}`}>
            <Box
              data-testid="milestone"
              sx={{
                position: 'absolute', top: 4, left: at(milestone.date), width: 8, height: 10,
                ml: '-4px', bgcolor: 'secondary.dark', transform: 'rotate(45deg)',
              }}
            />
          </Tooltip>
        ))}
        <Marker left={at(today)} colour={colour} label={t('roadmap.today')} />
      </Box>
    </Box>
  )
}
