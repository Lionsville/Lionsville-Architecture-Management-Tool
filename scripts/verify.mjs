#!/usr/bin/env node
/**
 * The gate, as one command with one verdict.
 *
 *   npm run verify   everything that has to be true before a push: the
 *                    typechecks, the tests, the lint, the web build, the
 *                    desktop build and the desktop smoke run
 *   npm run smoke    the last two on their own
 *
 * Written for an agent as much as for a person. There are no flags to choose
 * between, no judgement about which step was the relevant one, and no reading
 * of scrollback: every step's status lands in one table at the end and the
 * exit code is the verdict. Steps keep running after a failure so a single run
 * shows every problem rather than the first one. The one exception is the
 * smoke run, which is skipped when the desktop build it would exercise has
 * already failed — a smoke test of a bundle that does not exist says nothing.
 *
 * Each step is an existing npm script, so a command is defined once, in
 * package.json, and this file only decides the order and keeps the score.
 *
 * Deliberately a local script and not a CI workflow. The loop is local and
 * fast on purpose (CLAUDE.md, "The fast loop"); GitHub Actions is for building
 * and signing a release, not for waiting on.
 */
import { spawnSync } from 'node:child_process'

/** `run` is the npm script; `after` names a step this one is pointless without. */
const ALL = [
  { name: 'typecheck', run: 'typecheck' },
  { name: 'test', run: 'test' },
  { name: 'lint', run: 'lint' },
  { name: 'build web', run: 'build' },
  { name: 'build desktop', run: 'build:desktop' },
  { name: 'smoke desktop', run: 'smoke:run', after: 'build desktop' },
]

const MODES = {
  verify: ALL,
  smoke: ALL.filter((s) => s.name === 'build desktop' || s.name === 'smoke desktop'),
}

const mode = process.argv[2] ?? 'verify'
const steps = MODES[mode]
if (!steps) {
  process.stderr.write(`verify: unknown mode "${mode}" (use: ${Object.keys(MODES).join(', ')})\n`)
  process.exit(2)
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`
const banner = (text) => process.stdout.write(`\n── ${text} ${'─'.repeat(Math.max(0, 60 - text.length))}\n\n`)

const results = []
const started = Date.now()

for (const step of steps) {
  const blocker = step.after && results.find((r) => r.name === step.after && r.status !== 'ok')
  if (blocker) {
    results.push({ name: step.name, status: 'skip', ms: 0, why: `${step.after} did not pass` })
    continue
  }
  banner(`${step.name}  (npm run ${step.run})`)
  const t0 = Date.now()
  // Windows resolves `npm` to `npm.cmd`, which only a shell can start.
  const child = spawnSync('npm', ['run', '--silent', step.run], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const ok = child.status === 0
  results.push({
    name: step.name,
    status: ok ? 'ok' : 'FAIL',
    ms: Date.now() - t0,
    why: ok ? '' : child.error ? child.error.message : `exit ${child.status ?? child.signal}`,
  })
}

// --- the table -----------------------------------------------------------------

const width = Math.max(...results.map((r) => r.name.length))
banner(`${mode}: ${results.length} steps in ${seconds(Date.now() - started)}`)
for (const r of results) {
  const time = r.status === 'skip' ? '' : seconds(r.ms).padStart(7)
  process.stdout.write(`  ${r.status.padEnd(5)} ${r.name.padEnd(width)} ${time}  ${r.why}\n`)
}

const failed = results.filter((r) => r.status === 'FAIL')
const skipped = results.filter((r) => r.status === 'skip')
const verdict = failed.length === 0 && skipped.length === 0 ? 'PASS' : 'FAIL'
const detail = verdict === 'PASS'
  ? ''
  : `: ${failed.length} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`
process.stdout.write(`\n${mode.toUpperCase()} ${verdict}${detail}\n\n`)
process.exit(verdict === 'PASS' ? 0 : 1)
