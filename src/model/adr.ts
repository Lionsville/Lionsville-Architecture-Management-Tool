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
  signers: AdrSigner[]
}
