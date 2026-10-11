// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The third tab: the libraries to start from (ADR-0036 §5), what came in from
 * each, and how what came in differs from its library now.
 *
 * Each library is a card: what it offers, a way into the dialog that brings it
 * in (*From SAFe…*), and *What came in* (amended 11 October 2026) — every item
 * made from it, the library's term beside what it is called here, renamed in
 * place and opened on its own tab by pressing the term, with what *compare*
 * says has changed since; and every one of the organisation's own a bring-in
 * matched to an entry, "used your …". All of it read from the records
 * (`whatCameIn`), nothing guessed by name.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { whatCameIn } from '../cameIn'
import type { CameIn, CameInItem, MatchedItem } from '../cameIn'
import { compareWithLibraries } from '../compare'
import type { Difference } from '../compare'
import { editResponsibility, editRole, editUnitType } from '../edit'
import type { OperatingModel } from '../edit'
import type { Library, LibraryLanguage } from '../library'
import { countsLine } from './countsLine'

type Props = {
  model: OperatingModel
  readOnly: boolean
  dispatch(command: Command): void
  libraries: readonly Library[]
  /** The screen's language, as the libraries are written in it. */
  language: LibraryLanguage
  /** Open the dialog that brings a library in, on that library. */
  onFromLibrary(libraryId: string): void
  /** Open an item on its own tab, picked. */
  onOpenItem(id: string): void
}

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 3, mb: 1 } as const

export function LibrariesPanel({ model, readOnly, dispatch, libraries, language, onFromLibrary, onOpenItem }: Props) {
  const { t } = useStrings()
  const differences = useMemo(() => compareWithLibraries(model, libraries), [model, libraries])
  const cameIn = useMemo(() => whatCameIn(model, libraries), [model, libraries])
  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="body2" color="text.secondary">{t('operating.librariesIntro')}</Typography>
      {cameIn.map((one) => (
        <LibraryCard key={one.library.id} cameIn={one} readOnly={readOnly} dispatch={dispatch} language={language}
          onFromLibrary={onFromLibrary} onOpenItem={onOpenItem} />
      ))}
      <Typography component="h2" sx={heading}>{t('operating.compare')}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{t('operating.compareHint')}</Typography>
      <Box data-guide="operating.compare" component="ul" sx={{ pl: '1.2em', my: 0 }}>
        {differences.length === 0
          ? <Typography component="li" variant="body2" color="text.secondary">{t('operating.compareNone')}</Typography>
          : differences.map((difference, index) => (
            <Typography component="li" variant="body2" key={`${difference.item.id}-${difference.what}-${index}`}>
              {differenceSentence(difference, t)}
            </Typography>
          ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('operating.notices')}</Typography>
    </Box>
  )
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

type CardProps = {
  cameIn: CameIn
  readOnly: boolean
  dispatch(command: Command): void
  language: LibraryLanguage
  onFromLibrary(libraryId: string): void
  onOpenItem(id: string): void
}

function LibraryCard({ cameIn, readOnly, dispatch, language, onFromLibrary, onOpenItem }: CardProps) {
  const { library, made, matched } = cameIn
  const { t } = useStrings()
  const titleId = `came-in-${library.id}`
  return (
    <Box component="section" aria-labelledby={`library-${library.id}-name`} data-testid={`library-${library.id}`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mt: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="h2" id={`library-${library.id}-name`} sx={{ fontWeight: 700, fontSize: 15 }}>{library.name}</Typography>
        <Typography variant="caption" color="text.secondary">{t('operating.libraryVersion', { version: library.version })}</Typography>
        <Typography variant="caption" color="text.secondary">
          {countsLine(t, library.unitTypes.length, library.roles.length, library.responsibilities.length)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {!readOnly && (
          <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => onFromLibrary(library.id)}>
            {t('operating.fromThisLibrary', { library: library.name })}
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">{library.note[language]}</Typography>
      <Typography component="h3" id={titleId} sx={{ ...heading, mt: 1.5 }}>{t('operating.cameIn')}</Typography>
      {made.length === 0 && matched.length === 0
        ? <Typography variant="body2" color="text.secondary">{t('operating.cameInNone', { library: library.name })}</Typography>
        : (
          <Table size="small" aria-labelledby={titleId} data-guide="operating.cameIn">
            <TableHead>
              <TableRow>
                <TableCell>{t('operating.cameInTerm')}</TableCell>
                <TableCell>{t('operating.cameInName')}</TableCell>
                <TableCell>{t('operating.cameInChanged')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {made.map((item) => <MadeRow key={`${item.kind}-${item.id}`} item={item} readOnly={readOnly} dispatch={dispatch} onOpenItem={onOpenItem} />)}
              {matched.map((item) => <MatchedRow key={`${item.kind}-${item.id}-${item.entry}`} item={item} onOpenItem={onOpenItem} />)}
            </TableBody>
          </Table>
        )}
    </Box>
  )
}

const RENAME = { unitType: editUnitType, role: editRole, responsibility: editResponsibility } as const

/** The library's term, pressed to open the item, and what kind it is. */
function Term({ term, kind, id, onOpenItem }: { term: string; kind: CameInItem['kind']; id: string; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  return (
    <>
      <Tooltip describeChild title={t(kind === 'responsibility' ? 'operating.openOnRaci' : 'operating.openOnUnits')}>
        <Button size="small" onClick={() => onOpenItem(id)} sx={{ textTransform: 'none', p: 0, minWidth: 0, textAlign: 'left' }}>{term}</Button>
      </Tooltip>
      <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 0.75 }}>{t(`operating.entryKind.${kind}`)}</Typography>
    </>
  )
}

function MadeRow({ item, readOnly, dispatch, onOpenItem }: { item: CameInItem; readOnly: boolean; dispatch(command: Command): void; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  const term = item.term ?? item.entry
  return (
    <TableRow data-testid={`came-in-${item.id}`}>
      <TableCell><Term term={term} kind={item.kind} id={item.id} onOpenItem={onOpenItem} /></TableCell>
      <TableCell>
        {readOnly
          ? item.name
          : (
            <TextField size="small" fullWidth value={item.name} sx={{ minWidth: 180, '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
              slotProps={{ htmlInput: { 'aria-label': t('operating.calledHere', { term }) } }}
              onChange={(event) => dispatch(RENAME[item.kind](item.id, 'name', event.target.value))} />
          )}
      </TableCell>
      <TableCell sx={{ fontSize: 12, color: item.changed.length ? 'text.primary' : 'text.secondary' }}>{changedWords(item.changed, t)}</TableCell>
    </TableRow>
  )
}

function MatchedRow({ item, onOpenItem }: { item: MatchedItem; onOpenItem(id: string): void }) {
  const { t } = useStrings()
  return (
    <TableRow data-testid={`came-in-matched-${item.entry}`}>
      <TableCell><Term term={item.term ?? item.entry} kind={item.kind} id={item.id} onOpenItem={onOpenItem} /></TableCell>
      <TableCell sx={{ fontStyle: 'italic' }}>{t('operating.usedYour', { name: item.name })}</TableCell>
      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{t('operating.changedMatched')}</TableCell>
    </TableRow>
  )
}
