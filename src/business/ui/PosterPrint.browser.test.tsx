// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The poster on paper, printed by a real Chromium as the desktop's `printToPDF` prints
 * it, and the PDF read back. jsdom has no cascade and no print: the window's own
 * print rules — an open dialog printed in place of the page, every child of the body
 * sized by its content — once left an A1 of the dialog and no poster, with every test
 * of `printPage` green. Chromium only: WebKit has no PDF to ask for.
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { commands, server } from 'vitest/browser'
import { exampleFiles } from '../../adapters/folder/format/exampleFolder'
import type { ExampleFolder } from '../../adapters/folder/format/exampleFolder'
import acmeLogistics from '../../adapters/folder/format/examples/acme-logistics.json' with { type: 'json' }
import { scopeFromFolder } from '../../adapters/folder/format/folderFormat'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { printPicture } from '../../app/drawingExport'
import { PRINT_PAPERS } from '../../widgets/printPage'
import { tokenVariables } from '../../widgets/kit/tokens'
import '../../widgets/kit/fonts/fonts.css'
// The window's own print rules, which the copy on paper has to win over.
import '../../widgets/kit/Frame.css'
import '../../widgets/kit/Dialog.css'
import { DEFAULT_LENS, lensValue } from '../lens'
import { coverageOf } from '../coverage'
import { sheetPage } from '../sheet'
import { posterCopy } from './PosterWork'
import { SheetPoster } from './SheetPoster'
import type { PosterHandle } from './SheetPoster'

type PdfPage = { widthMm: number; heightMm: number; text: string; fonts: readonly string[] }

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** This page as HTML, printed by Chromium at its `@page` size and read back (`vitest.browser.config.ts`). */
    printPdf(html: string): Promise<PdfPage[]>
  }
}

const mounted: Root[] = []
afterEach(() => {
  for (const root of mounted.splice(0)) root.unmount()
  document.body.replaceChildren()
})

function drawExample(): { handle: { current: PosterHandle | undefined }; names: string[] } {
  const scope = scopeFromFolder(exampleFiles(acmeLogistics as ExampleFolder), '')!
  const sheet = scope.model.diagrams.find((one) => one.kind === 'sheet')!
  const laidOut = sheetPage(scope.model, sheet)
  for (const [name, value] of Object.entries(tokenVariables('light'))) document.documentElement.style.setProperty(name, value)
  const host = document.createElement('div')
  host.id = 'root'
  host.style.cssText = 'position:fixed;inset:0;display:flex'
  document.body.append(host)
  const root = createRoot(host)
  mounted.push(root)
  const handle: { current: PosterHandle | undefined } = { current: undefined }
  const covering = coverageOf([])
  const none = { supportedBy: [], assignedTo: [], coverage: 'uncovered' as const }
  const coverageAt = (id: string) => covering.get(id) ?? none
  flushSync(() => {
    root.render(
      <LanguageProvider language="en">
        <SheetPoster
          laidOut={laidOut} sheet={sheet} lens={DEFAULT_LENS} coverageAt={coverageAt} handle={handle}
          nameOf={(id) => scope.model.elements.find((one) => one.id === id)?.name ?? id}
          valueOf={(element) => lensValue(element, DEFAULT_LENS, { coverage: coverageAt, retiring: () => false })}
          selectedId={undefined} onSelect={() => {}} t={(key) => key}
        />
      </LanguageProvider>,
    )
  })
  return { handle, names: laidOut.areas.map((area) => area.element.name) }
}

/** The export dialog as it stands while the PDF is made: open, over the page. */
function openDialog() {
  const modal = document.createElement('div')
  modal.className = 'MuiModal-root MuiDialog-root'
  modal.innerHTML = '<div class="MuiDialog-container"><div class="MuiDialog-paper">The export dialog</div></div>'
  document.body.append(modal)
}

/** The document as it stands, without its scripts, to print in a page of its own. */
function documentNow(): string {
  const copy = document.documentElement.cloneNode(true) as HTMLElement
  for (const script of copy.querySelectorAll('script')) script.remove()
  return `<!doctype html>${copy.outerHTML}`
}

const papers = Object.values(PRINT_PAPERS)

describe('the poster printed to a PDF', () => {
  it.skipIf(server.browser !== 'chromium').each(papers)('fills $name with the poster, its words selectable, and nothing of the dialog', async (paper) => {
    const { handle, names } = drawExample()
    openDialog()
    await document.fonts.ready
    const held = posterCopy(handle.current!, paper, { look: 'print', title: 'A poster on paper', foot: 'Its foot', date: '8 Nov 2026' })!
    // Scaled to fit inside the margins: one side runs to them, neither past.
    const room = held.node.getBoundingClientRect()
    const drawn = held.node.querySelector('.print-page__copy')!.getBoundingClientRect()
    expect(drawn.right).toBeLessThanOrEqual(room.right + 1)
    expect(drawn.bottom).toBeLessThanOrEqual(room.bottom + 1)
    expect(Math.max(drawn.width / room.width, drawn.height / room.height)).toBeGreaterThan(0.9)
    const html = documentNow()
    held.release()
    const pages = await commands.printPdf(html)
    expect(pages).toHaveLength(1)
    expect(pages[0]!.widthMm).toBeCloseTo(paper.widthMm, 0)
    expect(pages[0]!.heightMm).toBeCloseTo(paper.heightMm, 0)
    const text = pages[0]!.text
    expect(text).toContain('A poster on paper')
    for (const name of names) expect(text).toContain(name)
    expect(text).not.toContain('The export dialog')
  })

  it.skipIf(server.browser !== 'chromium')('prints a drawing\'s picture on A4 the way round it fits, and nothing else', async () => {
    const outside = document.body.appendChild(document.createElement('div'))
    outside.textContent = 'The window behind'
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect x="10" y="10" width="780" height="480" fill="none" stroke="black"/><text x="40" y="80" font-size="40" font-family="sans-serif">Drawn words</text></svg>')
    let asked: { widthMm: number; heightMm: number } | undefined
    let pages: PdfPage[] = []
    // While the picture's address is still good: it is let go once the print has answered.
    await printPicture('A drawing', svg, async (doc) => { asked = doc; pages = await commands.printPdf(documentNow()) })
    expect(asked).toMatchObject({ widthMm: 297, heightMm: 210 })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.widthMm).toBeCloseTo(297, 0)
    expect(pages[0]!.text).toContain('Drawn words')
    expect(pages[0]!.text).not.toContain('The window behind')
  })
})
