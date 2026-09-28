// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which steps of the open scope change what the rest of the tree is told about
 * it, and the one listener that reads the index again after them.
 *
 * The index (`useIndex`) is read on boot, on the watcher, and when a write
 * asks. A source whose changes are written whole is covered by that: its save
 * is a write, and the folder's watcher or the save itself reads the tree again.
 * A source whose changes travel as steps (`publishesSteps`) never saves, so an
 * application added on a board reached the register, the cards and *Supported
 * by…* only after a reload. Its provider can say when the far end has a step;
 * this is the part the shell can say on its own: that a step which makes,
 * removes, links or renames a record was just taken here, so the index is read
 * again shortly after — once for a burst, never per keystroke.
 *
 * Only steps that move the tree's shape: a record or a row made, removed or
 * linked, and a change of what a record is called or where it is answered
 * for. Moving a card, a colour or a description is nothing the index is about.
 *
 * **Never while the source is not there.** A step taken while the connection
 * is down is kept and sent later, and a read of the tree at that moment fails —
 * which the shell reports as an error nobody asked for. Where the source says
 * it is not connected (`SourceProvider.connected`) the read is skipped: the
 * step is not at the far end yet, and when it lands there the provider says
 * the tree changed, which reads it then.
 */
import type { Command } from '../model'
import type { SessionChange } from './useModelSession'

/** The fields of a record whose change the index hears about: its name, its kind and whose it is. */
const SHAPE_FIELDS = new Set(['name', 'kind', 'ref', 'outside', 'partyId'])

/** Does this command change what the index says about the scope it is taken in? */
export function changesTreeShape(command: Command): boolean {
  switch (command.type) {
    // A record, or a row: what the map and *Supported by…* read across scopes.
    case 'element.create':
    case 'element.delete':
    case 'element.link':
    case 'relation.create':
    case 'relation.delete':
      return true
    case 'element.update':
      return Object.keys(command.patch).some((field) => SHAPE_FIELDS.has(field))
    default:
      return false
  }
}

/** How long a burst of such steps is waited out before the tree is read once. */
export const TREE_SHAPE_SETTLE_MS = 800

/**
 * Hear the open scope's steps, and read the tree again a moment after the
 * last one that changed its shape.
 *
 * Handed the session's `onChange` rather than the session, so it can be used
 * wherever a session is handed over. **Only for a source whose changes travel
 * as steps**: a listener on a session is what keeps the log from trimming until
 * somebody settles what it heard (`HISTORY_CAP`), and such a source's provider
 * is already listening and settling — one more listener changes nothing there,
 * where on any other source it would be the only one, and nobody would settle.
 * Answers how to stop, which also drops a read that is still waiting.
 */
export function watchTreeShape(
  onChange: (listener: (change: SessionChange) => void) => () => void,
  readAgain: () => void,
  settleMs = TREE_SHAPE_SETTLE_MS,
  connected: () => boolean = () => true,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = onChange((change) => {
    if (!change.commands.some(changesTreeShape)) return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      // Asked when the read would be made, not when the step was: a burst that
      // began online may settle after the connection went.
      if (connected()) readAgain()
    }, settleMs)
  })
  return () => {
    stop()
    if (timer !== undefined) clearTimeout(timer)
  }
}
