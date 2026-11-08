// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one sheet of keys: a group per context — everywhere, on a board — each a
 * row per thing done with every key that does it. Whoever opens it says the
 * rows; the kit only lays them out, so the frame's sheet and a board shown on
 * its own cannot come to look like two different things.
 */
import { Fragment } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import './Frame.css'

export type KeyRow = { readonly label: string; readonly keys: readonly string[] }
export type KeyGroup = { readonly title: string; readonly rows: readonly KeyRow[] }

export function KeySheet({ open, onClose, title, closeLabel, orWord, groups }: {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly closeLabel: string
  /** What is said between two keys for the same thing: *or*. */
  readonly orWord: string
  readonly groups: readonly KeyGroup[]
}) {
  return (
    <Dialog open={open} onClose={onClose} size="l" title={title} actions={<Button onClick={onClose}>{closeLabel}</Button>}>
      <div className="kit-sheet" data-testid="shortcuts-sheet">
        {groups.filter((group) => group.rows.length > 0).map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.rows.map((row) => (
              <div key={row.label} className="kit-sheet__row">
                <span>{row.label}</span>
                <span>
                  {row.keys.map((key, at) => (
                    <Fragment key={key}>{at > 0 && ` ${orWord} `}<span className="kit-frame__kbd">{key}</span></Fragment>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
