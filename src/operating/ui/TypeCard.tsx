// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One unit type's card on the structure (ADR-0036, amended 11 October 2026): its
 * name, how many units it has today, and its roles, one line each, with the word
 * *manages* where a role does. Where a type came from is said once, in its reader.
 *
 * Drawn the same on the page and over a library: what differs is handed in. The
 * page passes `onPick` and `onPickRole`, so the name and the role lines are
 * buttons that pick, and marks a type a library just brought in `fresh`; a
 * library's dialog passes a tick box as `head`, draws a type and the roles that
 * come along `dashed`, makes each role a button that folds out what it answers
 * for (`roleExpanded`), and says what it will say under the roles as `children`.
 */
import type { ReactNode } from 'react'
import { slotRange } from '../../model/operatingModel'
import type { Role, RoleId, RoleSlot, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import '../../widgets/kit/hidden.css'
import type { Look } from './structurePick'
import './Operating.css'

export type TypeCardProps = {
  type: UnitType
  /** The roles its slots name, by id; a slot naming one not there shows the id. */
  roles: ReadonlyMap<RoleId, Pick<Role, 'id' | 'name' | 'manages' | 'until'>>
  look?: Look
  /** The count, first under the name: *14 units*. Beside a long name it dropped to a line of its own, beside a short one it did not. */
  count?: string
  /** What is said under the name, joined by a dot: its limit, its last day. */
  meta?: readonly string[]
  /** Read aloud and not drawn: where it may sit, which the lines say to the eye. */
  place?: string
  onPick?: () => void
  /** Drawn instead of the name: a library dialog's tick box, which names the type itself. */
  head?: ReactNode
  onPickRole?: (id: RoleId) => void
  roleLook?: (id: RoleId) => Look
  /** Said where it holds no role; the page's words where absent. */
  noSlots?: string
  dashed?: boolean
  roleDashed?: (id: RoleId) => boolean
  /** Whether what a slot's role answers for is folded out under the card. Given, pressing a slot folds it rather than picking the role. */
  roleExpanded?: (id: RoleId) => boolean
  fresh?: boolean
  /** The range shown beside each role, where a library's dialog wants it. */
  showRange?: boolean
  children?: ReactNode
  /** The stable name the page's own cards carry (`platform/controlNames`). */
  named?: 'operating.typeCard'
}

export function TypeCard(props: TypeCardProps) {
  const { type, look = 'plain', count, meta = [], place, onPick, head, dashed = false, fresh = false, children, named } = props
  const { t } = useStrings()
  return (
    <div
      className="op-card" data-testid={`unit-type-${type.id}`} data-look={look} data-guide={named} data-fresh={fresh || undefined} data-dashed={dashed || undefined}
    >
      <div className="op-card__head">
        {head ?? (onPick
          ? <button type="button" className="op-card__name" onClick={onPick} aria-pressed={look === 'picked'}>{type.name}</button>
          : <span className="op-card__name">{type.name}</span>)}
        {type.spans && <span className="op-badge">{t('operating.spansBadge')}</span>}
        {fresh && <span className="op-badge" data-fresh="">{t('operating.newBadge')}</span>}
      </div>
      {(count || meta.length > 0) && <div className="op-card__meta">{[...(count ? [count] : []), ...meta].join(' · ')}</div>}
      {place && <span className="kit-hidden">{place}</span>}
      <div className="op-card__slots">
        {type.slots.length === 0 && <span className="op-small">{props.noSlots ?? t('operating.noSlots')}</span>}
        {type.slots.map((slot, index) => <SlotLine key={`${slot.role}-${index}`} slot={slot} {...props} />)}
      </div>
      {children}
    </div>
  )
}

/** A word beside a name: what it is, or that it is new. */
export function Badge({ children }: { children: string }) {
  return <span className="op-badge">{children}</span>
}

/** One role of the card: its name, and the word where it manages or ends. */
function SlotLine({ slot, roles, onPickRole, roleLook, roleDashed, roleExpanded, showRange }: { slot: RoleSlot } & Pick<
  TypeCardProps, 'roles' | 'onPickRole' | 'roleLook' | 'roleDashed' | 'roleExpanded' | 'showRange'
>) {
  const { t } = useStrings()
  const role = roles.get(slot.role)
  const look = roleLook?.(slot.role) ?? 'plain'
  const dashed = roleDashed?.(slot.role) === true
  const words = (
    <>
      <span className="op-slot__name">{role?.name ?? slot.role}</span>
      {showRange && <span className="op-slot__word">{slotRange(slot)}</span>}
      {role?.manages && <span className="op-slot__word">{t('operating.managesBadge')}</span>}
      {role?.until && <span className="op-slot__word">{t('operating.untilLine', { day: role.until })}</span>}
    </>
  )
  const marks = { 'data-testid': `role-${slot.role}`, 'data-look': look, 'data-dashed': dashed || undefined }
  if (!onPickRole) return <span className="op-slot" {...marks}>{words}</span>
  // A slot that folds out what its role answers for says so, rather than that it is picked.
  const state = roleExpanded ? { 'aria-expanded': roleExpanded(slot.role) } : { 'aria-pressed': look === 'picked' }
  return <button type="button" className="op-slot" onClick={() => onPickRole(slot.role)} {...state} {...marks}>{words}</button>
}
