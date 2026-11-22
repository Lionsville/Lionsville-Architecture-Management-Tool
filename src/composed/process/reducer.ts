// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the one writer.
 *
 * The reducer and the table of commands it looks a change up in: what a
 * change does, what it writes, and what it is refused with.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export type { CommandRefusal, CommandType, WriteKey } from '../../model/commands/handler'
export { COMMAND_TABLE } from '../../model/commands/table'
export { apply, applyGuarded, writesOf } from '../../model/reducer'
