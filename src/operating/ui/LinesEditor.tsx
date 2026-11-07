// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the holders of a role report, edited (ADR-0039 §2, §7, amended 17 October
 * 2026): one line of a kind, naming the role reported to, whether it is in the
 * same unit or found above, and the days it runs. A slot may also say *by nesting*
 * to take the role's line away for this type.
 *
 * A line the host says would close a loop, or one from a role to itself in the
 * same unit, is refused and said why, and not written.
 */
import { useState } from 'react'
import { linesWith } from '../../model/operatingModel'
import type { LineKind, ReportsTo, Role, RoleId } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { Field, Select, TextInput } from '../../widgets/kit/Field'

export type LinesEditorProps = {
  /** The role whose holders report: its lines are never offered to itself in the same unit. */
  roleId: RoleId
  /** The role's name, said in every control's name. */
  name: string
  /** The lines said here. */
  said: readonly ReportsTo[]
  kind: LineKind
  /** What holds until this place says otherwise: the role's own line, under a slot. Absent on the role itself. */
  inherited?: readonly ReportsTo[]
  roles: readonly Role[]
  /** Writes the lines as they would be, or says why they are refused, in which case nothing is written. */
  onChange: (next: ReportsTo[] | undefined) => string | undefined
  testId: string
}

/** A select's value for a row that says by nesting; nothing said is the empty string, a role its id. */
const NESTING = '\u0000nesting'

export function LinesEditor({ roleId, name, said, kind, inherited, roles, onChange, testId }: LinesEditorProps) {
  const { t } = useStrings()
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const line = said.find((one) => one.kind === kind)
  const under = inherited?.find((one) => one.kind === kind)
  const write = (next: ReportsTo | undefined) => setRefused(onChange(linesWith(said, kind, next)))
  const change = (patch: Partial<ReportsTo>) => {
    if (!line) return
    const next: ReportsTo = { ...line, ...patch }
    for (const key of ['from', 'until'] as const) if (next[key] === '') delete next[key]
    if (next.within !== true) delete next.within
    write(next)
  }
  const roleName = (id: string | undefined) => roles.find((one) => one.id === id)?.name ?? id ?? ''
  const nothingSaid = inherited !== undefined
    ? (under?.role !== undefined ? t('operating.reportsToAsRoleIs', { target: roleName(under.role) }) : t('operating.reportsToAsRole'))
    : t('operating.reportsToNone')
  const kindWord = t(kind === 'solid' ? 'operating.lineSolid' : 'operating.lineDotted')
  return (
    <div className="op-editor" data-testid={testId} data-kind={kind} data-said={line ? 'true' : undefined}>
      <Field label={`${t('operating.reportsTo')} (${kindWord})`}>
        {(ties) => (
          <Select
            {...ties} aria-label={`${name}: ${t('operating.reportsTo')} (${kindWord})`} value={line ? (line.role ?? NESTING) : ''}
            options={[
              { value: '', label: nothingSaid },
              ...(inherited !== undefined ? [{ value: NESTING, label: t('operating.reportsToNesting') }] : []),
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ]}
            onChange={(event) => {
              const picked = event.target.value
              if (picked === '') write(undefined)
              else if (picked === NESTING) write({ kind })
              else write({ ...(line ?? { kind }), role: picked, kind })
            }}
          />
        )}
      </Field>
      {line?.role !== undefined && (
        <>
          <Field label={t('operating.lineWhere')}>
            {(ties) => (
              <Select
                {...ties} aria-label={`${name}: ${t('operating.lineWhere')} (${kindWord})`} value={line.within ? 'within' : 'up'}
                options={[
                  { value: 'up', label: t('operating.lineUp') },
                  ...(line.role === roleId ? [] : [{ value: 'within', label: t('operating.lineWithin') }]),
                ]}
                onChange={(event) => change({ within: event.target.value === 'within' ? true : undefined })}
              />
            )}
          </Field>
          <div className="op-editor__two">
            <Field label={t('operating.lineFrom')}>
              {(ties) => <TextInput {...ties} type="date" aria-label={`${name}: ${t('operating.lineFrom')} (${kindWord})`} value={line.from ?? ''} onChange={(event) => change({ from: event.target.value })} />}
            </Field>
            <Field label={t('operating.lineUntil')}>
              {(ties) => <TextInput {...ties} type="date" aria-label={`${name}: ${t('operating.lineUntil')} (${kindWord})`} value={line.until ?? ''} onChange={(event) => change({ until: event.target.value })} />}
            </Field>
          </div>
        </>
      )}
      {refused && <div role="alert" className="op-small op-refused" data-testid="operating-line-refused">{refused}</div>}
    </div>
  )
}
