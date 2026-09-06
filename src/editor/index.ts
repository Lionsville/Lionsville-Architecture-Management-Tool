/**
 * The canvas and everything docked to it: the palette, the inspectors, the
 * toolbar, the nodes, the edges, the export.
 *
 * React through and through, so unlike the other modules it keeps its
 * subfolders rather than a `ui/` one. `canvas/` and this folder import each
 * other about ten times in each direction — a knot that used to cross a package
 * boundary and is now internal to one module. It is recorded here rather than
 * untied: untying it is a redesign of the editor's state, which phase 3 owns.
 *
 * `SolutionDesignEditorProps` is **a dozen entries**, down from 39, and each of
 * them names one thing the host owns:
 *
 * | | |
 * |---|---|
 * | `document` | what is open, and which diagram is on screen |
 * | `editing` | how it may change: `dispatch`, `history`, `ids`, `readOnly` |
 * | `diagrams` | who manages the tabs |
 * | `requests` | something outside asking the editor to show a thing |
 * | `layout` | what to do with what a layout pass has to say |
 * | `preferences` | view settings in, and out again |
 * | `language` | which language, and the toggle that changes it |
 * | `logos` | the uploaded mark library |
 * | `exportTitleBlock` · `renderMarkdown` · `windowChrome` · `onForceSave` | four capabilities that belong to nothing larger |
 *
 * Ten of the thirty-nine were the surface of a host this editor no longer has,
 * and nothing here passed any of them a value: `parameterSpecs`, `decorations`
 * and the chips that read them, `scopeSummary`, and three render slots. Six
 * more went with the batch (ADR-0002): `onChange`, `idAliases`,
 * `historyResetToken`, `rebaseToken`, `layoutOnOpenDiagramIds` and the four
 * separate undo props. The rest were grouped, which is the honest version of a
 * small number — twenty-eight capabilities do not become fewer by being
 * counted differently, but they do become legible when the ones that belong
 * together are named together.
 *
 * `readOnly` is the one the shell never passes: not a slot but a mode this
 * editor implements throughout, and a convention `CLAUDE.md` holds new work to.
 */
export { SolutionDesignEditor } from './SolutionDesignEditor'
/** What the editor is handed: props, decorations, export options. */
export type {
  EditorDiagramActions, EditorDocument, EditorEditing, EditorHistory, EditorLanguage,
  EditorLayoutReports, EditorLogos, EditorPreferencesSeam, EditorRequests,
  ExportDiagramPngOptions, ExportTitleBlock, SolutionDesignEditorProps,
} from './props'
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
