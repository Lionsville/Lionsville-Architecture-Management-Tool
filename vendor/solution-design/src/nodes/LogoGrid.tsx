import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useStrings } from '../i18n/LanguageContext';
import type { UploadedLogo } from '../types';
import {
  LOGO_CATEGORIES,
  matchesLogoQuery,
  searchLogos,
  useLogoLibrary,
  type LogoEntry,
} from './logoRegistry';
import { LogoMark, PathMark } from './PathMark';

/**
 * THE icon picker — one grid, three places: the inspector's Appearance tab, the
 * palette tray, and the element menu's "Icon…" popover. Before Phase 3 those
 * were an Autocomplete, a hand-rolled 5-column grid and an eight-item submenu,
 * each with its own idea of what "no icon" meant; a library of a hundred marks
 * makes three answers untenable.
 *
 * What it shows: a search field over label + keywords (Dutch synonyms included,
 * accents folded — see `searchLogos`), a **None** tile first, the built-ins
 * grouped by category in registry order, the host's uploaded marks under their
 * own group, and an upload tile when the host can take one. The current choice
 * is outlined; every tile carries its label as a tooltip AND as its accessible
 * name, so the marks stay decorative (`aria-hidden`) and a screen reader
 * announces each tile once.
 *
 * It is presentational: `value` in, `onChange` out. Nothing here knows whether
 * the key it hands back lands on an element, a palette draft or a menu action.
 */

export interface LogoGridProps {
  /** The chosen key; `undefined` selects the None tile. */
  value?: string;
  /** A tile was picked. `undefined` from the None tile — clear the mark. */
  onChange(iconKey: string | undefined): void;
  /**
   * Opens the host's upload flow. Absent = no upload tile, which is the right
   * state for a host with nowhere to put an uploaded mark.
   */
  onRequestUpload?(): void;
  disabled?: boolean;
  /** Visible caption above the grid; also the group's accessible name. */
  label?: string;
  /** Scroll height of the tile area. The search field stays pinned above it. */
  maxHeight?: number;
  /** Tile edge in px (≈40 by default; the narrow palette tray uses less). */
  tileSize?: number;
}

/** The uploaded group's heading — searchable, as the built-in category headings are. */
const UPLOADED_HEADING_KEY = 'logo.category.uploaded' as const;

/**
 * Reuse the one definition of "found" for uploaded marks, which have a label and
 * their heading but no keywords. Their heading is their own: typing "vendors"
 * must not surface every upload as if it were a brand mark.
 */
function searchUploaded(
  query: string,
  library: UploadedLogo[],
  heading: string,
): UploadedLogo[] {
  if (!query.trim()) return library;
  // The English heading is matched too, so "uploaded" keeps working in Dutch.
  return library.filter((entry) =>
    matchesLogoQuery(query, [entry.label, heading, 'Uploaded']),
  );
}

export function LogoGrid({
  value,
  onChange,
  onRequestUpload,
  disabled = false,
  label,
  maxHeight = 240,
  tileSize = 40,
}: LogoGridProps) {
  const library = useLogoLibrary();
  const { t } = useStrings();
  const [query, setQuery] = useState('');
  const uploadedHeading = t(UPLOADED_HEADING_KEY);

  const matches = useMemo(() => searchLogos(query, undefined, t), [query, t]);
  const uploads = useMemo(
    () => searchUploaded(query, library, uploadedHeading),
    [query, library, uploadedHeading],
  );
  const groups = useMemo(
    () =>
      LOGO_CATEGORIES.map((category) => ({
        ...category,
        label: t(category.labelKey),
        entries: matches.filter((entry) => entry.category === category.key),
      })).filter((group) => group.entries.length > 0),
    [matches, t],
  );

  const markSize = Math.max(14, Math.round(tileSize * 0.5));
  const nothingFound = groups.length === 0 && uploads.length === 0;

  return (
    <Box>
      {label && (
        <Typography sx={{ display: 'block', fontSize: 10.5, color: 'text.secondary', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Box role="group" aria-label={label ?? t('palette.logo')}>
        <InputBase
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('logo.search')}
          inputProps={{ 'aria-label': t('logo.search') }}
          sx={{
            width: '100%',
            fontSize: 12.5,
            px: 1,
            py: 0.25,
            mb: 0.75,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&:focus-within': { borderColor: 'primary.main' },
          }}
        />
        <Box sx={{ maxHeight, overflowY: 'auto', pr: 0.25 }}>
          <TileRow tileSize={tileSize}>
            <Tile
              label={t('logo.none')}
              selected={value === undefined}
              disabled={disabled}
              tileSize={tileSize}
              onClick={() => onChange(undefined)}
            >
              <NoLogoGlyph size={markSize} />
            </Tile>
          </TileRow>

          {groups.map((group) => (
            <Box key={group.key}>
              <GroupHeading>{group.label}</GroupHeading>
              <TileRow tileSize={tileSize}>
                {group.entries.map((entry: LogoEntry) => (
                  <Tile
                    key={entry.key}
                    label={entry.label}
                    selected={value === entry.key}
                    disabled={disabled}
                    tileSize={tileSize}
                    onClick={() => onChange(entry.key)}
                  >
                    <PathMark entry={entry} size={markSize} decorative />
                  </Tile>
                ))}
              </TileRow>
            </Box>
          ))}

          {(uploads.length > 0 || onRequestUpload) && (
            <Box>
              <GroupHeading>{uploadedHeading}</GroupHeading>
              <TileRow tileSize={tileSize}>
                {uploads.map((entry) => (
                  <Tile
                    key={entry.key}
                    label={entry.label}
                    selected={value === entry.key}
                    disabled={disabled}
                    tileSize={tileSize}
                    onClick={() => onChange(entry.key)}
                  >
                    {/* Uploaded marks render full colour, and only ever through
                        `img` — an uploaded SVG inlined into the DOM would be an
                        XSS vector. `LogoMark` also adds the dark-mode plate. */}
                    <LogoMark
                      resolved={{ source: 'uploaded', entry }}
                      size={markSize}
                      decorative
                    />
                  </Tile>
                ))}
                {onRequestUpload && (
                  <Tile
                    label={t('logo.upload')}
                    selected={false}
                    disabled={disabled}
                    tileSize={tileSize}
                    onClick={onRequestUpload}
                  >
                    <UploadGlyph size={markSize} />
                  </Tile>
                )}
              </TileRow>
            </Box>
          )}

          {nothingFound && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1 }}>
              {t('logo.noMatches', { query: query.trim() })}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// --- chrome -------------------------------------------------------------------

function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10, color: 'text.secondary', mt: 0.75, mb: 0.25, letterSpacing: 0.3 }}
    >
      {children}
    </Typography>
  );
}

/** Auto-filling tile grid: as many ≈`tileSize` columns as the container allows. */
function TileRow({ tileSize, children }: { tileSize: number; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`,
        gap: 0.5,
      }}
    >
      {children}
    </Box>
  );
}

function Tile({
  label,
  selected,
  disabled,
  tileSize,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  tileSize: number;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    // A NATIVE `title`, not a MUI `Tooltip`. The grid draws well over a hundred
    // tiles: a Tooltip each means a hundred extra components, popper instances
    // and timers mounted every time an element is selected, which was enough to
    // make the editor's own render measurably slower. The browser's tooltip says
    // the same thing for free, and `aria-label` still carries the name.
    <ButtonBase
      title={label}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      disableRipple
      onClick={onClick}
      sx={{
        height: tileSize,
        borderRadius: 1,
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        color: selected ? 'primary.main' : 'text.secondary',
        backgroundColor: (theme) =>
          selected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'text.disabled',
          color: 'text.primary',
        },
        '&.Mui-disabled': { opacity: 0.5 },
      }}
    >
      {children}
    </ButtonBase>
  );
}

/** "None" — a slashed circle, so it reads as a clear rather than as a mark. */
function NoLogoGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.5} />
      <path d="M6.5 17.5l11-11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/** The upload tile's mark. */
function UploadGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.5} />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
