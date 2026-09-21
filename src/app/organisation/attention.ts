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
 * off the technology rows the card already counts.
 *
 * Only what is filed at or under the scope whose home this is, so a domain's
 * home speaks for its domain. Information (`check.notDrawn`) is left out for
 * the reason the tree left it out: it is not something anybody has to do.
 */
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import { findingSentence } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import { ROOT_SCOPE, isWithinScope } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { isUnattributed } from './register'
import type { RegisterRow } from './register'
import type { TechnologyRow } from '../../projects/technologyRegister'

export type AttentionItem = {
  /** What kind of thing it is, for a test and a key. */
  key: string
  /** The scope to open, and the record to select there. */
  scope: ScopePath
  id: ElementId
  text: string
}

export function attentionItems(
  findings: ReadonlyMap<ScopePath, readonly Finding[]> | undefined,
  register: readonly RegisterRow[],
  technology: readonly TechnologyRow[],
  at: ScopePath,
  s: Translate,
  scopeName: (path: ScopePath) => string,
): AttentionItem[] {
  const within = (path: ScopePath) => at === ROOT_SCOPE || isWithinScope(path, at)
  const items: AttentionItem[] = []
  const seen = new Set<string>()
  const add = (item: AttentionItem) => {
    const key = `${item.key}|${item.scope}|${item.id}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }
  for (const [scope, held] of findings ?? []) {
    if (!within(scope)) continue
    for (const finding of held) {
      if (finding.information) continue
      add({ key: finding.key, scope, id: finding.id, text: findingSentence(finding, s, scopeName) })
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
    add({
      key: 'techRegister.unrealised', scope: row.master, id: row.id,
      text: s('techRegister.unrealisedSentence', { name: row.name }),
    })
  }
  return items.sort((a, b) => a.scope.localeCompare(b.scope) || a.text.localeCompare(b.text))
}
