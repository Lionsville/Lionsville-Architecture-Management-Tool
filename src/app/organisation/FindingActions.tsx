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
import type { Translate } from '../../i18n'
import { CHECK_ACTION_LABEL, CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { OwnerChoice } from '../../model/ownerField'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { Button } from '../../widgets/kit/Button'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import type { CheckMarking } from '../checkMarking'
import { endAssignmentFix, markSharedFix, removeAssignmentFix, removeInteractionFix, setOwnerFix } from './checkFixes'
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

export function FindingActions({ instance, index, marking, today, onOpen, openLabel, onLink, onFixed, s }: FindingActionsProps) {
  const { actions } = CHECK_CATALOGUE[instance.key]
  const about = instance.about
  const land = (fix: Fix | undefined, said: string) => {
    if (!fix || !marking?.mayChange(fix.scope)) return
    void marking.write(fix.scope, fix.commands).then((landed) => {
      if (landed) onFixed({ message: said, back: () => { void marking.write(fix.scope, fix.back) } })
      return undefined
    })
  }
  const may = (scope: ScopePath | undefined) => scope !== undefined && marking?.mayChange(scope) === true
  const master = about !== undefined ? index.lookup(about)?.master : undefined
  const conflict = instance.key === 'check.conflict' && 'scopes' in instance.finding ? instance.finding.scopes?.[0] : undefined
  const subject = instance.subject ?? instance.text
  return (
    <span className="org-finding__acts">
      {actions.includes('setOwner') && about !== undefined && may(master) && (
        <SetOwner index={index} s={s} onSet={(choice) => land(setOwnerFix(index, about, choice), s('checks.fixedOwner', { name: subject }))} />
      )}
      {actions.includes('markShared') && about !== undefined && may(master) && (
        <Button data-testid="fix-mark-shared" onClick={() => land(markSharedFix(index, about), s('checks.fixedShared', { name: subject }))}>{s(CHECK_ACTION_LABEL.markShared)}</Button>
      )}
      {actions.includes('endAssignment') && may(instance.scope) && (
        <Button data-testid="fix-end-assignment" onClick={() => land(endAssignmentFix(index, instance, today), s('checks.fixedEnded', { name: subject }))}>{s(CHECK_ACTION_LABEL.endAssignment)}</Button>
      )}
      {actions.includes('removeAssignment') && may(instance.scope) && (
        <Button variant="danger" data-testid="checks-remove-assignment" onClick={() => land(removeAssignmentFix(index, instance), s('checks.fixedRemoved', { name: subject }))}>{s(CHECK_ACTION_LABEL.removeAssignment)}</Button>
      )}
      {actions.includes('removeInteraction') && may(instance.scope) && (
        <Button data-testid="fix-remove-interaction" onClick={() => land(removeInteractionFix(index, instance), s('checks.fixedInteraction', { name: subject }))}>{s(CHECK_ACTION_LABEL.removeInteraction)}</Button>
      )}
      {actions.includes('link') && onLink && conflict !== undefined && about !== undefined && marking?.mayChange(conflict) && (
        <Button data-testid="register-link" onClick={() => onLink(conflict, about, instance.scope ?? '')}>{s('register.linkRow')}</Button>
      )}
      {onOpen && instance.opens && <Button variant="quiet" onClick={() => onOpen(instance)} data-guide="checks.instance.open">{openLabel ?? s(onABoard(instance) ? 'register.openOnBoard' : 'checks.openWhereFixed')}</Button>}
    </span>
  )
}
