// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { DragEvent, FC } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { Tooltip } from '../../widgets/kit/Tooltip';
import { ApplicationGlyph, BlockGlyph, ComponentGlyph, DomainGroupGlyph, PersonGlyph, PlatformGlyph, ServiceGlyph } from '../nodes/glyphs';
import { paletteDescription, paletteLabel, type PaletteKey } from './paletteItems';

export const PALETTE_DRAG_MIME = 'application/x-lionsville-element-kind';

/** What a gesture on a kind says beyond the kind. A logo is the inspector's, once it has a name. */
export interface PaletteSeed {
  iconKey?: string;
  name?: string;
}

/** What a group is given when it is made. */
export interface DomainGroupSeed {
  name?: string;
  color?: string;
}

const GLYPH_STROKE = 1.5;

function ExistingGlyph({ size = 14, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M6 10h8M6 14h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M19 3v6M16 6h6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

const KIND_GLYPHS: Record<PaletteKey, FC<{ size?: number; strokeWidth?: number }>> = {
  actor: PersonGlyph,
  application: ApplicationGlyph,
  component: ComponentGlyph,
  platform: PlatformGlyph,
  platformService: ServiceGlyph,
  buildingBlock: BlockGlyph,
  domainGroup: DomainGroupGlyph,
};

export interface ElementPaletteProps {
  kinds: readonly PaletteKey[];
  /** A kind pressed: the picker opens, at the board's centre. */
  onPress(key: PaletteKey): void;
  onAddExisting?(): void;
}

/**
 * The kinds as a labelled rail, kept open by whoever keeps it open (Add → Keep open):
 * reading comes first, so it is closed unless somebody asks. Drag a kind onto the
 * board, or press it to name it. What a kind is sits in its tooltip and the manual,
 * not on a screen somebody has read a hundred times.
 */
export function ElementPalette({ kinds, onPress, onAddExisting }: ElementPaletteProps) {
  const { t } = useStrings();
  const onDragStart = (key: PaletteKey) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify({ kind: key }));
    event.dataTransfer.effectAllowed = 'move';
  };
  const row = (key: PaletteKey) => {
    const Glyph = KIND_GLYPHS[key];
    const name = paletteLabel(key, t);
    return (
      <Tooltip key={key} title={paletteDescription(key, t)} placement="right">
        <button
          type="button"
          className="lv-rail__kind"
          draggable
          aria-label={t('palette.add', { name })}
          onDragStart={onDragStart(key)}
          onClick={() => onPress(key)}
        >
          <Glyph size={20} strokeWidth={GLYPH_STROKE} />
          <span>{name}</span>
        </button>
      </Tooltip>
    );
  };
  const [first, ...rest] = kinds;
  return (
    <aside className="lv-rail" aria-label={t('palette.aside')} data-guide="board.palette">
      {first && row(first)}
      {onAddExisting && (
        <button
          type="button"
          className="lv-rail__kind lv-rail__kind--press"
          aria-label={t('palette.existing')}
          data-guide="board.library"
          onClick={onAddExisting}
        >
          <ExistingGlyph size={20} strokeWidth={GLYPH_STROKE} />
          <span>{t('palette.existingShort')}</span>
        </button>
      )}
      {rest.map(row)}
    </aside>
  );
}
