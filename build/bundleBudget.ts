// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The web build's budget: a ceiling per file, one for the whole, and one ELK.
 *
 * The build had grown to 9.9 MB with the layout engine in it twice, and
 * nothing said so — Vite's own warning fires for any chunk over 500 kB, which
 * every build of this app has, so nobody reads it. A budget is a number
 * somebody has to change on purpose: the build fails over it, and the commit
 * that raises it says why.
 *
 * **The ceilings are the measured size and a little room**, set on 26
 * September 2026 once the second engine was gone: the largest file (the app
 * itself, `index-*.js`) at 2.74 MB against a ceiling of 2.9 MB, the whole
 * bundle at 8.0 MB against 8.4 MB. Not a target and not a promise that the
 * app will stay this size; the point is that it cannot grow by a megabyte
 * without somebody deciding it may. `libavoid.wasm` is published from
 * `public/` beside the bundle rather than through it (`libavoidWasm.ts`), and is
 * not counted.
 *
 * The engine is counted by a name only the engine carries: the worker script
 * and the self-contained bundle both hold it, and the API that talks to either
 * does not. More than one file holding it is ELK shipped twice
 * (`oneElk.ts`).
 */
import type { Plugin } from 'vite'

export type Budget = {
  /** Bytes, for any one file the bundle emits. */
  file: number
  /** Bytes, for everything the bundle emits together. */
  total: number
}

export const WEB_BUDGET: Budget = { file: 2_900_000, total: 8_400_000 }

/**
 * The desktop's renderer is the same bundle unminified — electron-vite's
 * default, and an installer's bytes are not a download per visit — so it has
 * ceilings of its own, set the same way: 5.22 MB for the largest file against
 * 5.5 MB, 15.3 MB for the whole against 16 MB.
 */
export const DESKTOP_BUDGET: Budget = { file: 5_500_000, total: 16_000_000 }

/** What only ELK's engine says, and neither its API nor anything else here. */
export const ELK_ENGINE_MARK = 'RecursiveGraphLayoutEngine'

export type Output = { name: string; bytes: number; text: string }

/** What is wrong with a bundle, one sentence per thing; nothing, when it is within its budget. */
export function overBudget(outputs: readonly Output[], budget: Budget = WEB_BUDGET): string[] {
  const said: string[] = []
  for (const output of outputs) {
    if (output.bytes > budget.file) {
      said.push(`${output.name} is ${kB(output.bytes)}, over the ${kB(budget.file)} a file may be.`)
    }
  }
  const total = outputs.reduce((sum, output) => sum + output.bytes, 0)
  if (total > budget.total) said.push(`The bundle is ${kB(total)}, over its ${kB(budget.total)}.`)
  const engines = outputs.filter((output) => output.text.includes(ELK_ENGINE_MARK)).map((output) => output.name)
  if (engines.length > 1) said.push(`ELK's engine is in ${engines.length} files (${engines.join(', ')}); it ships once, as the worker.`)
  return said
}

/** One line for the build's log: the whole, the largest, and the budget. */
export function summary(outputs: readonly Output[], budget: Budget = WEB_BUDGET): string {
  const total = outputs.reduce((sum, output) => sum + output.bytes, 0)
  const largest = outputs.reduce<Output | undefined>((held, output) => (!held || output.bytes > held.bytes ? output : held), undefined)
  return `bundle: ${kB(total)} in ${outputs.length} files (budget ${kB(budget.total)}); largest ${largest?.name ?? '-'} ${kB(largest?.bytes ?? 0)} (budget ${kB(budget.file)})`
}

function kB(bytes: number): string {
  return `${(bytes / 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 })} kB`
}

export function bundleBudget(budget: Budget = WEB_BUDGET): Plugin {
  return {
    name: 'lv-bundle-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle).map((output): Output => {
        const text = output.type === 'chunk'
          ? output.code
          : typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
        const bytes = output.type === 'chunk' || typeof output.source === 'string'
          ? new TextEncoder().encode(text).length
          : output.source.byteLength
        return { name: output.fileName, bytes, text }
      })
      this.info(summary(outputs, budget))
      const said = overBudget(outputs, budget)
      if (said.length > 0) this.error(said.join('\n'))
    },
  }
}
