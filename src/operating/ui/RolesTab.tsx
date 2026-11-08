// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who does what: every role as one line, where it is held, its line manager and
 * its part, read in a large preview on selecting it. The two owner rules live here,
 * since they name roles, and say what an unset rule costs.
 */
import { useMemo, useState } from 'react'
import { linesSaid, OPERATING_RULE_KINDS, typesHolding } from '../../model/operatingModel'
import type { OperatingRuleKind, Role } from '../../model/operatingModel'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Select } from '../../widgets/kit/Field'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import type { ListColumn } from '../../widgets/kit/List'
import { useDensity } from '../../widgets/kit/density'
import { listed } from '../../widgets/kit/listView'
import { FRESH_VIEW } from '../../widgets/kit/listView'
import type { ListView } from '../../widgets/kit/listView'
import { Preview } from '../../widgets/kit/Preview'
import { newRole, setRule } from '../edit'
import type { OperatingModel } from '../edit'
import type { ReaderParts } from './ReaderParts'
import { partWords, roleNamed } from './reading'
import { RoleReader } from './RoleReader'

const RULE_WORDS = {
  applicationOwner: ['operating.rule.applicationOwner', 'operating.rule.applicationOwnerAfter', 'operating.rule.applicationOwnerUnset'],
  domainOwner: ['operating.rule.domainOwner', 'operating.rule.domainOwnerAfter', 'operating.rule.domainOwnerUnset'],
} as const satisfies Record<OperatingRuleKind, readonly [string, string, string]>

/** Who owns what follows a role: the role in a sentence, and what follows while it is unset. */
export function OwnerRules({ model, readOnly, dispatch }: { model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const NONE = ''
  return (
    <div className="op-rules" data-guide="operating.rules">
      {OPERATING_RULE_KINDS.map((kind) => {
        const [before, after, unset] = RULE_WORDS[kind]
        const role = model.operatingRules.find((rule) => rule.id === kind)?.role ?? NONE
        return (
          <div className="op-rule" key={kind} data-testid={`operating-rule-${kind}`}>
            <span>{t(before)}</span>
            {readOnly
              ? <strong>{role ? roleNamed(model.roles, role) : t('operating.rule.none')}</strong>
              : (
                <Select
                  aria-label={t(before)} value={role}
                  options={[{ value: NONE, label: t('operating.rule.none') }, ...model.roles.map((one) => ({ value: one.id, label: one.name }))]}
                  onChange={(value) => {
                    const next = setRule(model.operatingRules, kind, value === NONE ? undefined : value)
                    if (next) dispatch(next)
                  }}
                />
              )}
            <span>{t(after)}</span>
            {!role && <span className="op-small">{t(unset)}</span>}
          </div>
        )
      })}
    </div>
  )
}

const lineOf = (role: Role, roles: readonly Role[], t: Translate) => {
  const lines = linesSaid(role.reportsTo)
  const solid = lines.find((one) => one.kind === 'solid')
  const dotted = lines.find((one) => one.kind === 'dotted')
  const main = solid?.role === undefined ? t('operating.byNesting') : t('operating.toRole', { role: roleNamed(roles, solid.role) })
  return dotted?.role === undefined ? main : t('operating.andFunctional', { main, role: roleNamed(roles, dotted.role) })
}

export function RolesTab({ parts, makeId, selected, onSelect, onNew }: {
  parts: ReaderParts; makeId: MakeId; selected: string | undefined; onSelect(id: string | undefined): void; onNew(id: string): void
}) {
  const { t, language } = useStrings()
  const { model, readOnly, dispatch } = parts
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [density, setDensity] = useDensity()
  const columnsAll: readonly ListColumn[] = useMemo(() => [
    { id: 'held', label: t('operating.heldIn'), sortable: true },
    { id: 'line', label: t('operating.lineSolid'), sortable: true },
    { id: 'part', label: t('operating.part'), sortable: true, width: '10em' },
  ], [t])
  const heldIn = (role: Role) => typesHolding(model.unitTypes, role.id).map((type) => type.name).join(', ') || t('operating.inNoType')
  const part = (role: Role) => partWords(role.duties) || t('operating.noPartYet')
  const rows = useMemo(() => listed(model.roles, view, {
    words: (role) => [role.name, role.short ?? '', heldIn(role), lineOf(role, model.roles, t)],
    filterBy: { part: (role) => (role.duties.length ? 'has' : 'none'), held: (role) => (typesHolding(model.unitTypes, role.id).length ? 'held' : 'nowhere') },
    sortBy: { item: (role) => role.name, held: heldIn, line: (role) => lineOf(role, model.roles, t), part: (role) => role.duties.length },
    language,
  }), [model, view, language, t])
  const ids = rows.flatMap((group) => group.rows.map((role) => role.id))
  const shownColumns = view.columns ?? columnsAll.map((one) => one.id)
  const open = model.roles.find((role) => role.id === selected)
  return (
    <>
      <FilterWords
        find={view.find} onFind={(find) => setView({ ...view, find })} findLabel={t('operating.findRole')}
        fields={[
          { id: 'part', label: t('operating.part'), options: [{ value: 'has', label: t('operating.hasPart') }, { value: 'none', label: t('operating.noPartYet') }] },
          { id: 'held', label: t('operating.heldIn'), options: [{ value: 'held', label: t('operating.inSomeType') }, { value: 'nowhere', label: t('operating.inNoType') }] },
        ]}
        filters={view.filters} onFilters={(filters) => setView({ ...view, filters })}
        columns={columnsAll.map(({ id, label }) => ({ id, label }))} shownColumns={shownColumns} onColumns={(columns) => setView({ ...view, columns })}
        density={density} onDensity={setDensity} onReset={() => setView(FRESH_VIEW)}
        shown={{ count: ids.length, total: model.roles.length }}
        actions={!readOnly && (
          <Button variant="plain" data-guide="operating.newRole" onClick={() => {
            const command = newRole(t('operating.newRoleName'), makeId, model)
            dispatch(command)
            onNew(command.role.id)
          }}>{t('operating.newRole')}</Button>
        )}
      />
      <OwnerRules model={model} readOnly={readOnly} dispatch={dispatch} />
      <List
        label={t('operating.roles')} density={density} dataGuide="operating.roleList" itemLabel={t('operating.role')} itemSortable
        columns={columnsAll.filter((one) => shownColumns.includes(one.id))} sort={view.sort}
        onSort={(sort) => setView({ ...view, sort })} selectedId={selected ?? null} onOpen={onSelect}
        groups={rows.map((group) => ({
          id: group.id, label: group.label,
          rows: group.rows.map((role) => ({ id: role.id, text: role.name, cells: { held: heldIn(role), line: lineOf(role, model.roles, t), part: part(role) } })),
        }))}
        empty={<p className="op-quiet">{t('operating.noRolesFound')}</p>}
      />
      <Preview ids={ids} currentId={open ? open.id : null} onSelect={(id) => onSelect(id ?? undefined)} title={open?.name ?? ''} listWord={t('operating.rolesWord')} dataGuide="operating.rolePreview">
        {open && <RoleReader role={open} parts={parts} />}
      </Preview>
    </>
  )
}
