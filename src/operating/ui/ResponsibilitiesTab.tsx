// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who answers for what. It opens on a part: a tree of the responsibility groups on
 * the left, and the grid of the roles with a part in what is picked, the others
 * folded into +N. The whole organisation is one press away, for audits and export.
 * A unit narrows it to that unit's roles and says who holds each, and a row whose A
 * sits outside the unit says where, so it does not read as a gap.
 *
 * The count of what needs one A is read over everything and never narrows, and the
 * tree marks a closed group by what is below it: no filter or fold hides a gap.
 */
import { useMemo, useState } from 'react'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Select, TextInput } from '../../widgets/kit/Field'
import { FilterWords } from '../../widgets/kit/FilterWords'
import type { MatrixPick } from '../../widgets/kit/Matrix'
import { MenuButton } from '../../widgets/kit/Menu'
import { Segmented } from '../../widgets/kit/Segmented'
import { TreeList } from '../../widgets/kit/TreeList'
import type { TreeNode } from '../../widgets/kit/TreeList'
import { newResponsibility } from '../edit'
import type { OperatingModel } from '../edit'
import { groupsOf } from '../matrixView'
import type { MatrixView } from '../matrixView'
import type { OrganisationFacts, UnitFact } from '../organisationFacts'
import { needOf, raciCsv, raciGrid, raciParts, rowsNeeding } from '../raciView'
import type { RaciGrid as RaciGridData, RaciLook, RaciPart } from '../raciView'
import { needWords, RaciGrid } from './RaciGrid'

export type RaciTabProps = {
  model: OperatingModel
  readOnly: boolean
  dispatch(command: Command): void
  makeId: MakeId
  facts: OrganisationFacts | undefined
  look: RaciLook
  onLook(look: RaciLook): void
  /** Kept by the page, so leaving the tab and coming back keeps it. */
  view: MatrixView
  onView(view: MatrixView): void
  arranging: boolean
  onArrange(on: boolean): void
  selected: string | undefined
  onSelect(id: string | undefined): void
  /** Hands the file over to be saved. Absent: no export. */
  onSave: ((name: string, text: string) => void) | undefined
  onOpenUnit: ((unit: { id: string; scope: string }) => void) | undefined
}

const PART = (group: string) => `part:${group}`
const ALL = 'all'
const OTHERS = 'others'

export function ResponsibilitiesTab({ model, readOnly, dispatch, makeId, facts, look, onLook, view, onView, arranging, onArrange, selected, onSelect, onSave, onOpenUnit }: RaciTabProps) {
  const { t } = useStrings()
  const unit = facts?.units.find((one) => one.id === look.unit)
  const unitRoles = unit?.roles
  const parts = useMemo(() => raciParts(model, unitRoles), [model, unitRoles])
  const shownParts = parts.filter((one) => one.responsibilities.length > 0)
  const firstGroup = shownParts[0]?.group
  const part = look.whole ? undefined : look.part ?? (unit ? undefined : firstGroup)
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(part !== undefined ? [PART(part)] : []))
  const [added, setAdded] = useState<readonly string[]>([])
  const [pick, setPick] = useState<MatrixPick | null>(null)
  const lookNow: RaciLook = { ...look, ...(part !== undefined ? { part } : {}) }
  // A column being written in stays where it is, even once its last letter has gone.
  const keeps = useMemo(() => (pick ? [...added, pick.column] : added), [added, pick])
  const grid = useMemo(() => raciGrid(model, lookNow, view, unitRoles, keeps), [model, part, look.row, look.whole, look.needs, view, unitRoles, keeps])
  const needing = useMemo(() => rowsNeeding(model), [model])
  const needingHere = unitRoles ? needing.filter((row) => model.roles.some((role) => unitRoles.includes(role.id) && role.duties.some((duty) => duty.responsibility === row.id))).length : undefined
  const pickNode = (id: string) => {
    if (id === OTHERS) { onLook({ whole: true }); return }
    if (id === ALL) { onLook({ ...(look.unit ? { unit: look.unit } : {}) }); return }
    const base = { ...(look.unit ? { unit: look.unit } : {}) }
    if (id.startsWith('part:')) { onLook({ ...base, part: id.slice(5) }); setOpened((held) => new Set(held).add(id)); return }
    const owner = parts.find((one) => one.responsibilities.some((row) => row.id === id))
    onLook({ ...base, row: id, ...(owner ? { part: owner.group } : {}) })
  }
  const selectedNode = look.row ?? (part !== undefined && !look.whole ? PART(part) : unit && !look.whole ? ALL : null)
  const title = look.needs ? t('operating.rowsNeeding', { count: needing.length }) : gridTitle(look, unit, part, t)
  const addResponsibility = () => {
    const command = newResponsibility(t('operating.newResponsibilityName'), makeId, part || undefined, model)
    dispatch(command)
    onSelect(command.responsibility.id)
  }
  const exportGrid = (whole: boolean) => {
    const wanted = whole ? raciGrid(model, { whole: true }, view, undefined, model.roles.map((role) => role.id)) : grid
    onSave?.(exportName(whole, unit, part), gridCsv(wanted, whole, model, t))
  }
  const noRoles = model.roles.length === 0
  return (
    <>
      <RaciTree
        model={model} parts={parts} unitName={unit?.name} readOnly={readOnly} selectedNode={selectedNode} onPick={pickNode} onNew={addResponsibility}
        opened={opened} onOpened={setOpened}
      />
      <div className="op-grid">
        <GridBar model={model} facts={facts} look={look} onLook={onLook} view={view} onView={onView} arranging={arranging} onArrange={onArrange} onExport={onSave ? exportGrid : undefined} />
        <GridHead title={title} grid={grid} all={model.roles.length} unit={unit} onOpenUnit={onOpenUnit} needing={needing.length} needingHere={needingHere} look={look} onLook={onLook} />
        {noRoles
          ? <p className="op-quiet">{t('operating.noRolesForMatrix')}</p>
          : grid.rows.length === 0 && model.responsibilities.length > 0
            ? <p className="op-quiet">{t(unit && view.roles.length === 0 && view.groups.length === 0 ? 'operating.unitNoPart' : 'operating.filterEmpty')}</p>
            : (
              <RaciGrid
                grid={grid} allRoles={model.roles} readOnly={readOnly} dispatch={dispatch} pick={pick} onPick={setPick}
                litRole={model.roles.some((role) => role.id === selected) ? selected : undefined}
                onOpenRole={onSelect} onOpenRow={onSelect} fullNames={!look.whole && !look.needs} unit={unit} facts={facts}
                label={title}
              />
            )}
        {grid.folded.length > 0 && (
          <div className="op-actions op-small" data-testid="operating-folded">
            <span>{t(grid.folded.length === 1 ? 'operating.noPartLineOne' : 'operating.noPartLine', {
              count: grid.folded.length,
              names: grid.folded.slice(0, 3).map((role) => role.name).join(', '),
              more: grid.folded.length > 3 ? t('operating.andMore', { count: grid.folded.length - 3 }) : '',
            })}</span>
            {!readOnly && (
              <MenuButton
                label={t('operating.addColumn')} variant="quiet" size="small"
                items={grid.folded.map((role) => ({ label: role.name, onSelect: () => setAdded((held) => [...held, role.id]) }))}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}

const gridTitle = (look: RaciLook, unit: UnitFact | undefined, part: string | undefined, t: Translate): string => {
  if (look.whole) return t('operating.wholeOrganisation')
  return unit && part === undefined ? unit.name : part || t('operating.noGroup')
}

const exportName = (whole: boolean, unit: UnitFact | undefined, part: string | undefined): string =>
  (whole ? 'raci-organisation.csv' : `raci-${(unit?.name ?? part ?? 'view').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`)

function gridCsv(grid: RaciGridData, whole: boolean, model: OperatingModel, t: Translate): string {
  return raciCsv([...grid.columns, ...(whole ? [] : grid.folded)], grid.rows, {
    group: t('operating.groupWord'), responsibility: t('operating.responsibility'), needs: t('operating.needs'), noGroup: t('operating.noGroup'), need: (count) => needWords(count, t),
  }, model.roles)
}

/** The left: find, new, and the tree of the groups, each marked by what is below it. */
function RaciTree({ model, parts, unitName, readOnly, selectedNode, onPick, onNew, opened, onOpened }: {
  model: OperatingModel; parts: readonly RaciPart[]; unitName: string | undefined; readOnly: boolean; selectedNode: string | null
  onPick(id: string): void; onNew(): void; opened: ReadonlySet<string>; onOpened(next: ReadonlySet<string>): void
}) {
  const { t } = useStrings()
  const [find, setFind] = useState('')
  const folks = find.trim().toLowerCase()
  const nodes = useMemo(() => treeNodes(model, parts, unitName, folks, t), [model, parts, unitName, folks, t])
  return (
    <div className="op-tree" data-testid="operating-tree">
      <TextInput type="search" aria-label={t('operating.findResponsibility')} placeholder={t('operating.findResponsibility')} value={find} onChange={(event) => setFind(event.target.value)} />
      {!readOnly && <div className="op-actions"><Button variant="plain" data-guide="operating.newResponsibility" onClick={onNew}>{t('operating.newResponsibility')}</Button></div>}
      <TreeList
        label={t('operating.partsLabel')} nodes={nodes} selectedId={selectedNode} onSelect={onPick} open={folks ? new Set(nodes.map((one) => one.id)) : opened} dataGuide="operating.raciTree"
        onOpen={(id, on) => { const next = new Set(opened); if (on) next.add(id); else next.delete(id); onOpened(next) }}
      />
    </div>
  )
}

function treeNodes(model: OperatingModel, parts: readonly RaciPart[], unitName: string | undefined, folks: string, t: Translate): TreeNode[] {
  const groupNode = (one: RaciPart): TreeNode | undefined => {
    const kept = folks ? one.responsibilities.filter((row) => row.name.toLowerCase().includes(folks)) : one.responsibilities
    if (kept.length === 0) return undefined
    return {
      id: PART(one.group), label: one.group || t('operating.noGroup'), strong: true, count: kept.length,
      ...(one.needing > 0 ? { note: <span className="op-need">{t('operating.needsOneA', { count: one.needing })}</span> } : {}),
      children: kept.map((row) => {
        const need = needOf(model.roles, row.id)
        return { id: row.id, label: row.name, ...(need !== undefined ? { note: <span className="op-need">{needWords(need, t)}</span> } : {}) }
      }),
    }
  }
  const groups = parts.flatMap((one) => groupNode(one) ?? [])
  if (unitName === undefined) return groups
  const noPart = raciParts(model).filter((one) => !parts.some((held) => held.group === one.group && held.responsibilities.length > 0))
  const needsThere = noPart.reduce((sum, one) => sum + one.needing, 0)
  return [
    { id: ALL, label: t('operating.allFor', { unit: unitName }), strong: true, count: parts.reduce((sum, one) => sum + one.responsibilities.length, 0) },
    ...groups,
    ...(noPart.length > 0 ? [{
      id: OTHERS, label: t('operating.groupsNoPart', { count: noPart.length }),
      ...(needsThere > 0 ? { note: <span className="op-need">{t('operating.needsOneA', { count: needsThere })}</span> } : {}),
    }] : []),
  ]
}

/** How much to show, of which unit, and what can be done with it. */
function GridBar({ model, facts, look, onLook, view, onView, arranging, onArrange, onExport }: {
  model: OperatingModel; facts: OrganisationFacts | undefined; look: RaciLook; onLook(look: RaciLook): void; view: MatrixView; onView(view: MatrixView): void
  arranging: boolean; onArrange(on: boolean): void; onExport: ((whole: boolean) => void) | undefined
}) {
  const { t } = useStrings()
  const groupOptions = groupsOf(model.responsibilities)
  return (
        <div className="op-actions">
          <Segmented
            label={t('operating.scopeLabel')} value={look.whole ? 'whole' : 'part'} data-guide="operating.raciScope"
            options={[{ value: 'part', label: t('operating.thisPart') }, { value: 'whole', label: t('operating.wholeOrganisation') }]}
            onChange={(next) => onLook(next === 'whole' ? { whole: true } : { ...(look.unit ? { unit: look.unit } : {}) })}
          />
          {facts && (
            <span className="op-rule" data-guide="operating.raciUnit">
              <span className="op-small">{t('operating.unit')}</span>
              <Select
                aria-label={t('operating.unit')} value={look.unit ?? ''}
                options={[{ value: '', label: t('operating.allUnits') }, ...facts.units.map((one) => ({ value: one.id, label: one.name }))]}
                onChange={(event) => { const { unit: _was, whole: _all, part: _part, row: _row, ...rest } = look; onLook({ ...rest, ...(event.target.value ? { unit: event.target.value } : {}) }) }}
              />
            </span>
          )}
          <FilterWords
            find="" onFind={() => {}} noFind dataGuide="operating.filterRoles"
            fields={[
              { id: 'roles', label: t('operating.filterRoles'), options: model.roles.map((role) => ({ value: role.id, label: role.name })) },
              { id: 'groups', label: t('operating.filterGroups'), options: groupOptions.map((group) => ({ value: group, label: group || t('operating.noGroup') })) },
            ]}
            filters={{ roles: view.roles, groups: view.groups }}
            onFilters={(filters) => onView({ ...view, roles: filters.roles ?? [], groups: filters.groups ?? [] })}
          />
          <Button variant="quiet" aria-pressed={arranging} data-guide="operating.arrange" onClick={() => onArrange(!arranging)}>{t('operating.arrange')}</Button>
          {onExport && (
            <MenuButton
              label={t('operating.export')} variant="plain" data-guide="operating.raciExport"
              items={[
                { label: t('operating.exportView'), onSelect: () => onExport(false) },
                { label: t('operating.exportWhole'), onSelect: () => onExport(true) },
              ]}
            />
          )}
        </div>
  )
}

/** What is up, how much of it, and what needs one A: a count that stays whole. */
function GridHead({ title, grid, all, unit, onOpenUnit, needing, needingHere, look, onLook }: {
  title: string; grid: RaciGridData; all: number; unit: UnitFact | undefined; onOpenUnit: RaciTabProps['onOpenUnit']
  needing: number; needingHere: number | undefined; look: RaciLook; onLook(look: RaciLook): void
}) {
  const { t } = useStrings()
  return (
        <div className="op-gridHead">
          <h2 data-testid="operating-grid-title">{title}</h2>
          <span className="op-small" data-testid="operating-grid-counts">{t('operating.gridCounts', { rows: grid.rows.length, roles: grid.columns.length, all })}</span>
          {unit && onOpenUnit && <button type="button" className="op-link" data-testid="operating-unit-open" onClick={() => onOpenUnit(unit)}>{t('operating.openInOrganisation')}</button>}
          <span className="op-grow" />
          <span className="op-need" data-testid="operating-needs-count">
            {needing > 0 && needingHere !== undefined && `${t('operating.needsHere', { count: needingHere })} · `}
            {needing > 0 && t(needing === 1 ? 'operating.needsInAllOne' : 'operating.needsInAll', { count: needing })}
          </span>
          {needing > 0 && (
            <Button variant="plain" size="small" aria-pressed={look.needs === true} data-testid="operating-only-needs" onClick={() => { const { needs: _was, ...rest } = look; onLook(look.needs ? rest : { ...rest, needs: true }) }}>
              {look.needs ? t('operating.showAllRows') : t('operating.showOnlyThese')}
            </Button>
          )}
        </div>
  )
}
