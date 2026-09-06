/**
 * What the editor is handed, and what it hands back.
 *
 * The UI half of the old contract file: props, decorations, export options. It
 * lives here rather than in `model/` because none of it is the model — it names
 * `ReactNode`, `HTMLElement` and callbacks, and a module that computes must not
 * have to see any of that to read what an element is.
 */
import type { ReactNode } from 'react';
import type { Language } from '../i18n/strings';
import type { MarkdownRenderOptions } from '../documentation/documentation';
import type { EditorPreferences } from './preferences';
import type {
  DesignElement, DesignModel, DesignParameters, DiagramContentBatch, DiagramSettings, ElementId,
  Rect, UploadedLogo,
} from '../model/types';
import type { WindowChrome } from '../platform/windowChrome';

export interface ParameterSpec {
  key: keyof DesignParameters;
  label: string;
  input: 'slider' | 'number' | 'select' | 'text';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

/** One host-computed figure rendered as a small chip on a card. */
export interface DecorationChip {
  label: string;
  value: string;
  title?: string;
}

export interface ElementDecoration {
  linkCount?: number;
  drift?: boolean;
  dangling?: boolean;
  unlinkedWarning?: boolean;
  monthlyPrice?: number;
  /**
   * Derived figures rendered as a compact chip row (iteration 3: applications
   * show combined complexity + averaged maturity/cloud-nativeness from their
   * components). The package renders; the host computes — it stays
   * semantics-agnostic about parameters.
   */
  parameterSummary?: DecorationChip[];
  /** When set: warning icon with this tooltip ("commercial parameters incomplete"). */
  incompleteWarning?: string;
}

export interface SolutionDesignEditorProps {
  model: DesignModel;
  activeDiagramId: string;
  readOnly?: boolean;
  onActiveDiagramChange(diagramId: string): void;
  /** Debounced by the host; emitted on every local mutation. */
  onChange(batch: DiagramContentBatch): void;
  onCreateContainerDiagram(applicationElementId: ElementId): void;
  onCreateLayer7Diagram(): void;
  /**
   * Diagram management from a Layer 7 tab's right-click menu. Each entry is
   * offered only when its callback is present, so a host that manages diagrams
   * elsewhere sees no half-wired menu.
   *
   * `onRenameDiagram` receives the NEW name: the editor asks for it (a small
   * dialog with the current name preselected) and hands over the trimmed result,
   * so the host has nothing to prompt for. `onDeleteDiagram` is a request — the
   * host confirms in its own way and decides what becomes active; the editor
   * only refuses (disables the entry) for the last remaining landscape.
   */
  onRenameDiagram?(diagramId: string, name: string): void;
  onDuplicateDiagram?(diagramId: string): void;
  onDeleteDiagram?(diagramId: string): void;
  /**
   * Apply a diagram's settings — its name, what the exported title block says,
   * and which maturity columns its applications carry. The editor opens the
   * dialog and hands over the whole answer; wiring this is what puts "Diagram
   * settings…" in a tab's menu.
   *
   * Deliberately not part of `DiagramContentBatch`: that batch is content —
   * elements, connections, placements, routes — and this is the diagram record.
   */
  onDiagramSettingsChange?(diagramId: string, settings: DiagramSettings): void;
  parameterSpecs(element: DesignElement): ParameterSpec[];
  decorations?: Record<ElementId, ElementDecoration>;
  /** CM links + ADR slots, rendered by the host inside the inspector. */
  renderInspectorExtras?(element: DesignElement): ReactNode;
  /** Coverage/ADR panel slot, rendered in the toolbar. */
  renderDesignPanelExtras?(): ReactNode;
  exportTitleBlock?: { client: string; author?: string };
  /**
   * The shared uploaded logo library. The package never fetches it — the host
   * loads it and passes `{ key, label, url }` per entry, the same way the
   * commercial and ADR sections arrive as host-rendered slots. Absent = only the
   * built-in generic marks are offered.
   */
  logoLibrary?: UploadedLogo[];
  /**
   * Opens the host's logo-upload dialog. Absent = no upload affordance, which is
   * the correct state for a host that has no library endpoint.
   */
  onRequestLogoUpload?(): void;
  /**
   * Called after a PNG export that could not embed one or more logo marks, with
   * their labels. The export still produced an image — those elements fall back
   * to their kind glyph — but the host should tell the user, because a diagram
   * that quietly lost its marks looks finished and is not.
   */
  onExportImagesMissing?(labels: string[]): void;
  /**
   * Optional markdown renderer for element descriptions. The package stays
   * dependency-free here: without it, the preview falls back to a plain
   * <pre> block. The host passes its themed renderer.
   *
   * The second argument is what the package knows and the renderer does not:
   * today, what to do with a link to another element. Callers that only need
   * the text still call it with one argument.
   */
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * Imperative focus request (e.g. the coverage drawer's click-to-focus).
   * When `nonce` changes, the editor selects the element and pans/zooms to
   * it; if it is only placed on another diagram, it first requests a switch
   * via onActiveDiagramChange and completes the focus once the host updates
   * activeDiagramId. Elements placed on no diagram are a no-op.
   */
  focusElement?: { id: ElementId; nonce: number };
  /**
   * Open the documentation page from outside the editor — a host's own menu
   * bar, or its search. Without `elementId` the page opens on the selected
   * element, failing that the first element placed on the active diagram, and
   * failing that the first element in the model; with no elements at all it
   * does nothing. Bump `nonce` to ask again.
   */
  documentationRequest?: { elementId?: ElementId; nonce: number };
  /**
   * Scope-level cost summary, rendered as a corner chip on layer7 diagrams.
   * The host composes it from the diagram's estimate and linked scope T&S
   * line totals.
   */
  scopeSummary?: {
    estimatedMonthlyCost?: number;
    costEstimateNote?: string;
    linkedTasMonthly?: number;
    /**
     * Estimate-vs-linked-T&S delta (B1), composed by the host from its own
     * delta helper. Optional and undefined-means-hide, like the rest of
     * this prop — hosts that don't compute a delta see no change.
     */
    delta?: {
      amount: number;
      percent: number | undefined;
      significant: boolean;
      periodMismatch: boolean;
    };
  };
  /** When provided, the toolbar shows a fullscreen button (host implements the view). */
  onOpenFullscreen?: () => void;
  /**
   * What the host window paints over the top of a full-window view, and
   * whether that view's top bar has to double as the handle that moves the
   * window. A desktop build that hides the macOS title bar leaves the traffic
   * lights over our top-left corner: anything the editor draws across the
   * whole window (the documentation page) must start after them, or its first
   * button sits underneath them and cannot be clicked. Absent = a browser tab,
   * where the page owns every pixel.
   */
  windowChrome?: WindowChrome;
  /**
   * Force-save hook (U4c, DK8). Mod+S always suppresses the browser's save
   * dialog; when this prop is present it also flushes the host's pending saves
   * (e.g. `DiagramSaveQueue.flush(activeDiagramId)`). Absent, Mod+S is a pure
   * preventDefault no-op so the package still works standalone.
   */
  onForceSave?: () => void;
  /**
   * A layout action (Tidy, route-only) failed. The edge router is WebAssembly
   * fetched at runtime, so it can fail for reasons the user can act on: the
   * `.wasm` 404s behind a CDN rule or a stale build, or the module aborts and
   * stays down until the page reloads. Without this the whole failure is a
   * console rejection, and the button just looks dead.
   *
   * `message` is ready to show as-is. The host is expected to surface it (hal_app
   * uses `useNotify().error`). The editor always logs the failure to the console as
   * well, wired or not, so the cause stays available for debugging.
   */
  onLayoutError?(message: string): void;
  /**
   * Diagrams whose geometry THIS SESSION created, so the editor lays them out on
   * open even without the persisted flag — a container diagram the user just
   * created by double-clicking an application, or an import applied in this tab.
   *
   * The session half of the "unclaimed geometry" signal. It costs no migration
   * and covers the case that ships first; the persisted flag covers the one this
   * session cannot know about, such as a diagram an agent created hours ago.
   */
  layoutOnOpenDiagramIds?: string[];
  /**
   * An automatic layout has landed on this diagram. Fires exactly once per
   * diagram per session, and only when the pass produced placements.
   *
   * The host clears the persisted `needsLayout` flag from here. Deliberately the
   * host's job and not the content-save endpoint's: having a save clear it
   * whenever it receives placements is tempting and wrong, because an ordinary
   * node drag would then clear it before the layout ever ran, and a flag that
   * clears itself for reasons the editor cannot see is a flag nobody can reason
   * about.
   *
   * The editor says nothing itself. It has one message channel, `onLayoutError`,
   * and that one is for failures — making it carry good news too would be the
   * first step toward a layout that narrates itself.
   */
  onLayoutSettled?(diagramId: string): void;
  /**
   * Authoritative tempId → real-id maps, accumulated by the host from its
   * save responses. Reconciliation resolves temp ids from these first and
   * only falls back to heuristic matching (kind/name/placement) for ids the
   * maps don't cover — heuristics alone cannot tell identical twins apart
   * (two default-named elements, two identical parallel connections).
   *
   * The host MUST hand over a NEW object whenever it learns an alias — never
   * mutate the maps in place. Aliases routinely land in a later commit than the
   * model swap of the same save (the host fills them once its save call
   * resolves, while the mutation's success handler already pushed the new
   * content), and reconciliation re-runs on this prop's identity. An in-place
   * mutation is invisible to that effect and strands the tempId (see the
   * undo/redo remap in useEditorState).
   */
  idAliases?: {
    elements: ReadonlyMap<ElementId, ElementId>;
    connections: ReadonlyMap<string, string>;
  };
  /**
   * View settings to start with — snap, grid, lifecycle badges, panel collapse
   * and the two Tidy option sets (see `EditorPreferences`). Read ONCE, on mount:
   * they seed the editor's own state rather than controlling it, so a host that
   * persists them cannot fight the user's next click. Missing or unreadable
   * fields fall back one by one to the package defaults.
   */
  initialPreferences?: unknown;
  /**
   * Those settings changed. Fires only on a real change (value equality, not
   * identity), so a host may write straight to storage from here.
   *
   * The package deliberately owns no storage: hosts differ on where a
   * preference belongs — this browser, a user profile, or nowhere — and a
   * package that picked one would be wrong for the other two.
   */
  onPreferencesChange?(preferences: EditorPreferences): void;
  /**
   * Bump this when the host replaces the DOCUMENT under the same diagram ids —
   * opening a file, or reverting to a shipped one.
   *
   * It clears the undo/redo stacks and any pending local overlay, which is
   * exactly what a remount used to do and the only part of a remount that was
   * ever load-bearing here. Without it a host that stops remounting on file open
   * (to keep the viewport, the selection and the panel state) leaves ⌘Z able to
   * restore content from the PREVIOUS document — undo steps are diffs, and the
   * model they were diffed against is gone.
   *
   * Not needed when the diagram ids themselves change: a host swapping those
   * must still remount, because the editor's once-per-session settling pass is
   * keyed by diagram id.
   */
  historyResetToken?: number | string;
  /**
   * The UI language. Default `'en'`.
   *
   * A prop and not a preference: an embedded editor has to speak whatever the
   * page around it speaks, and a host that already knows its user's language
   * (a profile, a URL segment, an app-wide setting) must not have to teach the
   * editor a second time. The editor never changes it by itself.
   */
  language?: Language;
  /**
   * The user asked for the other language, from the toolbar's NL/EN toggle.
   *
   * Its presence is what puts that toggle in the toolbar: an editor whose host
   * owns the language elsewhere should not offer a control that fights it. Wire
   * it, persist the value, and hand it back through `language`.
   */
  onLanguageChange?(language: Language): void;
}

export interface ExportTitleBlock {
  /**
   * The row captions, in the UI language. Optional and English by default, so a
   * host calling `exportDiagramPng` directly keeps the block it always got; the
   * editor passes the translated set (4B) because the block is a caption on a
   * picture for a reader, not a field name in a file format.
   */
  labels?: {
    client: string;
    title: string;
    author: string;
    date: string;
    legend: string;
  };
  client: string;
  title: string;
  author?: string;
  /** ISO date (yyyy-mm-dd); defaults to today. */
  date?: string;
  /** Legend line (e.g. the configured aspect labels), drawn as an extra row. */
  legend?: string;
}

export interface ExportDiagramPngOptions {
  /** Element containing the rendered React Flow canvas. */
  container: HTMLElement;
  /** Flow-coordinate region to capture; defaults to the measured node bounds. */
  bounds?: Rect;
  /** Drawn bottom-right on the exported image only — never on the canvas. */
  titleBlock?: ExportTitleBlock;
  /**
   * Image pixels per CSS pixel of the board. Left out, the export picks one:
   * enough that type survives a large-format print, and never more than a
   * canvas will hold (`exportPixelRatio`). Passing one overrides that choice,
   * and is still held to what the canvas can take.
   */
  pixelRatio?: number;
  /** Padding around the captured bounds, in flow pixels. Default 48. */
  padding?: number;
  /** Default '#ffffff' so exports drop cleanly onto documents. */
  background?: string;
  /**
   * Called when one or more logo marks could not be embedded in the bitmap, with
   * their labels. The export still succeeds — those elements fall back to their
   * kind glyph — but the host should say so, because a PNG that quietly lost its
   * marks looks finished and is not.
   */
  onImagesMissing?(labels: string[]): void;
}
