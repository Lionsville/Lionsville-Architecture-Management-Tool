// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The table under the Conway map (ADR-0036 §7): for each two of its columns,
 * how many interfaces run between them and the mode of every interaction
 * declared between them — whether or not an interface runs there — and the
 * cell shaded by how the two stand. An interface with nothing declared is
 * shaded one way; an interaction declared that no interface needs, another.
 * The cells are `model/conway`'s `pairs`; this only draws them.
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { StringKey, Translate } from '../../i18n'
import { pairBetween } from '../../model/conway'
import type { ConwayMap, ConwayPair, PairState } from '../../model/conway'
import { INTERACTION_MODES, INTERACTION_MODE_LABEL } from '../../model/relations'
import type { ElementId, InteractionMode } from '../../model/types'
import type { UnitViewsHere } from './unitViewsHere'

/** The one letter a mode is marked with in the table, in the reader's language. */
const MODE_MARK: Record<InteractionMode, StringKey> = {
  collaboration: 'conway.mark.collaboration',
  service: 'conway.mark.service',
  facilitating: 'conway.mark.facilitating',
}

/** A cell's fill and the ink its words are measured against it in (`theme.contrast.test.ts`). */
export type CellShade = { fill: string; ink: string }

/**
 * The two shadings a cell can have: an interface with nothing declared, in a
 * tint of the warning the dashed line is drawn in, and an interaction no
 * interface needs, in the neutral tint of a selected row — each lettered in an
 * ink measured over it, on either ground, in both modes.
 */
export function conwayCellShade(theme: Theme): Record<Extract<PairState, 'undeclared' | 'unused'>, CellShade> {
  const { palette } = theme
  return {
    undeclared: { fill: alpha(palette.warning.main, palette.mode === 'dark' ? 0.24 : 0.16), ink: palette.text.primary },
    unused: { fill: palette.action.selected, ink: palette.text.secondary },
  }
}

/** The groups' key for the applications nobody owns, where a key has to be a string. */
const NOBODY = ''

export function ConwayTable({ map, here, t }: { map: ConwayMap; here: UnitViewsHere; t: Translate }) {
  const groups = map.groups.map((group) => group.unitId)
  if (groups.length < 2) return null
  const between = pairBetween(map)
  const label = (id: ElementId | undefined) => (id === undefined ? t('conway.nobody') : here.name(id))
  return (
    <Box data-testid="conway-matrix" sx={{ mt: 3, overflowX: 'auto' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{t('conway.matrix')}</Typography>
      <Box component="table" sx={{ borderCollapse: 'collapse', fontSize: 11.5, '& th, & td': { border: 1, borderColor: 'divider', px: 0.75, py: 0.25, textAlign: 'center' } }}>
        <thead><tr><th />{groups.map((g) => <th key={g ?? NOBODY}>{label(g)}</th>)}</tr></thead>
        <tbody>
          {groups.map((row) => (
            <tr key={row ?? NOBODY}>
              <th style={{ textAlign: 'left' }}>{label(row)}</th>
              {groups.map((col) => (row === col
                ? <td key={col ?? NOBODY}>·</td>
                : <Cell key={col ?? NOBODY} pair={between(row, col)} t={t} />))}
            </tr>
          ))}
        </tbody>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{t('conway.matrixNote')}</Typography>
    </Box>
  )
}

/** The modes declared in a cell, each once, in the order the modes are listed; one with no mode as `?`. */
function marksOf(pair: ConwayPair, t: Translate): { marks: string; title: string } {
  const modes = INTERACTION_MODES.filter((mode) => pair.interactions.some((row) => row.mode === mode))
  const unnamed = pair.interactions.some((row) => row.mode === undefined)
  const marks = [...modes.map((mode) => t(MODE_MARK[mode])), ...(unnamed ? [t('conway.mark.unnamed')] : [])].join('')
  const titles = [...modes.map((mode) => t(INTERACTION_MODE_LABEL[mode])), ...(unnamed ? [t('conway.anInteraction')] : [])]
  return { marks, title: titles.length ? titles.join(' · ') : t('conway.cellNone') }
}

/** One cell: its count, its letters, and its shade. */
function Cell({ pair, t }: { pair: ConwayPair | undefined; t: Translate }) {
  const theme = useTheme()
  if (!pair) return <td />
  const { marks, title } = marksOf(pair, t)
  const shades = conwayCellShade(theme)
  const shade = pair.state === 'undeclared' || pair.state === 'unused' ? shades[pair.state] : undefined
  return (
    <Box component="td" title={title} data-testid="conway-cell" data-state={pair.state}
      sx={{
        bgcolor: shade?.fill ?? 'transparent', color: shade?.ink ?? (pair.state === 'declared' ? 'primary.main' : 'text.primary'),
        fontWeight: pair.state === 'undeclared' ? 700 : 400,
      }}>
      {pair.interfaces || ''}{marks ? <sup>{marks}</sup> : null}
    </Box>
  )
}
