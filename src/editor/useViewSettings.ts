// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useRef, useState } from 'react';
import type { TidyOptions } from '../layout/tidy';
import { mergePreferences, preferencesEqual, type EditorPreferences } from './preferences';
import type { EditorPreferencesSeam } from './props';

/**
 * The editor's view settings: the toggles, the panel widths and the two sets
 * of tidy options — the editor's, like the snap and lifecycle toggles, and
 * nothing that lands on the model.
 *
 * Seeded from the host ONCE, in the state initialiser: these are preferences,
 * not a controlled value. A host that persists them writes on `onChange` and
 * hands the same object back on the next mount, and re-reading the prop would
 * make that round trip fight whatever the user just clicked.
 */
export function useViewSettings(preferences: EditorPreferencesSeam | undefined) {
  const initial = useState(() => mergePreferences(preferences?.initial))[0];
  const [tidyOptions, setTidyOptions] = useState<TidyOptions>(initial.tidyOptions);
  // Per-group tidy settings, deliberately SEPARATE from the board's: a group
  // often wants a different direction or density from the board it sits on.
  const [groupTidyOptions, setGroupTidyOptions] = useState<TidyOptions>(initial.groupTidyOptions);
  // Grid snap (U4a), the visible dot grid (QF3), lifecycle badges (U5).
  const [snapToGrid, setSnapToGrid] = useState(initial.snapToGrid);
  const [showGrid, setShowGrid] = useState(initial.showGrid);
  const [showLifecycle, setShowLifecycle] = useState(initial.showLifecycle);
  // Panel collapse (U7b) and widths (4B): dragged on the seam beside each
  // panel, clamped by `model/panels`.
  const [paletteCollapsed, setPaletteCollapsed] = useState(initial.paletteCollapsed);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(initial.inspectorCollapsed);
  const [paletteWidth, setPaletteWidth] = useState(initial.paletteWidth);
  const [inspectorWidth, setInspectorWidth] = useState(initial.inspectorWidth);
  // The minimap (4B), off by default: it costs board area on a landscape that
  // already fills the window. Line labels: off, one shows only on hover or
  // selection.
  const [showMinimap, setShowMinimap] = useState(initial.showMinimap);
  const [showEdgeLabels, setShowEdgeLabels] = useState(initial.showEdgeLabels);

  const settings: EditorPreferences = {
    snapToGrid, showGrid, showLifecycle, paletteCollapsed, inspectorCollapsed,
    paletteWidth, inspectorWidth, showMinimap, showEdgeLabels, tidyOptions, groupTidyOptions,
  };
  useReportPreferences(settings, initial, preferences?.onChange);

  return {
    ...settings,
    setTidyOptions, setGroupTidyOptions, setSnapToGrid, setShowGrid, setShowLifecycle,
    setPaletteCollapsed, setInspectorCollapsed, setPaletteWidth, setInspectorWidth,
    setShowMinimap, setShowEdgeLabels,
  };
}

export type ViewSettings = ReturnType<typeof useViewSettings>;

/**
 * Report the view settings whenever one of them actually changes.
 *
 * One effect over all of them rather than a callback per toggle: the toggles
 * are plain `setState` calls in a dozen places (toolbar, canvas menu, panel
 * chevrons, the group popover) and threading a report through each of them
 * would be a dozen chances to forget one. The equality check is what makes
 * that affordable — a host writing to storage on every call must not be
 * called on every render.
 */
function useReportPreferences(
  next: EditorPreferences,
  initial: EditorPreferences,
  onChange: ((next: EditorPreferences) => void) | undefined,
) {
  const last = useRef<EditorPreferences>(initial);
  const {
    snapToGrid, showGrid, showLifecycle, paletteCollapsed, inspectorCollapsed,
    paletteWidth, inspectorWidth, showMinimap, showEdgeLabels, tidyOptions, groupTidyOptions,
  } = next;
  useEffect(() => {
    if (!onChange) return;
    const settings: EditorPreferences = {
      snapToGrid, showGrid, showLifecycle, paletteCollapsed, inspectorCollapsed,
      paletteWidth, inspectorWidth, showMinimap, showEdgeLabels, tidyOptions, groupTidyOptions,
    };
    if (preferencesEqual(last.current, settings)) return;
    last.current = settings;
    onChange(settings);
  }, [
    onChange, snapToGrid, showGrid, showLifecycle, paletteCollapsed, inspectorCollapsed,
    paletteWidth, inspectorWidth, showMinimap, showEdgeLabels, tidyOptions, groupTidyOptions,
  ]);
}
