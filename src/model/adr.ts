// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an architecture decision record IS.
 *
 * Only the shape and the vocabulary. The rules — the status machine, the
 * numbering, the MADR body, what locks a record — are `decisions/adr.ts`, which
 * is where you want to be if you are changing behaviour rather than reading a
 * field.
 *
 * The split is not tidiness: a scope's decisions live on its model
 * (`model.decisions`, told apart by `subjectId`), so the model has to be
 * able to say what it holds without importing the module that decides what may
 * happen to one.
 *
 * Two rules are here all the same, beside the lock: the move table and the
 * half of the gate that reads fields rather than text (ADR-0008, amended 28
 * September 2026). Written once, here, where anything that reads a model can
 * ask them, and re-exported from `decisions/`, where the page and the agent
 * do. The one writer does not: a log of steps replayed through it must arrive
 * where it arrived, whatever the rules said the day each step was written.
 */
export type AdrStatus = 'proposed' | 'reviewing' | 'accepted' | 'rejected' | 'superseded'

/** In workflow order, which is also the order a status picker shows them in. */
export const ADR_STATUSES: readonly AdrStatus[] = ['proposed', 'reviewing', 'accepted', 'rejected', 'superseded']

/**
 * Accepted, rejected and superseded records are history: title, body and
 * signers stay as they were. Vocabulary rather than a rule — which is why it
 * is here and not in `decisions/`: a restore (ADR-0008) has to refuse a locked
 * record from inside the model, where the rules are out of reach.
 */
export function isAdrLocked(adr: { status: AdrStatus }): boolean {
  return adr.status === 'accepted' || adr.status === 'rejected' || adr.status === 'superseded'
}

export type AdrVerdict = 'approved' | 'rejected'

/** One person the decision was put to. */
export type AdrSigner = {
  name: string
  role?: string
  verdict?: AdrVerdict
  /** The day of the verdict, `yyyy-mm-dd`. Absent until there is one. */
  signedAt?: string
}

export type Adr = {
  /** Stable, never shown. The number is what people call it. */
  id: string
  /** Sequential within its list; `ADR-0007` on screen. Never reused. */
  number: number
  title: string
  status: AdrStatus
  /** The day of the last status change, `yyyy-mm-dd`. */
  date: string
  /** The MADR body, markdown. Title, status, date and signers are fields, not text. */
  body: string
  /**
   * What this decision is ABOUT: any element the scope knows — an application,
   * a capability, a journey step — or, absent, the scope itself (ADR-0012 §7).
   *
   * It was `applicationId` while an application was the only thing a record
   * could be about and a group's records were a list of their own. The three
   * lists are one list now, and the field says what it always meant: which
   * subject. `projects/adrFile.ts` still READS the old spelling, and format 6
   * drops that alias.
   */
  subjectId?: string
  /** Set with the `superseded` status: the record that replaced this one. */
  supersededBy?: string
  /**
   * The accepted records this one replaces, named while it is written
   * (ADR-0008, amended 28 September 2026). The two ends of a supersession are
   * written together: accepting this record moves each of these to
   * `superseded` with {@link Adr.supersededBy} pointing here, in the same
   * step, and rejecting it leaves them accepted. Editable while the record is
   * proposed or under review, like the rest of its text.
   */
  supersedes?: string[]
  /**
   * Who proposed it, as free text — there are no accounts in the core. Read
   * only to say so when the one approving signer is the same name: accepting
   * your own proposal is allowed, and worth a second look.
   */
  proposedBy?: string
  /**
   * Why it was rejected or withdrawn. Required for a withdrawal, and for a
   * rejection that no signer's verdict explains; a record that ends without a
   * reason is a closed door nobody can read.
   */
  reason?: string
  signers: AdrSigner[]
}

// --- the moves a record has ---------------------------------------------------------

/**
 * Where a record may go from here.
 *
 * Here beside {@link isAdrLocked}, and asked by the page and the agent through
 * `decisions/` (ADR-0008) — not by the writer. A proposal can be withdrawn — it keeps
 * its number and ends rejected, with a reason — or sent for review; review can
 * go back to proposal; only acceptance leads anywhere after the end, and only
 * to superseded. A rejected decision is not superseded: it was never in force.
 */
export function adrMovesFrom(status: AdrStatus): readonly AdrStatus[] {
  switch (status) {
    case 'proposed': return ['reviewing', 'rejected']
    case 'reviewing': return ['accepted', 'rejected', 'proposed']
    case 'accepted': return ['superseded']
    case 'rejected':
    case 'superseded':
      return []
  }
}

/**
 * The lines of a decision gate that are fields rather than text. The body's
 * lines — context, options, outcome, consequences — need the template's words
 * in every language, which are the decisions module's; `decisions/adr.ts`
 * adds them in front of these, and `adrGate` there is the whole gate.
 */
export type AdrFieldItem = 'approved' | 'predecessors' | 'reason' | 'rejection' | 'successor'

/**
 * What a move needs of the record's fields, one line each, `ok` or not.
 *
 * `adr` is the record with what the move brings already on it — the reason,
 * the successor — and its status still the one it is leaving; `list` is the
 * records it sits among, which is where a successor and the records it
 * supersedes are found.
 *
 * - **accepted**: a signer approved and none rejected; and every record it
 *   names in `supersedes` is itself accepted, so accepting it can supersede
 *   them.
 * - **rejected**: from proposal it is a withdrawal, and wants a reason; from
 *   review a rejecting signer is reason enough, or a written one.
 * - **superseded**: the successor is another record in the list, and accepted.
 *   A proposal cannot replace a decision in force: were it then rejected,
 *   nothing accepted would be left and both would be locked.
 */
export function adrFieldItems(
  adr: Adr, to: AdrStatus, list: readonly Adr[],
): { item: AdrFieldItem; ok: boolean }[] {
  const find = (id: string) => list.find((one) => one.id === id)
  switch (to) {
    case 'accepted': {
      const items: { item: AdrFieldItem; ok: boolean }[] = [{
        item: 'approved',
        ok: adr.signers.some((one) => one.verdict === 'approved') && !adr.signers.some((one) => one.verdict === 'rejected'),
      }]
      if (adr.supersedes?.length) {
        items.push({
          item: 'predecessors',
          ok: adr.supersedes.every((id) => id !== adr.id && find(id)?.status === 'accepted'),
        })
      }
      return items
    }
    case 'rejected': {
      const reasoned = Boolean(adr.reason?.trim())
      if (adr.status === 'proposed') return [{ item: 'reason', ok: reasoned }]
      return [{ item: 'rejection', ok: reasoned || adr.signers.some((one) => one.verdict === 'rejected') }]
    }
    case 'superseded': {
      const successor = adr.supersededBy === undefined ? undefined : find(adr.supersededBy)
      return [{ item: 'successor', ok: successor !== undefined && successor.id !== adr.id && successor.status === 'accepted' }]
    }
    default:
      return []
  }
}
