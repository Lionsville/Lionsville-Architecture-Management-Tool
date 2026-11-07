// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ReportsTo, RoleId, RoleSlot, UnitType } from '../../model/operatingModel'

/** A change of lines about to be written: a slot's, with the slots as they would be, or a role's own. */
export type LineChange =
  | { on: 'slot'; type: UnitType; slots: readonly RoleSlot[]; roleId: RoleId; said: readonly ReportsTo[] | undefined }
  | { on: 'role'; roleId: RoleId; said: readonly ReportsTo[] | undefined }

/** Why the lines as they would be are refused: a sentence, or nothing. */
export type RefuseLine = (change: LineChange) => string | undefined
