/**
 * @lionsville/solution-design — customer solution design diagram editor.
 *
 * Public API per docs/plans/2026-06-10-solution-design/foundation/2026-06-10-solution-design-plan.md (Phase 2b +
 * Iteration 2 §2.3). The host (hal_app) integrates exclusively through these
 * exports; everything under editor/, canvas/, nodes/, edges/, model/, theme/
 * is internal.
 */

export type {
  AspectKey,
  AspectStatus,
  AspectEntry,
  AspectConfigEntry,
  ElementKind,
  Layer7Zone,
  ElementId,
  DesignElement,
  DesignParameters,
  DesignConnection,
  EdgeLineStyle,
  EdgeRouting,
  EdgeArrowhead,
  NodeShapeVariant,
  NodeIconSize,
  UploadedLogo,
  DiagramPlacement,
  DesignDiagram,
  DesignModel,
  DiagramContentBatch,
  MarkdownRenderOptions,
  DiagramLayoutConfig,
  DiagramSettings,
  DomainGroupRect,
  EdgeRoute,
  EdgeRouteSource,
  AttachSide,
  Point,
  ResizableZone,
  ParameterSpec,
  DecorationChip,
  ElementDecoration,
  SolutionDesignEditorProps,
  Rect,
  ExportTitleBlock,
  ExportDiagramPngOptions,
} from './types';

export { SolutionDesignEditor } from './editor/SolutionDesignEditor';
/**
 * The maturity-column list, on its own. A host that keeps its own defaults —
 * "what a new landscape in this project starts with" — edits them with the same
 * component the diagram's own settings use, so the two cannot drift.
 */
export { AspectColumnsEditor, settleFreshAspectKeys } from './editor/AspectColumnsEditor';
export { exportDiagramPng } from './export/exportPng';
/** Where the host publishes `libavoid.wasm`; call once before the editor routes. */
export { configureLibavoidWasm } from './layout/libavoidRouter';
/**
 * Optional: hand the package a factory for the routing worker, so routing runs
 * off the main thread. Constructing a worker is bundler-specific, so the host
 * owns the `new Worker(...)` and the package stays bundler-agnostic — without a
 * factory everything routes in-process exactly as before.
 */
export { configureLibavoidWorker, terminateLibavoidWorker } from './layout/libavoidRouter';
export { createTempId, isTempId } from './model/ids';
/**
 * The one definition of "this route row stores something" — a row without it is
 * the batch's delete marker. Hosts applying a `DiagramContentBatch` themselves
 * must use this rather than re-deriving the rule from `waypoints`.
 */
export { hasRouteContent } from './model/routes';
export {
  ASPECT_SUPERSET,
  DEFAULT_ASPECT_CONFIG,
  aspectConfigFor,
  aspectShortCode,
} from './model/aspects';
/**
 * The built-in icon library. A host needs it for two jobs the package cannot do
 * for it: deciding whether a key from ANOTHER tool is one the package knows
 * (`isBuiltInLogoKey` — the closed `iconType` vocabulary of the interchange
 * format), and offering its own picker if it has one. `searchLogos` is exported
 * with them so a host's picker filters by the same rule as the editor's,
 * accents and Dutch synonyms included.
 */
export {
  LOGO_ENTRIES,
  LOGO_CATEGORIES,
  isBuiltInLogoKey,
  logoCategoryLabel,
  searchLogos,
  useLogoLibrary,
} from './nodes/logoRegistry';
export type { LogoEntry, LogoCategory } from './nodes/logoRegistry';
/**
 * The editor's view settings. A host that persists them needs the type to hold
 * them and the defaults to fall back on; `mergePreferences` is exported so a
 * host can sanitise a stored blob before it decides anything from it (the
 * editor sanitises its own copy either way).
 */
export {
  DEFAULT_EDITOR_PREFERENCES,
  mergePreferences,
  preferencesEqual,
} from './model/preferences';
export type { EditorPreferences } from './model/preferences';
/**
 * THE STRING TABLE, so the host says the same words as the editor.
 *
 * A shell around this package has its own chrome — a save menu, a toast, a
 * confirm dialog — and those have to switch language with the toolbar toggle
 * inside the editor, not separately. Rather than a second table in the host and
 * two sets of Dutch to keep in step, the table is exported whole (shell copy
 * lives under the `shell.` prefix) along with `t` for the pure case,
 * `useStrings()` for components, and `LanguageProvider` for a host that renders
 * its own chrome outside the editor's tree.
 *
 * `detectBrowserLanguage()` is the default a host uses when nobody has chosen
 * yet — roadmap decision 1: a Dutch browser gets Dutch, everyone else English.
 */
export {
  LANGUAGES,
  STRINGS,
  detectBrowserLanguage,
  isLanguage,
  t,
  translator,
} from './i18n/strings';
export type { Language, StringKey, StringTable, Translate } from './i18n/strings';
export { LanguageProvider, useStrings } from './i18n/LanguageContext';
/**
 * Panel geometry: a host that persists `EditorPreferences` gets widths in the
 * blob and may want to sanitise them itself (the editor clamps its own copy
 * either way).
 */
export { PANEL_LIMITS, clampPanelWidth, panelWidth } from './model/panels';
