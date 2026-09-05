import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import type { LogoEntry, ResolvedLogo } from './logoRegistry';

export interface PathMarkProps {
  entry: LogoEntry;
  /** Rendered box, px. Nodes draw 14 (header) or 28 (body); the picker 20. */
  size?: number;
  /**
   * Render the mark decoratively — `aria-hidden`, no `role="img"`/`aria-label` —
   * for contexts where adjacent text already names it (a picker tile with a
   * visible label, a menu row). Default false: on a node the mark alone carries
   * the element's identity, so it earns a name.
   */
  decorative?: boolean;
}

/**
 * THE renderer for every built-in mark. One component, one 24×24 `viewBox`, one
 * `path` — which is what makes the registry plain data (`marks/*.ts`) rather than
 * ~100 hand-written components.
 *
 * Two paint modes, because the two sources draw differently and both are wanted:
 * - `stroke` (default) for the hand-authored generic and rail sets — 2px
 *   `currentColor` strokes, round caps and joins, `fill: none`.
 * - `fill` for `simple-icons` paths, which are solid silhouettes.
 *
 * Both take their colour from `currentColor`, so a mark inherits the node's ink
 * in either MUI theme and under the per-element accent override, and neither
 * introduces a hex the theme cannot reach.
 */
export function PathMark({ entry, size = 14, decorative = false }: PathMarkProps) {
  const filled = entry.render === 'fill';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : entry.label}
      aria-hidden={decorative || undefined}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d={entry.path}
        {...(filled
          ? { fill: 'currentColor' }
          : {
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const,
            })}
      />
    </svg>
  );
}

/**
 * Render a RESOLVED mark — the one component nodes and pickers use, so neither
 * has to know where a mark came from.
 *
 * A built-in stays monochrome `currentColor`, so the node's colour and the
 * per-element accent override reach it. An uploaded mark renders in **full
 * colour** — a brand mark stripped of its own colour is not recognisable, which
 * is the whole point of the upload library — so the accent styles the chrome
 * around it and not the mark itself. It reaches the page as an `img` and only
 * ever as an `img`: an uploaded SVG inlined into the DOM could carry a script.
 *
 * On a DARK theme a full-colour mark gets a light backing plate. Brand marks are
 * drawn for white paper and half of them are dark ink on nothing, so without the
 * plate a Salesforce or Kafka logo dropped on a dark card header disappears into
 * it. The plate is a theme token (`card.logoPlate`), transparent in light mode,
 * and it is deliberately NOT applied to built-ins: those are `currentColor` and
 * already contrast with whatever they sit on.
 *
 * Both carry a name: the mark conveys the element's identity, so unlike the
 * decorative kind glyphs it earns one.
 */
export function LogoMark({
  resolved,
  size,
  decorative = false,
}: {
  resolved: ResolvedLogo;
  size: number;
  decorative?: boolean;
}) {
  const tokens = getNodeTokens(useTheme());
  if (resolved.source === 'builtin') {
    return <PathMark entry={resolved.entry} size={size} decorative={decorative} />;
  }
  const plated = tokens.mode === 'dark';
  return (
    <Box
      sx={{
        display: 'flex',
        flexShrink: 0,
        ...(plated
          ? { backgroundColor: tokens.card.logoPlate, borderRadius: '3px', p: '1px' }
          : {}),
      }}
    >
      <img
        src={resolved.entry.url}
        alt={decorative ? '' : resolved.entry.label}
        width={size}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
      />
    </Box>
  );
}
