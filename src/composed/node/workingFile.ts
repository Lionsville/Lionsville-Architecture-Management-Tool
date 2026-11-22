// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with a node under it: the working file.
 *
 * The working file written from and read into repositories, for a process
 * with no screen.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { readWorkingFile, writeWorkingFile } from '../../platform/node/workingFile'
