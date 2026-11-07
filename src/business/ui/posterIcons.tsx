// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The small set of line icons a step or a stakeholder may carry on a poster, or an
 * image of the scope's. Optional, and it never stands in for a name: a screen reader
 * hears the name either way. A small set in the sheet's own chunk and no more, because
 * a page of a hundred steps does not need a registry.
 */
import { LibraryPicture, usePictureByAddress } from '../../documentation/ui/Pictures'

const PATHS: Readonly<Record<string, string>> = {
  box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.2a1.3 1.3 0 1 0 .01 0',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  scale: 'M12 4v16M6 20h12M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z',
  person: 'M12 3a4 4 0 1 0 .01 0M4 21c1-5 4-7 8-7s7 2 8 7',
  people: 'M8 5a3 3 0 1 0 .01 0M17 6.500a2.500 2.500 0 1 0 .01 0M2 20c.6-4 3-6 6-6s5.400 2 6 6M15 14c3 0 5.500 1.500 6.500 5',
  phone: 'M8.500 2.500h7a1.500 1.500 0 0 1 1.500 1.500v16a1.500 1.500 0 0 1-1.500 1.500h-7a1.500 1.500 0 0 1-1.500-1.500V4a1.500 1.500 0 0 1 1.500-1.500M11 18.500h2',
  call: 'M5 3h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c0 1-1 2-2 2C10 21 3 13 3 5c0-1 1-2 2-2z',
  calendar: 'M3 5h18v16H3zM3 10h18M8 2.500v5M16 2.500v5',
  card: 'M2.500 5h19v14h-19zM2.500 10h19M6 15h4',
  store: 'M3 9l2-5h14l2 5M4 9v12h16V9M3 9c0 2 4 2 4.500 0 .5 2 4 2 4.500 0 .5 2 4 2 4.500 0 .5 2 4.500 2 4.500 0M9 21v-6h6v6',
  scan: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 8v8M11 8v8M14 8v8M17 8v8',
  route: 'M6 16.500a2.500 2.500 0 1 0 .01 0M18 2.500a2.500 2.500 0 1 0 .01 0M8.500 19H16a3.500 3.500 0 0 0 0-7H8a3.500 3.500 0 0 1 0-7h7.500',
  pin: 'M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12zM12 7.500a2.500 2.500 0 1 0 .01 0',
  home: 'M3 11l9-8 9 8M5 9.500V21h14V9.500M10 21v-6h4v6',
  clock: 'M12 3a9 9 0 1 0 .01 0M12 7v5l3.500 2',
  pen: 'M4 20l1-4L16 5l3 3L8 19zM3 23h18',
  check: 'M3 3h18v18H3zM8 12l3 3 5-6',
  star: 'M12 3l2.700 6 6.300.700-4.700 4.300 1.300 6.300L12 17l-5.600 3.300 1.300-6.300L3 9.700 9.300 9z',
  chat: 'M3 4h18v13H9l-5 4v-4H3zM8 9h8M8 13h5',
  building: 'M5 21V3h10v18M15 9h4v12M3 21h18M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1',
}

export const POSTER_ICONS: readonly string[] = Object.keys(PATHS)

export function LineIcon({ name, size }: { name: string; size: number }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg className="poster-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <path d={path} />
    </svg>
  )
}

function ScopeImage({ address, alt }: { address: string; alt: string }) {
  const entry = usePictureByAddress(address)
  return entry ? <LibraryPicture entry={entry} alt={alt} /> : null
}

/**
 * A shipped icon by its name, or an image of the scope's by its address. A name's
 * own text is beside it, so a picture says nothing more to a reader; `wide` is a
 * logo's frame, 34 by 22, against an icon's square.
 */
export function IconOrImage({ icon, size, wide, alt = '' }: { icon: string; size: number; wide?: boolean; alt?: string }) {
  if (icon.startsWith('sha256:')) {
    return <span className="poster-logo" data-wide={wide ? '' : undefined}><ScopeImage address={icon} alt={alt ? '' : ''} /></span>
  }
  return <LineIcon name={icon} size={size} />
}
