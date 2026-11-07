// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a finding offers where it is read: its one-field fix, then the way to
 * where it is fixed. The same on a row of Found and in a register's preview, so a
 * finding offers the same thing wherever it is met.
 *
 * Nothing is open on a home, so no ⌘Z reaches a fix made here: each lands as a
 * step in the scope that keeps the record, is named in Activity, and has *Put
 * back* in the toast, which is another step. `readOnly`, or a scope the person
 * may only read, shows only the way to where it is.
 */
import { useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import { INTERACTION_MODE_LABEL, INTERACTION_MODES } from '../../model/relations'
import { CHECK_ACTION_LABEL, CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { CheckAction } from '../../model/checkCatalogue'
import type { Person } from '../../people/person'
import type { ScopeModel } from '../../projects/scope'
import { MenuButton } from '../../widgets/kit/Menu'
import type { OwnerChoice } from '../../model/ownerField'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { Button } from '../../widgets/kit/Button'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import type { CheckMarking } from '../checkMarking'
import { acceptFix, assignFix, declareFix, endAssignmentFix, markSharedFix, removeAssignmentFix, removeInteractionFix, setOwnerFix } from './checkFixes'
import type { Fix } from './checkFixes'
import type { CheckInstance } from './treeChecks'

export type FixDone = { readonly message: string; readonly back: () => void }

export type FindingActionsProps = {
  readonly instance: CheckInstance
  readonly index: Pick<ScopeIndex, 'lookup' | 'assignments' | 'rowsOf' | 'units'>
  readonly marking: CheckMarking | undefined
  readonly today: string
  /** Go where it is fixed, with the walk through the check started from here. */
  readonly onOpen?: (instance: CheckInstance) => void
  readonly openLabel?: string
  /** Link: the session of the scope that yields does it, so the scope is opened on it. */
  readonly onLink?: (scope: ScopePath, id: string, to: ScopePath) => void
  /** Where a new record's id comes from: an interaction declared, a role assigned. */
  readonly makeId?: ((prefix: string) => string) | undefined
  /** Who a role can be assigned to. */
  readonly people?: readonly Person[] | undefined
  /** A scope's records, for an interface worked out from its container lines. */
  readonly modelOf?: ((scope: ScopePath) => ScopeModel['model'] | undefined) | undefined
  /** A fix that landed, with its way back. */
  readonly onFixed: (done: FixDone) => void
  readonly s: Translate
}

/** The units one might set as an owner, with where each is kept to tell two apart. */
function unitOptions(index: Pick<ScopeIndex, 'units'>): PickerOption[] {
  return index.units().map(({ unit, scope }) => ({ id: unit.id, label: unit.name, detail: scope }))
}

function SetOwner({ index, onSet, s }: { index: FindingActionsProps['index']; onSet: (choice: OwnerChoice) => void; s: Translate }) {
  const [open, setOpen] = useState(false)
  if (!open) return <Button onClick={() => setOpen(true)} data-testid="fix-set-owner">{s(CHECK_ACTION_LABEL.setOwner)}</Button>
  return (
    <span className="org-fix">
      <span className="org-fix__picker">
        <Picker
          label={s('checks.ownerField')} placeholder={s('checks.ownerField')} options={unitOptions(index)} posture="popup" autoFocus
          onPick={(option) => onSet({ unit: option.id })}
          onCreate={(name) => onSet({ name })} createLabel={(name) => s('checks.ownerNotAUnit', { name })}
        />
      </span>
      <Button variant="quiet" onClick={() => setOpen(false)}>{s('common.cancel')}</Button>
    </span>
  )
}

/** Whether opening it lands on a board, which can be said in those words. */
function onABoard({ opens }: CheckInstance): boolean {
  return opens !== undefined && 'page' in opens && (opens.page.page === 'element' || opens.page.page === 'board')
}

/** Somebody who can hold a role: named, and not gone or merged away. */
function peopleOptions(people: readonly Person[]): PickerOption[] {
  return people.filter((one) => one.name !== undefined && one.mergedInto === undefined && one.leftOn === undefined).map((one) => ({ id: one.id, label: one.name as string }))
}

function Assign({ people, onPick, s }: { people: readonly Person[]; onPick: (id: string) => void; s: Translate }) {
  const [open, setOpen] = useState(false)
  if (!open) return <Button onClick={() => setOpen(true)} data-testid="fix-assign">{s(CHECK_ACTION_LABEL.assign)}</Button>
  return (
    <span className="org-fix">
      <span className="org-fix__picker">
        <Picker label={s(CHECK_ACTION_LABEL.assign)} placeholder={s(CHECK_ACTION_LABEL.assign)} options={peopleOptions(people)} posture="popup" autoFocus onPick={(option) => onPick(option.id)} />
      </span>
      <Button variant="quiet" onClick={() => setOpen(false)}>{s('common.cancel')}</Button>
    </span>
  )
}

/** The scope whose record should give way, where two define one thing: *Link* is offered on it. */
function yieldingScope({ key, finding }: CheckInstance): ScopePath | undefined {
  return key === 'check.conflict' && 'scopes' in finding ? finding.scopes?.[0] : undefined
}

/** The fixes of one press: which action of the catalogue, what writes it, and what the toast says it did. */
function oneFixes(props: FindingActionsProps): readonly { action: CheckAction; testId: string; danger?: true; fix: () => Fix | undefined; said: StringKey }[] {
  const { instance, index, today, modelOf, makeId } = props
  const about = instance.about
  return [
    { action: 'markShared', testId: 'fix-mark-shared', fix: () => (about !== undefined ? markSharedFix(index, about) : undefined), said: 'checks.fixedShared' },
    { action: 'endAssignment', testId: 'fix-end-assignment', fix: () => endAssignmentFix(index, instance, today), said: 'checks.fixedEnded' },
    { action: 'removeAssignment', testId: 'checks-remove-assignment', danger: true, fix: () => removeAssignmentFix(index, instance), said: 'checks.fixedRemoved' },
    { action: 'removeInteraction', testId: 'fix-remove-interaction', fix: () => removeInteractionFix(index, instance), said: 'checks.fixedInteraction' },
    {
      action: 'acceptInterface', testId: 'fix-accept', said: 'checks.fixedAccepted',
      fix: () => (makeId ? acceptFix(instance.scope !== undefined ? modelOf?.(instance.scope) : undefined, instance, makeId('rel'), today, (id) => index.lookup(id)?.name ?? id) : undefined),
    },
  ]
}

export function FindingActions(props: FindingActionsProps) {
  const { instance, index, marking, today, onOpen, openLabel, onLink, makeId, people, onFixed, s } = props
  const { actions } = CHECK_CATALOGUE[instance.key]
  const about = instance.about
  const subject = instance.subject ?? instance.text
  const land = (fix: Fix | undefined, said: StringKey) => {
    if (!fix || !marking?.mayChange(fix.scope)) return
    void marking.write(fix.scope, fix.commands).then((landed) => {
      if (landed) onFixed({ message: s(said, { name: subject }), back: () => { void marking.write(fix.scope, fix.back) } })
      return undefined
    })
  }
  const may = (scope: ScopePath | undefined) => scope !== undefined && marking?.mayChange(scope) === true
  const master = about !== undefined ? index.lookup(about)?.master : undefined
  const onRecord = about !== undefined && may(master)
  const yields = yieldingScope(instance)
  const offered = oneFixes(props).filter((one) => actions.includes(one.action) && may(one.action === 'markShared' ? master : instance.scope))
  return (
    <span className="org-finding__acts">
      {actions.includes('setOwner') && onRecord && (
        <SetOwner index={index} s={s} onSet={(choice) => land(setOwnerFix(index, about, choice), 'checks.fixedOwner')} />
      )}
      {offered.map((one) => (
        <Button key={one.action} data-testid={one.testId} {...(one.danger ? { variant: 'danger' as const } : {})} onClick={() => land(one.fix(), one.said)}>
          {s(CHECK_ACTION_LABEL[one.action])}
        </Button>
      ))}
      {actions.includes('assign') && onRecord && makeId && people && (
        <Assign people={people} s={s} onPick={(person) => land(assignFix(index, instance, person, makeId('as'), today), 'checks.fixedAssigned')} />
      )}
      {actions.includes('declareInteraction') && makeId && may(instance.scope) && (
        <MenuButton
          label={s(CHECK_ACTION_LABEL.declareInteraction)}
          items={INTERACTION_MODES.map((mode) => ({ label: s(INTERACTION_MODE_LABEL[mode]), onSelect: () => land(declareFix(instance, mode, makeId('rel')), 'checks.fixedDeclared') }))}
        />
      )}
      {onLink && yields !== undefined && about !== undefined && may(yields) && (
        <Button data-testid="register-link" onClick={() => onLink(yields, about, instance.scope ?? '')}>{s('register.linkRow')}</Button>
      )}
      {onOpen && instance.opens && <Button variant="quiet" onClick={() => onOpen(instance)}>{openLabel ?? s(onABoard(instance) ? 'register.openOnBoard' : 'checks.openWhereFixed')}</Button>}
    </span>
  )
}
