// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useMemo, useState } from 'react';
import { placedNodes } from '../model/placement';
import type { ColourBy, OverlayBand } from '../model/overlay';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import { SurfaceMenu as Menu } from '../widgets/kit/Surface';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { createPortal } from 'react-dom';
import { BoardBar, type BoardBarAdd, type BoardBarShow } from './BoardBar';
import { Button as KitButton } from '../widgets/kit/Button';
import { usePlaceHost } from '../widgets/kit/placeHost';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { TidyOptions } from '../layout/tidy';
import { ContextMenu } from './canvas/ContextMenu';
import { OWN_MENU_ATTR } from './isEditableTarget';
import { menuItemsFor, type MenuItem as MenuItemModel } from './canvas/menuItems';
import { detectPlatform } from './keymap';
import type { DesignDiagram, DesignModel, ElementId, Point } from '../model/types';
import { AddIcon, CaretIcon, RadarIcon } from '../widgets/icons';
import { useStrings } from '../i18n/LanguageContext';
import { DayControl } from '../widgets/kit/DayControl';
import { formatDay } from '../i18n/dates';
import { daysWorthLooking } from './daysWorthLooking';
import { type Language, type StringKey } from '../i18n/strings';

/**
 * Which layout action is currently running. Both of them go through a WASM
 * engine (ELK for Tidy, libavoid for route-only) and both commit one undo step,
 * so they must not overlap: whichever is running disables the other. Naming the
 * action rather than carrying a bare boolean keeps the spinner on the button the
 * user actually pressed.
 */
export type LayoutAction = 'tidy' | 'route';

export interface EditorToolbarProps {
  model: DesignModel;
  activeDiagram: DesignDiagram;
  readOnly: boolean;
  /**
   * Looking at another day (ADR-0027, amended): what lays the board out is put
   * away, as under `readOnly`, while what is about the look, the day, *Save*,
   * undo, stays.
   */
  looking?: boolean;
  /** The board this container diagram was opened from: where its way back goes. */
  cameFrom?: string;
  /** A container diagram with categories: a row per category, then the lines. */
  onLayersByCategory?(): void;
  busy?: LayoutAction;
  onActiveDiagramChange(diagramId: string): void;
  /** The view that is up was pressed: its own panel. Absent, nothing happens. */
  onOpenThisView?(): void;
  onCreateLayer7Diagram(): void;
  /**
   * Open a laid-out view the canvas cannot draw (ADR-0012 §6). Its tab sits in
   * the same strip — a view is a view — but choosing it is a request to the
   * host rather than a change of the active diagram, because the canvas has
   * nothing to draw for one.
   */
  onOpenSheet?(diagramId: string): void;
  onOpenMap?(diagramId: string): void;
  onCreateMap?(): void;
  /** The technology landscape (ADR-0015), listed among the tabs like the other laid-out views. */
  onOpenTechnology?(diagramId: string): void;
  onCreateTechnology?(): void;
  /** A drawing, listed on its own and made from the same menu. */
  onOpenDrawing?(diagramId: string): void;
  onCreateDrawing?(): void;
  /** Ask which kind of view to make. Handed how to make a landscape, which is the editor's. */
  onNewView?(landscape: () => void): void;
  /**
   * The organisation chart and the Conway map (ADR-0036 §7): laid out, each
   * listed on its own, and made from the same menu.
   */
  onOpenChart?(diagramId: string): void;
  onCreateChart?(): void;
  onOpenConway?(diagramId: string): void;
  onCreateConway?(): void;
  /** The active view is laid out (ADR-0016): the canvas's controls have nothing to act on. */
  laidOut?: boolean;
  /** Where a laid-out page may draw its own controls in this row (`PageView.pageBar`). */
  onPageBar?: (node: HTMLElement | null) => void;
  /**
   * The active view is drawn on a day, laid out or not: a board, and the
   * organisation chart and the Conway map (ADR-0036 §7). It keeps the day
   * control — looking at another day, and saving one — when the canvas's
   * other controls are put away.
   */
  dated?: boolean;
  /** Offer a business architecture beside a landscape under the `+`. */
  onCreateSheet?(): void;
  onTidy(): void;
  /**
   * Stop the tidy that is running. Absent when the layout has no thread of its
   * own to stop, in which case the button stays a disabled spinner — a Cancel
   * that cannot cancel is worse than no Cancel.
   */
  onCancelTidy?(): void;
  /** Session Tidy settings, opened from the caret beside the Tidy button. */
  tidyOptions: TidyOptions;
  onTidyOptionsChange(options: TidyOptions): void;
  /**
   * Re-route the edges around the CURRENT node positions without moving a node.
   * Standalone button for now; the Tidy customization plan's Phase 3 folds it
   * into the Tidy split-button popover, and this handler migrates as-is.
   */
  onRouteEdges(): void;
  /**
   * Live auto-routing for this diagram: persisted, off by default.
   *
   * A pressed-state button here rather than a checkbox in the Tidy popover, for
   * three reasons. It is a MODE, not a parameter of an action the user invokes.
   * Off-by-default makes discoverability the real risk, and a mode behind a caret
   * will not be found. And when it self-disables on a board the router refuses,
   * its state has to be visible at the moment the user is wondering why their
   * lines stopped moving.
   */
  autoRoute: boolean;
  onToggleAutoRoute(): void;
  /**
   * Why auto-routing cannot do anything useful right now, appended to the
   * toggle's tooltip. Two cases, both worth explaining rather than leaving the
   * user to conclude the feature is broken: the board is over the connector cap
   * and the mode turned itself off, or the diagram still holds routes written
   * before provenance existed, which live mode will never move until one "Route
   * connections" press reclassifies them.
   */
  autoRouteNote?: string;
  onExport(): void;
  /**
   * A PNG export is rasterising. Its own flag rather than {@link busy}: an
   * export neither commits nor conflicts with a layout pass, so it disables its
   * own button and nothing else.
   */
  exportBusy?: boolean;
  /** Opens the keyboard-shortcuts help overlay (U4c). */
  onOpenHelp(): void;
  /** Add's kinds, and whether the rail stays open. Absent on a view nothing is placed on. */
  add?: BoardBarAdd;
  /** What Show says about the cards and the key. */
  show?: BoardBarShow;
  /** Route every line again, those a person drew too. */
  onRouteEdgesAll?(): void;
  /** Lifecycle-badge toggle state + handler (U5); default on. */
  showLifecycle: boolean;
  onToggleLifecycle(): void;
  /**
   * The deployment boxes on a container diagram (ADR-0013); default on, and
   * absent on every other kind of view — there is nothing to draw them around.
   */
  showDeployment?: boolean;
  onToggleDeployment?(): void;
  /**
   * What the landscape's cards are tinted by (ADR-0013), and the bands that
   * came out of it for the legend. Absent on every view that is not a
   * landscape — there is nothing there to colour.
   */
  colourBy?: ColourBy;
  onColourByChange?(by: ColourBy | undefined): void;
  /** Keep this reader's lens with the view, for everybody who opens it. Absent: nothing to keep, or nobody here may. */
  onKeepColourBy?(): void;
  overlayBands?: readonly OverlayBand[];
  /** What the one-thing overlay may ask about (ADR-0020): this scope's platforms and offerings, by name. */
  overlayCandidates?: readonly { id: ElementId; name: string }[];
  /**
   * The day the board is drawn on (ADR-0009); absent = today. The same single
   * model as it stood then — which is how a future diagram is made, rather
   * than by copying the project.
   *
   * Moving it is looking, not writing (ADR-0027): `onAsOfChange` changes what
   * this window shows and nothing else. Making it the board's day is the
   * band's, which is up while the look is.
   */
  asOf?: string;
  onAsOfChange(day: string | undefined): void;
  /** `yyyy-mm-dd`, what the days worth looking at are counted from. */
  today?: string;
  /** In-memory undo/redo (U7); buttons hidden under readOnly, gated on stack depth. */
  onUndo(): void;
  onRedo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Optional: host-implemented fullscreen view. */
  /**
   * Diagram management for a Layer 7 tab's right-click menu; each entry is
   * offered only when its callback is present. Rename opens the editor's own
   * dialog first, so `onRenameDiagram` already receives the new name.
   */
  onRenameDiagram?(diagramId: string, name: string): void;
  /** Opens the diagram's settings dialog; the editor owns the dialog itself. */
  onOpenDiagramSettings?(diagramId: string): void;
  /**
   * Copy a diagram. `asOf` dates the copy in the same step (ADR-0009), which is
   * what makes "the landscape after the cutover" one action rather than a
   * duplicate followed by a setting somebody forgets.
   */
  onDuplicateDiagram?(diagramId: string, asOf?: string): void;
  onDeleteDiagram?(diagramId: string): void;
  /** "History…" on the tab menu; absent where the host keeps none (ADR-0008). */
  onDiagramHistory?(diagramId: string): void;
  /** ⌘F: opens the element finder. */
  onOpenSearch(): void;
  /** Minimap toggle (4B): persisted with the other view settings. */
  showMinimap: boolean;
  /** Line labels always, or only on hover and selection; default on. */
  showEdgeLabels: boolean;
  onToggleEdgeLabels(): void;
  onToggleMinimap(): void;
  /**
   * The NL/EN toggle. Shown ONLY when the host wired `onLanguageChange` — an
   * editor whose host owns the language elsewhere (a global app setting, a URL)
   * must not offer a second control that fights it.
   */
  onLanguageChange?(language: Language): void;
}


/**
 * Top bar: Layer 7 diagram tabs (breadcrumb when drilled into a container
 * diagram) and the tidy / fit / export actions.
 */
/** The tab lists, in the order the strip shows them. */
/**
 * The technology landscape has a View bar of its own, and undo and find are the
 * frame's: nothing is left for this bar to hold but the tabs, which are row two.
 */
function barDisplay(framed: boolean, kind: DesignDiagram['kind']): 'none' | 'flex' {
  return framed && (kind === 'technology' || kind === 'chart') ? 'none' : 'flex';
}

const TAB_LISTS = ['board', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway'] as const;
type TabList = (typeof TAB_LISTS)[number];

/**
 * Which tab list a view belongs on. A container view is not a tab. A drawing,
 * an organisation chart and a Conway map are each their own list, offered
 * only where the host can open one — the same rule as a sheet, a map and a
 * technology landscape.
 */
function tabList(kind: DesignDiagram['kind'], props: EditorToolbarProps): TabList | 'none' {
  switch (kind) {
    case 'layer7':
      return 'board'
    case 'container':
      return 'none'
    case 'sheet':
      return props.onOpenSheet ? 'sheet' : 'none'
    case 'map':
      // Coverage is a reading of the sheet, in the sheet's own tab, wherever there is a sheet for it to be a reading of.
      return props.onOpenMap && !props.model.diagrams.some((diagram) => diagram.kind === 'sheet') ? 'map' : 'none'
    case 'technology':
      return props.onOpenTechnology ? 'technology' : 'none'
    case 'drawing':
      return props.onOpenDrawing ? 'drawing' : 'none'
    case 'chart':
      return props.onOpenChart ? 'chart' : 'none'
    case 'conway':
      return props.onOpenConway ? 'conway' : 'none'
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

/** Open the tab the host draws this kind on. A board changes the active view; the others ask the host. */
function openTab(kind: DesignDiagram['kind'], id: string, props: EditorToolbarProps): void {
  switch (kind) {
    case 'layer7':
    case 'container':
      props.onActiveDiagramChange(id)
      return
    case 'sheet':
      ;(props.onOpenSheet ?? props.onActiveDiagramChange)(id)
      return
    case 'map':
      ;(props.onOpenMap ?? props.onActiveDiagramChange)(id)
      return
    case 'technology':
      ;(props.onOpenTechnology ?? props.onActiveDiagramChange)(id)
      return
    case 'drawing':
      ;(props.onOpenDrawing ?? props.onActiveDiagramChange)(id)
      return
    case 'chart':
      ;(props.onOpenChart ?? props.onActiveDiagramChange)(id)
      return
    case 'conway':
      ;(props.onOpenConway ?? props.onActiveDiagramChange)(id)
      return
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

export function EditorToolbar(props: EditorToolbarProps) {
  const host = usePlaceHost();
  const { t } = useStrings();
  const layer7Diagrams = props.model.diagrams.filter((d) => tabList(d.kind, props) === 'board');
  // Each kind is its own list. A drawing is not dropped into a sheet's, and a
  // kind the host cannot open is not offered.
  const tabs = TAB_LISTS.flatMap((list) => props.model.diagrams.filter((d) => tabList(d.kind, props) === list));
  const isContainer = props.activeDiagram.kind === 'container';
  // The legend is a button of its own beside the lifecycle toggle: a control
  // whose hover explained the colours and whose click did something else
  // read as neither, and it named no column.
  // Right-click on a Layer 7 tab: the diagram menu, built by the same pure
  // builder as the canvas menus and drawn by the same component. A container
  // diagram has no tab, so the same menu opens from its entry in the
  // container-views dropdown and from its own header: a container view is a
  // tab in everything but shape, and rename, settings and delete are what a
  // tab offers.
  const [tabMenu, setTabMenu] = useState<{ diagramId: string; kind: DesignDiagram['kind']; screen: Point } | null>(null);
  const [duplicateAsOf, setDuplicateAsOf] = useState<{ diagramId: string; day: string } | null>(null);
  const platform = useMemo(() => detectPlatform(), []);
  const tabMenuItems = useMemo(
    () =>
      tabMenu
        ? menuItemsFor(
            { kind: 'tab', diagramId: tabMenu.diagramId },
            {
              readOnly: props.readOnly,
              platform,
              t,
              diagramKind: tabMenu.kind,
              tab: {
                canRename: Boolean(props.onRenameDiagram),
                canConfigure: Boolean(props.onOpenDiagramSettings),
                // A second container view about the same application would be
                // two answers to "what is inside it"; the finder takes the first.
                canDuplicate: Boolean(props.onDuplicateDiagram) && tabMenu.kind !== 'container',
                canDelete: Boolean(props.onDeleteDiagram),
                canHistory: Boolean(props.onDiagramHistory),
                isLastLandscape: tabMenu.kind === 'layer7' && layer7Diagrams.length <= 1,
              },
            },
          )
        : [],
    [tabMenu, props.readOnly, platform, t, props.onRenameDiagram, props.onOpenDiagramSettings, props.onDuplicateDiagram, props.onDeleteDiagram, props.onDiagramHistory, layer7Diagrams.length],
  );
  const hasTabMenu = !props.readOnly && Boolean(
    props.onRenameDiagram || props.onOpenDiagramSettings
      || props.onDuplicateDiagram || props.onDeleteDiagram || props.onDiagramHistory);
  const openTabMenu = (event: React.MouseEvent, diagramId: string) => {
    if (!hasTabMenu) return;
    event.preventDefault();
    const kind = props.model.diagrams.find((d) => d.id === diagramId)?.kind ?? 'layer7';
    setTabMenu({ diagramId, kind, screen: { x: event.clientX, y: event.clientY } });
  };
  /** The same menu from a button rather than a right-click: it opens under the button. */
  const openTabMenuBelow = (element: HTMLElement, diagramId: string) => {
    if (!hasTabMenu) return;
    const box = element.getBoundingClientRect();
    const kind = props.model.diagrams.find((d) => d.id === diagramId)?.kind ?? 'layer7';
    setTabMenu({ diagramId, kind, screen: { x: box.left, y: box.bottom } });
  };
  const handleTabMenuSelect = (item: MenuItemModel) => {
    if (!tabMenu) return;
    const diagram = props.model.diagrams.find((d) => d.id === tabMenu.diagramId);
    if (!diagram) return;
    switch (item.action) {
      case 'rename-diagram':
        props.onRenameDiagram?.(diagram.id, diagram.name);
        return;
      case 'diagram-settings':
        props.onOpenDiagramSettings?.(diagram.id);
        return;
      case 'duplicate-diagram':
        props.onDuplicateDiagram?.(diagram.id);
        return;
      case 'duplicate-diagram-as-of':
        setDuplicateAsOf({ diagramId: diagram.id, day: diagram.asOf ?? '' });
        return;
      case 'delete-diagram':
        props.onDeleteDiagram?.(diagram.id);
        return;
      case 'diagram-history':
        props.onDiagramHistory?.(diagram.id);
        return;
    }
  };

  // In the frame the view's tabs are row two, and undo is row one: the bar under
  // them is the view's own tools (decision 1). With no frame, as in a test of this
  // bar alone, each draws where it stands.
  const framed = host?.views ?? null;
  const inRow = (node: React.ReactNode) => (framed ? createPortal(node, framed) : node);
  return (
    <>
    <Box
      sx={{
        display: framed ? 'contents' : 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        // Out of width — a narrow window, or 400 % zoom (1.4.10) — the tools
        // take a second row rather than running off the side of the window.
        minHeight: 48, flexWrap: 'wrap', ...emptyInFrame(framed, props.activeDiagram.kind),
      }}
    >
      {inRow(isContainer ? (
        <>
          <Breadcrumb
            model={props.model}
            activeDiagram={props.activeDiagram}
            onActiveDiagramChange={props.onActiveDiagramChange}
            cameFrom={props.cameFrom}
            onMenu={hasTabMenu ? openTabMenuBelow : undefined} onOpenThisView={props.onOpenThisView}
          />
          <ContextMenu
            open={tabMenu !== null}
            position={tabMenu?.screen ?? null}
            items={tabMenuItems}
            onSelect={handleTabMenuSelect}
            onClose={() => setTabMenu(null)}
            ariaLabel={t('menu.tabLabel')}
          />
        </>
      ) : (
        <>
          <Tabs
            value={host?.pageUp ? false : selectedTab(tabs, activeTabOf(props))}
            onChange={(_e, value: string) => {
              // A laid-out view is a tab like any other since ADR-0016: the
              // host draws it in place of the canvas. The host's openers stay
              // for whatever else it does on the way — closing a page over
              // the editor, say — and the plain change is the fallback.
              const diagram = props.model.diagrams.find((d) => d.id === value);
              if (diagram) openTab(diagram.kind, value, props);
              else props.onActiveDiagramChange(value);
            }}
            variant="scrollable"
            // The tabs scroll before the tools take a second row: a basis of
            // nothing, grown up to the tabs' own width, keeps the tools on the
            // tabs' line at 1024 px, where the tabs at their natural width
            // sent them under. Nothing else on the line grows: the tools go
            // right by the auto margin of the spacer after the + (3.7.2), so
            // the tabs are not handed half the free width while the rest of
            // the bar stands empty.
            sx={{ minHeight: 'var(--tabs-h)', flex: '1 1 0', maxWidth: 'max-content', minWidth: 0, '& .MuiTab-root': { minHeight: 'var(--tabs-h)', py: 0 }, '& .MuiTabs-scroller, & .MuiTabs-flexContainer': { height: '100%' } }}
          >
            {tabs.map((diagram) => (
              <Tab
                key={diagram.id}
                value={diagram.id} aria-label={diagram.name}
                // Pressing the name of the view that is up asks about the view itself: *This view*.
                onClick={diagram.id === props.activeDiagram.id && !host?.pageUp ? props.onOpenThisView : undefined}
                {...tabMenuDoors(diagram.id, openTabMenu, hasTabMenu ? openTabMenuBelow : undefined)}
                label={
                  <TabLabel
                    diagram={diagram}
                    model={props.model}
                    onActiveDiagramChange={props.onActiveDiagramChange}
                    // In the frame a view's settings are in its tab's menu, and the ring is gone.
                    onOpenDiagramSettings={props.readOnly || framed ? undefined : props.onOpenDiagramSettings}
                    onContainerMenu={hasTabMenu ? openTabMenu : undefined}
                  />
                }
              />
            ))}
          </Tabs>
          <ContextMenu
            open={tabMenu !== null}
            position={tabMenu?.screen ?? null}
            items={tabMenuItems}
            onSelect={handleTabMenuSelect}
            onClose={() => setTabMenu(null)}
            ariaLabel={t('menu.tabLabel')}
          />
          <Dialog open={duplicateAsOf !== null} onClose={() => setDuplicateAsOf(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{t('menu.duplicateDiagramAsOf')}</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', mb: 1.5 }}>
                {t('toolbar.asOfHelp')}
              </Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                autoFocus
                label={t('toolbar.asOf')}
                value={duplicateAsOf?.day ?? ''}
                onChange={(e) => setDuplicateAsOf((held) => (held ? { ...held, day: e.target.value } : held))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDuplicateAsOf(null)}>{t('common.cancel')}</Button>
              <Button
                variant="contained"
                disabled={!duplicateAsOf?.day}
                onClick={() => {
                  if (duplicateAsOf?.day) props.onDuplicateDiagram?.(duplicateAsOf.diagramId, duplicateAsOf.day);
                  setDuplicateAsOf(null);
                }}
              >
                {t('menu.duplicateDiagram')}
              </Button>
            </DialogActions>
          </Dialog>
          {!props.readOnly && <NewViewMenu props={props} />}
        </>
      ))}

      {!framed && !isContainer && <Box sx={{ ml: 'auto' }} />}
    </Box>
    {barDisplay(framed !== null, props.activeDiagram.kind) !== 'none' && (
      <BoardBar
        props={props}
        framed={framed !== null}
        pageBar={<PageBarSlot props={props} />}
        day={!props.laidOut || props.dated ? <ViewDay props={props} /> : undefined}
        add={props.add}
        show={props.show}
      />
    )}
    </>
  );
}

/**
 * The language switch.
 *
 * It was a two-state button while there were exactly two languages; with four,
 * a button that cycles would make a person press it three times to get back,
 * so it is a small menu. The button still shows the code of the language you
 * are IN, the same grammar as every other pressed toggle in this bar, and the
 * menu names each language the way it names itself.
 *
 * Visible in read-only too: which language you read a board in is not a mutation.
 */
const DAY_PHASE = { live: 'toolbar.dayLive', retiring: 'toolbar.dayRetiring', retired: 'toolbar.dayRetired' } as const;

/** Where a laid-out page draws its own controls, in this row rather than a second bar of its own. */
function PageBarSlot({ props }: { props: EditorToolbarProps }) {
  if (!props.laidOut || !props.onPageBar) return null
  return <Box ref={props.onPageBar} data-testid="toolbar-page-bar" sx={{ display: 'flex', flex: '1 1 auto', minWidth: 0 }} />
}

/**
 * The day the view is drawn on (ADR-0027): a board's, and a laid-out view's that
 * is drawn on a day. Today says nothing; the days worth looking at come first and
 * a typed one is one step on.
 */
function ViewDay({ props }: { props: EditorToolbarProps }) {
  const { t } = useStrings();
  const days = useMemo(() => daysWorthLooking(props.model, props.today ?? '', {
    plan: (plan, milestone) => t('toolbar.dayPlan', { plan, milestone }),
    phase: (phase, name) => t(DAY_PHASE[phase], { name }),
    board: (name) => t('toolbar.dayBoard', { name }),
  }), [props.model, props.today, t]);
  return (
    <DayControl
      day={props.asOf}
      groups={days.length > 0 ? [{ heading: t('toolbar.dayHere'), days }] : []}
      onChange={props.onAsOfChange}
      note={t('toolbar.dayNote')}
      data-guide="board.day"
    />
  );
}

/**
 * The `+` beside the tabs: a new view of each kind the host can make, or a
 * new landscape straight away where the host makes no other kind.
 */
function NewViewMenu({ props }: { props: EditorToolbarProps }) {
  const { t } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!props.onCreateSheet) {
    return (
      <Tooltip title={t('toolbar.newDiagram')}>
        <IconButton size="small" aria-label={t('toolbar.newDiagram')} onClick={props.onCreateLayer7Diagram}>
          <AddIcon />
        </IconButton>
      </Tooltip>
    );
  }
  // The host asks in its own words, who draws it first; the menu is for one that does not.
  if (props.onNewView) {
    const landscape = props.onCreateLayer7Diagram;
    return (
      <Tooltip title={t('toolbar.newDiagram')}>
        <IconButton size="small" aria-label={t('toolbar.newDiagram')} aria-haspopup="dialog" data-testid="tab-new-view" onClick={() => props.onNewView?.(landscape)}>
          <AddIcon />
        </IconButton>
      </Tooltip>
    );
  }
  const make = (create: (() => void) | undefined) => () => { setAnchor(null); create?.(); };
  const kinds: { key: StringKey; create: (() => void) | undefined }[] = [
    { key: 'toolbar.newLandscape', create: props.onCreateLayer7Diagram },
    { key: 'toolbar.newSheet', create: props.onCreateSheet },
    { key: 'toolbar.newMap', create: props.onCreateMap },
    { key: 'toolbar.newTechnology', create: props.onCreateTechnology },
    { key: 'toolbar.newDrawing', create: props.onCreateDrawing },
    { key: 'toolbar.newChart', create: props.onCreateChart },
    { key: 'toolbar.newConway', create: props.onCreateConway },
  ];
  return (
    <>
      <Tooltip title={t('toolbar.newDiagram')}>
        <IconButton
          size="small"
          aria-label={t('toolbar.newDiagram')}
          aria-haspopup="menu"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {kinds.filter((kind) => kind.create).map((kind) => (
          <MenuItem key={kind.key} onClick={make(kind.create)}>{t(kind.key)}</MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * The tab to show selected. A laid-out view is active without a tab where the
 * host draws it but offers no opener for its kind; then no tab is the answer,
 * not an id MUI cannot find among the tabs.
 */
/** A sheet and its Coverage have a View bar of their own, and row two holds the tabs: this bar would be an empty row. */
function emptyInFrame(framed: HTMLElement | null, kind: DesignDiagram['kind']) {
  // A drawing has its own bar too.
  return framed && (kind === 'sheet' || kind === 'map' || kind === 'drawing') ? { display: 'none' } : {}
}

function activeTabOf(props: EditorToolbarProps): string {
  const { activeDiagram, model } = props
  if (activeDiagram.kind !== 'map') return activeDiagram.id
  return model.diagrams.find((diagram) => diagram.kind === 'sheet')?.id ?? activeDiagram.id
}

function selectedTab(tabs: readonly DesignDiagram[], active: string): string | false {
  return tabs.some((d) => d.id === active) ? active : false;
}

/**
 * A tab's own keys, for what its two pointer controls do: ↓ opens the
 * container diagrams under it (the caret's list, where it has one), and
 * Shift+F10 or the Menu key opens the tab's menu under it, the menu a
 * right-click opens. ← and → stay MUI's, moving between the tabs.
 */
function tabMenuDoors(
  diagramId: string,
  openAtPointer: (event: React.MouseEvent, diagramId: string) => void,
  openMenuBelow: ((element: HTMLElement, diagramId: string) => void) | undefined,
) {
  return {
    onContextMenu: (event: React.MouseEvent) => openAtPointer(event, diagramId),
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => tabKeyDown(event, diagramId, openMenuBelow),
    // Shift+F10 is the tab's own where it has a menu, not the canvas's.
    ...(openMenuBelow ? { [OWN_MENU_ATTR]: true } : {}),
  };
}

/** ↓ and the menu keys on a tab (see {@link tabMenuDoors}). */
function tabKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  diagramId: string,
  openMenuBelow: ((element: HTMLElement, diagramId: string) => void) | undefined,
): void {
  const tab = event.currentTarget;
  if (event.key === 'ArrowDown') {
    const caret = tab.querySelector<HTMLElement>('[data-tab-action="containers"]');
    if (!caret) return;
    event.preventDefault();
    caret.click();
    return;
  }
  const menuKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
  if (!menuKey || !openMenuBelow) return;
  event.preventDefault();
  openMenuBelow(tab, diagramId);
}

/**
 * A Layer 7 tab's label: the name and, when applications placed on this
 * landscape have container diagrams, a small chevron that lists them. Container
 * diagrams used to be reachable only by double-clicking their application; now
 * they are one click from the tab they belong to, and the breadcrumb still takes
 * over once one is open.
 */
/**
 * The two controls a tab carries beside its name, for the pointer. Spans, not
 * IconButtons, and out of the accessibility tree: a Tab is already a <button>,
 * and a control inside a button is one a screen reader cannot reach and a
 * keyboard should not have to stop at. The keyboard reaches both from the tab
 * itself ({@link tabMenuDoors}): ↓ opens the container diagrams, Shift+F10 or the
 * Menu key the tab's menu, whose *Settings…* is the other.
 */
const TAB_ACTION_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  p: 0.25,
  borderRadius: 1,
  color: 'text.secondary',
  '&:hover, &:focus-visible': { color: 'text.primary', bgcolor: 'action.hover' },
} as const;

function TabLabel({
  diagram,
  model,
  onActiveDiagramChange,
  onOpenDiagramSettings,
  onContainerMenu,
}: {
  diagram: DesignDiagram;
  model: DesignModel;
  onActiveDiagramChange(diagramId: string): void;
  /** Absent when the host offers no settings, and when the editor is read-only. */
  onOpenDiagramSettings?(diagramId: string): void;
  /**
   * Right-click on a container view's entry: the diagram menu a tab has,
   * for a view that has no tab. Absent where there is no menu to offer.
   */
  onContainerMenu?(event: React.MouseEvent, diagramId: string): void;
}) {
  const { t, language } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const placed = new Set(placedNodes(diagram).map((p) => p.id));
  const containers = model.diagrams.filter(
    (d) => d.kind === 'container' && d.applicationElementId && placed.has(d.applicationElementId),
  );
  const nameOf = (d: DesignDiagram) =>
    model.elements.find((e) => e.id === d.applicationElementId)?.name ?? d.name;
  const open = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchor(event.currentTarget as HTMLElement);
  };
  const openSettings = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onOpenDiagramSettings?.(diagram.id);
  };

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <span>{diagram.name}</span>
      {diagram.asOf && <span className="editor-tab__day">{formatDay(diagram.asOf, language)}</span>}
      {containers.length > 0 && (
        <>
          <Tooltip title={t('toolbar.containerDiagrams')}>
            <Box
              component="span"
              aria-hidden
              data-tab-action="containers"
              aria-label={t('toolbar.containerDiagramsOf', { name: diagram.name })}
              onClick={open}
              sx={TAB_ACTION_SX}
            >
              <CaretIcon />
            </Box>
          </Tooltip>
          <Menu
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            slotProps={{
              list: {
                dense: true,
                'aria-label': t('toolbar.containerDiagramsOf', { name: diagram.name }),
              },
            }}
          >
            {containers.map((container) => (
              <MenuItem
                key={container.id}
                onClick={() => {
                  setAnchor(null);
                  onActiveDiagramChange(container.id);
                }}
                onContextMenu={onContainerMenu && ((event: React.MouseEvent) => {
                  // The dropdown is a portal in the DOM and a child of the tab
                  // in React's tree, so without this the tab's own right-click
                  // handler fires next and opens the landscape's menu instead.
                  event.stopPropagation();
                  setAnchor(null);
                  onContainerMenu(event, container.id);
                })}
              >
                <ListItemText
                  primary={nameOf(container)}
                  secondary={t('toolbar.containerView')}
                  slotProps={{ primary: { sx: { fontSize: 'var(--t-body)' } }, secondary: { sx: { fontSize: 'var(--t-small)' } } }}
                />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {onOpenDiagramSettings && (
        <Tooltip title={t('toolbar.diagramSettings')}>
          <Box
            component="span"
            aria-hidden
            aria-label={t('toolbar.diagramSettingsOf', { name: diagram.name })}
            onClick={openSettings}
            sx={TAB_ACTION_SX}
          >
            <RadarIcon />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

function Breadcrumb({
  model,
  activeDiagram,
  onActiveDiagramChange,
  cameFrom,
  onOpenThisView,
  onMenu,
}: {
  model: DesignModel;
  activeDiagram: DesignDiagram;
  onActiveDiagramChange(diagramId: string): void;
  cameFrom: string | undefined;
  /**
   * This view's own menu — rename, settings, delete — under a chevron after
   * its name, because a container diagram has no tab to right-click. Absent
   * under `readOnly` and where the host offers none of the three.
   */
  onMenu?(anchor: HTMLElement, diagramId: string): void;
  /** Its name, pressed, opens what it says about itself and the key. */
  onOpenThisView: (() => void) | undefined;
}) {
  const { t } = useStrings();
  const application = model.elements.find((e) => e.id === activeDiagram.applicationElementId);
  const parent = levelUpOf(model, activeDiagram, cameFrom);
  const name = application?.name ?? activeDiagram.name;
  const title = t('c4.containerTitle', { name });
  return (
    <div className="lv-levelbar">
      {parent && (
        <Tooltip title={t('toolbar.backTo', { name: viewWord(model, parent) })}>
          <KitButton
            size="small"
            aria-label={t('toolbar.backTo', { name: viewWord(model, parent) })}
            data-testid="level-up"
            data-guide="board.levelUp"
            onClick={() => onActiveDiagramChange(parent.id)}
          >
            {`‹ ${viewWord(model, parent)}`}
          </KitButton>
        </Tooltip>
      )}
      {onOpenThisView
        ? <span className="lv-levelbar__title"><KitButton variant="quiet" aria-haspopup="dialog" data-testid="this-view" onClick={onOpenThisView}>{title}</KitButton></span>
        : <span className="lv-levelbar__title">{title}</span>}
      {onMenu && (
        <Tooltip title={t('toolbar.containerMenu')}>
          <IconButton
            size="small"
            aria-label={t('toolbar.containerMenuOf', { name })}
            aria-haspopup="menu"
            onClick={(event) => onMenu(event.currentTarget, activeDiagram.id)}
          >
            <CaretIcon />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}

/** Where a level up goes: the board this was opened from, else the first board that places it, else the first board. */
export function levelUpOf(model: DesignModel, diagram: DesignDiagram, cameFrom: string | undefined): DesignDiagram | undefined {
  return model.diagrams.find((d) => d.id === cameFrom) ?? model.diagrams.find(
    (d) => d.kind === 'layer7' && placedNodes(d).some((p) => p.id === diagram.applicationElementId),
  ) ?? model.diagrams.find((d) => d.kind === 'layer7');
}

/** What a view is called on the way back: a container diagram goes by its application. */
function viewWord(model: DesignModel, diagram: DesignDiagram): string {
  return (diagram.kind === 'container' ? model.elements.find((e) => e.id === diagram.applicationElementId)?.name : undefined) ?? diagram.name;
}
