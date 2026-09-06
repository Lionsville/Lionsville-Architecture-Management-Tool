import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * The perf tests, which are a different kind of test and so a different runner.
 *
 * They are not in `npm run check`, and that is the point of the split. The fast
 * loop is a few seconds and gets run after every change (CLAUDE.md, "The fast
 * loop"); these build landscapes of several thousand elements and time work
 * over them, which is tens of seconds and would turn the loop into something
 * you batch up instead of running. They are a step in `npm run verify` — the
 * gate before a push — where a minute is already the price.
 *
 * Three settings do the actual work here:
 *
 * - **One file at a time, one worker.** Two perf files racing each other on the
 *   same cores measure the scheduler.
 * - **`--expose-gc`.** A heap budget without a collection either side of the
 *   work measures whatever had not been swept yet. `heapGrowthMb` says so out
 *   loud when the flag is missing rather than reporting the noise as a number.
 * - **Console capture off.** Every measurement prints its median as it goes, so
 *   the run is the report; captured output would arrive re-ordered and grouped
 *   under test names.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.perf.test.{ts,tsx}'],
    env: { TZ: 'UTC' },
    pool: 'forks',
    execArgv: ['--expose-gc'],
    singleFork: true,
    fileParallelism: false,
    maxWorkers: 1,
    disableConsoleIntercept: true,
    // Building the `xl` fixture and timing seven runs over it is not a
    // five-second test, and a timeout that fires is a red gate with nothing
    // wrong behind it.
    testTimeout: 120_000,
  },
})
