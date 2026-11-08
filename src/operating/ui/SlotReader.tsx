// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One role in one unit type: who its holders report to and where that answer
 * comes from, top rule first. The precedence is stated, not implied: a holder's
 * own line, then the unit's, then this type's, then the role's, then nesting. One
 * way to change it at this level and one way back, and how many units that moves.
 */
import { useState } from 'react'
import { linesInto, linesSaid } from '../../model/operatingModel'
import type { LineKind, RoleSlot, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Field, TextInput } from '../../widgets/kit/Field'
import { PanelSection } from '../../widgets/kit/Panel'
import { setReportsTo, setSlot } from '../edit'
import { LinesEditor } from './LinesEditor'
import { readerFoot, stackedFrame } from './ReaderParts'
import type { ReaderFrame, ReaderParts } from './ReaderParts'
import { howManyWords, lineWords, roleNamed, slotReading } from './reading'
import { plural } from '../../i18n/strings'

export function SlotReader({ type, slot, index, parts, onTakeOut, frame = stackedFrame }: {
  type: UnitType; slot: RoleSlot; index: number; parts: ReaderParts; onTakeOut(): void; frame?: ReaderFrame
}) {
  const { t } = useStrings()
  const { model, readOnly } = parts
  const [changing, setChanging] = useState<LineKind | 'many' | undefined>(undefined)
  const role = model.roles.find((one) => one.id === slot.role)
  const name = role?.name ?? slot.role
  const solid = slotReading(slot, role, 'solid')
  const write = (next: Parameters<typeof setReportsTo>[2]) => {
    const { slots, command } = setReportsTo(type, index, next)
    const why = parts.refuseLine?.({ on: 'slot', type, slots, roleId: slot.role, said: next })
    if (!why) parts.dispatch(command)
    return why
  }
  const typeSays = linesSaid(slot.reportsTo).find((one) => one.kind === 'solid')
  const units = parts.facts?.unitsOfType(type.id).length
  // How many it takes and how far the answer reaches: the facts beside the text.
  const facts = (
    <>
      <div className="op-rowEnd">
        <span>{t('operating.howMany', { many: howManyWords(slot, t) })}</span>
        {!readOnly && <Button variant="quiet" size="small" data-testid="operating-change-many" aria-expanded={changing === 'many'} onClick={() => setChanging(changing === 'many' ? undefined : 'many')}>{t('operating.change')}</Button>}
      </div>
      {changing === 'many' && !readOnly && <HowMany type={type} slot={slot} index={index} name={name} parts={parts} />}
      {units !== undefined && <p className="op-small">{plural(t, { one: 'operating.appliesToOne', other: 'operating.appliesTo' }, units)}</p>}
    </>
  )
  const body = (
    <div data-testid="operating-slot-reader">
      <p className="op-question">{t('operating.whoManager')}</p>
      <p className="op-answer" data-testid="operating-slot-answer">
        {solid.line?.role !== undefined ? roleNamed(model.roles, solid.line.role) : t('operating.byNestingCap')}
      </p>
      {solid.line?.role !== undefined && <p className="op-small">{t(solid.line.within ? 'operating.lineWithinShort' : 'operating.lineUpShort')}</p>}
      <PanelSection title={t('operating.chainTitle')}>
        <LineChain type={type} slot={slot} parts={parts} />
      </PanelSection>
      {!readOnly && (
        <div className="op-actions">
          <Button variant="plain" size="small" aria-expanded={changing === 'solid'} data-testid="operating-change-line" onClick={() => setChanging(changing === 'solid' ? undefined : 'solid')}>
            {t('operating.changeLineFor', { type: type.name })}
          </Button>
          {typeSays && <Button variant="quiet" size="small" data-testid="operating-line-back" onClick={() => write(linesSaidWithout(slot, 'solid'))}>{t('operating.backToRole')}</Button>}
        </div>
      )}
      {changing === 'solid' && !readOnly && (
        <LinesEditor roleId={slot.role} name={name} kind="solid" said={linesSaid(slot.reportsTo)} inherited={linesSaid(role?.reportsTo)} roles={model.roles} onChange={write} testId="operating-slot-lines" />
      )}
      <FunctionalLine slot={slot} name={name} parts={parts} changing={changing} onChanging={setChanging} write={write} />
      <ReportedBy slotRole={slot.role} parts={parts} />
    </div>
  )
  // Taking it out of the type stands alone at the foot's far end, where no other press lands on it.
  const away = !readOnly && <Button variant="danger" size="small" aria-label={t('operating.slotRemove', { role: name })} onClick={onTakeOut}>{t('operating.takeOut')}</Button>
  return frame({ body, facts, foot: readerFoot(parts, { away, history: true }) })
}

/** The functional line under the answer, with its Change. */
function FunctionalLine({ slot, name, parts, changing, onChanging, write }: {
  slot: RoleSlot; name: string; parts: ReaderParts
  changing: LineKind | 'many' | undefined; onChanging(next: LineKind | 'many' | undefined): void
  write(next: Parameters<typeof setReportsTo>[2]): string | undefined
}) {
  const { t } = useStrings()
  const { model, readOnly } = parts
  const role = model.roles.find((one) => one.id === slot.role)
  const dotted = slotReading(slot, role, 'dotted')
  return (
    <>
      <div className="op-rowEnd">
        <span>{t('operating.functionalLine', { line: dotted.line?.role !== undefined ? roleNamed(model.roles, dotted.line.role) : t('operating.none') })}</span>
        {!readOnly && <Button variant="quiet" size="small" data-testid="operating-change-functional" aria-expanded={changing === 'dotted'} onClick={() => onChanging(changing === 'dotted' ? undefined : 'dotted')}>{t('operating.change')}</Button>}
      </div>
      {changing === 'dotted' && !readOnly && (
        <LinesEditor roleId={slot.role} name={name} kind="dotted" said={linesSaid(slot.reportsTo)} inherited={linesSaid(role?.reportsTo)} roles={model.roles} onChange={write} testId="operating-slot-lines" />
      )}
    </>
  )
}

/** Where the answer comes from, top rule first. */
function LineChain({ type, slot, parts }: { type: UnitType; slot: RoleSlot; parts: ReaderParts }) {
  const { t } = useStrings()
  const { model, facts } = parts
  const role = model.roles.find((one) => one.id === slot.role)
  const below = facts?.saidBelow.filter((one) => one.roleId === slot.role && one.kind === 'solid' && facts.unitsOfType(type.id).some((unit) => unit.id === one.unitId)) ?? []
  const typeSays = linesSaid(slot.reportsTo).find((one) => one.kind === 'solid')
  const roleSays = linesSaid(role?.reportsTo).find((one) => one.kind === 'solid')
  const chain = [
    { level: t('operating.chainHolder'), says: saidBelowWords(below.filter((one) => one.on === 'holder').length, t) },
    { level: t('operating.chainUnit'), says: saidBelowWords(below.filter((one) => one.on === 'unit').length, t) },
    { level: type.name, says: typeSays ? `${lineWords(typeSays, model.roles, t)} · ${t('operating.chainThisOne')}` : t('operating.chainNothing'), here: typeSays !== undefined, wins: typeSays !== undefined },
    { level: t('operating.chainRole'), says: roleSays ? lineWords(roleSays, model.roles, t) : t('operating.chainNothing'), wins: typeSays === undefined && roleSays !== undefined },
    { level: t('operating.chainNesting'), says: t('operating.chainNestingSays'), wins: typeSays === undefined && roleSays === undefined },
  ]
  return (
    <ol className="op-chain" data-testid="operating-chain">
      {chain.map((one) => <li key={one.level} data-here={one.here || undefined} data-wins={one.wins || undefined}><span>{one.level}</span><span>{one.says}</span></li>)}
    </ol>
  )
}

const saidBelowWords = (count: number, t: Translate) => (count === 0 ? t('operating.chainNobody') : t('operating.chainSome', { count }))

const linesSaidWithout = (slot: RoleSlot, kind: LineKind) => {
  const left = linesSaid(slot.reportsTo).filter((one) => one.kind !== kind)
  return left.length ? left : undefined
}

function HowMany({ type, slot, index, name, parts }: { type: UnitType; slot: RoleSlot; index: number; name: string; parts: ReaderParts }) {
  const { t } = useStrings()
  const number = (value: string) => (value === '' ? undefined : Math.max(0, Number(value)))
  return (
    <div className="op-editor__two">
      <Field label={t('operating.slotMin')}>
        {(ties) => <TextInput {...ties} type="number" min={0} aria-label={`${name}: ${t('operating.slotMin')}`} value={slot.min} onChange={(event) => parts.dispatch(setSlot(type, index, { min: number(event.target.value) ?? 0 }))} />}
      </Field>
      <Field label={t('operating.slotMax')}>
        {(ties) => <TextInput {...ties} type="number" min={0} placeholder="∞" aria-label={`${name}: ${t('operating.slotMax')}`} value={slot.max ?? ''} onChange={(event) => parts.dispatch(setSlot(type, index, { max: number(event.target.value) }))} />}
      </Field>
    </div>
  )
}

/** Who reports to a role, across the model. */
export function ReportedBy({ slotRole, parts }: { slotRole: string; parts: ReaderParts }) {
  const { t } = useStrings()
  const { model } = parts
  const into = linesInto(model.unitTypes, model.roles, slotRole)
  const typeName = (id: string | undefined) => model.unitTypes.find((one) => one.id === id)?.name ?? id ?? ''
  return (
    <PanelSection title={t('operating.reportedToBy')}>
      {into.length === 0
        ? <span className="op-quiet">{t('operating.reportedToByNone')}</span>
        : into.map((line, at) => (
          <div key={`${line.from}/${line.typeId ?? ''}/${line.kind}/${at}`} data-testid="operating-reported-by">
            {line.source === 'role'
              ? t('operating.reportedByRole', { role: roleNamed(model.roles, line.from) })
              : t('operating.reportedBySlot', { role: roleNamed(model.roles, line.from), type: typeName(line.typeId) })}
            {' · '}{t(line.kind === 'solid' ? 'operating.lineSolid' : 'operating.lineDotted').toLowerCase()}
            {line.within ? ` · ${t('operating.lineWithinShort')}` : ''}
          </div>
        ))}
    </PanelSection>
  )
}
