// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the interchange.
 *
 * The organisation carried out as one parcel and brought in again
 * (ADR-0031 §2). Apart from the format, because it reaches the working
 * file's codec.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { bringIn, carryScopes, open } from '../../adapters/folder/format/interchange'
