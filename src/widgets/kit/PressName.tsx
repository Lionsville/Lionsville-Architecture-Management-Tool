// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record's name: a heading that a press turns into a field, where it may be
 * written, and only a heading where it may not, so a reader sees the same layout
 * without the affordance. Enter or leaving keeps it, Escape drops it, and refused
 * words come back as the sentence to say with what was typed still on the field.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStrings } from '../../i18n/LanguageContext'

export type PressNameProps = {
  readonly name: string
  readonly onRename?: ((name: string) => string | void) | undefined
  /** A new number opens the field, for a command that asks for the name from elsewhere. */
  readonly renameRequest?: number | undefined
  readonly heading: 'h1' | 'h2' | 'span'
  /** The look is the place's: a panel's name and a record's title are not the same size. */
  readonly classes: { readonly heading: string; readonly press: string; readonly field: string; readonly refused: string }
}

export function PressName({ name, onRename, renameRequest, heading: Heading, classes }: PressNameProps) {
  const { t } = useStrings()
  const [typed, setTyped] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const pressed = useRef<HTMLButtonElement>(null)
  const editing = typed !== null
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing && !wasEditing.current) field.current?.select()
    if (!editing && wasEditing.current) pressed.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const asked = useRef(renameRequest)
  useEffect(() => {
    if (renameRequest === asked.current) return
    asked.current = renameRequest
    if (onRename && renameRequest !== undefined) setTyped(name)
    // Only a new request opens the field; a name moving under it does not.
  }, [renameRequest])

  // Another selection is another name, and whatever was being typed was not about it.
  useEffect(() => {
    setTyped(null)
    setRefused(null)
  }, [name])

  if (!onRename) return <Heading className={classes.heading}>{name}</Heading>
  const commit = () => {
    if (typed === null) return
    const answer = typed.trim() && typed !== name ? onRename(typed.trim()) : undefined
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
      event.stopPropagation()
      setRefused(null)
      setTyped(null)
    }
  }
  if (!editing) {
    return (
      <Heading className={classes.heading}>
        <button type="button" ref={pressed} className={classes.press} aria-label={`${t('kit.panel.rename')}: ${name}`} onClick={() => setTyped(name)}>{name}</button>
      </Heading>
    )
  }
  return (
    <>
      <textarea
        ref={field} className={classes.field} aria-label={t('kit.panel.rename')} rows={Math.max(1, Math.ceil(typed.length / 28))}
        aria-invalid={refused !== null} value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={onKeyDown} onBlur={commit}
      />
      {refused && <div className={classes.refused} role="alert">{refused}</div>}
    </>
  )
}
