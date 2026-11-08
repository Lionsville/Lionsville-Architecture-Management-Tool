// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record's name: a heading that a press turns into a field, where it may be
 * written, and only a heading where it may not, so a reader sees the same layout
 * without the affordance. Enter or leaving keeps it, Escape drops it, and refused
 * words come back as the sentence to say with what was typed still on the field.
 *
 * **What is typed is never thrown away under the person.** Where the place
 * says what the name is of (`subject`), the name moving while the field is
 * open — somebody else renamed the same thing — leaves the field open with
 * what was typed, and says who renamed it to what. Enter then keeps the
 * person's, marked as made over a name that moved (`movedUnder`), so whoever
 * checks two changes against each other asks which stays rather than letting
 * the later one win unasked. Another subject is another name, and the field
 * closes as before.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { PencilIcon } from '../icons'
import { claimKey } from './keys'
import './PressName.css'

/** How a rename was made: over a name that moved under the person while they typed. */
export type RenameMade = { readonly movedUnder?: true }

export type PressNameProps = {
  readonly name: string
  readonly onRename?: ((name: string, made?: RenameMade) => string | void) | undefined
  /** What the name is of. The same subject renamed under an open field keeps the field; without it, any new name closes it. */
  readonly subject?: string | undefined
  /** Who renamed it, where the place can say, asked when the name moves under an open field. */
  readonly movedBy?: (() => string | undefined) | undefined
  /** A new number opens the field, for a command that asks for the name from elsewhere. */
  readonly renameRequest?: number | undefined
  /** A request there at the first draw counts too: for what was just made and drawn for the first time. */
  readonly renameAtOnce?: boolean | undefined
  readonly heading: 'h1' | 'h2' | 'span'
  /** The look is the place's: a panel's name and a record's title are not the same size. */
  readonly classes: { readonly heading: string; readonly press: string; readonly field: string; readonly refused: string }
}

export function PressName({ name, onRename, subject, movedBy, renameRequest, renameAtOnce, heading: Heading, classes }: PressNameProps) {
  const { t } = useStrings()
  const [typed, setTypedState] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  /** The name moved under the open field: to what, and by whom where that is known. */
  const [moved, setMoved] = useState<{ to: string; by?: string } | null>(null)
  /** The name the field was opened over. */
  const over = useRef(name)
  const setTyped = (next: string | null, from = name) => {
    if (next !== null && typed === null) over.current = from
    if (next === null) setMoved(null)
    setTypedState(next)
  }
  const field = useRef<HTMLTextAreaElement>(null)
  const pressed = useRef<HTMLButtonElement>(null)
  const editing = typed !== null
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing && !wasEditing.current) { field.current?.focus(); field.current?.select() }
    if (!editing && wasEditing.current) pressed.current?.focus()
    wasEditing.current = editing
  }, [editing])

  // Another selection is another name, and whatever was being typed was not about it.
  // The same subject renamed while the field is open is the same name moving: the field stays.
  const was = useRef({ name, subject })
  useEffect(() => {
    const before = was.current
    was.current = { name, subject }
    if (before.name === name && before.subject === subject) return
    if (typed !== null && subject !== undefined && before.subject === subject) {
      const by = movedBy?.()
      setMoved(name === over.current ? null : { to: name, ...(by ? { by } : {}) })
      return
    }
    setTyped(null)
    setRefused(null)
  }, [name, subject])

  // After the clearing above, which a first draw runs too.
  const asked = useRef(renameAtOnce ? undefined : renameRequest)
  useEffect(() => {
    if (renameRequest === asked.current) return
    asked.current = renameRequest
    if (onRename && renameRequest !== undefined) setTyped(name)
    // Only a new request opens the field; a name moving under it does not.
  }, [renameRequest])

  if (!onRename) return <Heading className={classes.heading}>{name}</Heading>
  const commit = () => {
    if (typed === null) return
    // Over a name that moved since the field opened: said, so the two renames are weighed rather than the later winning.
    const made: RenameMade | undefined = over.current !== name ? { movedUnder: true } : undefined
    const answer = typed.trim() && typed !== name ? (made ? onRename(typed.trim(), made) : onRename(typed.trim())) : undefined
    if (typeof answer === 'string') {
      setRefused(answer)
      return
    }
    setRefused(null)
    setTyped(null)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      claimKey(event)
      setRefused(null)
      setTyped(null)
    }
  }
  if (!editing) {
    return (
      <Heading className={classes.heading}>
        <button type="button" ref={pressed} className={classes.press} aria-label={`${t('kit.panel.rename')}: ${name}`} onClick={() => setTyped(name)}>
          {name}<span className="kit-pressname__pen" aria-hidden="true"><PencilIcon size={12} /></span>
        </button>
      </Heading>
    )
  }
  return (
    <div data-shortcuts-ignore="">
      <textarea
        ref={field} className={classes.field} aria-label={t('kit.panel.rename')} rows={Math.max(1, Math.ceil(typed.length / 28))}
        aria-invalid={refused !== null} value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={onKeyDown} onBlur={commit}
      />
      {moved && (
        <div className="kit-pressname__moved" role="status" data-testid="name-moved">
          {moved.by ? t('kit.panel.renamedWhileTyping', { by: moved.by, name: moved.to }) : t('kit.panel.renamedWhileTypingAnon', { name: moved.to })}
        </div>
      )}
      {refused && <div className={classes.refused} role="alert">{refused}</div>}
    </div>
  )
}
