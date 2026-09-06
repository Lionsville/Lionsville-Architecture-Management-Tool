import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme, alpha, type Theme } from '@mui/material/styles';
import type { ElementKind, UploadedLogo } from '../../model/types';
import { LogoGrid } from '../nodes/LogoGrid';
import { LogoLibraryProvider } from '../nodes/logoRegistry';
import {
  ApplicationGlyph,
  ChannelGlyph,
  ComponentGlyph,
  DomainGroupGlyph,
  GlobeGlyph,
  PersonGlyph,
  WrenchGlyph,
} from '../nodes/glyphs';
import { ColorField } from '../ColorField';
import { defaultGroupName } from './domainGroupPlacement';
import {
  PALETTE_ITEMS,
  PALETTE_SECTIONS,
  paletteDescription,
  paletteLabel,
  type PaletteKey,
} from './paletteItems';
import { useStrings } from '../../i18n/LanguageContext';
import { matchesQuery } from '../../model/textSearch';
import { PANEL_LIMITS } from '../panels';
import { STRINGS } from '../../i18n/strings';

export const PALETTE_DRAG_MIME = 'application/x-lionsville-element-kind';

/**
 * Docked widths. The numbers themselves live in `model/panels.ts` since 4B made
 * the panel resizable — the preference layer has to clamp a stored width and
 * cannot import a React component to find out the limits.
 */
export const PALETTE_WIDTH = PANEL_LIMITS.palette.default;
export const PALETTE_RAIL_WIDTH = PANEL_LIMITS.palette.rail;

/** Glyph stroke in the panel. Nodes draw 2; see `glyphs.tsx`. */
const GLYPH_STROKE = 1.5;

/**
 * What a palette gesture asks for beyond the kind. Deliberately smaller than
 * `ElementSeedStyle`: accent colour and shape live in the inspector Appearance
 * tab only. Choosing a brand mark is the one decision worth making *before*
 * placing — a shape is not, and offering both here is what made the previous
 * tray feel like a settings dialog.
 */
export interface PaletteSeed {
  iconKey?: string;
  name?: string;
}

/**
 * What the domain-group row asks for. Its own type rather than a `color` bolted
 * onto {@link PaletteSeed}: a group is not an element (no kind, no logo, no
 * inspector), and a seed field that only ever means something for one of seven
 * rows is the kind of thing that later gets passed to `addElement` by mistake.
 *
 * Colour IS offered before placing, unlike an element's accent — a group's whole
 * job is to mark out a region, so which region it marks is the decision you are
 * making when you create it.
 */
export interface DomainGroupSeed {
  name?: string;
  color?: string;
}

// --- local chrome icons (the package avoids @mui/icons-material) -------------

function Chevron({ direction }: { direction: 'left' | 'right' | 'down' }) {
  const d =
    direction === 'left' ? 'M15 5l-7 7 7 7' : direction === 'right' ? 'M9 5l7 7-7 7' : 'M5 9l7 7 7-7';
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- content mapping ---------------------------------------------------------

/**
 * The palette draws the SAME glyphs the canvas nodes draw, so what you pick
 * looks like what lands. Only the stroke is lighter here.
 */
const KIND_GLYPHS: Record<PaletteKey, FC<{ size?: number; strokeWidth?: number }>> = {
  actor: PersonGlyph,
  application: ApplicationGlyph,
  component: ComponentGlyph,
  externalSystem: GlobeGlyph,
  inputChannel: ChannelGlyph,
  managementTool: WrenchGlyph,
  domainGroup: DomainGroupGlyph,
};

/**
 * What one row's tray holds while you fill it in. The union of both seed shapes,
 * because one tray implementation serves every row — `iconKey` is set on every
 * element row (Phase 3: an actor or an input channel earns a mark as much as an
 * application does), `color` only on the domain group, and the two `clean*`
 * functions below are what keep each seed honest on the way out.
 */
interface PaletteDraft {
  iconKey?: string;
  name?: string;
  color?: string;
}

/** Drop empty strings so an untouched tray produces no seed fields at all. */
function cleanSeed(draft: PaletteDraft): PaletteSeed | undefined {
  const name = draft.name?.trim();
  const out: PaletteSeed = {};
  if (draft.iconKey) out.iconKey = draft.iconKey;
  if (name) out.name = name;
  return out.iconKey || out.name ? out : undefined;
}

/** The same, for the group row. Never carries `iconKey` — a group has no mark. */
function cleanGroupSeed(draft: PaletteDraft): DomainGroupSeed | undefined {
  const name = draft.name?.trim();
  const out: DomainGroupSeed = {};
  if (name) out.name = name;
  if (draft.color) out.color = draft.color;
  return out.name || out.color ? out : undefined;
}

// --- component ---------------------------------------------------------------

export interface ElementPaletteProps {
  kinds: ElementKind[];
  onAdd(kind: ElementKind, seed?: PaletteSeed): void;
  /**
   * Layer 7 only: offer a "Domain group" entry (creates a layoutConfig rect).
   * Absent = the row is not rendered at all, which is how a container diagram
   * ends up without one.
   */
  onAddDomainGroup?(seed?: DomainGroupSeed): void;
  /**
   * The shared logo library, injected by the host. The package never fetches:
   * `logoRegistry.tsx` promises no network and no blob, and this package is
   * HAL-agnostic, so uploaded marks arrive as `{ key, label, url }` the same way
   * the inspector's commercial sections arrive as host-rendered slots.
   */
  logoLibrary?: UploadedLogo[];
  /** Opens the host's upload dialog. Absent = no upload tile in the tray. */
  onRequestLogoUpload?(): void;
  /** Default name per kind, shown as the name field's placeholder. */
  defaultNames?: Partial<Record<ElementKind, string>>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Expanded width in px (4B: dragged on the seam, clamped by `model/panels`). */
  width?: number;
}

/**
 * The element palette: a DOCKED left panel, the mirror of `InspectorPanel` on
 * the right — a `flexShrink: 0` sibling of the `flex: 1` canvas, so collapsing
 * to the rail lets the canvas reclaim the width with no manual resize. Hidden
 * entirely in `readOnly`.
 *
 * **Pressing a row opens it; the Place button inside adds.** That is a
 * deliberate break with the previous click-to-add row, made because choosing a
 * logo before placing is worth a pause. The accessible name `Add <kind>` moved
 * with the action, onto that button — so what a screen reader (and the test
 * suite) looks for still names the control that actually places an element.
 * **Dragging a closed row still places directly**: drag is not click, and making
 * someone open a tray first would be a regression on the fast path.
 *
 * Presentation is the "variant B, calmer" recut: quiet sentence-case captions
 * that never fold, labels without descriptions, one text weight, 1.5-stroke
 * glyphs a step lighter than the label, no drag grip (the `grab` cursor carries
 * it), and a hover fill at roughly a third of its old strength. What that recut
 * deleted: per-kind hues (and the hardcoded-hex waiver they needed), palette
 * search, the recently-used strip, and the vendor-logo grid section — whose
 * removal also retired the `source: 'logo'` drag-payload discriminator, because
 * a logo chosen inside a kind's row already knows its kind.
 *
 * The collapsed rail follows the same rule: a click OPENS the panel with that
 * row already expanded, rather than placing. One gesture model everywhere —
 * click opens, drag places — beats a rail that quietly does something different
 * from the panel it collapses into. The per-kind draft survives the switch, so
 * reopening a row shows the logo you picked before collapsing.
 *
 * **Every row, including the domain group.** The group used to be the exception
 * that added on click, on the reasoning that a layout rect has nothing to
 * configure. It does: a colour. So it now opens a tray like the rest — name,
 * colour, Place — and drags onto the board like the rest. There is no longer a
 * row anywhere in this panel that behaves differently from its neighbours, which
 * is the whole point: six rows on a Layer 7 board, one gesture model, no
 * exceptions to remember.
 *
 * All panel state (which row is open, the per-kind draft) is in-memory and
 * local — same discipline as the snap and lifecycle toggles.
 *
 * Contrast, checked rather than assumed: the captions and row labels sit on
 * `text.secondary`, which against `background.paper` in HAL's theme measures
 * **5.74:1 on light and 8.78:1 on dark** — both clear of 4.5:1. `text.disabled`
 * would have looked calmer still and measures 2.68:1, so it is not used for
 * anything carrying meaning here.
 */
export function ElementPalette({
  kinds,
  onAdd,
  onAddDomainGroup,
  logoLibrary = [],
  onRequestLogoUpload,
  defaultNames,
  collapsed = false,
  onToggleCollapsed,
  width = PALETTE_WIDTH,
}: ElementPaletteProps) {
  const theme = useTheme();
  const { t } = useStrings();
  const mode = theme.palette.mode;
  const [openKey, setOpenKey] = useState<PaletteKey | null>(null);
  // The panel's own filter (4B). In-memory and never persisted: a search box
  // that remembered yesterday's word would hide four of six rows on open.
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Partial<Record<PaletteKey, PaletteDraft>>>({});
  const rowRefs = useRef<Partial<Record<PaletteKey, HTMLButtonElement | null>>>({});
  const trayRef = useRef<HTMLDivElement | null>(null);
  // The card handed to `setDragImage`, alive for exactly one drag.
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Opening a row moves focus into it, so the first thing a keyboard user meets
  // is the tray's own controls rather than the row they just pressed.
  useEffect(() => {
    if (!openKey) return;
    const first = trayRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }, [openKey]);

  // Belt and braces: unmounting mid-drag must not leave the card behind.
  useEffect(() => clearDragPreview, []);

  const draftFor = (key: PaletteKey): PaletteDraft => drafts[key] ?? {};
  const patchDraft = (key: PaletteKey, patch: PaletteDraft) =>
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const available = useMemo<PaletteKey[]>(
    () => (onAddDomainGroup ? [...kinds, 'domainGroup'] : [...kinds]),
    [kinds, onAddDomainGroup],
  );

  /**
   * A row matches on its name and its one-line description, **in both
   * languages**: this tool is used by Dutch-speaking architects who type English
   * product words, and a filter that only knew the current language would answer
   * "nothing" to half of what they type. Folding is the shared rule
   * (`model/textSearch`), so accents and case behave as they do in the icon grid.
   */
  const matches = useMemo(() => {
    const terms = (key: PaletteKey) => [
      STRINGS.en[PALETTE_ITEMS[key].labelKey],
      STRINGS.nl[PALETTE_ITEMS[key].labelKey],
      STRINGS.en[PALETTE_ITEMS[key].descriptionKey],
      STRINGS.nl[PALETTE_ITEMS[key].descriptionKey],
    ];
    return (key: PaletteKey) => matchesQuery(query, terms(key));
  }, [query]);

  const sections = useMemo(
    () =>
      PALETTE_SECTIONS.map((section) => ({
        ...section,
        keys: section.keys.filter((key) => available.includes(key) && matches(key)),
      })).filter((section) => section.keys.length > 0),
    [available, matches],
  );

  const closeTray = (focusRow?: PaletteKey) => {
    setOpenKey(null);
    if (focusRow) rowRefs.current[focusRow]?.focus();
  };

  /** The name a row shows when its field is empty — and what a drag is labelled. */
  const placeholderFor = (key: PaletteKey): string =>
    key === 'domainGroup'
      ? defaultGroupName(t)
      : (defaultNames?.[key] ?? paletteLabel(key, t));

  const place = (key: PaletteKey) => {
    const draft = draftFor(key);
    if (key === 'domainGroup') onAddDomainGroup?.(cleanGroupSeed(draft));
    else onAdd(key, cleanSeed(draft));
    closeTray(key);
  };

  const chromeSx = {
    flexShrink: 0,
    borderRight: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as const;

  /**
   * Build the card handed to `setDragImage`, replacing the OS ghost of a list
   * row with something shaped like the node about to exist.
   *
   * It shows the KIND GLYPH and the NAME, never the chosen logo. Two reasons,
   * both deliberate: the preview's job is "what is this and where will it land",
   * which the kind and name answer; and an `img` that has not finished loading
   * snapshots blank, so putting an uploaded mark in here would trade a reliable
   * preview for an occasionally empty one. The logo is confirmed on the node the
   * moment it lands.
   *
   * Built imperatively because `setDragImage` needs a laid-out node during the
   * event, and rendering six hidden React cards to satisfy that would duplicate
   * every row label in the DOM.
   */
  const buildDragPreview = (row: HTMLElement, key: PaletteKey): HTMLDivElement => {
    const card = document.createElement('div');
    card.setAttribute('aria-hidden', 'true');
    Object.assign(card.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      minWidth: '132px',
      borderRadius: '6px',
      border: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      boxShadow: theme.shadows[3],
      fontFamily: theme.typography.fontFamily ?? 'sans-serif',
      fontSize: '12.5px',
      pointerEvents: 'none',
    });

    // The row's own glyph — already the right mark for the kind.
    const glyph = row.querySelector('svg');
    if (glyph) {
      const clone = glyph.cloneNode(true) as SVGElement;
      clone.setAttribute('width', '18');
      clone.setAttribute('height', '18');
      clone.style.color = theme.palette.text.secondary;
      clone.style.flexShrink = '0';
      card.appendChild(clone);
    }

    const label = document.createElement('span');
    label.textContent = draftFor(key).name?.trim() || placeholderFor(key);
    card.appendChild(label);

    document.body.appendChild(card);
    return card;
  };

  const clearDragPreview = () => {
    previewRef.current?.remove();
    previewRef.current = null;
  };

  const setDragPayload = (event: React.DragEvent, key: PaletteKey) => {
    const draft = draftFor(key);
    // One payload shape for both: `kind` says what to make, the rest seeds it.
    // A group drag carries no `iconKey` and an element drag carries no `color`,
    // which is exactly what the two `clean*` functions guarantee.
    const seed = key === 'domainGroup' ? cleanGroupSeed(draft) : cleanSeed(draft);
    event.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify({ kind: key, ...seed }));
    event.dataTransfer.effectAllowed = 'move';
    // Guarded: a test's mock DataTransfer has no such method, and a missing
    // preview must never break the drag itself.
    if (typeof event.dataTransfer.setDragImage !== 'function') return;
    clearDragPreview();
    const card = buildDragPreview(event.currentTarget as HTMLElement, key);
    previewRef.current = card;
    event.dataTransfer.setDragImage(card, 16, 16);
    // The browser snapshots the node during this event, so it can go on the next
    // tick. Deliberately NOT waiting for `dragend`: a cancelled drag does not
    // always fire one, and the card would then sit in the body until reload.
    window.setTimeout(() => {
      if (previewRef.current === card) previewRef.current = null;
      card.remove();
    }, 0);
  };

  // --- collapsed rail -------------------------------------------------------
  if (collapsed) {
    return (
      <Box
        component="aside"
        aria-label={t('palette.aside')}
        sx={{ ...chromeSx, width: PALETTE_RAIL_WIDTH, alignItems: 'center', gap: 0.5, py: 0.5 }}
      >
        {onToggleCollapsed && (
          <Tooltip title={t('palette.expand')} placement="right">
            <IconButton
              size="small"
              aria-label={t('palette.expand')}
              aria-pressed
              onClick={onToggleCollapsed}
              sx={{ color: 'text.secondary' }}
            >
              <Chevron direction="right" />
            </IconButton>
          </Tooltip>
        )}
        <Divider flexItem sx={{ mx: 1 }} />
        {available.map((key) => {
          const Glyph = KIND_GLYPHS[key];
          return (
            <Tooltip
              key={key}
              placement="right"
              title={
                <>
                  {paletteLabel(key, t)}
                  <Box component="span" sx={{ display: 'block', opacity: 0.75 }}>
                    {paletteDescription(key, t)}
                  </Box>
                </>
              }
            >
              <ButtonBase
                aria-label={t('palette.openOptions', { name: paletteLabel(key, t).toLowerCase() })}
                draggable
                onDragStart={(event) => setDragPayload(event, key)}
                onClick={() => {
                  // Set the row first, then expand: `openKey` is state on this
                  // same component, so the expanded branch renders with the tray
                  // already open and focus already moving into it.
                  setOpenKey(key);
                  onToggleCollapsed?.();
                }}
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  color: 'text.secondary',
                  cursor: 'grab',
                  '&:hover': {
                    color: 'text.primary',
                    backgroundColor: alpha(theme.palette.text.primary, mode === 'dark' ? 0.06 : 0.04),
                  },
                }}
              >
                <Glyph size={18} strokeWidth={GLYPH_STROKE} />
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>
    );
  }

  // --- expanded panel -------------------------------------------------------
  const renderRow = (key: PaletteKey) => {
    const rowLabel = paletteLabel(key, t);
    const Glyph = KIND_GLYPHS[key];
    const lower = rowLabel.toLowerCase();
    const isGroup = key === 'domainGroup';
    const open = openKey === key;
    const draft = draftFor(key);
    const trayId = `lv-palette-tray-${key}`;

    return (
      <Box key={key}>
        <ButtonBase
          ref={(node: HTMLButtonElement | null) => {
            rowRefs.current[key] = node;
          }}
          aria-expanded={open}
          aria-controls={open ? trayId : undefined}
          draggable
          onDragStart={(event) => setDragPayload(event, key)}
          onClick={() => (open ? closeTray() : setOpenKey(key))}
          sx={{ ...rowSx(theme, mode), cursor: 'grab' }}
        >
          <Box sx={{ display: 'flex', color: 'text.secondary' }}>
            <Glyph size={15} strokeWidth={GLYPH_STROKE} />
          </Box>
          <Typography sx={{ fontSize: 13, lineHeight: 1.4, flex: 1, textAlign: 'left' }}>
            {rowLabel}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              color: 'text.disabled',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <Chevron direction="down" />
          </Box>
        </ButtonBase>
        <Collapse in={open} unmountOnExit>
          <Box
            id={trayId}
            ref={trayRef}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              closeTray(key);
            }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              mx: 2,
              mt: 0.5,
              mb: 1,
              px: 1.25,
              py: 1.25,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.text.primary, mode === 'dark' ? 0.06 : 0.035),
            }}
          >
            {/* Every element row gets the icon grid — Phase 3 lit the icon slot
                on the actor, the input channel and the component too, so the
                choice worth making before placing is available on all of them.
                Only the domain group has no mark to choose. The library reaches
                the grid through context, provided here from this panel's own
                prop so the palette keeps working outside the editor shell. */}
            {!isGroup && (
              <LogoLibraryProvider value={logoLibrary}>
                <LogoGrid
                  label={t('palette.logo')}
                  value={draft.iconKey}
                  onChange={(iconKey) => patchDraft(key, { iconKey })}
                  onRequestUpload={onRequestLogoUpload}
                  maxHeight={150}
                  tileSize={34}
                />
              </LogoLibraryProvider>
            )}
            {/* No visible "Name" caption: the placeholder already shows the name
                you get if you leave it alone, and a labelled group around one
                field would collide with the inspector's own Name field for
                anything querying by label. */}
            <InputBase
              value={draft.name ?? ''}
              onChange={(event) => patchDraft(key, { name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                place(key);
              }}
              placeholder={placeholderFor(key)}
              inputProps={{ 'aria-label': t('palette.nameField', { name: rowLabel }) }}
              sx={{
                width: '100%',
                fontSize: 12.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&:focus-within': { borderColor: 'primary.main' },
              }}
            />
            {/* Colour is the group's equivalent of the logo grid: the one thing
                worth deciding before the box exists, because the box IS a
                coloured region. Same control as the inspector's accent, so the
                clear affordance means the same thing in both places. */}
            {isGroup && (
              <ColorField
                label={t('palette.colour')}
                ariaLabel={t('palette.groupColour')}
                value={draft.color}
                readOnly={false}
                onChange={(value) => patchDraft(key, { color: value })}
              />
            )}
            <ButtonBase
              aria-label={t('palette.add', { name: lower })}
              onClick={() => place(key)}
              sx={{
                alignSelf: 'flex-start',
                px: 1.5,
                py: 0.5,
                fontSize: 12,
                borderRadius: 1,
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {t('palette.place')}
            </ButtonBase>
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box component="aside" aria-label={t('palette.aside')} sx={{ ...chromeSx, width }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pl: 2,
          pr: 1,
          pt: 2,
          pb: 0.75,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t('palette.addToCanvas')}</Typography>
        {onToggleCollapsed && (
          <Tooltip title={t('palette.collapse')} placement="right">
            <IconButton
              size="small"
              aria-label={t('palette.collapse')}
              aria-pressed={false}
              onClick={onToggleCollapsed}
              sx={{ color: 'text.secondary' }}
            >
              <Chevron direction="left" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* The filter. Only in the expanded panel: the rail has no labels to
          filter and no room for a field.
          `data-shortcuts-ignore` is what actually keeps Escape here: the canvas
          shortcut dispatch is a native capture-phase listener on `document`, so
          a React `stopPropagation()` alone would clear the filter AND deselect
          the board — two meanings for one keypress. */}
      <Box sx={{ px: 2, pb: 0.5, flexShrink: 0 }} data-shortcuts-ignore="">
        <InputBase
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || query === '') return;
            // Escape clears the filter instead of reaching the canvas's
            // deselect — one Escape, the nearest meaning.
            event.stopPropagation();
            setQuery('');
          }}
          placeholder={t('palette.searchPlaceholder')}
          inputProps={{ 'aria-label': t('palette.search'), type: 'search' }}
          sx={{
            width: '100%',
            fontSize: 12.5,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&:focus-within': { borderColor: 'primary.main' },
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pb: 1.5 }}>
        {sections.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, py: 1 }}>
            {t('palette.noMatches', { query: query.trim() })}
          </Typography>
        )}
        {sections.map((section, index) => (
          <Box component="section" key={section.id} aria-labelledby={`lv-palette-${section.id}`}>
            <Typography
              id={`lv-palette-${section.id}`}
              component="h3"
              sx={{
                fontSize: 11,
                fontWeight: 400,
                color: 'text.secondary',
                pl: 2,
                pr: 1,
                pt: index === 0 ? 1 : 2.25,
                pb: 0.25,
              }}
            >
              {t(section.titleKey)}
            </Typography>
            {section.keys.map(renderRow)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Shared row geometry — 8px vertical, 16px horizontal, quiet hover. */
function rowSx(theme: Theme, mode: 'light' | 'dark') {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1.4,
    px: 2,
    py: 1,
    justifyContent: 'flex-start',
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, mode === 'dark' ? 0.05 : 0.03),
    },
  } as const;
}

