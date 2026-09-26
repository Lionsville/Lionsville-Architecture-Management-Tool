// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The engine the build hands to whoever asked for ELK's self-contained bundle.
 *
 * Node has no web worker, so the worker is elkjs's own stand-in for one — the
 * engine run on this thread behind the same messages — counted, so what is
 * asserted is the shape the browser gets: one worker per question, and each
 * ended once it is answered.
 */
import { describe, expect, it, vi } from 'vitest'

const workers = vi.hoisted(() => ({ made: 0, ended: 0 }))

vi.mock('elkjs/lib/elk-worker.min.js?worker', async () => {
  const { createRequire } = await import('node:module')
  type Inner = { postMessage(message: unknown): void; onmessage?: (event: unknown) => void }
  const { Worker: Engine } = createRequire(import.meta.url)('elkjs/lib/elk-worker.min.js') as { Worker: new () => Inner }
  class Counted {
    onmessage: ((event: unknown) => void) | null = null
    private readonly inner = new Engine()
    constructor() {
      workers.made += 1
      this.inner.onmessage = (event) => this.onmessage?.(event)
    }
    postMessage(message: unknown): void { this.inner.postMessage(message) }
    terminate(): void { workers.ended += 1 }
  }
  return { default: Counted }
})

const { default: ElkInWorker } = await import('./elkInWorker')

describe('ELK in a worker', () => {
  it('lays a graph out the way the bundle did, in a worker that is ended once it has answered', async () => {
    const elk = new ElkInWorker()
    expect(workers.made).toBe(0)
    const laid = await elk.layout({
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered' },
      children: [{ id: 'a', width: 40, height: 20 }, { id: 'b', width: 40, height: 20 }],
      edges: [{ id: 'ab', sources: ['a'], targets: ['b'] }],
    })
    expect(laid.children?.map((child) => [child.id, typeof child.x])).toEqual([['a', 'number'], ['b', 'number']])
    expect(workers).toEqual({ made: 1, ended: 1 })
  })

  it('makes a worker per question, as mermaid makes an engine per drawing and ends none', async () => {
    const elk = new ElkInWorker()
    const before = { ...workers }
    await elk.knownLayoutAlgorithms()
    await elk.knownLayoutOptions()
    expect(workers.made - before.made).toBe(2)
    expect(workers.ended - before.ended).toBe(2)
    elk.terminateWorker()
    expect(workers.ended - before.ended).toBe(2)
  })
})
