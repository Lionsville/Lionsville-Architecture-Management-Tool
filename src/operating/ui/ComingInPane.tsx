// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What will come in*: the step a library dialog is about to write, shown
 * before it is written (ADR-0036, amended 11 October 2026), as the rows
 * `whatWillComeIn` answers.
 *
 * Every name made is edited in place, starting from the library's term in the
 * screen's language, so a rename is not a second step; each unit type says
 * where it will sit, from the places `placementChoices` offers; each role is
 * brought in or one of the organisation's is used for it, the suggestion
 * first. What is in the model already is said, and used as it is. The button
 * says how much the one step makes.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import NativeSelect from '@mui/material/NativeSelect'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { placementKey } from '../comingIn'
import type { ComingInEdits, ComingInRow, PlacementChoice, WhatWillComeIn } from '../comingIn'
import type { OperatingLists } from '../bringIn'
import type { Library } from '../library'
import { countsLine } from './countsLine'
import { HEADING } from './Rules'

export type ComingInPaneProps = {
  library: Library
  lists: OperatingLists
  coming: WhatWillComeIn
  edits: ComingInEdits
  onEdit(edits: ComingInEdits): void
  onBring(): void
}

export function ComingInPane({ library, lists, coming, edits, onEdit, onBring }: ComingInPaneProps) {
  const { t } = useStrings()
  const rows = new Map(coming.rows.map((row) => [row.entry, row]))
  const types = coming.rows.filter((row) => row.kind === 'unitType' && row.fate !== 'inModel')
  const roles = coming.rows.filter((row) => row.kind === 'role' && row.fate !== 'inModel')
  const standing = coming.rows.filter((row) => row.fate === 'inModel')
  const reused = coming.rows.filter((row) => row.fate === 'reused').length
  const made = (kind: ComingInRow['kind']) => coming.rows.filter((row) => row.kind === kind && row.fate === 'made').length
  const context: RowContext = { library, lists, rows, edits, onEdit, t }
  return (
    <Box data-guide="operating.comingIn" data-testid="coming-in" component="section" aria-labelledby="coming-in-heading">
      <Typography component="h3" id="coming-in-heading" sx={{ ...HEADING, mt: 0 }}>{t('operating.comingIn')}</Typography>
      {coming.rows.length === 0 && <Typography variant="body2" color="text.secondary">{t('operating.comingInNothing')}</Typography>}
      {types.length > 0 && (
        <Box component="section" aria-label={t('operating.comingInTypes')} sx={{ mb: 1.5 }}>
          <Typography sx={SUBHEADING}>{t('operating.comingInTypes')}</Typography>
          {types.map((row) => <TypeRow key={row.entry} row={row} {...context} />)}
        </Box>
      )}
      {roles.length > 0 && (
        <Box component="section" aria-label={t('operating.comingInRoles')} sx={{ mb: 1.5 }}>
          <Typography sx={SUBHEADING}>{t('operating.comingInRoles')}</Typography>
          {roles.map((row) => <RoleRow key={row.entry} row={row} {...context} />)}
        </Box>
      )}
      {coming.responsibilities.length > 0 && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {t(coming.responsibilities.length === 1 ? 'operating.comingInDutiesOne' : 'operating.comingInDutiesOther', { count: coming.responsibilities.length })}
        </Typography>
      )}
      {standing.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('operating.comingInStanding', { names: standing.map((row) => (row.matched ? t('operating.nameMatched', { name: row.name }) : row.name)).join(', ') })}
        </Typography>
      )}
      {/* The step itself stays in reach however long the rows run. */}
      <Box sx={{ position: 'sticky', bottom: -16, mx: -2, px: 2, pt: 1, pb: 2, mb: -2, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}>
        {coming.made > 0 && (
          <Typography variant="body2" data-testid="coming-in-counts">
            {t('operating.comingInMakes', { counts: countsLine(t, made('unitType'), made('role'), coming.responsibilities.length) })}
          </Typography>
        )}
        <Button variant="contained" size="small" data-guide="operating.bringIn" disabled={coming.made === 0 && reused === 0}
          onClick={onBring} sx={{ textTransform: 'none', mt: 1 }}>
          {coming.made === 0 && reused > 0
            ? t('operating.bringInMatches')
            : t(coming.made === 1 ? 'operating.bringInOne' : 'operating.bringInOther', { count: coming.made })}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{t('operating.comingInOneStep')}</Typography>
      </Box>
    </Box>
  )
}

const SUBHEADING = { fontSize: 12, fontWeight: 700, mb: 0.5 } as const

type RowContext = {
  library: Library
  lists: OperatingLists
  rows: ReadonlyMap<string, ComingInRow>
  edits: ComingInEdits
  onEdit(edits: ComingInEdits): void
  t: Translate
}

/** One row's frame: the library's term, and why it is there where it was not ticked. */
function RowFrame({ row, rows, t, children }: { row: ComingInRow; children: ReactNode } & Pick<RowContext, 'rows' | 't'>) {
  return (
    <Box data-testid={`coming-${row.entry}`} sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography sx={{ fontSize: 12 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{row.term}</Box>
        {!row.asked && row.by.length > 0 && (
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {' · '}{t('operating.comesAlong', { names: row.by.map((entry) => rows.get(entry)?.term ?? entry).join(', ') })}
          </Box>
        )}
      </Typography>
      {children}
    </Box>
  )
}

/** The name an item made will have, edited in place: blank is the library's term. */
function NameField({ row, edits, onEdit, t }: { row: ComingInRow } & Pick<RowContext, 'edits' | 'onEdit' | 't'>) {
  const typed = edits.names && Object.hasOwn(edits.names, row.entry) ? edits.names[row.entry] : row.name
  return (
    <TextField
      size="small" fullWidth value={typed} placeholder={row.term} sx={{ '& .MuiInputBase-input': { py: 0.5, fontSize: 13 } }}
      slotProps={{ htmlInput: { 'aria-label': t('operating.calledHere', { term: row.term }) } }}
      onChange={(event) => onEdit({ ...edits, names: { ...edits.names, [row.entry]: event.target.value } })}
    />
  )
}

function TypeRow({ row, ...context }: { row: ComingInRow } & RowContext) {
  const { lists, edits, onEdit, t } = context
  return (
    <RowFrame row={row} {...context}>
      {row.fate === 'made' && <NameField row={row} {...context} />}
      {row.fate === 'made' && row.place && row.places && (
        <NativeSelect
          value={placementKey(row.place)} sx={{ fontSize: 12 }}
          inputProps={{ 'aria-label': t('operating.sitsInOf', { term: row.term }) }}
          onChange={(event) => {
            const choice = row.places?.find((one) => placementKey(one) === event.target.value)
            if (choice) onEdit({ ...edits, places: { ...edits.places, [row.entry]: choice } })
          }}
        >
          {row.places.map((choice) => <option key={placementKey(choice)} value={placementKey(choice)}>{placeLabel(choice, row, context)}</option>)}
        </NativeSelect>
      )}
      {(row.suggested !== undefined || row.fate === 'reused') && (
        <Reuse row={row} items={lists.unitTypes} bringIn={t('operating.bringInNewType')} {...context} />
      )}
    </RowFrame>
  )
}

function RoleRow({ row, ...context }: { row: ComingInRow } & RowContext) {
  const { lists, t } = context
  return (
    <RowFrame row={row} {...context}>
      {row.fate === 'made' && <NameField row={row} {...context} />}
      {lists.roles.length > 0 && <Reuse row={row} items={lists.roles} bringIn={t('operating.bringInNewRole')} {...context} />}
    </RowFrame>
  )
}

/** Bring it in, or use one of the organisation's for it: the suggestion said, and first among them. */
function Reuse({ row, items, bringIn, edits, onEdit, t }: {
  row: ComingInRow; items: readonly { id: string; name: string }[]; bringIn: string
} & Pick<RowContext, 'edits' | 'onEdit' | 't'>) {
  const NEW = ''
  const ordered = [...items.filter((item) => item.id === row.suggested), ...items.filter((item) => item.id !== row.suggested)]
  return (
    <NativeSelect
      value={row.fate === 'reused' ? row.id : NEW} sx={{ fontSize: 12 }}
      inputProps={{ 'aria-label': t('operating.reuseOf', { term: row.term }) }}
      onChange={(event) => onEdit({ ...edits, reuse: { ...edits.reuse, [row.entry]: event.target.value === NEW ? null : event.target.value } })}
    >
      <option value={NEW}>{bringIn}</option>
      {ordered.map((item) => (
        <option key={item.id} value={item.id}>
          {t(item.id === row.suggested ? 'operating.useYourSuggested' : 'operating.useYour', { name: item.name })}
        </option>
      ))}
    </NativeSelect>
  )
}

/**
 * A place, in words: as in the library — in the types it sits in there, by
 * the name each will have or has — at the top, or beside or inside one of the
 * organisation's types, by its name and where it sits.
 */
export function placeLabel(choice: PlacementChoice, row: ComingInRow, { library, lists, rows, t }: RowContext): string {
  const typeName = (id: string) => lists.unitTypes.find((type) => type.id === id)?.name ?? id
  const or = (names: readonly string[]) => names.join(t('operating.listOr'))
  switch (choice.how) {
    case 'library': {
      const item = library.unitTypes.find((one) => one.entry === row.entry)
      const within = (item?.within ?? []).map((entry) => rows.get(entry)?.name ?? entry)
      if (within.length === 0) return t('operating.placeLibraryTop', { library: library.name })
      return t(item?.top ? 'operating.placeLibraryOrTop' : 'operating.placeLibrary', { library: library.name, where: or(within) })
    }
    case 'top': return t('operating.placeTop')
    case 'inside': return t('operating.placeInside', { name: typeName(choice.type) })
    case 'beside': {
      const type = lists.unitTypes.find((one) => one.id === choice.type)
      const where = [...(type?.top ? [t('operating.atTheTop')] : []), ...(type?.within ?? []).map(typeName)]
      return t('operating.placeBeside', { name: typeName(choice.type), where: or(where) })
    }
  }
}
