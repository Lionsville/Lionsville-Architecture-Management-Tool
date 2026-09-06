/**
 * One decision record, as one markdown file.
 *
 * A decision is prose about why something is the way it is, and prose belongs
 * in a file a person can read in a pull request, on a wiki, or in a text editor
 * on a machine that has never heard of this tool. The fields that are *not*
 * prose — the number, the status, the date, who signed — sit above it as front
 * matter, which is the convention every static site and every ADR tool already
 * reads.
 *
 * The shape is the one this repository's own `docs/decisions/` uses, on
 * purpose: a record exported from a project should look like a record written
 * by hand, or the format is only pretending to be markdown.
 *
 * What may happen to a record — the status machine, the numbering, what locks
 * it — is `decisions/adr.ts` and is none of this file's business. This is the
 * codec, and it is deliberately forgiving in one direction: it writes one exact
 * shape and reads several, because a file in the user's folder can be edited by
 * anything, and a record that half-parses is worth more than a refusal.
 */
import { ADR_STATUSES } from '../decisions/adr'
import type { Adr, AdrSigner, AdrStatus, AdrVerdict } from '../decisions/adr'
import { KEY_RE, slug } from '../model/keys'
import {
  frontMatterNumber, frontMatterRows, frontMatterString, frontMatterText, markdownBody,
  readFrontMatter,
} from './fileText'

/** The folder a project's or a group's records live in. */
export const DECISIONS_FOLDER = 'decisions'

function numberPrefix(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/**
 * Where a record is filed, relative to the project (or group) folder.
 *
 * An application's records go in a folder of their own because **numbers are
 * per list**: the landscape's ADR-0007 and an application's ADR-0007 are two
 * records, and two records may not be one file. The `applicationId` is written
 * in the front matter as well, so a file dragged out of its folder still says
 * whose decision it is.
 */
export function adrPath(adr: Adr): string {
  const name = `${numberPrefix(adr.number)}-${adr.title.trim() ? slug(adr.title) : 'decision'}.md`
  // A folder name is only ever an id we minted. Anything else — an id from an
  // imported document, say — stays flat rather than becoming a path.
  const application = adr.applicationId && KEY_RE.test(adr.applicationId) ? adr.applicationId : undefined
  return application
    ? `${DECISIONS_FOLDER}/${application}/${name}`
    : `${DECISIONS_FOLDER}/${name}`
}

function signerRows(signers: readonly AdrSigner[]): Record<string, string>[] {
  return signers.map((signer) => ({
    name: signer.name,
    ...(signer.role ? { role: signer.role } : {}),
    ...(signer.verdict ? { verdict: signer.verdict } : {}),
    ...(signer.signedAt ? { signedAt: signer.signedAt } : {}),
  }))
}

/**
 * The record as a file.
 *
 * The title is the heading and not a front-matter field, because that is what
 * makes the file render as a decision record everywhere markdown is rendered.
 * It carries the number too, in the form people say out loud — and the reader
 * takes that prefix back off, so the number stays the field's business and the
 * heading cannot drift from it.
 */
export function adrFileText(adr: Adr): string {
  const fields = frontMatterText({
    id: adr.id,
    number: adr.number,
    status: adr.status,
    date: adr.date,
    applicationId: adr.applicationId,
    supersededBy: adr.supersededBy,
    signers: signerRows(adr.signers),
  })
  const heading = `# ADR-${numberPrefix(adr.number)} — ${adr.title}`
  return `${fields}\n${heading}\n\n${adr.body}\n`
}

function statusOf(text: string | undefined): AdrStatus {
  return ADR_STATUSES.includes(text as AdrStatus) ? (text as AdrStatus) : 'proposed'
}

function verdictOf(text: string | undefined): AdrVerdict | undefined {
  return text === 'approved' || text === 'rejected' ? text : undefined
}

function signersFrom(rows: Record<string, string | number | boolean>[]): AdrSigner[] {
  return rows.flatMap((row) => {
    const name = typeof row.name === 'string' ? row.name : ''
    if (!name) return []
    const role = typeof row.role === 'string' ? row.role : undefined
    const signedAt = typeof row.signedAt === 'string' ? row.signedAt : undefined
    const verdict = verdictOf(typeof row.verdict === 'string' ? row.verdict : undefined)
    return [{
      name,
      ...(role ? { role } : {}),
      ...(verdict ? { verdict } : {}),
      ...(signedAt ? { signedAt } : {}),
    }]
  })
}

/** `0007-a-slug.md` → 7. What a hand-written file gives us when the field is missing. */
function numberFromName(path: string): number | undefined {
  const match = /(?:^|\/)(\d{1,6})-/.exec(path)
  return match ? Number(match[1]) : undefined
}

/**
 * A record back out of a file, or `undefined` when the file is not one.
 *
 * `path` is where the file was found, and it is a source of two things the
 * front matter may not carry: the number (from the name) and the application
 * (from the folder). The front matter wins where both speak — a record is what
 * it says it is, and a file can be moved by anyone.
 */
export function adrFromFile(text: string, path: string): Adr | undefined {
  const { fields, body } = readFrontMatter(text)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined

  const rest = body.replace(/^\n+/, '')
  const headingEnd = rest.startsWith('# ') ? rest.indexOf('\n') : -1
  const heading = headingEnd === -1 ? undefined : rest.slice(2, headingEnd)
  const title = (heading ?? frontMatterString(fields, 'title') ?? '')
    .replace(/^ADR-\d+\s+[—-]\s+/, '')
    .trim()

  const folder = /(?:^|\/)decisions\/([^/]+)\//.exec(path)?.[1]
  const applicationId = frontMatterString(fields, 'applicationId') ?? folder
  const supersededBy = frontMatterString(fields, 'supersededBy')

  return {
    id: frontMatterString(fields, 'id') || `adr-${applicationId ? `${applicationId}-` : ''}${number}`,
    number,
    title,
    status: statusOf(frontMatterString(fields, 'status')),
    date: frontMatterString(fields, 'date') ?? '',
    body: markdownBody(headingEnd === -1 ? rest : rest.slice(headingEnd + 1).replace(/^\n/, '')),
    ...(applicationId ? { applicationId } : {}),
    ...(supersededBy ? { supersededBy } : {}),
    signers: signersFrom(frontMatterRows(fields, 'signers')),
  }
}
