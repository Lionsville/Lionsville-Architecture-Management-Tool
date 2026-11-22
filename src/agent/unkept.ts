// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An argument that names a part of a record the source cannot keep yet
 * (`platform/sourceProvider.ts`'s `SourceCannotKeep`; ADR-0022, amended 22
 * November 2026): refused with the source's own sentence, before anything is
 * written or read — a person is not offered the field, and an agent can do
 * what a person can (ADR-0011).
 *
 * The sentence arrives said, in English as every refusal's detail is to an
 * agent: whoever lends the agent its view of the scope reads the source's key
 * from the registry, which nothing here may load.
 */
import type { UnkeptPart } from '../platform/sourceProvider'
import { refused } from './tools'
import type { AgentAnswer } from './tools'

/** The source's word about a part, as a view of the scope carries it: its sentence, or nothing where the part is kept. */
export type UnkeptSaid = { readonly unkept?: ((part: UnkeptPart) => string | undefined) | undefined }

/** The refusal for an argument that names this part, or nothing where the source keeps it. */
export function notKept(view: UnkeptSaid, part: UnkeptPart, argument: string): AgentAnswer | undefined {
  const why = view.unkept?.(part)
  return why === undefined ? undefined : refused('agent.notKeptHere', `"${argument}": ${why}`)
}
