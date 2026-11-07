// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The stakeholder rail (ADR-0036, amended 12 October 2026): the parties' tree,
 * then *Units on this sheet* with why each is there, then, where *All units* is
 * on, the rest of the scope's units, and the switch last, saying how many it would
 * add. A unit is made on the organisation chart, not here, so no *+* offers one.
 *
 * A row with something under it is a heading, read off the next row's depth
 * rather than stored. *Outside* is said once on the group; a row says it only
 * where it differs from its group.
 */
import { Fragment } from 'react'
import type { ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { Button } from '../../widgets/kit/Button'
import type { CSSProperties } from 'react'
import type { SheetActor } from '../sheet'
import type { Author } from './SheetAuthor'
import type { RailUnits } from './useRail'

function Row({ row, heading, group, selected, onSelect, why, t, saysOutside }: {
  row: SheetActor
  heading?: boolean
  group: string
  selected: boolean
  onSelect(id: ElementId): void
  why?: string
  t: Translate
  saysOutside: boolean
}) {
  return (
    <button
      type="button" className="sheet-rail__row" data-testid={`sheet-actor-${row.element.id}`} data-element-id={row.element.id}
      data-rail-group={group} data-heading={heading || undefined} data-other={group === 'other' || undefined} data-selected={selected || undefined}
      style={{ '--sheet-depth': row.depth } as CSSProperties} onClick={() => onSelect(row.element.id)}
    >
      {row.element.name}{saysOutside && ` ${t('sheet.outsideWord')}`}
      {why && <span className="sheet-rail__why">{why}</span>}
    </button>
  )
}

function Parties({ rows, selectedId, onSelect, author, t }: {
  rows: readonly SheetActor[]
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  return rows.map((row, index) => {
    const heading = (rows[index + 1]?.depth ?? 0) > row.depth
    const group = row.depth === 0 ? row : [...rows.slice(0, index)].reverse().find((r) => r.depth === 0) ?? row
    const endsGroup = row.depth > 0 && (rows[index + 1]?.depth ?? 0) === 0
    return (
      <Fragment key={row.element.id}>
        <Row
          row={row} heading={heading} group="parties" selected={selectedId === row.element.id} onSelect={onSelect} t={t}
          saysOutside={row.outside && (row === group || !group.outside)}
        />
        {author && endsGroup && (
          <span data-sheet-add>
            <Button
              variant="quiet" size="small" aria-label={t('sheet.addStakeholderTo', { name: group.element.name })}
              onClick={() => author.made(author.actions.addElement({ kind: 'actor', name: t('sheet.nameStakeholder'), parentId: group.element.id }))}
            >{t('sheet.addStakeholder')}</Button>
          </span>
        )}
      </Fragment>
    )
  })
}

/** Why a unit is among *Units on this sheet*: the first thing it answers for here, else its lane. */
function whyDrawn(uses: NonNullable<SheetActor['uses']>, t: Translate): string | undefined {
  const [first, ...more] = uses.responsibleFor
  if (first) {
    return more.length === 0
      ? t('sheet.unitResponsible', { name: first.name })
      : t('sheet.unitResponsibleMore', { name: first.name, count: more.length })
  }
  return uses.lane ? t('sheet.unitLane') : undefined
}

function Units({ group, heading, rows, selectedId, onSelect, t }: {
  group: 'used' | 'other'
  heading: string
  rows: readonly SheetActor[]
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  t: Translate
}) {
  if (rows.length === 0) return null
  return (
    <div data-testid={`sheet-rail-${group}`}>
      <div className="sheet-rail__heading">{heading}</div>
      {rows.map((row) => (
        <Row
          key={row.element.id} row={row} group={group} selected={selectedId === row.element.id} onSelect={onSelect} t={t}
          saysOutside={row.outside} {...(row.uses ? { why: whyDrawn(row.uses, t) } : {})}
        />
      ))}
    </div>
  )
}

export function SheetRail({ actors, width, selectedId, onSelect, author, units, t }: {
  actors: readonly SheetActor[]
  width: number
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  author: Author | undefined
  /** Absent from a picture of the page. */
  units?: RailUnits
  t: Translate
}) {
  const parties = actors.filter((row) => row.group === 'parties')
  return (
    <div className="sheet-rail" data-testid="sheet-rail" style={{ width }}>
      <div className="sheet-rail__heading"><span>{t('sheet.stakeholders')}</span></div>
      {parties.length === 0 && <div className="sheet-rail__note">{t('sheet.noStakeholders')}</div>}
      <Parties rows={parties} selectedId={selectedId} onSelect={onSelect} author={author} t={t} />
      {author && (
        <div className="sheet-rail__foot" data-sheet-add>
          <Button
            variant="quiet" size="small" title={t('sheet.addGroupHint')} aria-label={t('sheet.addGroupHint')}
            onClick={() => author.made(author.actions.addElement({ kind: 'actor', name: t('sheet.nameGroup') }))}
          >{t('sheet.addGroup')}</Button>
        </div>
      )}
      <Units group="used" heading={t('sheet.unitsHere')} rows={actors.filter((row) => row.group === 'used')} selectedId={selectedId} onSelect={onSelect} t={t} />
      <Units group="other" heading={t('sheet.unitsOther')} rows={actors.filter((row) => row.group === 'other')} selectedId={selectedId} onSelect={onSelect} t={t} />
      {units && (units.notDrawn > 0 || units.all) && (
        <div className="sheet-rail__foot">
          {!units.all && (
            <span className="sheet-rail__note" data-testid="sheet-units-not-drawn">
              {plural(t, { one: 'sheet.unitsNotDrawnOne', other: 'sheet.unitsNotDrawnOther' }, units.notDrawn)}
            </span>
          )}
          <span data-guide="sheet.allUnits" data-testid="sheet-all-units">
            <Button variant="plain" size="small" role="switch" aria-checked={units.all} onClick={() => units.onAll(!units.all)}>{t('sheet.allUnits')}</Button>
          </span>
        </div>
      )}
    </div>
  )
}
