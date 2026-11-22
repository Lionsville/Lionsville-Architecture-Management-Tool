// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the format's number.
 *
 * The number the folder's format is at, and what a scope's header file is
 * called. Apart from the format, because a process that only says which
 * format it speaks must not load the code that reads one.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { SCOPE_FILE, SCOPE_FORMAT_VERSION } from '../../adapters/folder/format/scopeHeader'
