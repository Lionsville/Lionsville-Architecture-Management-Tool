// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A screen says one of five sizes: `--t-small`, `--t-body`, `--t-large`,
 * `--t-title`, `--t-page` (`src/widgets/kit/tokens.ts`). They are in rem, so a
 * browser's text size and the top bar's reach them. A size written out in px or
 * em does not follow the person, and is how there came to be sixteen sizes.
 *
 * What stays is what is on a canvas or a picture, where the type is part of the
 * drawing and the zoom is what makes it larger: `FIXED` holds those files, with
 * a ceiling that may only come down. A canvas's stylesheet says the fixed tokens
 * (`--canvas-t-*`) and is not counted.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const FIXED: Record<string, number> = {
  'src/app/drawingSkin.ts': 2,
  'src/business/ui/SheetPoster.css': 2,
  'src/editor/canvas/DomainGroupLayer.tsx': 1,
  'src/editor/edges/FloatingEdge.tsx': 1,
  'src/editor/nodes/ActorNode.tsx': 1,
  'src/editor/nodes/LogoGrid.tsx': 3,
  // The help's small screens: a picture of the app at a reading size, drawn to scale.
  'src/help/ui/pictures/pictures.css': 11,
  'src/layout/edgeLabelSize.ts': 2,
  'src/model/placement.ts': 6,
  'src/observations/ui/AnalysisPicture.tsx': 3,
  'src/observations/ui/ChainMarks.tsx': 2,
  'src/observations/ui/PictureMarks.tsx': 6,
  'src/observations/ui/SolutionPicture.tsx': 1,
}

const SOURCE = /\.(tsx?|css)$/
const NOT_SHIPPED = /\.(test|spec|contract)\.|\/testing\//
const THE_ONE_PLACE = 'src/widgets/kit/tokens.ts'
const ALLOWED = /^(0$|calc\(var\(--(canvas-t-[a-z]+|t-canvas-name)\) \/|var\(--(t-small|t-body|t-large|t-title|t-page|canvas-t-[a-z]+|t-canvas-name)\))/

function sources(under: string, out: string[] = []): string[] {
  for (const name of readdirSync(under)) {
    const path = join(under, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (SOURCE.test(name) && !NOT_SHIPPED.test(path)) out.push(path)
  }
  return out
}

/** Sizes written out in a stylesheet, an `sx` or an attribute, that are not on the scale. */
export function literalSizes(text: string): string[] {
  const found: string[] = []
  for (const held of text.matchAll(/(?:font-size:\s*|fontSize:\s*|fontSize=\{?\s*)([^;,}\n]+)/g)) {
    const said = (held[1] ?? '').trim().replace(/^['"`]|['"`]$/g, '')
    if (!/^[\d.]+|^var\(--t-(xs|sm|md|lg|xl|2xl|label|base)\)|^calc\(/.test(said)) continue
    if (!ALLOWED.test(said)) found.push(said)
  }
  return found
}

describe('a font size outside the scale', () => {
  const root = process.cwd()
  const counted = sources(join(root, 'src'))
    .map((path) => ({ file: relative(root, path), sizes: literalSizes(readFileSync(path, 'utf8')) }))
    .filter(({ file, sizes }) => sizes.length > 0 && file !== THE_ONE_PLACE)

  it('is found by the rule', () => {
    expect(literalSizes('.a { font-size: 12px; }')).toEqual(['12px'])
    expect(literalSizes("sx={{ fontSize: 13 }}")).toEqual(['13'])
    expect(literalSizes("sx={{ fontSize: '0.9em' }}")).toEqual(['0.9em'])
    expect(literalSizes('.a { font-size: var(--t-sm); }')).toEqual(['var(--t-sm)'])
    expect(literalSizes('.a { font-size: var(--t-small); }')).toEqual([])
    expect(literalSizes('.a { font-size: calc(var(--canvas-t-xs) / var(--canvas-zoom, 1)); }')).toEqual([])
    expect(literalSizes('<Icon fontSize="small" />')).toEqual([])
  })

  it('is on a canvas or a picture, and no more of them than there were', () => {
    const over = counted.filter(({ file, sizes }) => sizes.length > (FIXED[file] ?? 0)).map(({ file, sizes }) => `${file}: ${sizes.join(', ')}`)
    expect(over).toEqual([])
  })
})
