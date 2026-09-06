/**
 * The canvas and everything docked to it: the palette, the inspectors, the
 * toolbar, the nodes, the edges, the export.
 *
 * React through and through, so unlike the other modules it keeps its
 * subfolders rather than a `ui/` one. `canvas/` and this folder import each
 * other about ten times in each direction — a knot that used to cross a package
 * boundary and is now internal to one module. It is recorded here rather than
 * untied: untying it is a redesign of the editor's state, which phase 3 owns.
 */
export { SolutionDesignEditor } from './SolutionDesignEditor'
/**
 * The maturity-column list, on its own. The shell keeps its own defaults —
 * "what a new landscape starts with" — and edits them with the same component
 * the diagram's own settings use, so the two cannot drift.
 */
export { AspectColumnsEditor, settleFreshAspectKeys } from './AspectColumnsEditor'
export { exportDiagramPng } from './export/exportPng'
/**
 * The built-in icon library. The shell needs it to decide whether a key from
 * another tool is one this app knows (`isBuiltInLogoKey` — the closed
 * `iconType` vocabulary of the interchange format) and to filter its own picker
 * by the same rule the editor's uses.
 */
export {
  LOGO_ENTRIES, LOGO_CATEGORIES, isBuiltInLogoKey, logoCategoryLabel, searchLogos, useLogoLibrary,
} from './nodes/logoRegistry'
export type { LogoEntry, LogoCategory } from './nodes/logoRegistry'
/**
 * The editor's view settings. Preferences, not a controlled value: seeded once
 * on mount and persisted from `onPreferencesChange`. `mergePreferences`
 * sanitises a stored blob, so a stale one costs that field and not the editor.
 */
export { DEFAULT_EDITOR_PREFERENCES, mergePreferences, preferencesEqual } from './preferences'
export type { EditorPreferences } from './preferences'
/** Panel geometry, for sanitising widths that arrive in a stored blob. */
export { PANEL_LIMITS, clampPanelWidth, panelWidth } from './panels'
