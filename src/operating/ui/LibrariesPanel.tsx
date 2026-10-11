// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The third tab: the libraries to start from (ADR-0036 §5), what each offers
 * that is not in yet, and how what came in differs from its library now.
 *
 * Bringing items in is one step. What an entry needs comes with it and is
 * said before anything is written (`entriesBrought`); what is in already is
 * not offered again.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { bringIn, entriesBrought, notBroughtIn } from '../bringIn'
import { compareWithLibraries } from '../compare'
import type { Difference } from '../compare'
import type { OperatingModel } from '../edit'
import { entryOf, libraryLanguage } from '../library'
import type { Library, LibraryLanguage } from '../library'
import { countsLine } from './countsLine'

type Props = {
  model: OperatingModel
  readOnly: boolean
  dispatch(command: Command): void
  makeId: MakeId
  libraries: readonly Library[]
  /** The screen's language: what the words of an item brought in are taken in. */
  language: string
}

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 3, mb: 1 } as const

export function LibrariesPanel({ model, readOnly, dispatch, makeId, libraries, language }: Props) {
  const { t } = useStrings()
  const words = libraryLanguage(language)
  const differences = useMemo(() => compareWithLibraries(model, libraries), [model, libraries])
  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="body2" color="text.secondary">{t('operating.librariesIntro')}</Typography>
      {libraries.map((library) => (
        <LibraryCard key={library.id} library={library} model={model} readOnly={readOnly} dispatch={dispatch} makeId={makeId} language={words} />
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
      return t('operating.diff.about', {
        name, field: t(`operating.field.${difference.what}`), about: difference.about ?? '',
        here: value(difference.here), there: value(difference.there),
      })
    default:
      return t('operating.diff.field', {
        name, field: t(`operating.field.${difference.what}`), here: value(difference.here), there: value(difference.there),
      })
  }
}

function LibraryCard(props: {
  library: Library; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void; makeId: MakeId; language: LibraryLanguage
}) {
  const { library, model, readOnly, dispatch, makeId, language } = props
  const { t } = useStrings()
  const [picked, setPicked] = useState<readonly string[]>([])
  const offered = notBroughtIn(model, library)
  const chosen = picked.filter((entry) => offered.includes(entry))
  const brings = entriesBrought(model, library, chosen).filter((entry) => !chosen.includes(entry))
  const nameOf = (entry: string) => entryOf(library, entry)?.item.name[language] ?? entry
  const bring = (entries: readonly string[]) => {
    const step = bringIn({ lists: model, library, entries, language, makeId })
    if (step) dispatch(step)
    setPicked([])
  }
  return (
    <Box data-testid={`library-${library.id}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mt: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 15 }}>{library.name}</Typography>
        <Typography variant="caption" color="text.secondary">{t('operating.libraryVersion', { version: library.version })}</Typography>
        <Typography variant="caption" color="text.secondary">
          {countsLine(t, library.unitTypes.length, library.roles.length, library.responsibilities.length)}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">{library.note[language]}</Typography>
      <Typography sx={{ ...heading, mt: 1.5 }}>{t('operating.notBroughtIn')}</Typography>
      {offered.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t('operating.allBroughtIn')}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
          {offered.map((entry) => {
            const held = entryOf(library, entry)!
            return (
              <FormControlLabel
                key={entry}
                control={(
                  <Checkbox size="small" disabled={readOnly} checked={chosen.includes(entry)}
                    onChange={(_event, on) => setPicked(on ? [...chosen, entry] : chosen.filter((one) => one !== entry))} />
                )}
                label={`${held.item.name[language]} · ${t(`operating.entryKind.${held.kind}`)}`}
              />
            )
          })}
        </Box>
      )}
      {brings.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t('operating.bringsWith', { names: brings.map(nameOf).join(', ') })}
        </Typography>
      )}
      {!readOnly && offered.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button size="small" variant="contained" disabled={chosen.length === 0} data-guide="operating.bringIn" sx={{ textTransform: 'none' }}
            onClick={() => bring(chosen)}>
            {t('operating.bringIn')}
          </Button>
          <Button size="small" sx={{ textTransform: 'none' }} onClick={() => bring(offered)}>
            {t('operating.bringInAll', { library: library.name })}
          </Button>
        </Box>
      )}
    </Box>
  )
}
