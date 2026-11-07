// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A Harvey ball (ADR-0043): empty, a quarter, a half, three quarters, full, and
 * the legend that says so in words, so the reading of a grid does not rest on a
 * shape alone.
 */
import { useStrings } from '../../i18n/LanguageContext'
import type { StringKey } from '../../i18n'
import type { BlockLevel as Level } from '../../model/types'

const R = 7

/** The filled part, as a path: a wedge from twelve o'clock, clockwise. */
function wedge(level: Level): string {
  const angle = (level / 4) * 2 * Math.PI
  const x = 8 + R * Math.sin(angle)
  const y = 8 - R * Math.cos(angle)
  return `M8 8 L8 ${8 - R} A${R} ${R} 0 ${level > 2 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`
}

/** `quiet` is a target and not a rating: what is needed, in the secondary ink. */
export function BallFigure({ level, size = 16, quiet = false }: { level: Level; size?: number; quiet?: boolean }) {
  return (
    <span className="guidance-ball" data-quiet={quiet || undefined}>
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
        <circle cx="8" cy="8" r={R} fill={level === 4 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
        {level > 0 && level < 4 && <path d={wedge(level)} fill="currentColor" />}
      </svg>
    </span>
  )
}

const LEVEL_WORD: Record<Level, StringKey> = {
  0: 'blocks.level0', 1: 'blocks.level1', 2: 'blocks.level2', 3: 'blocks.level3', 4: 'blocks.level4',
}

/** The balls, in words. */
export function BallLegend() {
  const { t } = useStrings()
  return (
    <ul className="guidance-legend" aria-label={t('blocks.legend')}>
      {([0, 1, 2, 3, 4] as const).map((level) => <li key={level}><BallFigure level={level} size={14} />{t(LEVEL_WORD[level])}</li>)}
    </ul>
  )
}
