// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where one holder reports, in the inspector of their assignment (ADR-0039,
 * amended 17 October 2026): the lines that hold for them on the day — their
 * own where they have one, else their role's in that unit, each saying where
 * it was said and marked where it is an override — or by nesting where no
 * solid line does; who manages them, and why; and an exception placement
 * said.
 *
 * Where the assignment may be written: *Override…*, a line of the holder's
 * own to a role in a unit or to one person (`LineTargetForm`), replacing
 * theirs of that kind; and, where they have one, what the model would say
 * beside *Use the model's*, which takes theirs away. A line to their own role
 * in their own unit, and a solid one that would close a loop, are refused here
 * and said why, as the agent's are. Each is one `assignment.update` in the
 * scope that keeps the assignment.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import { pickedPerson } from '../../model/person'
import { personLinesWith, refusePersonLines } from '../../model/reporting'
import type { ElementId } from '../../model/types'
import { isExceptionPlacement, linesOfHolder, managersOfHolder, personOf, reportingLinesOn } from '../../model/units'
import type { Assignment, Organisation, ReportingLineOn } from '../../model/units'
import type { PersonNames } from '../../people/ui/names'
import { reportingLineColours } from '../theme'
import { LineTargetForm } from './LineTargetForm'
import { refusalWords } from './lineWords'
import { lineWords, OverrideMark } from './UnitLines'

export type HolderLinesProps = {
  organisation: Organisation
  held: Assignment
  day: string
  editable: boolean
  /** The path of the scope that keeps a unit, as the tree has it. */
  scopeOf: (unitId: ElementId) => string | undefined
  names: PersonNames
  dispatch: (command: Command) => unknown
  s: Translate
}

const SECTION = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 } as const
const LINE = { fontSize: 13 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const
const ACTION = { minWidth: 0, px: 0.5, py: 0, fontSize: 12, textTransform: 'none' } as const

const SOURCE = { role: 'holder.sourceRole', type: 'holder.sourceType', unit: 'holder.sourceUnit', person: 'holder.sourcePerson' } as const

export function HolderLines(props: HolderLinesProps) {
  const { organisation, held, day, editable, names, s } = props
  const [editing, setEditing] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const lines = useMemo(() => linesOfHolder(organisation, held, day), [organisation, held, day])
  const managers = useMemo(() => managersOfHolder(organisation, held, day), [organisation, held, day])
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const own = held.reportsTo ?? []
  // What the model says for their role there, said beside their own line so taking it away is not a guess.
  const model = own.length === 0 ? [] : reportingLinesOn(organisation, day).filter((line) => line.unitId === held.unitId && line.roleId === held.roleId)
  const modelWords = model.length === 0 || !model.some((line) => line.kind === 'solid')
    ? [s('holder.modelNesting'), ...model.map((line) => lineWords(line, organisation, day, s, names))]
    : model.map((line) => lineWords(line, organisation, day, s, names))
  const write = (reportsTo: Assignment['reportsTo']) => {
    props.dispatch({ type: 'assignment.update', id: held.id, patch: { reportsTo: reportsTo?.length ? reportsTo : undefined } })
  }
  const exception = isExceptionPlacement(organisation, held)
  const viaWords = (via: string) => (via === 'line' ? ` · ${s('unit.byLine')}` : via === 'override' ? ` · ${s('unit.byOverride')}` : '')
  return (
    <Box data-testid="holder-lines">
      <Typography sx={SECTION}>{s('holder.reportsTo')}</Typography>
      {exception && (
        <Typography data-testid="holder-exception" sx={{ ...QUIET, borderLeft: 3, borderColor: (theme) => reportingLineColours(theme).override, pl: 1, mb: 0.5 }}>
          {s('unit.exceptionPlacement', { role: roleName(held.roleId), unit: unitName(held.unitId) })}
        </Typography>
      )}
      {!lines.some((line) => line.kind === 'solid' && line.state !== 'nesting') && (
        <Typography sx={LINE} data-testid="holder-line-nesting">{s('holder.byNesting')}</Typography>
      )}
      {lines.map((line) => <HolderLine key={`${line.kind}/${line.source}`} line={line} {...props} />)}
      {own.length > 0 && (
        <Typography sx={{ ...QUIET, mt: 0.5 }} data-testid="holder-model">{s('holder.model', { lines: modelWords.join('; ') })}</Typography>
      )}
      {editable && !editing && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Button size="small" sx={ACTION} data-testid="holder-line-override" onClick={() => { setRefused(undefined); setEditing(true) }}>
            {s('holder.override')}
          </Button>
          {own.length > 0 && (
            <Button size="small" sx={ACTION} data-testid="holder-line-use-model" onClick={() => { setRefused(undefined); write(undefined) }}>
              {s('holder.useModel')}
            </Button>
          )}
        </Box>
      )}
      {editable && editing && (
        <LineTargetForm
          organisation={organisation} day={day} scopeOf={props.scopeOf} names={names} fromUnit={held.unitId} testId="holder-line" s={s}
          title={s('holder.overrideTitle', { person: names.text(pickedPerson(personOf(held))) })}
          onCancel={() => { setEditing(false); setRefused(undefined) }}
          onSave={(said) => {
            const next = personLinesWith(own, said)
            const refusal = refusePersonLines(organisation, held, next, day)
            setRefused(refusal && refusalWords(refusal, organisation, s))
            if (refusal) return
            write(next)
            setEditing(false)
          }}
        />
      )}
      {refused && <Typography role="alert" sx={{ fontSize: 12, color: 'error.main' }} data-testid="holder-line-refused">{refused}</Typography>}
      <Typography sx={SECTION}>{s('holder.managedBy')}</Typography>
      {managers.length === 0 && <Typography sx={QUIET}>{s('holder.managedByNone')}</Typography>}
      {managers.map((one) => (
        <Typography key={one.assignment.id} sx={LINE} data-testid="holder-manager" data-via={one.via}>
          {s('unit.managedByLine', { person: names.text(pickedPerson(one.person)), role: roleName(one.roleId), unit: unitName(one.unitId) })}
          {viaWords(one.via)}
        </Typography>
      ))}
    </Box>
  )
}

/** One line that holds for them: where it lands, its kind, where it was said, and the override mark. */
function HolderLine({ line, organisation, day, names, s }: HolderLinesProps & { line: ReportingLineOn }) {
  return (
    <Typography component="div" sx={LINE} data-testid="holder-line" data-kind={line.kind} data-source={line.source} data-state={line.state}>
      {lineWords(line, organisation, day, s, names)}
      <Chip variant="outlined" label={s(line.kind === 'solid' ? 'unit.lineSolid' : 'unit.lineDotted')}
        sx={{ height: 18, fontSize: 10, ml: 0.5, ...(line.kind === 'dotted' ? { borderStyle: 'dotted' } : {}) }} />
      <Box component="span" sx={{ ...QUIET, ml: 0.5 }}>{s(SOURCE[line.source])}</Box>
      {line.override && <OverrideMark s={s} />}
    </Typography>
  )
}
