// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A library drawn as its own structure, read-only, in the middle of the
 * dialog that brings it in (ADR-0036, amended 11 October 2026): its unit
 * types in the lanes the page draws the organisation's own in
 * (`StructureLanes`), each card with its purpose, its role slots and a tick
 * box, and under the lanes the roles none of its types holds, each with its
 * own.
 *
 * What a tick does is drawn before anything is written, from the rows of
 * *What will come in*: a type or a role that comes along with a ticked one is
 * dashed and still there to read; an entry the organisation already has says
 * what it is called there and is ticked for good, since it is used as it is.
 * Pressing a role folds out what it answers for: responsibilities always come
 * with their role, so they are read here rather than ticked.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import type { UnitType } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import type { OperatingLists } from '../bringIn'
import type { ComingInRow } from '../comingIn'
import type { Library, LibraryLanguage, LibraryRole } from '../library'
import { answersOf, libraryRoles, libraryTypes, looseRoles, standingFor } from './libraryCards'
import type { Standing } from './libraryCards'
import { HEADING } from './Rules'
import { StructureLanes } from './StructureLanes'
import { Badge, TypeCard } from './TypeCard'
import { placeOf } from './UnitsAndRoles'

export type LibraryStructureProps = {
  library: Library
  language: LibraryLanguage
  /** The organisation's model, for what stands for an entry already. */
  lists: OperatingLists
  /** The rows of *What will come in*, by entry: what comes along, and with what. */
  rows: ReadonlyMap<string, ComingInRow>
  ticked: ReadonlySet<string>
  onTick(entry: string, on: boolean): void
  /** The roles whose responsibilities are folded out, by entry. */
  unfolded: ReadonlySet<string>
  onFold(entry: string): void
}

export function LibraryStructure(props: LibraryStructureProps) {
  const { library, language, lists, rows } = props
  const { t } = useStrings()
  const types = useMemo(() => libraryTypes(library, language), [library, language])
  const structure = useMemo(() => unitTypeLanes(types), [types])
  const roles = useMemo(() => libraryRoles(library, language), [library, language])
  const loose = looseRoles(library)
  const comes = (entry: string) => {
    const row = rows.get(entry)
    return row !== undefined && !row.asked && row.fate !== 'inModel'
  }
  const card = (type: UnitType) => {
    const standing = standingFor(lists, library, type.id)
    const row = rows.get(type.id)
    const answers = type.slots.filter((slot) => props.unfolded.has(slot.role))
    return (
      <TypeCard
        type={type} roles={roles} place={placeOf(type, types, t)}
        meta={type.limit !== undefined ? [t('operating.limitLine', { count: type.limit })] : []}
        head={<Tick entry={type.id} name={type.name} standing={standing} {...props} />}
        dashed={comes(type.id)} roleDashed={comes}
        onPickRole={props.onFold} roleExpanded={(role) => props.unfolded.has(role)}
        noSlots={t('operating.libraryNoSlots')}
      >
        <Note standing={standing} row={row} rows={rows} t={t} />
        {type.purpose && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{type.purpose}</Typography>}
        {answers.map((slot) => (
          <Answers key={slot.role} library={library} role={slot.role} name={roles.get(slot.role)?.name ?? slot.role} language={language} />
        ))}
      </TypeCard>
    )
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">{library.note[language]}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {t('operating.libraryVersion', { version: library.version })} · {t('operating.libraryHint')}
      </Typography>
      {library.unitTypes.length > 0 && (
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <StructureLanes
            structure={structure} label={t('operating.libraryStructure', { library: library.name })}
            organisation={{ name: t('operating.theOrganisation'), note: t('operating.organisationNote') }}
            laneLabel={(lane) => (lane === 0 ? t('operating.theOrganisation') : t('operating.lane', { lane }))}
            card={card} compact
          />
        </Box>
      )}
      {loose.length > 0 && (
        <Box component="section" aria-label={t('operating.libraryLooseRoles')} sx={{ mt: 1 }}>
          <Typography component="h3" sx={HEADING}>{t('operating.libraryLooseRoles')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1 }}>
            {loose.map((role) => <LooseRole key={role.entry} role={role} {...props} />)}
          </Box>
        </Box>
      )}
    </Box>
  )
}

/** The tick box that names a type or a role: ticked for good where the organisation has it already. */
function Tick({ entry, name, standing, ticked, onTick }: {
  entry: string; name: string; standing: Standing | undefined
} & Pick<LibraryStructureProps, 'ticked' | 'onTick'>) {
  return (
    <FormControlLabel
      sx={{ m: 0, mr: 0.5, '& .MuiFormControlLabel-label': { fontWeight: 700, fontSize: 13 } }}
      control={(
        <Checkbox size="small" sx={{ p: 0.25, mr: 0.5 }} checked={standing !== undefined || ticked.has(entry)} disabled={standing !== undefined}
          onChange={(_event, on) => onTick(entry, on)} />
      )}
      label={name}
    />
  )
}

/** What is said under the name: in the model already, matched to one of the organisation's, or come along. */
function Note({ standing, row, rows, t }: {
  standing: Standing | undefined; row: ComingInRow | undefined; rows: ReadonlyMap<string, ComingInRow>; t: Translate
}) {
  let words: string | undefined
  if (standing) words = t(standing.matched ? 'operating.inYourModelMatched' : 'operating.inYourModel', { name: standing.name })
  else if (row?.fate === 'reused') words = t('operating.usesYour', { name: row.name })
  else if (row && !row.asked) words = t('operating.comesAlong', { names: row.by.map((entry) => rows.get(entry)?.term ?? entry).join(', ') })
  return words ? <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, fontStyle: 'italic' }}>{words}</Typography> : null
}

/** What a role answers for, folded out under its card: each responsibility, and its letter. */
function Answers({ library, role, name, language, id }: { library: Library; role: string; name: string; language: LibraryLanguage; id?: string }) {
  const { t } = useStrings()
  const answers = answersOf(library, role, language)
  return (
    <Box id={id} sx={{ mt: 0.75, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{t('operating.answersFor', { role: name })}</Typography>
      {answers.length === 0
        ? <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('operating.answersNone')}</Typography>
        : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {answers.map((one) => (
              <Typography component="li" key={one.entry} sx={{ fontSize: 11 }}>
                <Box component="abbr" title={t(`operating.raci.${one.raci}`)} sx={{ fontWeight: 700, mr: 0.5, textDecoration: 'none' }}>{one.raci}</Box>
                {one.name}
              </Typography>
            ))}
          </Box>
        )}
    </Box>
  )
}

/** A role none of the library's types holds: ticked on its own, with what it answers for to fold out. */
function LooseRole({ role, ...props }: { role: LibraryRole } & LibraryStructureProps) {
  const { library, language, lists, rows, unfolded, onFold } = props
  const { t } = useStrings()
  const standing = standingFor(lists, library, role.entry)
  const open = unfolded.has(role.entry)
  const count = answersOf(library, role.entry, language).length
  return (
    <Box data-testid={`library-role-${role.entry}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 0.75 }}>
        <Tick entry={role.entry} name={role.name[language]} standing={standing} {...props} />
        {role.manages && <Badge>{t('operating.managesBadge')}</Badge>}
      </Box>
      <Note standing={standing} row={rows.get(role.entry)} rows={rows} t={t} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{role.purpose[language]}</Typography>
      <Fold open={open} onClick={() => onFold(role.entry)} controls={`answers-${role.entry}`}>
        {t(count === 1 ? 'operating.answersCountOne' : 'operating.answersCountOther', { count })}
      </Fold>
      {open && <Answers id={`answers-${role.entry}`} library={library} role={role.entry} name={role.name[language]} language={language} />}
    </Box>
  )
}

function Fold({ open, onClick, controls, children }: { open: boolean; onClick(): void; controls: string; children: ReactNode }) {
  return (
    <ButtonBase onClick={onClick} aria-expanded={open} aria-controls={open ? controls : undefined}
      sx={{ mt: 0.5, fontSize: 11, color: 'primary.main', borderRadius: 0.5, px: 0.25 }}>
      {open ? '▾ ' : '▸ '}{children}
    </ButtonBase>
  )
}
