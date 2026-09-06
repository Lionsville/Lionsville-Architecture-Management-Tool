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
  /** Megabytes the heap may grow over five hundred undo steps. */
  undoHeapMb: 50,
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
