/**
 * What an architecture decision record IS.
 *
 * Only the shape and the vocabulary. The rules — the status machine, the
 * numbering, the MADR body, what locks a record — are `decisions/adr.ts`, which
 * is where you want to be if you are changing behaviour rather than reading a
 * field.
 *
 * The split is not tidiness: a project's decisions live on its model
 * (`model.decisions`, told apart by `applicationId`), so the model has to be
 * able to say what it holds without importing the module that decides what may
 * happen to one.
 */
export type AdrStatus = 'proposed' | 'reviewing' | 'accepted' | 'rejected' | 'superseded'

/** In workflow order, which is also the order a status picker shows them in. */
export const ADR_STATUSES: readonly AdrStatus[] = ['proposed', 'reviewing', 'accepted', 'rejected', 'superseded']

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
   * Which application this decision belongs to. Absent on a project record
   * means the landscape level; a group's records never carry it.
   */
  applicationId?: string
  /** Set with the `superseded` status: the record that replaced this one. */
  supersededBy?: string
  signers: AdrSigner[]
}
