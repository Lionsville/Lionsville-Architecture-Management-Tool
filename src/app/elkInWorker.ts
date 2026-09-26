// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * ELK, in a worker, for whoever asks for the self-contained bundle.
 *
 * elkjs ships its engine twice: once as a worker script, which `main.tsx`
 * hands the layout, and once inside `elk.bundled.js`, which runs the same
 * engine on the calling thread. Two things in the app ask for the second — the
 * layout's fallback for a host with no worker, and mermaid's ELK renderer — and
 * each of them put 1.4 MB of the same engine in the build beside the worker's.
 * The build answers `elkjs/lib/elk.bundled.js` with this file instead
 * (`build/oneElk.ts`), so the engine ships once, as the worker.
 *
 * The same API: a worker per question, ended when it is answered, because
 * mermaid makes an engine for each drawing and never ends one, and a worker
 * left running is an engine held in memory for nothing. The tests and the
 * perf runs are node, have no worker and no Vite, and keep the real bundle.
 */
import ElkApi from 'elkjs/lib/elk-api.js'
import type { ELK, ELKConstructorArguments } from 'elkjs'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'

export default class ElkInWorker implements ELK {
  constructor(private readonly options: ELKConstructorArguments = {}) {}

  private async once<T>(ask: (elk: ELK) => Promise<T>): Promise<T> {
    const elk = new ElkApi({ ...this.options, workerFactory: () => new ElkWorker() })
    try {
      return await ask(elk)
    } finally {
      elk.terminateWorker()
    }
  }

  layout: ELK['layout'] = (graph, args) => this.once((elk) => elk.layout(graph, args))
  knownLayoutAlgorithms: ELK['knownLayoutAlgorithms'] = () => this.once((elk) => elk.knownLayoutAlgorithms())
  knownLayoutOptions: ELK['knownLayoutOptions'] = () => this.once((elk) => elk.knownLayoutOptions())
  knownLayoutCategories: ELK['knownLayoutCategories'] = () => this.once((elk) => elk.knownLayoutCategories())

  /** Each question's worker is ended when it is answered, so there is none left to end. */
  terminateWorker(): void {}
}
