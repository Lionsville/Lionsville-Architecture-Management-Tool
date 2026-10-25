// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation screen asks a person to look at: one sentence per
 * finding, each a way to the thing it is about.
 *
 * Findings used to be counted on the cards ("1 defined twice") and on a
 * scope's row in the tree ("1 conflict · 1 undefined"), which told a newcomer
 * that something was wrong and nothing about what, and neither line could be
 * pressed. This is the same findings said once, under the cards, as sentences
 * with a subject and a place to go — and nothing here is worked out afresh:
 * the tree's findings come from the index the shell already holds (ADR-0012
 * §9), an application nobody has said whose it is comes off the register's
 * rows as the register page reads it, and a service nothing realises is read
 * off the technology rows the card already counts. The operating model's
 * findings are the one exception (ADR-0036 §2): a responsibility without its
 * one *A* and a unit type that sits nowhere are about the organisation's own
 * document, which no index holds, so the organisation's home hands it in and
 * they are said from it — each opening the operating model's page with the
 * item picked, since no board draws either.
 *
 * Only what is filed at or under the scope whose home this is, so a domain's
 * home speaks for its domain. A note — a record on no board, a capability a
 * domain proposes — is listed with the rest: the list hides the notes until
 * somebody asks for them (ADR-0036, amended 11 October 2026), which is what
 * leaving `check.notDrawn` out used to do for the one note there was.
 */
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import type { CheckKey } from '../../model/checkCatalogue'
import type { HostModel } from '../../model/hostModel'
import { findingSentence, operatingModelFindings } from '../../projects/checks'
import { pickedPerson } from '../../model/person'
import type { Person } from '../../people/person'
import { personText, registerOf } from '../../people/shown'
import type { Finding } from '../../projects/checks'
import { ROOT_SCOPE, isWithinScope } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { isUnattributed } from './register'
import type { RegisterRow } from './register'
import type { TechnologyRow } from '../../projects/technologyRegister'

export type AttentionItem = {
  /** The check it is (`model/checkCatalogue.ts`): what a list groups it by, a test and a key. */
  key: CheckKey
  /**
   * The same, as the one word a row carries on screen (`data-finding`):
   * `conflict`, `dangling`, `unattributed`, `unrealised`… — the key without
   * the table it is said from. A name for something outside this tree to
   * point at a kind of finding by, which the sentence cannot be: that moves
   * with the language.
   */
  kind: string
  /** The scope to open, and the record to select there. */
  scope: ScopePath
  id: ElementId
  /** The view to open instead, where the finding is about something on one (`Finding.view`). */
  view?: string
  /** The other scope the finding names, where it does: the other definition, the one a stand-in's fields belong to. */
  elsewhere?: ScopePath
  /**
   * The finding's own `fields`, `scopes` and `person`, where it has them:
   * what makes it this instance, which a mark as intended is keyed by
   * (`model/checkMarks.findingKey`).
   */
  fields?: readonly string[]
  scopes?: readonly ScopePath[]
  person?: string
  /**
   * The page to open instead, with the record picked on it: the operating
   * model's, where the finding is about a unit type or a responsibility,
   * which no board draws (ADR-0036 §2).
   */
  page?: 'operating' | 'home' | 'principles' | 'record'
  text: string
}

/** The findings about a principle (ADR-0041 §10): opened on the principles page of its scope, the principle picked there. */
const ON_THE_PRINCIPLES_PAGE: ReadonlySet<string> = new Set(['check.principleUnused', 'check.principleChafes'])

/** A citation that names a principle not there: opened on the record that cites, where it is fixed. */
const ON_THE_RECORD: ReadonlySet<string> = new Set(['check.citationGone'])

/** Where a finding opens other than on the record it names as an element. */
function pageOf(key: string): Pick<AttentionItem, 'page'> {
  if (ON_THE_OPERATING_PAGE.has(key)) return { page: 'operating' }
  if (ABOUT_A_SCOPE.has(key)) return { page: 'home' }
  if (ON_THE_PRINCIPLES_PAGE.has(key)) return { page: 'principles' }
  return ON_THE_RECORD.has(key) ? { page: 'record' } : {}
}

/** The findings about the operating model: opened on its page at the organisation, the item picked there. */
const ON_THE_OPERATING_PAGE: ReadonlySet<string> = new Set(['check.accountability', 'check.unitTypeNowhere'])

/** The findings about a scope itself (ADR-0036, amended 17 October 2026): opened on its home, where its type and *Served by* are. */
export const ABOUT_A_SCOPE: ReadonlySet<string> = new Set(['check.scopeTypeDisagrees', 'check.scopeTypeUnserved', 'check.scopeTypeGone'])

/** The kind a key names: its last segment, `check.conflict` → `conflict`. */
export function findingKind(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1)
}

export function attentionItems(
  findings: ReadonlyMap<ScopePath, readonly Finding[]> | undefined,
  register: readonly RegisterRow[],
  technology: readonly TechnologyRow[],
  at: ScopePath,
  s: Translate,
  scopeName: (path: ScopePath) => string,
  people: readonly Person[] = [],
  operating?: Pick<HostModel, 'unitTypes' | 'roles' | 'responsibilities'>,
): AttentionItem[] {
  const within = (path: ScopePath) => at === ROOT_SCOPE || isWithinScope(path, at)
  // A finding about a person says who by id; the register says the name (ADR-0036 §8).
  const named = registerOf(people)
  const personName = (id: string) => personText(pickedPerson(id), named, s)
  const items: AttentionItem[] = []
  const seen = new Set<string>()
  const add = (item: Omit<AttentionItem, 'kind'>) => {
    const key = `${item.key}|${item.scope}|${item.id}`
    if (seen.has(key)) return
    seen.add(key)
    items.push({ ...item, kind: findingKind(item.key) })
  }
  // The operating model's own, off the organisation's document where the home has it: no index holds them.
  const operatingFound: [ScopePath, readonly Finding[]][] = operating ? [[ROOT_SCOPE, operatingModelFindings(ROOT_SCOPE, operating)]] : []
  for (const [scope, held] of [...findings ?? [], ...operatingFound]) {
    if (!within(scope)) continue
    for (const finding of held) {
      const elsewhere = finding.scopes?.[0]
      add({
        key: finding.key, scope, id: finding.id, ...(finding.view ? { view: finding.view } : {}),
        ...(elsewhere !== undefined ? { elsewhere } : {}),
        ...(finding.fields ? { fields: finding.fields } : {}), ...(finding.scopes ? { scopes: finding.scopes } : {}),
        ...(finding.person !== undefined ? { person: finding.person } : {}),
        ...pageOf(finding.key),
        text: findingSentence(finding, s, scopeName, personName),
      })
    }
  }
  for (const row of register) {
    const scope = row.master ?? row.drawnIn[0]
    if (!isUnattributed(row) || scope === undefined || !within(scope)) continue
    add({
      key: 'check.unattributed', scope, id: row.id,
      text: findingSentence({ key: 'check.unattributed', scope, id: row.id, name: row.name }, s, scopeName),
    })
  }
  for (const row of technology) {
    if (row.kind !== 'platformService' || row.realisedBy.length > 0 || row.master === undefined) continue
    if (!within(row.master)) continue
    // A check of the catalogue's like the others (`check.unrealised`), said in the register's own words.
    add({
      key: 'check.unrealised', scope: row.master, id: row.id,
      text: s('techRegister.unrealisedSentence', { name: row.name }),
    })
  }
  return items.sort((a, b) => a.scope.localeCompare(b.scope) || a.text.localeCompare(b.text))
}
