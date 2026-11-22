// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the open source cannot keep yet, for a field drawn deep in a page
 * (`platform/sourceProvider.ts`'s `SourceCannotKeep`; ADR-0022, amended 22
 * November 2026).
 *
 * Handed down once by the shell, as the session's memory is, so no page
 * between has to carry it and no form has to know there is a source at all:
 * the field asks about its own part, and draws the source's sentence in place
 * of its control where the part is not kept. Where nothing provides one — a
 * test, a page drawn on its own, every source that keeps all of it — every
 * part is kept.
 *
 * A part is a string here and one of a list where the seam is declared: this
 * module knows no record.
 */
import { createContext, useContext } from 'react'

/** The key of the sentence that says why the open source cannot keep a part, or nothing where it keeps it. */
export type Unkept = (part: string) => string | undefined

export const UnkeptContext = createContext<Unkept | undefined>(undefined)

/** Why the open source cannot keep this part, as the key of its sentence; nothing where it can. */
export function useUnkept(part: string): string | undefined {
  return useContext(UnkeptContext)?.(part)
}
