// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The marks on the writer's toolbar, drawn as `widgets/icons` draws its own. */
import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Stroke({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

export const BulletIcon = (props: IconProps) => (
  <Stroke {...props}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".8" /><circle cx="4.5" cy="12" r=".8" /><circle cx="4.5" cy="18" r=".8" /></Stroke>
)
export const NumberIcon = (props: IconProps) => (
  <Stroke {...props}><path d="M10 6h10M10 12h10M10 18h10M4 4.5 5.5 4v5M3.5 14.5c.4-1 2.8-1 2.8.6 0 1.2-2.8 2-2.8 3.4h3" /></Stroke>
)
export const TaskIcon = (props: IconProps) => (
  <Stroke {...props}><rect x="3" y="4" width="7" height="7" rx="1" /><path d="m4.5 16.5 1.8 1.8 3-3.3M14 7.5h7M14 17h7" /></Stroke>
)
export const QuoteIcon = (props: IconProps) => (
  <Stroke {...props}><path d="M4 5v14M9 7h11M9 12h11M9 17h7" /></Stroke>
)
export const CodeIcon = (props: IconProps) => (
  <Stroke {...props}><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></Stroke>
)
export const TableIcon = (props: IconProps) => (
  <Stroke {...props}><rect x="3" y="4.5" width="18" height="15" rx="1.5" /><path d="M3 10h18M3 15h18M12 4.5v15" /></Stroke>
)
export const AttachIcon = (props: IconProps) => (
  <Stroke {...props}><path d="m20 11.5-8.2 8.2a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.3l7.8-7.8" /></Stroke>
)
export const OutlineIcon = (props: IconProps) => (
  <Stroke {...props}><path d="M4 6h16M8 12h12M8 18h12" /></Stroke>
)
export const SideBySideIcon = (props: IconProps) => (
  <Stroke {...props}><rect x="3" y="4.5" width="18" height="15" rx="1.5" /><path d="M12 4.5v15" /></Stroke>
)
export const PictureIcon = (props: IconProps) => (
  <Stroke {...props}><rect x="3" y="4.5" width="18" height="15" rx="1.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5.5-5 3.5 3 3-2.5 4.5 4" /></Stroke>
)
