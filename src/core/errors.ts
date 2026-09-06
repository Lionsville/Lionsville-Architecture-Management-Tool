/**
 * One shape for a refusal that the user has to be told about.
 *
 * There were three. `LogoError` carried a key; `openProjectDocument` returned a
 * result union; the adapters threw English sentences, which is the one thing
 * this shell is not allowed to do — a sentence written here is a sentence in
 * whichever language the author happened to be thinking in, shown to somebody
 * who chose the other one.
 *
 * So: a key, and the numbers that belong in it. The layer that knows the
 * language turns it into words at the moment of showing (`ui/messageFor.ts`).
 * The result union stays where it is — a refusal that is part of a function's
 * ordinary answer is better as a value than as a throw, and `openProjectDocument`
 * has three of those.
 */
import type { StringKey, StringParams } from '@lionsville/solution-design'

export class ShellError extends Error {
  readonly key: StringKey
  readonly params?: StringParams

  constructor(key: StringKey, params?: StringParams) {
    // The key doubles as the `message`, so an error that ends up unread in a
    // log somewhere still says WHICH refusal it was.
    super(key)
    this.name = 'ShellError'
    this.key = key
    this.params = params
  }
}

/**
 * Whatever was thrown, as something that can go inside a sentence.
 *
 * Not `describeCause`, which prefixes the class name because a log wants to
 * know it. A user reading "The file could not be saved: QuotaExceededError:
 * disk full" is reading one word of English and two of ours.
 */
export function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}
