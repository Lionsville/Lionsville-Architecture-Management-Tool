// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map, drawn in its tab (ADR-0036 §7, ADR-0016): the units over
 * the applications they own, the interfaces between those applications, and
 * what the two say about each other on the view's day.
 *
 * **Columns, lines and a table.** Each column is a unit — the owner, or the
 * unit of a type above it the person groups by — with its applications under
 * it, and one for the applications nobody owns. The lines between the cards
 * are the interfaces that cross from one column to another: solid where the
 * two units declared an interaction, dashed where they declared none. The
 * table under them (`ConwayTable`) counts the interfaces between each pair and
 * marks every interaction declared between them, needed or not. The lines are
 * the one piece of geometry on the page, measured from where the cards ended
 * up and never stored.
 *
 * **It only reads.** Nothing on it moves a unit or an application. An answer
 * to a finding is a change where it is kept: an interaction declared on one of
 * the two units — offered here where one of them is kept in this scope — an
 * owner set on the application, a limit on the unit type. The arithmetic is
 * `model/conway`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import { conwayMap } from '../../model/conway'
import type { ConwayFinding, ConwayLine, ConwayMap } from '../../model/conway'
import { INTERACTION_MODE_LABEL } from '../../model/relations'
import type { DesignDiagram, ElementId } from '../../model/types'
import { pickedPerson } from '../../model/person'
import { compareUnits, unitTypeRank } from '../../model/unitOrder'
import { isUnit, organisationOn, personOf, runsOn, unitsAbove } from '../../model/units'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import type { HostModel } from '../../model/hostModel'
import { CHECK_LABEL } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { servesBadge } from './chartWords'
import { ConwayTable } from './ConwayTable'
import { InteractDialog } from './Interactions'
import type { Interacting } from './Interactions'
import { conwayInputHere } from './unitViewsHere'
import type { UnitViewsHere } from './unitViewsHere'

export type ConwayPageProps = {
  diagram: DesignDiagram
  here: UnitViewsHere
  index: ScopeIndex
  scope: ScopePath
  model: HostModel
  today: string
  readOnly: boolean
  people: PeopleRegisterAccess | undefined
  scopeLabel: (path: ScopePath) => string
  selectedId?: ElementId
  onSelect(id: ElementId | undefined): void
  onOpenElsewhere(scope: ScopePath, id: ElementId): void
  /** Where an interaction may be declared from a unit kept here. Absent: the map offers none. */
  declare?: { dispatch: (command: Command) => unknown; newRowId: () => string; scopeName: string }
  select?: SelectRequest
  onHandle?(handle: PageHandle | undefined): void
}

/** The groups' key for the applications nobody owns, where a key has to be a string. */
const NOBODY = ''

export function ConwayPage(props: ConwayPageProps) {
  const { t, language } = useStrings()
  const theme = useTheme()
  const { here, diagram, today } = props
  const day = diagram.asOf ?? today
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined)
  const [lit, setLit] = useState<number | undefined>(undefined)
  const [interacting, setInteracting] = useState<Interacting | undefined>(undefined)
  const input = useMemo(() => conwayInputHere(props.index, props.scope, props.model, here, day), [props.index, props.scope, props.model, here, day])
  const map = useMemo(() => conwayMap(input, day, groupBy !== undefined ? { groupBy } : {}), [input, day, groupBy])
  const mine = useMine(here, day)
  const page = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const open = useCallback((id: ElementId) => {
    if (here.heldHere(id)) { props.onSelect(id); return }
    const scope = here.scopeOf(id)
    if (scope !== undefined) props.onOpenElsewhere(scope, id)
  }, [here, props.onSelect, props.onOpenElsewhere])
  const { locatedId, locate } = useLocated(page, (id) => { if (here.heldHere(id)) props.onSelect(id) })
  const drawn = useCallback((id: string) => map.groups.some((group) => group.unitId === id || group.applications.some((app) => app.id === id)), [map])
  useSelectRequest(props.select, drawn, locate)
  usePageHandle(page, diagram.id, props.selectedId, props.onHandle, theme.palette.background.default)
  const lines = useMeasuredLines(stage, map)
  const highlighted = new Set(lit === undefined ? [] : keysOf(map.findings[lit]))
  const types = here.at.organisation.unitTypes
  const findMe = () => { const first = map.groups.find((group) => group.unitId !== undefined && mine.has(group.unitId)); if (first?.unitId) locate(first.unitId) }
  const crossing = map.lines.filter((line) => line.status !== 'inside').length
  const undeclared = map.lines.filter((line) => line.status === 'undeclared').length
  const declarable = (from: ElementId, to: ElementId) => {
    if (!props.declare || props.readOnly) return undefined
    const held = [from, to].find((id) => here.heldHere(id) && here.at.organisation.units.some((unit) => unit.id === id && isUnit(unit)))
    if (held === undefined) return undefined
    return () => setInteracting({ mode: 'new', from: { id: held, name: here.name(held) }, with: held === from ? to : from })
  }
  return (
    <Box data-testid="conway-page" sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box data-testid="conway-bar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <TextField select size="small" label={t('conway.groupBy')} value={groupBy ?? ''} onChange={(event) => { setGroupBy(event.target.value || undefined); setLit(undefined) }}
          sx={{ minWidth: 200 }} slotProps={{ htmlInput: { 'data-testid': 'conway-group-by' } }}>
          <MenuItem value="">{t('conway.byOwner')}</MenuItem>
          {types.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
        </TextField>
        <Button size="small" variant="outlined" onClick={findMe} disabled={mine.size === 0} data-testid="conway-find-me">{t('chart.findMe')}</Button>
        <Typography data-testid="conway-count" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('conway.count', { crossing, undeclared })}</Typography>
        <Box sx={{ flex: 1 }} />
        <Legend t={t} />
      </Box>
      <Box ref={page} data-testid="conway-body" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2, bgcolor: 'background.default', ...locatedRing(locatedId) }}>
        {map.groups.length === 0
          ? <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>{t('conway.empty')}</Typography>
          : (
            <Box ref={stage} sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
              {map.groups.map((group) => (
                <Column key={group.unitId ?? NOBODY} unitId={group.unitId} apps={group.applications} here={here} mine={mine}
                  selectedId={props.selectedId} highlighted={highlighted} grouped={groupBy !== undefined} open={open} scopeLabel={props.scopeLabel} t={t} />
              ))}
              <Lines lines={lines} />
            </Box>
          )}
        <Findings map={map} here={here} lit={lit} onLight={(at) => setLit(lit === at ? undefined : at)} declarable={declarable} open={open} t={t}
          heading={t('conway.findings', { day: formatDay(day, language) })} />
        <ConwayTable map={map} here={here} t={t} />
      </Box>
      {interacting && props.declare && (
        <InteractDialog
          interacting={interacting} units={unitsInOrder(here)}
          newRowId={props.declare.newRowId} dispatch={props.declare.dispatch} scopeName={props.declare.scopeName}
          onClose={() => setInteracting(undefined)} s={t}
        />
      )}
    </Box>
  )
}

/** The units to declare an interaction with, in the order every list of units reads. */
function unitsInOrder(here: UnitViewsHere): { id: ElementId; name: string }[] {
  const { units, unitTypes } = here.at.organisation
  return units.filter(isUnit).sort(compareUnits(unitTypeRank(unitTypes))).map((unit) => ({ id: unit.id, name: unit.name }))
}

/** The units this install's person holds a role in on the day, and every unit above each: where *you* are marked. */
function useMine(here: UnitViewsHere, day: string): ReadonlySet<ElementId> {
  const names = usePersonNames()
  return useMemo(() => {
    const { units, assignments } = organisationOn(here.at.organisation, day)
    const held = assignments
      .filter((one) => runsOn(one, day) && names.isMe(pickedPerson(personOf(one))))
      .map((one) => one.unitId)
    return new Set(held.flatMap((id) => [id, ...unitsAbove(units, id)]))
  }, [names, here, day])
}

/** The page as the agent's renderer reaches it. */
function usePageHandle(
  page: { current: HTMLDivElement | null }, diagramId: string, selectedId: ElementId | undefined,
  onHandle: ((handle: PageHandle | undefined) => void) | undefined, background: string,
) {
  const capture = useCallback(async (options: PageCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('ConwayPage: the page is not on screen')
    return captureSheet(node, { ...options, background })
  }, [page, background])
  useEffect(() => {
    if (!onHandle) return undefined
    onHandle({ diagramId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, diagramId, capture, selectedId])
}

/** The interfaces a finding is about, as the keys the lines and the cards carry. */
function keysOf(finding: ConwayFinding | undefined): string[] {
  if (!finding) return []
  switch (finding.kind) {
    case 'undeclared': return [finding.flow.sourceId, finding.flow.targetId]
    case 'unused': return [finding.interaction.sourceId, finding.interaction.targetId]
    case 'unowned': return [finding.applicationId]
    case 'overLimit': return [finding.unitId]
  }
}

function Legend({ t }: { t: Translate }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, fontSize: 11, color: 'text.secondary' }}>
      <span><Box component="span" sx={{ display: 'inline-block', width: 18, borderTop: 2, borderColor: 'primary.main', mr: 0.5, verticalAlign: 'middle' }} />{t('conway.legendDeclared')}</span>
      <span><Box component="span" sx={{ display: 'inline-block', width: 18, borderTop: 2, borderStyle: 'dashed', borderColor: 'warning.main', mr: 0.5, verticalAlign: 'middle' }} />{t('conway.legendUndeclared')}</span>
    </Box>
  )
}

/** One unit's applications, or the ones nobody owns. */
function Column({ unitId, apps, here, mine, selectedId, highlighted, grouped, open, scopeLabel, t }: {
  unitId: ElementId | undefined; apps: ConwayMap['groups'][number]['applications']; here: UnitViewsHere; mine: ReadonlySet<ElementId>
  selectedId: ElementId | undefined; highlighted: ReadonlySet<string>; grouped: boolean; open: (id: ElementId) => void
  scopeLabel: (path: ScopePath) => string; t: Translate
}) {
  const unit = unitId === undefined ? undefined : here.at.organisation.units.find((one) => one.id === unitId)
  const type = here.at.organisation.unitTypes.find((one) => one.id === unit?.unitTypeId)
  const lit = unitId !== undefined && highlighted.has(unitId)
  // A unit serving several domains names them, as the chart's badge does; one serving one says its type.
  const serves = unit?.scopes !== undefined && unit.scopes.length > 1 ? servesBadge(unit.scopes, scopeLabel, t) : undefined
  return (
    <Box data-testid="conway-column" data-element-id={unitId} sx={{
      minWidth: 180, maxWidth: 240, border: 1, borderRadius: 1.5, p: 1, bgcolor: 'background.paper',
      borderColor: lit || selectedId === unitId ? 'primary.main' : 'divider', borderStyle: unitId === undefined ? 'dashed' : 'solid',
    }}>
      {unitId === undefined ? (
        <>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('conway.nobody')}</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>{t('conway.nobodyNote')}</Typography>
        </>
      ) : (
        <ButtonBase onClick={() => open(unitId)} data-testid="conway-unit-open" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
          <Typography sx={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}
            data-testid="conway-unit-kind" {...(serves?.full ? { title: serves.full } : {})}>
            {serves ? serves.text : type?.name ?? ''}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{here.name(unitId)}</Typography>
            {mine.has(unitId) && <Chip size="small" color="primary" label={t('unit.you')} sx={{ height: 16, fontSize: 10 }} data-testid="conway-you" />}
          </Box>
        </ButtonBase>
      )}
      <Box sx={{ display: 'grid', gap: 0.75, mt: 1 }}>
        {apps.map((app) => (
          <ButtonBase key={app.id} data-testid="conway-app" data-app={app.id} data-element-id={app.id} onClick={() => open(app.id)}
            sx={{
              display: 'block', textAlign: 'left', border: 1, borderRadius: 1, px: 1, py: 0.5, fontSize: 12,
              borderColor: highlighted.has(app.id) || selectedId === app.id ? 'primary.main' : 'divider',
              bgcolor: highlighted.has(app.id) ? 'action.selected' : 'background.default',
            }}>
            {app.name}
            {grouped && app.partyId !== undefined && app.partyId !== unitId && (
              <Box component="span" sx={{ display: 'block', fontSize: 10, color: 'text.secondary' }}>{here.name(app.partyId)}</Box>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  )
}

type Drawn = { key: string; d: string; status: ConwayLine['status'] }

/**
 * Where each crossing line runs, from the cards as they ended up: measured
 * after every layout and again when the stage changes size, never stored.
 */
function useMeasuredLines(stage: { current: HTMLDivElement | null }, map: ConwayMap): Drawn[] {
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const root = stage.current
    if (!root) { setDrawn([]); return }
    const box = root.getBoundingClientRect()
    const cards = new Map([...root.querySelectorAll<HTMLElement>('[data-app]')].map((card) => [card.dataset.app, card]))
    const at = (id: string) => cards.get(id)?.getBoundingClientRect()
    const next: Drawn[] = []
    for (const line of map.lines) {
      if (line.status === 'inside') continue
      const a = at(line.flow.sourceId)
      const b = at(line.flow.targetId)
      if (!a || !b || (a.width === 0 && b.width === 0)) continue
      const forward = b.left >= a.left
      const x1 = (forward ? a.right : a.left) - box.left
      const x2 = (forward ? b.left : b.right) - box.left
      const y1 = a.top + a.height / 2 - box.top
      const y2 = b.top + b.height / 2 - box.top
      const mx = (x1 + x2) / 2
      next.push({ key: line.flow.id, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, status: line.status })
    }
    setDrawn(next)
  }, [stage, map])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    const root = stage.current
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => measure())
    watch.observe(root)
    return () => watch.disconnect()
  }, [stage, measure])
  return drawn
}

function Lines({ lines }: { lines: readonly Drawn[] }) {
  const theme = useTheme()
  const stroke = (status: Drawn['status']) => (status === 'declared' ? theme.palette.primary.main : status === 'undeclared' ? theme.palette.warning.main : theme.palette.text.secondary)
  return (
    <Box component="svg" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {lines.map((line) => (
        <path key={line.key} d={line.d} fill="none" stroke={stroke(line.status)} strokeWidth={1.5}
          strokeDasharray={line.status === 'declared' ? undefined : line.status === 'undeclared' ? '5 4' : '2 3'} data-testid={`conway-line-${line.status}`} />
      ))}
    </Box>
  )
}

/** What the map finds on the day, each with its answer where one can be given here. */
function Findings({ map, here, lit, onLight, declarable, open, heading, t }: {
  map: ConwayMap; here: UnitViewsHere; lit: number | undefined; onLight: (at: number) => void
  declarable: (from: ElementId, to: ElementId) => (() => void) | undefined; open: (id: ElementId) => void; heading: string; t: Translate
}) {
  return (
    <Box data-testid="conway-findings" sx={{ mt: 3 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{heading}</Typography>
      {map.findings.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('conway.nothing')}</Typography>}
      {map.findings.map((finding, at) => {
        const declare = finding.kind === 'undeclared' ? declarable(finding.from, finding.to) : undefined
        return (
          <Box key={at} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <ButtonBase onClick={() => onLight(at)} data-testid="conway-finding" data-kind={finding.kind}
              sx={{ fontSize: 12, textAlign: 'left', color: finding.kind === 'unused' ? 'text.secondary' : 'warning.main', fontWeight: lit === at ? 700 : 400 }}>
              {findingText(finding, here, t)}
            </ButtonBase>
            {declare && <Button size="small" onClick={declare} data-testid="conway-declare" sx={{ fontSize: 11 }}>{t('interacts.add')}</Button>}
            {finding.kind === 'unowned' && <Button size="small" onClick={() => open(finding.applicationId)} sx={{ fontSize: 11 }}>{t('conway.openApplication')}</Button>}
          </Box>
        )
      })}
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>{t('conway.onlyReads')}</Typography>
    </Box>
  )
}

/** One finding, in words. */
export function findingText(finding: ConwayFinding, here: UnitViewsHere, t: Translate): string {
  switch (finding.kind) {
    case 'undeclared':
      return t('check.interfaceUndeclared', {
        source: here.name(finding.flow.sourceId), target: here.name(finding.flow.targetId), from: here.name(finding.from), to: here.name(finding.to),
      })
    case 'unused':
      return t('check.interactionUnused', {
        a: here.name(finding.interaction.sourceId), b: here.name(finding.interaction.targetId),
        mode: finding.interaction.mode ? t(INTERACTION_MODE_LABEL[finding.interaction.mode]) : t('conway.anInteraction'),
      })
    case 'unowned':
      return t('check.applicationUnowned', { name: here.name(finding.applicationId) })
    case 'overLimit': {
      const unit = here.at.organisation.units.find((one) => one.id === finding.unitId)
      const type = here.at.organisation.unitTypes.find((one) => one.id === unit?.unitTypeId)?.name ?? ''
      // One kind with the organisation's own over-limit, so said in its words (`check.unitOverLimit`).
      return t(CHECK_LABEL['check.unitOverLimit'], { name: here.name(finding.unitId), count: finding.owns, detail: type, limit: finding.limit })
    }
  }
}
