// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * This browser's database, or — where it will not open at all — memory.
 *
 * A browser that has a database can still refuse to open it: a private window
 * that allows the key-value storage and not the database, a policy. That is
 * only known once it is asked, which is the first thing anything reads, and
 * so it is asked then: where the database opens, every answer is its own;
 * where opening it fails, every answer from then on is memory's, and the
 * browser's chrome says that nothing will outlive the tab. The session works
 * in full and leaves nothing behind, which is the honest answer.
 *
 * A refusal the database gives once it is open — full, a later build in
 * another tab — is not this: it is said as the refusal it is, and nothing
 * falls anywhere. Nor is a database that waits on another tab: its answers
 * wait with it, and the chrome says why.
 */
import { ShellError } from '../../platform/errors'
import type { Repositories } from '../../ports/Repositories'

export function fallingBack(primary: Repositories, fallback: () => Repositories, fell: (cause: unknown) => void): Repositories {
  let chosen: Promise<Repositories> | undefined
  const choose = (): Promise<Repositories> => {
    chosen ??= primary.scopes.tree().then(() => primary, (cause: unknown) => {
      if (cause instanceof ShellError) return primary
      fell(cause)
      return fallback()
    })
    return chosen
  }
  /** One repository, each call answered by whichever of the two was chosen. */
  const through = <K extends keyof Repositories>(name: K): Repositories[K] => new Proxy(primary[name], {
    get(target, member) {
      const value = Reflect.get(target, member) as unknown
      if (typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        const held = (await choose())[name] as unknown as Record<PropertyKey, (...given: unknown[]) => unknown>
        return Reflect.apply(held[member], held, args)
      }
    },
  })
  return {
    scopes: through('scopes'), index: through('index'), history: through('history'),
    images: through('images'), settings: through('settings'),
  }
}
