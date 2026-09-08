/**
 * One plan, as one markdown file (ADR-0009).
 *
 * The sibling of {@link ./adrFile}, and deliberately the same shape: front
 * matter for the fields that are not prose, a heading that names it the way
 * people say it out loud, and markdown below. A plan exported from a project
 * should look like a plan somebody wrote by hand, or the format is only
 * pretending to be markdown.
 *
 * Forgiving in one direction, as the decision codec is: it writes one exact
 * shape and reads several, because a file in the user's folder can be edited by
 * anything and a plan that half-parses is worth more than a refusal.
 *
 * What may happen to a plan — the status machine, the numbering — is
 * `model/transition.ts` and is none of this file's business. This is the codec.
 */
import { TRANSITION_STATUSES } from '../model/transition'
import type {
  Transition, TransitionElement, TransitionMilestone, TransitionRole, TransitionStatus,
} from '../model/transition'
import { slug } from '../model/keys'
import {
  frontMatterNumber, frontMatterRows, frontMatterString, frontMatterText, markdownBody,
  readFrontMatter,
} from './fileText'
import type { FrontMatterScalar } from './fileText'

/** The folder a project's plans live in. */
export const TRANSITIONS_FOLDER = 'transitions'

const ROLES: readonly TransitionRole[] = ['introduces', 'retires', 'changes']

function numberPrefix(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/**
 * Where a plan is filed, relative to the project folder.
 *
 * Flat, unlike the decisions: numbers are per project rather than per list, so
 * there is no second list for a `TR-0003` to collide with. The number leads the
 * name for the same two reasons it does there — it sorts, and it means a
 * `README.md` dropped in the folder is not read as a plan.
 */
export function transitionPath(transition: Transition): string {
  const stem = transition.title.trim() ? slug(transition.title) : 'plan'
  return `${TRANSITIONS_FOLDER}/${numberPrefix(transition.number)}-${stem}.md`
}

function elementRows(elements: readonly TransitionElement[]): Record<string, FrontMatterScalar>[] {
  return elements
    .filter((one) => one.elementId)
    .map((one) => ({ elementId: one.elementId, role: one.role }))
}

function milestoneRows(milestones: readonly TransitionMilestone[]): Record<string, FrontMatterScalar>[] {
  return milestones
    .filter((one) => one.date || one.name)
    .map((one) => ({ date: one.date, name: one.name }))
}

export function transitionFileText(transition: Transition): string {
  const fields = frontMatterText({
    id: transition.id,
    number: transition.number,
    status: transition.status,
    from: transition.from,
    to: transition.to,
    owner: transition.owner,
    // Written as a list of ids rather than rows, because a decision reference
    // is one value and a row with one column reads like a mistake.
    decisions: transition.decisions.filter(Boolean).map((id) => ({ id })),
    elements: elementRows(transition.elements),
    milestones: milestoneRows(transition.milestones),
  })
  const heading = `# TR-${numberPrefix(transition.number)} — ${transition.title}`
  return `${fields}\n${heading}\n\n${transition.body}\n`
}

function statusOf(text: string | undefined): TransitionStatus {
  return TRANSITION_STATUSES.includes(text as TransitionStatus)
    ? (text as TransitionStatus)
    : 'draft'
}

function roleOf(text: string | undefined): TransitionRole {
  return ROLES.includes(text as TransitionRole) ? (text as TransitionRole) : 'changes'
}

function elementsFrom(rows: Record<string, FrontMatterScalar>[]): TransitionElement[] {
  return rows.flatMap((row) => {
    const elementId = typeof row.elementId === 'string' ? row.elementId : ''
    if (!elementId) return []
    return [{ elementId, role: roleOf(typeof row.role === 'string' ? row.role : undefined) }]
  })
}

function milestonesFrom(rows: Record<string, FrontMatterScalar>[]): TransitionMilestone[] {
  return rows.flatMap((row) => {
    const date = typeof row.date === 'string' ? row.date : ''
    const name = typeof row.name === 'string' ? row.name : ''
    if (!date && !name) return []
    return [{ date, name }]
  })
}

function decisionsFrom(rows: Record<string, FrontMatterScalar>[]): string[] {
  return rows.flatMap((row) => (typeof row.id === 'string' && row.id ? [row.id] : []))
}

/** `0003-a-slug.md` → 3, for a file whose front matter lost its number. */
function numberFromName(path: string): number | undefined {
  const match = /(?:^|\/)(\d{1,6})-/.exec(path)
  return match ? Number(match[1]) : undefined
}

/**
 * A plan back out of a file, or `undefined` when the file is not one.
 *
 * The number comes from the front matter, or from the file name where a
 * hand-written file has none. Everything else has a defensible default: a plan
 * whose status was mistyped is a draft, and an element whose role was mistyped
 * is one the plan changes.
 */
export function transitionFromFile(text: string, path: string): Transition | undefined {
  const { fields, body } = readFrontMatter(text)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined

  const rest = body.replace(/^\n+/, '')
  const headingEnd = rest.startsWith('# ') ? rest.indexOf('\n') : -1
  const heading = headingEnd === -1 ? undefined : rest.slice(2, headingEnd)
  const title = (heading ?? frontMatterString(fields, 'title') ?? '')
    .replace(/^TR-\d+\s+[—-]\s+/, '')
    .trim()

  const from = frontMatterString(fields, 'from')
  const to = frontMatterString(fields, 'to')
  const owner = frontMatterString(fields, 'owner')

  return {
    id: frontMatterString(fields, 'id') || `tr-${number}`,
    number,
    title,
    status: statusOf(frontMatterString(fields, 'status')),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(owner ? { owner } : {}),
    elements: elementsFrom(frontMatterRows(fields, 'elements')),
    decisions: decisionsFrom(frontMatterRows(fields, 'decisions')),
    milestones: milestonesFrom(frontMatterRows(fields, 'milestones')),
    body: markdownBody(headingEnd === -1 ? rest : rest.slice(headingEnd + 1).replace(/^\n/, '')),
  }
}
