// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What was read of a history, kept to a size: the last ones used stay, the
 * one used longest ago goes. A commit does not change, so what was read of one
 * is right for as long as it is kept; the size is what keeps a history of any
 * length from being held in memory whole.
 */
export class Lru<K, V> {
  private readonly held = new Map<K, V>()

  constructor(private readonly size: number) {}

  has(key: K): boolean {
    return this.held.has(key)
  }

  get(key: K): V | undefined {
    if (!this.held.has(key)) return undefined
    const value = this.held.get(key)!
    this.held.delete(key)
    this.held.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    this.held.delete(key)
    this.held.set(key, value)
    while (this.held.size > this.size) this.held.delete(this.held.keys().next().value!)
  }
}
