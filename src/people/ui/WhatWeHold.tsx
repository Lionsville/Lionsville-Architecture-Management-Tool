// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What we hold*: the answer to a request for access, as a page somebody can read
 * and hand on. The same facts go as text or as JSON, because one is for the person
 * who asked and the other for whoever files it.
 */
import { useEffect, useState } from 'react'
import { Dialog } from '../../widgets/kit/Dialog'
import { heldLine, holdText, keptName, pointerLine, ruleLine, whatWeHold } from '../hold'
import type { Mention, PointsAt } from '../hold'
import { meIdIn } from '../me'
import type { Person } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess } from './access'
import { KIND_LABEL, useDayWords } from './parts'
import { usePointsAt } from './PersonReader'

/** The names typed as text: what a search across the tree finds for this name. Nothing is asked of a name that is gone. */
export function useMentions(name: string | undefined, register: Pick<PeopleRegisterAccess, 'mentionsOf'>): readonly Mention[] | undefined {
  const [mentions, setMentions] = useState<Mention[] | undefined>(undefined)
  const { mentionsOf } = register
  useEffect(() => {
    let stale = false
    setMentions(undefined)
    if (name) void mentionsOf(name).then((found) => { if (!stale) setMentions(found) }, () => { if (!stale) setMentions([]) })
    return () => { stale = true }
  }, [mentionsOf, name])
  return mentions
}

function holdOf(person: Person, register: PeopleRegisterAccess, found: PointsAt | undefined, mentions: readonly Mention[] | undefined) {
  return whatWeHold(person, register.people ?? [], {
    thisIsMe: meIdIn(register.me, register.people) === person.id,
    assignments: (register.assignmentsOf?.(person.id) ?? []).map(heldLine),
    ...(mentions ? { mentions } : {}),
    ...(found ? {
      namedIn: found.pointers.filter((one) => !keptName(one)).map((one) => pointerLine(one)),
      // On a forgotten entry, only that each signature exists: never the name it was signed with.
      signed: found.pointers.filter(keptName).map((one) => pointerLine(one, person.state === 'forgotten')),
      derived: found.byRule.map(ruleLine),
    } : {}),
  })
}

export function WhatWeHold({ person, register, copyText, onClose, s }: {
  person: Person; register: PeopleRegisterAccess; copyText: ((text: string) => void) | undefined; onClose: () => void; s: Translate
}) {
  const dayWords = useDayWords()
  const found = usePointsAt(person.id, register)
  const mentions = useMentions(person.name, register)
  const held = holdOf(person, register, found, mentions)
  const state = person.state === 'left' ? s('people.stateLeft', { day: dayWords(person.leftOn) })
    : person.state === 'forgotten' ? s('people.stateForgotten', { day: dayWords(person.forgottenOn) }) : s('people.stateActive')
  const entry = [held.register.name, held.register.email, s(KIND_LABEL[person.kind]), state].filter(Boolean).join(' · ')
  const none = s('people.holdNone')
  const sections: readonly (readonly [string, readonly string[]])[] = [
    [s('people.holdEntry'), [entry, `${held.register.id} · ${s('people.holdPseudonym', { code: held.register.pseudonym })}`]],
    [s('people.holdYou'), [s(held.thisIsMe ? 'people.holdYes' : 'people.holdNo')]],
    [s('people.holdMerged'), held.mergedFrom],
    [s('people.holdRoles'), held.assignments],
    [s('people.holdNamedOn'), held.namedIn],
    [s('people.holdSigned'), held.signed],
    [s('people.holdRule'), held.derived],
    [s('people.holdTyped'), held.mentions.map((one) => `${one.title} (${one.scope || s('common.organisation')})`)],
  ]
  const asText = [
    shownText(shownEntry(person), s),
    ...sections.map(([label, lines]) => `${label}\n${(lines.length ? lines : [none]).map((line) => `- ${line}`).join('\n')}`),
  ].join('\n\n')
  return (
    <Dialog
      open size="l" title={s('people.holdTitle', { name: shownText(shownEntry(person), s) })} onClose={onClose}
      actions={{
        aside: [copyText && { onClick: () => copyText(asText), 'data-testid': 'people-hold-copy-text', label: s('people.holdCopyText') }, copyText && { onClick: () => copyText(holdText(held)), 'data-testid': 'people-hold-copy-json', label: s('people.holdCopyJson') }],
        cancel: { onClick: onClose, label: s('people.close') },
      }}
    >
      <div className="people-stack" data-testid="people-hold">
        <p className="people-note">{s('people.holdNote')}</p>
        <dl className="people-hold">
          {sections.map(([label, lines]) => (
            <div key={label} className="people-hold__row">
              <dt>{label}</dt>
              <dd>
                {lines.length === 0 && <span className="people-quiet">{none}</span>}
                {lines.map((line, at) => <span key={at} className="people-line">{line}</span>)}
              </dd>
            </div>
          ))}
        </dl>
        {person.name && mentions && <p className="people-note">{s('people.mentionsNote', { count: mentions.length })}</p>}
      </div>
    </Dialog>
  )
}
