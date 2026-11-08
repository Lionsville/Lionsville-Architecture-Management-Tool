// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The libraries to start from (ADR-0036 §5), as a short list, each read in a large
 * preview: what it offers, a way into the dialog that brings it in, and *What came
 * in*, as text, the library's term beside what it is called here and what has
 * changed since, with every one of the organisation's own a bring-in matched to an
 * entry. An item is renamed where it lives: pressing it opens it. How what came in
 * differs from its library now is one press away.
 */
import { useMemo, useState } from 'react'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { whatCameIn } from '../cameIn'
import type { CameInItem, MatchedItem } from '../cameIn'
import { compareWithLibraries } from '../compare'
import type { Difference } from '../compare'
import type { OperatingModel } from '../edit'
import type { Library, LibraryLanguage } from '../library'
import { countsLine } from './countsLine'
import { plural } from '../../i18n/strings'

type Props = {
  model: OperatingModel
  readOnly: boolean
  libraries: readonly Library[]
  /** The screen's language, as the libraries are written in it. */
  language: LibraryLanguage
  /** Open the dialog that brings a library in, on that library. */
  onFromLibrary(libraryId?: string): void
  /** Open an item on its own tab, picked. */
  onOpenItem(id: string): void
  selected: string | undefined
  onSelect(id: string | undefined): void
}

export function LibrariesPanel({ model, readOnly, libraries, language, onFromLibrary, onOpenItem, selected, onSelect }: Props) {
  const { t } = useStrings()
  const differences = useMemo(() => compareWithLibraries(model, libraries), [model, libraries])
  const cameIn = useMemo(() => whatCameIn(model, libraries), [model, libraries])
  const [comparing, setComparing] = useState(false)
  const open = cameIn.find((one) => one.library.id === selected)
  const ids = cameIn.map((one) => one.library.id)
  return (
    <>
      <p className="op-concept">{t('operating.librariesIntro')}</p>
      <div className="op-actions">
        <Button variant="plain" aria-expanded={comparing} data-testid="operating-compare" onClick={() => setComparing(!comparing)}>{t('operating.compare')}</Button>
        {!readOnly && <Button variant="plain" data-guide="operating.fromLibrary" onClick={() => onFromLibrary()}>{t('operating.fromLibrary')}</Button>}
      </div>
      {comparing && (
        <section className="op-section" aria-label={t('operating.compare')}>
          <p className="op-small">{t('operating.compareHint')}</p>
          <ul className="op-diffs" data-guide="operating.compare">
            {differences.length === 0
              ? <li className="op-quiet">{t('operating.compareNone')}</li>
              : differences.map((difference, index) => <li key={`${difference.item.id}-${difference.what}-${index}`}>{differenceSentence(difference, t)}</li>)}
          </ul>
        </section>
      )}
      <List
        label={t('operating.tabLibraries')} wrap dataGuide="operating.libraries" selectedId={selected ?? null} onOpen={onSelect}
        itemLabel={t('operating.library')}
        columns={[{ id: 'note', label: t('operating.libraryAbout') }, { id: 'came', label: t('operating.cameIn'), width: '14em' }]}
        groups={[{
          id: 'all', label: '', rows: cameIn.map(({ library, made, matched }) => ({
            id: library.id, text: library.name,
            cells: { note: library.note[language], came: cameInWords(made, matched, t) },
          })),
        }]}
      />
      <p className="op-small">{t('operating.notices')}</p>
      <Preview
        ids={ids} currentId={open ? open.library.id : null} onSelect={(id) => onSelect(id ?? undefined)} title={open?.library.name ?? ''} dataGuide="operating.libraryPreview"
        facts={open && (
          <>
            <PreviewFact label={t('operating.version')}>{open.library.version}</PreviewFact>
            <PreviewFact label={t('operating.holds')}>{countsLine(t, open.library.unitTypes.length, open.library.roles.length, open.library.responsibilities.length)}</PreviewFact>
          </>
        )}
        foot={open && !readOnly && <Button variant="primary" onClick={() => onFromLibrary(open.library.id)}>{t('operating.fromThisLibrary', { library: open.library.name })}</Button>}
      >
        {open && (
          <div data-testid={`library-${open.library.id}`} className="op-section">
            <p>{open.library.note[language]}</p>
            <h3>{t('operating.cameIn')}</h3>
            {open.made.length === 0 && open.matched.length === 0
              ? <p className="op-quiet">{t('operating.cameInNone', { library: open.library.name })}</p>
              : (
                <div className="op-cameIn" data-guide="operating.cameIn">
                  <span className="op-cameIn__head">{t('operating.cameInTerm')}</span>
                  <span className="op-cameIn__head">{t('operating.cameInName')}</span>
                  <span className="op-cameIn__head">{t('operating.cameInChanged')}</span>
                  {open.made.map((item) => <MadeRow key={`${item.kind}-${item.id}`} item={item} onOpenItem={onOpenItem} />)}
                  {open.matched.map((item) => <MatchedRow key={`${item.kind}-${item.id}-${item.entry}`} item={item} onOpenItem={onOpenItem} />)}
                </div>
              )}
          </div>
        )}
      </Preview>
    </>
  )
}

const cameInWords = (made: readonly CameInItem[], matched: readonly MatchedItem[], t: Translate): string => {
  const count = made.length + matched.length
  if (count === 0) return t('operating.nothingBrought')
  const changed = made.filter((item) => item.changed.length > 0).length
  return changed > 0 ? t('operating.broughtChanged', { count, changed }) : plural(t, { one: 'operating.broughtOne', other: 'operating.brought' }, count)
}

/** A difference as a sentence. */
export function differenceSentence(difference: Difference, t: Translate): string {
  const name = difference.item.name
  const value = (said: string | undefined) => {
    if (said === undefined) return t('operating.value.none')
    return said === 'true' ? t('operating.value.yes') : said
  }
  switch (difference.what) {
    case 'own':
    case 'libraryGone':
    case 'entryGone':
      return t(`operating.diff.${difference.what}`, { name })
    case 'version':
      return t('operating.diff.version', { name, here: difference.here ?? '', there: difference.there ?? '' })
    case 'slot':
    case 'within':
    case 'duty':
      // A place a type was put in when it came in is what a move since is told from.
      return t(difference.moved ? 'operating.diff.movedAbout' : 'operating.diff.about', {
        name, field: t(`operating.field.${difference.what}`), about: difference.about ?? '',
        here: value(difference.here), there: value(difference.there),
      })
    default:
      // A name chosen when the item came in is what a rename since is told from.
      if (difference.what === 'name' && difference.chosen !== undefined) return t('operating.diff.renamed', { name, chosen: difference.chosen })
      return t(difference.moved ? 'operating.diff.moved' : 'operating.diff.field', {
        name, field: t(`operating.field.${difference.what}`), here: value(difference.here), there: value(difference.there),
      })
  }
}

/** What has changed since an item came in, in a few words: each field, the version, or the entry gone. */
export function changedWords(changed: readonly Difference[], t: Translate): string {
  if (changed.length === 0) return t('operating.changedNothing')
  const words = changed.map((difference) => {
    switch (difference.what) {
      case 'version': return t('operating.changedVersion', { here: difference.here ?? '', there: difference.there ?? '' })
      case 'entryGone':
      case 'libraryGone':
      case 'own': return t('operating.changedGone')
      case 'slot':
      case 'within':
      case 'duty': return `${t(`operating.field.${difference.what}`)} ${difference.about ?? ''}`.trim()
      default: return t(`operating.field.${difference.what}`)
    }
  })
  return [...new Set(words)].join(', ')
}

function Term({ term, kind, id, onOpenItem }: { term: string; kind: CameInItem['kind']; id: string; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  return (
    <span>
      <button type="button" className="op-link" title={t(kind === 'responsibility' ? 'operating.openOnRaci' : kind === 'role' ? 'operating.openOnRoles' : 'operating.openOnUnits')} onClick={() => onOpenItem(id)}>{term}</button>
      {' '}<span className="op-small">{t(`operating.entryKind.${kind}`)}</span>
    </span>
  )
}

function MadeRow({ item, onOpenItem }: { item: CameInItem; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  return (
    <>
      <Term term={item.term ?? item.entry} kind={item.kind} id={item.id} onOpenItem={onOpenItem} />
      <span data-testid={`came-in-${item.id}`}>{item.name}</span>
      <span className="op-small">{item.changed.length === 0 ? '' : changedWords(item.changed, t)}</span>
    </>
  )
}

function MatchedRow({ item, onOpenItem }: { item: MatchedItem; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  return (
    <>
      <Term term={item.term ?? item.entry} kind={item.kind} id={item.id} onOpenItem={onOpenItem} />
      <span data-testid={`came-in-matched-${item.entry}`}>{t('operating.usedYour', { name: item.name })}</span>
      <span className="op-small">{t('operating.changedMatched')}</span>
    </>
  )
}
