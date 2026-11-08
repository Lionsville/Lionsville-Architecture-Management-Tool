// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What jsdom cannot show: where the help's pictures are cut once a browser has
 * laid them out. A cut written in pixels ran through "Receiving, slotting,
 * picking and shipping" and through the line over Views here; the cut is now
 * read off the picture's own parts and lines, so it holds in every language
 * and at every text size, which is what this walks.
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { translator } from '../../i18n'
import type { Language } from '../../i18n/languages'
import { tokenVariables } from '../../widgets/kit/tokens'
import '../../widgets/kit/fonts/fonts.css'
import './help.css'
import { CHAPTER_WIDTH, START_COLUMN, START_WIDTH } from './HelpDocument'
import { HelpFigure } from './HelpFigure'
import { crosses, overlaps, textLines } from './pictureCut'
import type { Box } from './pictureCut'
import { PICTURES } from './pictures'
import { START_PICTURES } from './pictures/start'

const mounted: Root[] = []
afterEach(() => {
  for (const root of mounted.splice(0)) root.unmount()
  document.body.replaceChildren()
  document.documentElement.style.fontSize = ''
})


const figures = [
  ...START_PICTURES.map((Picture, at) => ({ name: `step ${at + 1}`, Picture, width: START_WIDTH, column: START_COLUMN })),
  ...Object.entries(PICTURES).map(([name, Picture]) => ({ name, Picture, width: CHAPTER_WIDTH, column: undefined })),
]

async function draw(language: Language, textSize: number, across = 780): Promise<HTMLElement> {
  for (const [name, value] of Object.entries(tokenVariables('light'))) document.documentElement.style.setProperty(name, value)
  document.documentElement.style.fontSize = `${textSize}%`
  const host = document.createElement('div')
  // As wide as the help's column of text at its widest, where a step's picture has the whole of its column.
  host.style.cssText = `width:${across}px`
  document.body.append(host)
  const root = createRoot(host)
  mounted.push(root)
  const t = translator(language)
  flushSync(() => {
    root.render(
      <LanguageProvider language={language}>
        {/* A step's picture in a step, so the page's own rules reach it as they do on the page. */}
        <ol className="help-start__steps">
          {figures.filter(({ column }) => column).map(({ name, Picture, width, column }) => (
            <li key={name} className="help-start__step" data-figure={name}><div><p>{name}</p></div><HelpFigure Picture={Picture} caption={name} t={t} width={width} column={column} small /></li>
          ))}
        </ol>
        {figures.filter(({ column }) => !column).map(({ name, Picture, width }) => <div key={name} data-figure={name}><HelpFigure Picture={Picture} caption={name} t={t} width={width} /></div>)}
      </LanguageProvider>,
    )
  })
  await document.fonts.ready
  await new Promise((resolve) => setTimeout(resolve, 50))
  return host
}

/** The cut a figure shows, read off what it was drawn with. */
function shownCut(figure: Element): Box {
  const crop = figure.querySelector('.help-crop') as HTMLElement
  const picture = figure.querySelector('.help-crop__picture') as HTMLElement
  const moved = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(picture.style.transform)
  // A picture with no part marked is shown whole.
  if (!moved) return { x: 0, y: 0, width: picture.offsetWidth, height: picture.offsetHeight }
  return { x: -Number(moved?.[1]), y: -Number(moved?.[2]), width: parseFloat(crop.style.width), height: parseFloat(crop.style.height) }
}

describe("the help's pictures, cut", () => {
  for (const language of ['en', 'nl', 'de'] as const) {
    for (const textSize of [100, 150]) {
      it(`cut through no line of text, in ${language} at ${textSize}%`, async () => {
        const host = await draw(language, textSize)
        const problems: string[] = []
        for (const { name, column } of figures) {
          const figure = host.querySelector(`[data-figure="${name}"]`) as HTMLElement
          const cut = shownCut(figure)
          const picture = figure.querySelector('.help-crop__picture') as HTMLElement
          for (const line of textLines(picture)) if (crosses(line, cut)) problems.push(`${name}: ${JSON.stringify(line)} across ${JSON.stringify(cut)}`)
          // And none the picture cuts itself, at a window's foot or a box's side, shows in the cut.
          for (const line of textLines(picture)) if (line.clipped && overlaps(line, cut)) problems.push(`${name}: ${JSON.stringify(line)} cut by the picture, in ${JSON.stringify(cut)}`)
          // A step's cut fits its column, where the column would otherwise cut it again, through whatever is at its edge.
          if (column && cut.width + 2 > column) problems.push(`${name}: ${cut.width} px wide in a column of ${column}`)
        }
        expect(problems).toEqual([])
      })
    }
  }

  it('shows no word smaller than 11 px at 100 %', async () => {
    const host = await draw('en', 100)
    const small: string[] = []
    for (const { name } of figures) {
      const figure = host.querySelector(`[data-figure="${name}"]`) as HTMLElement
      for (const element of Array.from(figure.querySelectorAll('.help-crop__picture *'))) {
        const own = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (own && parseFloat(getComputedStyle(element).fontSize) < 11) small.push(`${name}: ${element.textContent}`)
      }
    }
    expect(small).toEqual([])
  })

  it('enlarges the whole picture to most of the window, keeping its shape', async () => {
    const host = await draw('en', 100)
    const figure = host.querySelector('[data-figure="board"]') as HTMLElement
    ;(figure.querySelector('.help-figure__press') as HTMLButtonElement).click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const dialog = figure.querySelector('dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    const shown = dialog.getBoundingClientRect()
    const picture = (dialog.querySelector('.help-screen') as HTMLElement).getBoundingClientRect()
    const inline = figure.querySelector('.help-crop__picture') as HTMLElement
    // It fills one way to within the window's share, and never overflows the other.
    const filled = Math.max(shown.width / innerWidth, shown.height / innerHeight)
    expect(filled).toBeGreaterThan(0.85)
    expect(shown.width).toBeLessThanOrEqual(innerWidth)
    expect(shown.height).toBeLessThanOrEqual(innerHeight)
    // Its shape kept, to the few per cent text laid out larger rounds its lines to.
    expect(Math.abs((picture.width - 2) / (picture.height - 2) / (CHAPTER_WIDTH / inline.offsetHeight) - 1)).toBeLessThan(0.05)
    expect(dialog.scrollHeight).toBeLessThanOrEqual(dialog.clientHeight + 1)
  })

  it('scales a picture down to a phone\'s column rather than cutting it at the edge, and cuts it where a wide column does', async () => {
    const cutsAt = (host: HTMLElement) => figures.map(({ name }) => shownCut(host.querySelector(`[data-figure="${name}"]`) as HTMLElement))
    const wide = cutsAt(await draw('en', 100))
    for (const root of mounted.splice(0)) root.unmount()
    document.body.replaceChildren()
    const phone = await draw('en', 100, 358)
    const problems: string[] = []
    figures.forEach(({ name }, at) => {
      const figure = phone.querySelector(`[data-figure="${name}"]`) as HTMLElement
      const crop = (figure.querySelector('.help-crop') as HTMLElement).getBoundingClientRect()
      if (crop.right > phone.getBoundingClientRect().right + 0.5) problems.push(`${name}: ${crop.width} px in a column of 358`)
      const scaled = /scale\(([\d.]+)\)/.exec((figure.querySelector('.help-crop__picture') as HTMLElement).style.transform)
      // The same part of the picture, only smaller.
      const cut = shownCut(figure)
      const drawn = scaled ? { ...cut, width: cut.width / Number(scaled[1]), height: cut.height / Number(scaled[1]) } : cut
      for (const key of ['x', 'y', 'width', 'height'] as const) if (Math.abs(drawn[key] - wide[at]![key]) > 1) problems.push(`${name}: ${key} ${drawn[key]} against ${wide[at]![key]}`)
    })
    expect(problems).toEqual([])
  })
})
