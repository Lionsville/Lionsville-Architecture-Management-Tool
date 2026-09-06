import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { TidyOptions } from '../layout/tidy';
import { ContextMenu } from './canvas/ContextMenu';
import { menuItemsFor, type MenuItem as MenuItemModel } from './canvas/menuItems';
import { detectPlatform } from './keymap';
import { TidySettingsPanel } from './TidySettingsPanel';
import type { DesignDiagram, DesignModel, Lifecycle, Point } from '../model/types';
import { getNodeTokens } from './theme/tokens';
import { AddIcon, AutoRouteIcon, BackIcon, CaretIcon, ExportIcon, FitIcon, FullscreenIcon, HelpIcon, LifecycleIcon, MinimapIcon, RadarIcon, RedoIcon, RouteIcon, SearchIcon, TidyIcon, UndoIcon } from './toolbarIcons';
import { useStrings } from '../i18n/LanguageContext';
import { LANGUAGES, type Language, type StringKey } from '../i18n/strings';

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
  busy?: LayoutAction;
  onActiveDiagramChange(diagramId: string): void;
  onCreateLayer7Diagram(): void;
  onTidy(): void;
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
  onFitView(): void;
  onExport(): void;
  /**
   * A PNG export is rasterising. Its own flag rather than {@link busy}: an
   * export neither commits nor conflicts with a layout pass, so it disables its
   * own button and nothing else.
   */
  exportBusy?: boolean;
  /** Opens the keyboard-shortcuts help overlay (U4c). */
  onOpenHelp(): void;
  /** Lifecycle-badge toggle state + handler (U5); default on. */
  showLifecycle: boolean;
  onToggleLifecycle(): void;
  /** In-memory undo/redo (U7); buttons hidden under readOnly, gated on stack depth. */
  onUndo(): void;
  onRedo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Optional: host-implemented fullscreen view. */
  onOpenFullscreen?(): void;
  extras?: ReactNode;
  /**
   * Diagram management for a Layer 7 tab's right-click menu; each entry is
   * offered only when its callback is present. Rename opens the editor's own
   * dialog first, so `onRenameDiagram` already receives the new name.
   */
  onRenameDiagram?(diagramId: string, name: string): void;
  /** Opens the diagram's settings dialog; the editor owns the dialog itself. */
  onOpenDiagramSettings?(diagramId: string): void;
  onDuplicateDiagram?(diagramId: string): void;
  onDeleteDiagram?(diagramId: string): void;
  /** ⌘F: opens the element finder. */
  onOpenSearch(): void;
  /** Minimap toggle (4B): persisted with the other view settings. */
  showMinimap: boolean;
  onToggleMinimap(): void;
  /**
   * The NL/EN toggle. Shown ONLY when the host wired `onLanguageChange` — an
   * editor whose host owns the language elsewhere (a global app setting, a URL)
   * must not offer a second control that fights it.
   */
  onLanguageChange?(language: Language): void;
}

const LIFECYCLE_LEGEND: { key: Lifecycle; labelKey: StringKey; noteKey: StringKey }[] = [
  { key: 'planned', labelKey: 'lifecycle.planned', noteKey: 'lifecycleNote.planned' },
  { key: 'live', labelKey: 'lifecycle.live', noteKey: 'lifecycleNote.live' },
  { key: 'retiring', labelKey: 'lifecycle.retiring', noteKey: 'lifecycleNote.retiring' },
  { key: 'retired', labelKey: 'lifecycle.retired', noteKey: 'lifecycleNote.retired' },
];

/** What the NL/EN button shows and says, per language. */
const LANGUAGE_NAME: Record<Language, StringKey> = {
  nl: 'common.languageNl',
  en: 'common.languageEn',
};

/**
 * Top bar: Layer 7 diagram tabs (breadcrumb when drilled into a container
 * diagram), host extras slot, and the tidy / fit / export actions.
 */
export function EditorToolbar(props: EditorToolbarProps) {
  const theme = useTheme();
  const { t, language } = useStrings();
  const layer7Diagrams = props.model.diagrams.filter((d) => d.kind === 'layer7');
  const isContainer = props.activeDiagram.kind === 'container';
  // Legend opens on hover of the toggle (which itself toggles on click), so the
  // one control doubles as its own key (plan D4).
  const [legendAnchor, setLegendAnchor] = useState<HTMLElement | null>(null);
  // Right-click on a Layer 7 tab: the diagram menu, built by the same pure
  // builder as the canvas menus and drawn by the same component.
  const [tabMenu, setTabMenu] = useState<{ diagramId: string; screen: Point } | null>(null);
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
              diagramKind: 'layer7',
              tab: {
                canRename: Boolean(props.onRenameDiagram),
                canConfigure: Boolean(props.onOpenDiagramSettings),
                canDuplicate: Boolean(props.onDuplicateDiagram),
                canDelete: Boolean(props.onDeleteDiagram),
                isLastLandscape: layer7Diagrams.length <= 1,
              },
            },
          )
        : [],
    [tabMenu, props.readOnly, platform, t, props.onRenameDiagram, props.onOpenDiagramSettings, props.onDuplicateDiagram, props.onDeleteDiagram, layer7Diagrams.length],
  );
  const openTabMenu = (event: React.MouseEvent, diagramId: string) => {
    if (props.readOnly) return;
    if (!props.onRenameDiagram && !props.onOpenDiagramSettings
      && !props.onDuplicateDiagram && !props.onDeleteDiagram) return;
    event.preventDefault();
    setTabMenu({ diagramId, screen: { x: event.clientX, y: event.clientY } });
  };
  const handleTabMenuSelect = (item: MenuItemModel) => {
    if (!tabMenu) return;
    const diagram = layer7Diagrams.find((d) => d.id === tabMenu.diagramId);
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
      case 'delete-diagram':
        props.onDeleteDiagram?.(diagram.id);
        return;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 48,
      }}
    >
      {isContainer ? (
        <Breadcrumb
          model={props.model}
          activeDiagram={props.activeDiagram}
          onActiveDiagramChange={props.onActiveDiagramChange}
        />
      ) : (
        <>
          <Tabs
            value={props.activeDiagram.id}
            onChange={(_e, value: string) => props.onActiveDiagramChange(value)}
            variant="scrollable"
            sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5 } }}
          >
            {layer7Diagrams.map((diagram) => (
              <Tab
                key={diagram.id}
                value={diagram.id}
                onContextMenu={(event) => openTabMenu(event, diagram.id)}
                label={
                  <TabLabel
                    diagram={diagram}
                    model={props.model}
                    onActiveDiagramChange={props.onActiveDiagramChange}
                    onOpenDiagramSettings={props.readOnly ? undefined : props.onOpenDiagramSettings}
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
          {!props.readOnly && (
            <Tooltip title={t('toolbar.newDiagram')}>
              <IconButton size="small" aria-label={t('toolbar.newDiagram')} onClick={props.onCreateLayer7Diagram}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}

      <Box sx={{ flex: 1 }} />
      {props.readOnly && <Chip size="small" label={t('toolbar.readOnly')} variant="outlined" />}
      {props.extras}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {!props.readOnly && (
        <>
          <Tooltip title={t('toolbar.undoTip')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('toolbar.undo')}
                onClick={props.onUndo}
                disabled={!props.canUndo}
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('toolbar.redoTip')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('toolbar.redo')}
                onClick={props.onRedo}
                disabled={!props.canRedo}
              >
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
      {!props.readOnly && (
        <TidySplitButton
          busy={props.busy}
          onTidy={props.onTidy}
          options={props.tidyOptions}
          onOptionsChange={props.onTidyOptionsChange}
          // A container diagram has one "group" — the application boundary — so
          // the same two pins apply, under words that match what is on screen.
          boundaryLabels={isContainer}
        />
      )}
      {!props.readOnly && (
        <Tooltip title={t('toolbar.routeOnlyTip')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('toolbar.routeOnly')}
              onClick={props.onRouteEdges}
              disabled={props.busy !== undefined}
            >
              {props.busy === 'route' ? <CircularProgress size={16} /> : <RouteIcon />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {!props.readOnly && (
        <Tooltip
          title={
            (props.autoRoute ? t('toolbar.autoRouteOn') : t('toolbar.autoRouteOff')) +
            (props.autoRouteNote ? ` — ${props.autoRouteNote}` : '')
          }
        >
          <IconButton
            size="small"
            aria-label={t('toolbar.autoRoute')}
            aria-pressed={props.autoRoute}
            onClick={props.onToggleAutoRoute}
            sx={{
              color: props.autoRoute ? 'primary.main' : 'text.secondary',
              backgroundColor: props.autoRoute
                ? alpha(theme.palette.primary.main, 0.12)
                : 'transparent',
            }}
          >
            <AutoRouteIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t('toolbar.searchTip')}>
        <IconButton size="small" aria-label={t('toolbar.search')} onClick={props.onOpenSearch}>
          <SearchIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={props.showMinimap ? t('toolbar.minimapOn') : t('toolbar.minimapOff')}>
        <IconButton
          size="small"
          aria-label={t('toolbar.minimap')}
          aria-pressed={props.showMinimap}
          onClick={props.onToggleMinimap}
          sx={{
            color: props.showMinimap ? 'primary.main' : 'text.secondary',
            backgroundColor: props.showMinimap
              ? alpha(theme.palette.primary.main, 0.12)
              : 'transparent',
          }}
        >
          <MinimapIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('toolbar.fitView')}>
        <IconButton size="small" aria-label={t('toolbar.fitView')} onClick={props.onFitView}>
          <FitIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={props.exportBusy ? t('toolbar.exportingPng') : t('toolbar.exportPng')}>
        <span>
          <IconButton
            size="small"
            aria-label={t('toolbar.exportPng')}
            onClick={props.onExport}
            disabled={props.exportBusy === true}
          >
            {props.exportBusy ? <CircularProgress size={16} /> : <ExportIcon />}
          </IconButton>
        </span>
      </Tooltip>
      <IconButton
        size="small"
        aria-label={t('toolbar.lifecycleBadges')}
        aria-pressed={props.showLifecycle}
        onClick={props.onToggleLifecycle}
        onMouseEnter={(e) => setLegendAnchor(e.currentTarget)}
        onMouseLeave={() => setLegendAnchor(null)}
        // Keyboard users tabbing to the control get the legend too (click still
        // only toggles badge visibility, never opens the popover).
        onFocus={(e) => setLegendAnchor(e.currentTarget)}
        onBlur={() => setLegendAnchor(null)}
        sx={{
          color: props.showLifecycle ? 'primary.main' : 'text.secondary',
          backgroundColor: props.showLifecycle
            ? alpha(theme.palette.primary.main, 0.12)
            : 'transparent',
        }}
      >
        <LifecycleIcon />
      </IconButton>
      <Popover
        open={Boolean(legendAnchor)}
        anchorEl={legendAnchor}
        onClose={() => setLegendAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
        slotProps={{ paper: { sx: { p: 1, mt: 0.5 } } }}
      >
        <LifecycleLegend />
      </Popover>
      <Tooltip title={t('toolbar.shortcuts')}>
        <IconButton size="small" aria-label={t('toolbar.shortcuts')} onClick={props.onOpenHelp}>
          <HelpIcon />
        </IconButton>
      </Tooltip>
      {props.onOpenFullscreen && (
        <Tooltip title={t('toolbar.fullscreen')}>
          <IconButton size="small" aria-label={t('toolbar.fullscreen')} onClick={props.onOpenFullscreen}>
            <FullscreenIcon />
          </IconButton>
        </Tooltip>
      )}
      {props.onLanguageChange && (
        <LanguageToggle language={language} onChange={props.onLanguageChange} />
      )}
    </Box>
  );
}

/**
 * The NL/EN switch.
 *
 * A two-state button rather than a select: there are exactly two languages and a
 * dropdown for two options is a click too many. It shows the language you are
 * IN and switches to the other one — the same grammar as every other pressed
 * toggle in this bar, and the reason its tooltip names the current language
 * rather than the action.
 *
 * Visible in read-only too: which language you read a board in is not a mutation.
 */
function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange(language: Language): void;
}) {
  const { t } = useStrings();
  const other = LANGUAGES.find((candidate) => candidate !== language) ?? 'en';
  return (
    <Tooltip title={t('toolbar.languageTip', { name: t(LANGUAGE_NAME[language]) })}>
      <IconButton
        size="small"
        aria-label={t('common.language')}
        onClick={() => onChange(other)}
        sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', px: 0.75 }}
      >
        {language.toUpperCase()}
      </IconButton>
    </Tooltip>
  );
}

/**
 * Tidy as a split button: the icon runs a tidy with the current settings, the
 * caret opens those settings (which carry their own Apply). They live in editor
 * state for the session only — nothing is written to the model.
 */
function TidySplitButton({
  busy,
  onTidy,
  options,
  onOptionsChange,
  boundaryLabels,
}: {
  busy?: LayoutAction;
  onTidy(): void;
  options: TidyOptions;
  onOptionsChange(options: TidyOptions): void;
  boundaryLabels?: boolean;
}) {
  const { t } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title={t('toolbar.tidyTip')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('toolbar.tidy')}
              onClick={onTidy}
              disabled={busy !== undefined}
            >
              {busy === 'tidy' ? <CircularProgress size={16} /> : <TidyIcon />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('toolbar.tidySettings')}>
          <IconButton
            size="small"
            aria-label={t('toolbar.tidySettings')}
            aria-haspopup="true"
            onClick={(event) => setAnchor(event.currentTarget)}
            sx={{ ml: -0.75, p: 0.25 }}
          >
            <CaretIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 1.5, mt: 0.5 } } }}
      >
        <TidySettingsPanel
          options={options}
          onChange={onOptionsChange}
          applyLabel={t('toolbar.tidy')}
          showPinGroups
          boundaryLabels={boundaryLabels}
          onApply={() => {
            close();
            onTidy();
          }}
        />
      </Popover>
    </>
  );
}

/**
 * A Layer 7 tab's label: the name and, when applications placed on this
 * landscape have container diagrams, a small chevron that lists them. Container
 * diagrams used to be reachable only by double-clicking their application; now
 * they are one click from the tab they belong to, and the breadcrumb still takes
 * over once one is open.
 */
/**
 * The two controls a tab carries beside its name. Spans with button semantics,
 * not IconButtons: a Tab is already a <button>, and buttons do not nest.
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
}: {
  diagram: DesignDiagram;
  model: DesignModel;
  onActiveDiagramChange(diagramId: string): void;
  /** Absent when the host offers no settings, and when the editor is read-only. */
  onOpenDiagramSettings?(diagramId: string): void;
}) {
  const { t } = useStrings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const placed = new Set(diagram.placements.map((p) => p.elementId));
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
      {containers.length > 0 && (
        <>
          <Tooltip title={t('toolbar.containerDiagrams')}>
            <Box
              component="span"
              role="button"
              tabIndex={0}
              aria-label={t('toolbar.containerDiagramsOf', { name: diagram.name })}
              aria-haspopup="menu"
              aria-expanded={Boolean(anchor)}
              onClick={open}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') open(event);
              }}
              sx={TAB_ACTION_SX}
            >
              <CaretIcon />
            </Box>
          </Tooltip>
          <Menu
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            onClick={(event) => event.stopPropagation()}
            MenuListProps={{
              dense: true,
              'aria-label': t('toolbar.containerDiagramsOf', { name: diagram.name }),
            }}
          >
            {containers.map((container) => (
              <MenuItem
                key={container.id}
                onClick={() => {
                  setAnchor(null);
                  onActiveDiagramChange(container.id);
                }}
              >
                <ListItemText
                  primary={nameOf(container)}
                  secondary={t('toolbar.containerView')}
                  primaryTypographyProps={{ fontSize: 13 }}
                  secondaryTypographyProps={{ fontSize: 10.5 }}
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
            role="button"
            tabIndex={0}
            aria-label={t('toolbar.diagramSettingsOf', { name: diagram.name })}
            onClick={openSettings}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') openSettings(event);
            }}
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
}: {
  model: DesignModel;
  activeDiagram: DesignDiagram;
  onActiveDiagramChange(diagramId: string): void;
}) {
  const { t } = useStrings();
  const application = model.elements.find((e) => e.id === activeDiagram.applicationElementId);
  // Back target: the layer7 diagram where this application is placed,
  // falling back to the first layer7 diagram.
  const parent =
    model.diagrams.find(
      (d) =>
        d.kind === 'layer7' &&
        d.placements.some((p) => p.elementId === activeDiagram.applicationElementId),
    ) ?? model.diagrams.find((d) => d.kind === 'layer7');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 0.5 }}>
      {parent && (
        <Tooltip title={t('toolbar.backTo', { name: parent.name })}>
          <IconButton
            size="small"
            aria-label={t('toolbar.backToLandscape')}
            onClick={() => onActiveDiagramChange(parent.id)}
          >
            <BackIcon />
          </IconButton>
        </Tooltip>
      )}
      {parent && (
        <Link
          component="button"
          underline="hover"
          color="text.secondary"
          sx={{ fontSize: 13, fontWeight: 600 }}
          onClick={() => onActiveDiagramChange(parent.id)}
        >
          {parent.name}
        </Link>
      )}
      <Typography color="text.disabled" sx={{ fontSize: 13 }}>
        /
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
        {application?.name ?? activeDiagram.name}
      </Typography>
      <Chip
        size="small"
        variant="outlined"
        label={t('toolbar.containerView')}
        sx={{ ml: 0.5, height: 20, fontSize: 10 }}
      />
    </Box>
  );
}

/** Lifecycle colour key: one swatch + label + note per state (plan D4). */
function LifecycleLegend() {
  const { t } = useStrings();
  const tokens = getNodeTokens(useTheme());
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
        {t('field.lifecycle')}
      </Typography>
      {LIFECYCLE_LEGEND.map(({ key, labelKey, noteKey }) => {
        const token = tokens.lifecycle[key];
        return (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '3px',
                flexShrink: 0,
                backgroundColor: token.bg,
                border: `1px solid ${token.border}`,
              }}
            />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{t(labelKey)}</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>— {t(noteKey)}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
