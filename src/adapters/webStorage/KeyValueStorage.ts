/**
 * The part of `localStorage` these adapters actually use.
 *
 * Four lines instead of the whole `Storage` interface, on purpose: it lets these
 * adapters' suites run in node without jsdom — a handful of lines of fake
 * storage is enough — and it leaves room for anything else that speaks the same
 * four lines.
 *
 * `keys()` is here because a store has to be able to enumerate what it holds:
 * the picker lists projects, and an index document kept alongside the projects
 * would be one more thing that can drift out of step with them. It is the one
 * method `localStorage` does not offer under this name, so `available.ts` wraps
 * it — a small price for a primitive that maps cleanly onto "list a directory"
 * in whatever adapter comes next.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): string[]
}
