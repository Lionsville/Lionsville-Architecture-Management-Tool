// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who else is somewhere, as a few discs of initials and a count of the rest:
 * the names in full on hover and as the accessible name, never in the row.
 *
 * It keeps one width whoever and however many there are, so a row that holds
 * it does not take room from its neighbours as people come and go — a name in
 * words costs the crumb beside it a word of its own.
 */
import { Tooltip } from './Tooltip'
import './Faces.css'

/** The letters a disc carries: the first of the first word and of the last, or of the one word there is. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).map((word) => Array.from(word).find((char) => /\p{L}|\p{N}/u.test(char))).filter((char): char is string => char !== undefined)
  if (words.length === 0) return '?'
  return (words.length === 1 ? words[0]! : `${words[0]!}${words.at(-1)!}`).toLocaleUpperCase()
}

export type FacesProps = {
  readonly names: readonly string[]
  /** The whole of what is said: the tooltip and the accessible name, names and all. */
  readonly label: string
  /** How many discs before the count of the rest. */
  readonly most?: number
  readonly testId?: string
  readonly dataGuide?: string
}

export function Faces({ names, label, most = 3, testId, dataGuide }: FacesProps) {
  const shown = names.length > most ? names.slice(0, most - 1) : names
  const rest = names.length - shown.length
  return (
    <Tooltip title={label} names>
      <span className="kit-faces" role="img" aria-label={label} data-testid={testId} data-guide={dataGuide}>
        {shown.map((name, at) => <span key={`${at}-${name}`} className="kit-faces__disc" aria-hidden>{initialsOf(name)}</span>)}
        {rest > 0 && <span className="kit-faces__disc kit-faces__rest" aria-hidden>+{rest}</span>}
      </span>
    </Tooltip>
  )
}
