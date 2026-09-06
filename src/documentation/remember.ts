/**
 * Caches with a bound on them.
 *
 * Two things in this module are worth keeping between renders: what a
 * description says, because every card on the canvas asks twice per render, and
 * what mermaid drew for a fence, because a block that remounts should not flash
 * back to its source while the picture is computed again. Both are keyed on
 * text, which is exactly the case a `WeakMap` cannot help with — a string is not
 * a collectable key, so a plain `Map` here grows for as long as the app is open
 * and holds every page anybody has ever looked at.
 *
 * So: a bound and an eviction rule. A `Map` in JavaScript iterates in insertion
 * order, which makes it an LRU as soon as a hit re-inserts its key — the oldest
 * key is the first one the iterator gives back. That is the whole mechanism, and
 * it is written once here rather than twice badly.
 *
 * Eviction is invisible by construction: everything cached here is a pure
 * function of its key, so a forgotten answer is recomputed and is the same
 * answer. The tests read past the bound and ask the first question again.
 */

export type Remembered<T> = {
  get(key: string): T | undefined
  set(key: string, value: T): void
  /** How many answers are held. For a test; nothing else should care. */
  readonly size: number
}

/** A store that forgets the answer it has gone longest without being asked for. */
export function remembering<T>(limit: number): Remembered<T> {
  const held = new Map<string, T>()
  return {
    get(key) {
      if (!held.has(key)) return undefined
      const answer = held.get(key) as T
      // Delete and re-set moves the key to the end of the insertion order,
      // which is what makes a plain Map an LRU rather than a FIFO.
      held.delete(key)
      held.set(key, answer)
      return answer
    },
    set(key, value) {
      held.delete(key)
      held.set(key, value)
      while (held.size > limit) held.delete(held.keys().next().value as string)
    },
    get size() {
      return held.size
    },
  }
}

/**
 * A reader that answers from memory the second time it is asked the same text.
 *
 * `undefined` is a valid answer and is remembered like any other, so a reader
 * whose result can be absent still only computes it once.
 */
export function readOnce<T>(read: (text: string) => T, limit: number): (text: string) => T {
  const held = remembering<{ answer: T }>(limit)
  return (text) => {
    const known = held.get(text)
    if (known) return known.answer
    const answer = read(text)
    held.set(text, { answer })
    return answer
  }
}
