/**
 * The yardstick: how a perf test measures, and what it is allowed to cost.
 *
 * The repository had no performance test of any kind, and no fixture larger
 * than two hundred rows, so every statement about what was fast was a
 * recollection. This file and {@link ./synthetic} are the two halves of the
 * answer: one builds a landscape big enough to be slow, this one times work
 * over it against a written-down number.
 *
 * **A budget is a regression alarm, not a threshold to tune.** Every number in
 * {@link BUDGET} is what the operation may cost on an ordinary laptop — chosen
 * for the person using the tool, not derived from the machine that happened to
 * run it. A failure therefore means something got slower by a factor, not that
 * the machine was busy for a moment. The right response is to find what
 * changed. Raising the number is the one response that makes this whole file
 * worthless.
 *
 * Measured 6 September 2026, median of seven runs on the `large` fixture —
 * 2,000 elements, 5,000 connections, 30 diagrams, 2 KB of markdown each. The
 * measuring machine is a fast Apple-silicon laptop and reads several times
 * quicker than the laptop the budgets are written for, so the headroom in the
 * last column is not the margin a slower machine will see:
 *
 * | Operation | Measured | Budget |
 * |---|---|---|
 * | open: parse, index, derive the landscape | 16 ms | 1500 ms |
 * | one inspector keystroke to model update | 0.25 ms | 5 ms |
 * | drag-stop of 10 nodes, routing excluded | 2.0 ms | 30 ms |
 * | search, one keystroke, warm index | 0.14-0.33 ms | 20 ms |
 * | undo or redo of one step | 1.6 ms | 5 ms |
 * | serialise one diagram file | 1.5 ms | 20 ms |
 * | derive a 600-node board after one move | 2.5 ms | 30 ms |
 * | 500 undo steps, heap growth | 0.02 MB | 50 MB |
 * | 200 models indexed, heap growth | 0.05 MB | 50 MB |
 * | 20,000 descriptions read, heap growth | 1.2 MB | 50 MB |
 * | the agent's layout report over the landscape | 83 ms | 500 ms |
 * | history: one snapshot looked at, for one diagram | 17 ms | 1500 ms |
 * | history: restore one diagram | 1.2 ms | 50 ms |
 * | history: restore the whole project | 18 ms | 500 ms |
 * | the index over twenty scopes of the large fixture | 7.6 ms | 500 ms |
 *
 * The last row was measured 12 September 2026 (ADR-0012 §2), on the same
 * machine, over twenty copies of the `large` fixture under twenty paths.
 *
 * The three history rows were measured 8 September 2026 (ADR-0008), on the
 * same machine and fixture. Measuring them is what found `placement.set`
 * copying its record once per row: a one-diagram restore cost 254 ms before
 * that was made a single pass, and the drag-stop row fell with it.
 *
 * Every {@link measure} call prints its label and its median as the run goes,
 * so `npm run test:perf` is the report and this table is the contract.
 */

/**
 * What each operation is allowed to cost. Milliseconds, except where the name
 * says otherwise. See the note above before changing one.
 */
export const BUDGET = {
  /** Parse the folder, index the model, derive the landscape's nodes and edges. */
  open: 1500,
  /** One character typed into an inspector field, through the reducer. */
  keystroke: 5,
  /** Dropping ten dragged nodes. Routing is a separate, capped pass. */
  dragStop: 30,
  /** One keystroke in the search box against a warm index. */
  search: 20,
  /** One step of undo, or of redo. */
  undo: 5,
  /** Writing one diagram's files out as text. */
  serialiseDiagram: 20,
  /** Nodes and edges for a 600-node board, re-derived after one element moved. */
  derive: 30,
  /**
   * The agent's layout report over the generated landscape (ADR-0007): every
   * box against every box it could overlap, every line against every box its
   * span could touch. The loop an agent runs pays this on every turn.
   */
  inspect: 500,
  /**
   * The history page, per snapshot clicked (ADR-0008): the folder read back
   * as a project, compared with now, filtered to one subject. What the page
   * pays for a click, on top of the adapter fetching the text.
   */
  historyLook: 1500,
  /** One diagram brought back to a snapshot, as commands through the reducer. */
  restoreDiagram: 50,
  /** The whole project brought back — every element, connection, diagram and decision. */
  restoreProject: 500,
  /**
   * The organisation-wide index (ADR-0012 §2), over twenty scopes of a few
   * thousand elements each — forty thousand records and a hundred thousand
   * rows, which is a large organisation rather than a large landscape.
   *
   * It is one pass per list into three maps, with the depth worked out once
   * per scope rather than once per record, so tens of milliseconds is what
   * the record predicts and what this is written against. The budget is the
   * usual multiple of that for an ordinary laptop: what it is watching for is
   * a pass that became quadratic in the tree — an ancestor walk per element,
   * or a `find` over the entries — because that is the shape this arithmetic
   * invites and it would not show at all on one scope.
   *
   * Paid on every open and again whenever the watcher says the folder
   * changed, and never on a keystroke.
   */
  index: 500,
  /** Megabytes the heap may grow over five hundred undo steps. */
  undoHeapMb: 50,
  /**
   * Megabytes a cache may grow the heap over a long session's worth of work.
   * The point of a bound is that this number does not depend on how much was
   * asked of it, so the budget is generous on purpose — what it is watching for
   * is a cache with no bound at all, which grows without limit.
   */
  cacheHeapMb: 50,
} as const

export type Budget = keyof typeof BUDGET

export type MeasureOptions = {
  /** Timed runs; the answer is their median. */
  runs?: number
  /** Untimed runs first, so a budget is not a measurement of the JIT warming up. */
  warmup?: number
  /** Run before each timed run and not counted — where the fixture is rebuilt. */
  prepare?: () => void
}

/**
 * Run `work` a few times and answer with the median in milliseconds, after
 * printing the line that makes the run its own report.
 *
 * The median rather than the mean or the best: a mean is moved by the one run
 * that landed on a garbage collection, and the best is a number no user ever
 * sees. An odd default run count so the median is a measurement rather than an
 * average of two.
 */
export function measure(label: string, work: () => void, options: MeasureOptions = {}): number {
  const { runs = 7, warmup = 2, prepare } = options
  for (let n = 0; n < warmup; n++) {
    prepare?.()
    work()
  }
  const times: number[] = []
  for (let n = 0; n < runs; n++) {
    prepare?.()
    const started = performance.now()
    work()
    times.push(performance.now() - started)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]
  report(label, `${format(median)} ms`, `${format(times[0])} ms best of ${runs}`)
  return median
}

/**
 * {@link measure}, for work that is a promise.
 *
 * A separate function rather than one that accepts both: a synchronous
 * `measure` handed an async function would time how long it took to CREATE the
 * promise, which is a number that looks plausible and means nothing.
 */
export async function measureAsync(
  label: string, work: () => Promise<unknown>, options: MeasureOptions = {},
): Promise<number> {
  const { runs = 7, warmup = 2, prepare } = options
  for (let n = 0; n < warmup; n++) {
    prepare?.()
    await work()
  }
  const times: number[] = []
  for (let n = 0; n < runs; n++) {
    prepare?.()
    const started = performance.now()
    await work()
    times.push(performance.now() - started)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]
  report(label, `${format(median)} ms`, `${format(times[0])} ms best of ${runs}`)
  return median
}

/**
 * How many megabytes the heap grew over `work`, with a collection either side.
 *
 * Only honest when the process was started with `--expose-gc`, which the perf
 * config does; without it the number includes whatever had not been collected
 * yet, so the measurement says so rather than quietly reporting noise.
 */
export function heapGrowthMb(label: string, work: () => void): number {
  const collect = (globalThis as { gc?: () => void }).gc
  collect?.()
  const before = process.memoryUsage().heapUsed
  work()
  collect?.()
  const grown = (process.memoryUsage().heapUsed - before) / 1024 / 1024
  report(label, `${format(grown)} MB`, collect ? 'after a collection' : 'NO --expose-gc: noisy')
  return grown
}

const format = (value: number) => (value >= 100 ? value.toFixed(0) : value.toFixed(2))

/**
 * One line per measurement, on stdout. The perf config turns vitest's console
 * capture off, so the run reads as a table rather than as a list of passes.
 */
function report(label: string, value: string, note: string): void {
  process.stdout.write(`  ${label.padEnd(46, '.')} ${value.padStart(10)}   (${note})\n`)
}
