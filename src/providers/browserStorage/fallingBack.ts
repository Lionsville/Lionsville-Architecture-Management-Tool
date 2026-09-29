// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * This browser's database, or — where it will not open at all — memory.
 *
 * A browser that has a database can still refuse to open it: a private window
 * that allows the key-value storage and not the database, a policy. That is
 * only known once it is asked, which the boot does before anything is drawn
 * (`browserStorageSource.ts`, `settled`); this is what answers where nothing
 * asked first, from the first read on: where the database opens, every answer
 * is its own; where opening it fails, every answer from then on is the
 * fallback's, and the browser's chrome says that nothing will outlive the tab.
 *
 * A refusal the database gives once it is open — full, a later build in
 * another tab — is not this: it is said as the refusal it is, and nothing
 * falls anywhere. Nor is a database that waits on another tab: its answers
 * wait with it, and the chrome says why.
 */
import { ShellError } from '../../platform/errors'
import type { Repositories } from '../../ports/Repositories'

/** Did the database open? Its first answer says, and a refusal from it is an answer. */
export async function opens(repositories: Repositories): Promise<true | { cause: unknown }> {
  try {
    await repositories.scopes.tree()
    return true
  } catch (cause) {
    return cause instanceof ShellError ? true : { cause }
  }
}

export function fallingBack(
  primary: Repositories, fallback: () => Repositories | Promise<Repositories>, fell: (cause: unknown) => void,
): Repositories {
  let chosen: Promise<Repositories> | undefined
  return answeredBy(primary, () => {
    chosen ??= opens(primary).then((opened) => {
      if (opened === true) return primary
      fell(opened.cause)
      return fallback()
    })
    return chosen
  })
}

/** Repositories whose every answer is those `choose` settles on, made when first asked. */
export function made(shape: Repositories, make: () => Promise<Repositories>): Repositories {
  let chosen: Promise<Repositories> | undefined
  return answeredBy(shape, () => {
    chosen ??= make()
    return chosen
  })
}

function answeredBy(shape: Repositories, choose: () => Promise<Repositories>): Repositories {
  /** One repository, each call answered by the one chosen. */
  const through = <K extends keyof Repositories>(name: K): Repositories[K] => new Proxy(shape[name], {
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
