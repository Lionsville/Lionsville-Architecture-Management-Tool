// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One unit type's card on the structure (ADR-0036, amended 11 October 2026):
 * its name, where it came from, what is said under the name — the units it
 * has today, its application limit, its last day — and its role slots, each
 * with its count and a mark for a managing role.
 *
 * Drawn the same on the page and over a library: what differs is handed in.
 * The page passes `onPick` and `onPickRole`, so the name and the slots are
 * buttons that pick; a library's dialog passes a tick box as `head`, draws a
 * type that comes along `dashed`, and says what it will say under the slots
 * as `children`.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { slotRange } from '../../model/operatingModel'
import type { Role, RoleId, RoleSlot, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { Look } from './structurePick'

export type TypeCardProps = {
  type: UnitType
  /** The roles its slots name, by id; a slot naming one not there shows the id. */
  roles: ReadonlyMap<RoleId, Pick<Role, 'id' | 'name' | 'manages' | 'until'>>
  /** How it stands to what is picked on the structure; plain where absent. */
  look?: Look
  /** Where it came from, beside the name: a library's name, or the organisation's own. */
  source?: string
  /** What is said under the name, joined by a dot: the units it has today, its limit, its last day. */
  meta?: readonly string[]
  /** Read aloud and not drawn: where it may sit, which the lines say to the eye. */
  place?: string
  /** Pressing the name picks the type. Absent, the name is only words. */
  onPick?: () => void
  /** Drawn instead of the name: a library dialog's tick box, which names the type itself. */
  head?: ReactNode
  /** Pressing a slot picks its role. Absent, the slots are only words. */
  onPickRole?: (id: RoleId) => void
  /** How a slot's role stands to what is picked. */
  roleLook?: (id: RoleId) => Look
  /** Said where it holds no role; the page's words where absent. */
  noSlots?: string
  /** Drawn with a dashed edge: a type that comes along with another. */
  dashed?: boolean
  /** Under the slots: a purpose, a note. */
  children?: ReactNode
  /** The stable name the page's own cards carry (`platform/controlNames`). */
  named?: 'operating.typeCard'
}

/** The ring a look draws: the pick's own colour, the lit one, or none. */
export function ringOf(look: Look | undefined): string | undefined {
  return look === 'picked' ? 'warning.main' : look === 'lit' ? 'primary.main' : undefined
}

const VISUALLY_HIDDEN = {
  position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const

export function TypeCard(props: TypeCardProps) {
  const { type, look = 'plain', source, meta = [], place, onPick, head, dashed = false, children, named } = props
  const { t } = useStrings()
  const ring = ringOf(look)
  return (
    <Box
      data-testid={`unit-type-${type.id}`} data-look={look} data-guide={named}
      sx={{
        border: 1, borderStyle: dashed ? 'dashed' : 'solid', borderColor: ring ?? 'divider', borderRadius: 1.5, p: 1,
        bgcolor: 'background.paper', boxShadow: ring ? (theme) => `0 0 0 1px ${look === 'picked' ? theme.palette.warning.main : theme.palette.primary.main}` : 'none',
        // Out of the pick: there to be found, not read (`app/theme.contrast.test.ts`).
        opacity: look === 'dim' ? 0.45 : 1, transition: 'opacity 150ms', '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 0.75 }}>
        {head ?? (onPick
          ? (
            <ButtonBase onClick={onPick} aria-pressed={look === 'picked'} sx={{ borderRadius: 0.5, textAlign: 'left' }}>
              <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>{type.name}</Typography>
            </ButtonBase>
          )
          : <Typography component="span" sx={{ fontWeight: 700, fontSize: 13 }}>{type.name}</Typography>)}
        {source && <Badge filled>{source}</Badge>}
        {type.spans && <Badge>{t('operating.spansBadge')}</Badge>}
      </Box>
      {meta.length > 0 && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>{meta.join(' · ')}</Typography>}
      {place && <Box component="span" sx={VISUALLY_HIDDEN}>{place}</Box>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
        {type.slots.length === 0 && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{props.noSlots ?? t('operating.noSlots')}</Typography>}
        {type.slots.map((slot, index) => <SlotChip key={`${slot.role}-${index}`} slot={slot} {...props} />)}
      </Box>
      {children}
    </Box>
  )
}

function Badge({ filled = false, children }: { filled?: boolean; children: string }) {
  return (
    <Box component="span" sx={{
      fontSize: 10, lineHeight: '15px', px: 0.5, borderRadius: 0.5, whiteSpace: 'nowrap', color: 'text.secondary',
      border: 1, borderColor: filled ? 'transparent' : 'divider', bgcolor: filled ? 'background.default' : 'transparent',
    }}>
      {children}
    </Box>
  )
}

/** One slot: the role, a mark where it manages, how many, and its last day where it has one. */
function SlotChip({ slot, roles, onPickRole, roleLook }: { slot: RoleSlot } & Pick<TypeCardProps, 'roles' | 'onPickRole' | 'roleLook'>) {
  const { t } = useStrings()
  const role = roles.get(slot.role)
  const look = roleLook?.(slot.role) ?? 'plain'
  const ring = ringOf(look)
  const words = (
    <>
      {role?.name ?? slot.role}
      {role?.manages && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'primary.main' }}>{t('operating.managesBadge')}</Box>}
      <Box component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>{slotRange(slot)}</Box>
      {role?.until && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'text.secondary' }}>{t('operating.untilLine', { day: role.until })}</Box>}
    </>
  )
  const sx = {
    display: 'inline-flex', alignItems: 'baseline', fontSize: 11, lineHeight: '18px', px: 0.75, borderRadius: 1, border: 1,
    borderColor: ring ?? 'divider', bgcolor: 'background.paper', color: 'text.primary',
  } as const
  return onPickRole
    ? <ButtonBase onClick={() => onPickRole(slot.role)} aria-pressed={look === 'picked'} data-testid={`role-${slot.role}`} data-look={look} sx={sx}>{words}</ButtonBase>
    : <Box component="span" data-testid={`role-${slot.role}`} data-look={look} sx={sx}>{words}</Box>
}
