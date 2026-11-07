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
 * without somebody deciding it may.
 *
 * **Taken down on 27 September 2026**, when the pages a person reaches later
 * — the registers, the reports, the history, the markdown renderer and the
 * shipped example — left the first download for scripts of their own
 * (`widgets/lazyPart`): the app at 2.37 MB against 2.55 MB, the whole at
 * 7.9 MB against 8.3 MB; the desktop's renderer at 4.60 MB against 4.9 MB and
 * 15.1 MB against 16 MB. Room that is not taken back is room the next page
 * grows into without anybody deciding it may. `libavoid.wasm` is published from
 * `public/` beside the bundle rather than through it (`libavoidWasm.ts`), and is
 * not counted.
 *
 * **The whole raised on 30 September 2026**, to 8.4 MB, for local and global
 * analysis (ADR-0032): the observations page with its filters, its two sizes,
 * its forms and its buttons is 172 kB of a script of its own, fetched when the
 * page is opened, and the first download is 17 kB lighter for it; the words
 * of the page in three languages stay in the first download with every other
 * module's. The whole was 8.15 MB before and is 8.31 MB now.
 *
 * **The file raised on 8 October 2026**, to 2.6 MB, for the merge screen
 * (ADR-0035): the screen itself is in the observations page's script, but
 * its words — the three parts, a refusal for every link a merge cannot move
 * and for every merge it cannot make, and what a merge across scopes came
 * to — are in the first download in three languages, as every module's are.
 * The app went from 2.535 MB to 2.561 MB; the whole is 8.39 MB, within its
 * 8.4 MB.
 *
 * **Both raised on 8 October 2026**, to 3 MB a file and 10 MB in all: the
 * owner raised the ceilings so the merge screen's and the share link's words
 * fit with room. With the agent's merge tools (ADR-0035 §6) and File › Share
 * with a Link… (ADR-0033) the app's own file is 2.587 MB and the whole
 * 8.413 MB, which was 13 kB over the 8.4 MB before. A ceiling is still a
 * number somebody changes on purpose, in a commit that says why.
 *
 * **And for the Conway map's verdict and panel**, by 20 kB and 90 kB: its words in three languages are first-download, and the kit's list, panel and matrix came along in its chunk; measured 3.085 MB and 10.146 MB.
 *
 * **And again for 4.0.0's observations**, 10 kB and 60 kB: the chain's words in three languages are in the first
 * download with every other module's, and its list, preview, editor and ladder come with the page.
 *
 * **Both raised for 4.0.0**, by 80 kB each: one frame stands over every screen,
 * so its rows, its tree and ⌘K are in the first download. The whole measured
 * 10.046 MB and the largest file 3.059 MB when this was said. **And again**, by
 * 80 kB and 20 kB: the merged register's and the work list's words are in the
 * first download in three languages, as every module's are.
 *
 * **Raised again for 4.0.0**, by 40 kB each: a home is the first paint, and its
 * tree, its one-line rows and its first-run pages come with their words in three
 * languages. Measured 10.089 MB and 3.093 MB when this was said.
 *
 * **And for the technology landscape's words**, by 50 kB of the whole: its reader,
 * reports and empty state in three languages are first-download.
 *
 * **And for the one panel and the record page**, 40 kB of the whole: their rows
 * are shared, and the parts only a press opens went out of the first download
 * into scripts of their own.
 *
 * The engine is counted by a name only the engine carries: the worker script
 * and the self-contained bundle both hold it, and the API that talks to either
 * does not. More than one file holding it is ELK shipped twice
 * (`oneElk.ts`).
 */
import type { Plugin } from 'vite'
import { HELP_ASSETS } from './helpPage'

export type Budget = {
  /** Bytes, for any one file the bundle emits. */
  file: number
  /** Bytes, for everything the bundle emits together. */
  total: number
}

// The whole 11 MB: a sheet's poster with Design, its tray and its print, 10.93 measured. The file ceiling 3.36 MB and 10.82 MB: the copy into a folder that reads back and counts by kind, its words first-download, 3.350 and 10.798 measured; before it the file ceiling 3.30 MB: the drawing's words and its guard, first-download, 3.295 measured; before them 3.27 MB: the first-run page, Your work and the example's band, first-download, 3.266 measured; before them 3.24 MB: the plan and roadmap words, a home's tree, rows and first-run pages, then Guidance's words and frame, are first-download; measured 3.221; then the observation chain's words, 10 kB.
// 10.72 MB: the drawing rebuilt on the kit, 10.717 measured; 10.67 MB: settings as a page and the first run, 10.664 measured; 10.64 MB: the organisation chart as a tree, 10.619 measured; 10.59 MB: the sheet's Overview, lenses, find bar and Coverage's matrix, all in parts of their own, 10.569 measured; 10.50 MB: the one panel and the record page's 0.04 MB, the observation chain's 0.06 MB, the technology landscape's 0.05 MB on the Conway map's 0.09 MB, the decisions page's 0.10 MB (its reader and writing window on the kit) and what the areas before it took.
//
// **The largest file raised on 7 November 2026, on the owner's decision**, to 1.7 times what it was before this redesign began (3.00 MB here, 5.60 MB on the desktop): the owner allowed the main bundle 70 % for version 4. The whole keeps its own measure.
export const WEB_BUDGET: Budget = { file: 5_100_000, total: 11_000_000 }

/**
 * The desktop's renderer is the same bundle unminified — electron-vite's
 * default, and an installer's bytes are not a download per visit — so it has
 * ceilings of its own, set the same way: 5.22 MB for the largest file against
 * 5.5 MB, 15.3 MB for the whole against 16 MB.
 *
 * **Raised on 8 October 2026** with the web build's, by the same measure —
 * 2.6 to 3 MB a file there is 4.9 to 5.6 MB here, 8.4 to 10 MB in all is 16
 * to 19 MB: the merge screen, the agent's merge tools and the share link
 * took the renderer to 4.867 MB for its largest file and 16.016 MB in all,
 * 16 kB over the 16 MB before.
 *
 * **The largest file raised on 7 November 2026, on the owner's decision**, to
 * 1.7 times its 5.6 MB, with the web build's. The whole to 19.6 MB the same
 * day, measured: the redesign's kit, frame and pages took it to 19.514 MB, and
 * the desktop's whole had not followed the web build's on the way.
 */
export const DESKTOP_BUDGET: Budget = { file: 9_520_000, total: 19_600_000 }

/**
 * **The help, apart** (4.0.0): a page of its own beside the app, fetched when
 * somebody opens it, one language at a time. Its words in three languages are
 * most of it, and counting them in the app's whole would have spent the room
 * the app grows into on a page the app never loads. The ceilings are the
 * measured size and a little room, as above.
 */
export const HELP_BUDGET: Budget = { file: 700_000, total: 2_200_000 }

/** The help's own files: its page and what `build/helpPage.ts` put under its folder. */
export function isHelpOutput(output: Output): boolean {
  return output.name === 'help/index.html' || output.name.startsWith(HELP_ASSETS)
}

function overHelpBudget(help: readonly Output[]): string[] {
  const said = help.filter((output) => output.bytes > HELP_BUDGET.file)
    .map((output) => `${output.name} is ${kB(output.bytes)}, over the ${kB(HELP_BUDGET.file)} a file of the help may be.`)
  const total = help.reduce((sum, output) => sum + output.bytes, 0)
  if (total > HELP_BUDGET.total) said.push(`The help is ${kB(total)}, over its ${kB(HELP_BUDGET.total)}.`)
  return said
}

/** What only ELK's engine says, and neither its API nor anything else here. */
export const ELK_ENGINE_MARK = 'RecursiveGraphLayoutEngine'

export type Output = { name: string; bytes: number; text: string }

/** What is wrong with a bundle, one sentence per thing; nothing, when it is within its budget. */
export function overBudget(outputs: readonly Output[], budget: Budget = WEB_BUDGET): string[] {
  const help = outputs.filter(isHelpOutput)
  const said: string[] = overHelpBudget(help)
  outputs = outputs.filter((output) => !isHelpOutput(output))
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
export function summary(all: readonly Output[], budget: Budget = WEB_BUDGET): string {
  const outputs = all.filter((output) => !isHelpOutput(output))
  const help = all.filter(isHelpOutput).reduce((sum, output) => sum + output.bytes, 0)
  const total = outputs.reduce((sum, output) => sum + output.bytes, 0)
  const largest = outputs.reduce<Output | undefined>((held, output) => (!held || output.bytes > held.bytes ? output : held), undefined)
  return `bundle: ${kB(total)} in ${outputs.length} files (budget ${kB(budget.total)}); largest ${largest?.name ?? '-'} ${kB(largest?.bytes ?? 0)} (budget ${kB(budget.file)})${help > 0 ? `; the help ${kB(help)} apart (budget ${kB(HELP_BUDGET.total)})` : ''}`
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
