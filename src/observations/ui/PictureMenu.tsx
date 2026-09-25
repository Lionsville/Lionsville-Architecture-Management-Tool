// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The right-click on the two pictures. A picture says what was pressed — a
 * node by its key, or a line by the link it draws — and where; the page says
 * what can be done with it, in the words its readers already use, and this
 * draws that list at the pointer.
 *
 * The picture decides nothing. That keeps the actions in one place (the page,
 * beside the readers' own handlers) so the menu and the reader cannot offer
 * two different sets for the same record.
 */
import Divider from '@mui/material/Divider'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { CauseStrength } from '../observation'

/** What a right-click landed on. */
export type PictureTarget =
  /** A node, by the key the page selects it with. */
  | { kind: 'node'; key: string }
  /** A line from what is explained to the cause that explains it. */
  | { kind: 'explains'; causeId: string; id: string; scope?: string; strength: CauseStrength }
  /** A line from a cause to the solution that addresses it. */
  | { kind: 'addresses'; solutionId: string; causeId: string; strength: CauseStrength }
  /** A line between a solution and an experiment that tests it: into the experiment, or on from a confirmed one. */
  | { kind: 'tests'; experimentId: string; solutionId: string; strength: CauseStrength }

export type PictureMenuHandler = (target: PictureTarget, at: { x: number; y: number }) => void

export type MenuAction = {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  /** A choice among several, with this one the current. */
  checked?: boolean
  danger?: boolean
  /** A rule above this line. */
  divider?: boolean
}

export type PictureMenuProps = {
  at?: { x: number; y: number }
  actions: readonly MenuAction[]
  onClose: () => void
}

export function PictureMenu({ at, actions, onClose }: PictureMenuProps) {
  const open = at !== undefined && actions.length > 0
  const anyChecked = actions.some((one) => one.checked !== undefined)
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={at ? { top: at.y, left: at.x } : undefined}
      slotProps={{ list: { dense: true, 'data-testid': 'picture-menu' } as object }}
    >
      {actions.flatMap((one) => [
        ...(one.divider ? [<Divider key={`${one.key}-rule`} />] : []),
        <MenuItem
          key={one.key}
          disabled={one.disabled}
          onClick={() => { onClose(); one.onClick() }}
          data-testid={`picture-menu-${one.key}`}
          sx={one.danger ? { color: 'error.main' } : undefined}
        >
          {anyChecked && <ListItemIcon sx={{ fontSize: 14 }}>{one.checked ? '✓' : ''}</ListItemIcon>}
          <ListItemText>{one.label}</ListItemText>
        </MenuItem>,
      ])}
    </Menu>
  )
}
