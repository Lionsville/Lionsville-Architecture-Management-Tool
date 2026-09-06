/**
 * What the editor is handed, and what it hands back.
 *
 * The UI half of the old contract file: props, decorations, export options. It
 * lives here rather than in `model/` because none of it is the model — it names
 * `ReactNode`, `HTMLElement` and callbacks, and a module that computes must not
 * have to see any of that to read what an element is.
 */
import type { ReactNode } from 'react';
import type { Command } from '../model/commands';
import type { IdPolicy } from '../model/keys';
import type { Language } from '../i18n/strings';
import type { MarkdownRenderOptions } from '../documentation/documentation';
import type { EditorPreferences } from './preferences';
import type {
  DesignModel, DiagramSettings, ElementId,
  Rect, UploadedLogo,
} from '../model/types';
import type { WindowChrome } from '../platform/windowChrome';

/**
 * Undo and redo, as the editor sees them.
 *
 * One object rather than four props because they are one thing: a stack the
 * editor reads and steps but does not own. Whether it can step is the host's
 * answer, not a count of anything here.
 */
export interface EditorHistory {
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Creating, renaming, duplicating and deleting the diagram tabs. */
export interface EditorDiagramActions {
    onCreateContainer(applicationElementId: ElementId): void;
    onCreateLayer7(): void;
    /**
     * Diagram management from a Layer 7 tab's right-click menu. Each entry is
     * offered only when its callback is present, so a host that manages diagrams
     * elsewhere sees no half-wired menu.
     *
     * `onRename` receives the NEW name: the editor asks for it (a small
     * dialog with the current name preselected) and hands over the trimmed result,
     * so the host has nothing to prompt for. `onDelete` is a request — the
     * host confirms in its own way and decides what becomes active; the editor
     * only refuses (disables the entry) for the last remaining landscape.
     */
    onRename?(diagramId: string, name: string): void;
    onDuplicate?(diagramId: string): void;
    onDelete?(diagramId: string): void;
    /**
     * Apply a diagram's settings — its name, what the exported title block says,
     * and which maturity columns its applications carry. The editor opens the
     * dialog and hands over the whole answer; wiring this is what puts "Diagram
     * settings…" in a tab's menu.
     *
     * Its own callback rather than a command the editor dispatches: the settings
     * carry rules the host owns — what the exported title block says, and the
     * project's default columns a diagram may override.
     */
    onSettingsChange?(diagramId: string, settings: DiagramSettings): void;
}

/** The shared uploaded mark library, and what happens when one cannot be drawn. */
export interface EditorLogos {
    /**
     * The shared uploaded logo library. The package never fetches it — the host
     * loads it and passes `{ key, label, url }` per entry, the same way the
     * commercial and ADR sections arrive as host-rendered slots. Absent = only the
     * built-in generic marks are offered.
     */
    library?: UploadedLogo[];
    /**
     * Opens the host's logo-upload dialog. Absent = no upload affordance, which is
     * the correct state for a host that has no library endpoint.
     */
    onRequestUpload?(): void;
    /**
     * Called after a PNG export that could not embed one or more logo marks, with
     * their labels. The export still produced an image — those elements fall back
     * to their kind glyph — but the host should tell the user, because a diagram
     * that quietly lost its marks looks finished and is not.
     */
    onExportImagesMissing?(labels: string[]): void;
}

/** Something outside the editor asking it to show a thing. */
export interface EditorRequests {
    /**
     * Imperative focus request (e.g. the coverage drawer's click-to-focus).
     * When `nonce` changes, the editor selects the element and pans/zooms to
     * it; if it is only placed on another diagram, it first requests a switch
     * via onActiveDiagramChange and completes the focus once the host updates
     * activeDiagramId. Elements placed on no diagram are a no-op.
     */
    focus?: { id: ElementId; nonce: number };
    /**
     * Open the documentation page from outside the editor — a host's own menu
     * bar, or its search. Without `elementId` the page opens on the selected
     * element, failing that the first element placed on the active diagram, and
     * failing that the first element in the model; with no elements at all it
     * does nothing. Bump `nonce` to ask again.
     */
    documentation?: { elementId?: ElementId; nonce: number };
}

/** What the editor says about a layout pass, and what it says it settled. */
export interface EditorLayoutReports {
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
    onError?(message: string): void;
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
    onSettled?(diagramId: string): void;
}

/** View settings in, and out again when they change. */
export interface EditorPreferencesSeam {
    /**
     * View settings to start with — snap, grid, lifecycle badges, panel collapse
     * and the two Tidy option sets (see `EditorPreferences`). Read ONCE, on mount:
     * they seed the editor's own state rather than controlling it, so a host that
     * persists them cannot fight the user's next click. Missing or unreadable
     * fields fall back one by one to the package defaults.
     */
    initial?: unknown;
    /**
     * Those settings changed. Fires only on a real change (value equality, not
     * identity), so a host may write straight to storage from here.
     *
     * The package deliberately owns no storage: hosts differ on where a
     * preference belongs — this browser, a user profile, or nowhere — and a
     * package that picked one would be wrong for the other two.
     */
    onChange?(preferences: EditorPreferences): void;
}

/** The UI language, and the toggle that changes it. */
export interface EditorLanguage {
    /**
     * The UI language. Default `'en'`.
     *
     * A prop and not a preference: an embedded editor has to speak whatever the
     * page around it speaks, and a host that already knows its user's language
     * (a profile, a URL segment, an app-wide setting) must not have to teach the
     * editor a second time. The editor never changes it by itself.
     */
    value?: Language;
    /**
     * The user asked for the other language, from the toolbar's NL/EN toggle.
     *
     * Its presence is what puts that toggle in the toolbar: an editor whose host
     * owns the language elsewhere should not offer a control that fights it. Wire
     * it, persist the value, and hand it back through `language`.
     */
    onChange?(language: Language): void;
}

/** What is open: the document, and which of its diagrams is on screen. */
export interface EditorDocument {
  model: DesignModel;
  activeDiagramId: string;
  onActiveDiagramChange(diagramId: string): void;
}

/**
 * How the document may change — and, with `readOnly`, whether it may at all.
 *
 * One object because these are one thing: the editor holds no copy of the
 * document and no stack of its own, so this is the whole of what it can do to
 * what it is drawing (ADR-0002).
 */
export interface EditorEditing {
  /**
   * Apply a change, and answer with the model that results — `undefined` when
   * the host refused it.
   *
   * An action builds a command, sends it here, and reads the answer, so the
   * next action in the same gesture sees the first without waiting for a
   * render.
   */
  dispatch(command: Command): DesignModel | undefined;
  /**
   * The host's undo stack, which is the app's only one. The toolbar buttons and
   * ⌘Z call it, and the editor pushes nothing of its own — so ⌘Z here undoes a
   * diagram rename or a decision's status as readily as a node move.
   */
  history: EditorHistory;
  /**
   * Where a new element's or connection's id comes from.
   *
   * An id is the key the thing will have in the file, minted at the moment it is
   * drawn, so a change can carry it and nothing ever refers to a name that is
   * about to be replaced (ADR-0002).
   *
   * Optional, because the editor can answer it from the model it is holding. A
   * host supplies one when it knows more than the editor can see, and because
   * an id handed out is then remembered across a remount.
   */
  ids?: IdPolicy;
  /** Nothing may change. Every mutating affordance hides or disables itself. */
  readOnly?: boolean;
}

/**
 * What the editor is handed.
 *
 * A dozen entries, and each of them names one thing the host owns: what is
 * open, how it may change, who manages the tabs, where the marks come from,
 * what to do with a request from outside, what to say about a layout pass,
 * where view settings live, which language to speak — and four single
 * capabilities that belong to nothing larger.
 */
export interface SolutionDesignEditorProps {
  document: EditorDocument;
  editing: EditorEditing;
  diagrams: EditorDiagramActions;
  requests?: EditorRequests;
  layout?: EditorLayoutReports;
  preferences?: EditorPreferencesSeam;
  language?: EditorLanguage;
  logos?: EditorLogos;
  exportTitleBlock?: { client: string; author?: string };
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
