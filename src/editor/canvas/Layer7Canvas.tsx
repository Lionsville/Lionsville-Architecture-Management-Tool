import { useCallback, useRef, useState } from 'react';
import Popover from '@mui/material/Popover';
import { domainGroupForPoint, domainGroupRectMap } from '../../model/placement';
import { zoneForPoint } from '../../model/zones';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../../layout/tidy';
import { ColorField } from '../ColorField';
import { useStrings } from '../../i18n/LanguageContext';
import { TidySettingsPanel } from '../TidySettingsPanel';
import type { DesignDiagram, DesignModel, ElementId, ElementKind, Layer7Zone, Point } from '../../model/types';
import { selectDomainGroup, type ElementSeedPatch } from '../useEditorState';
import { DiagramCanvas, type DiagramCanvasProps } from './DiagramCanvas';
import { newDomainGroupRect } from './domainGroupPlacement';
import type { DomainGroupSeed } from './ElementPalette';
import { DomainGroupLayer } from './DomainGroupLayer';
import type { MenuItem, MenuTarget } from './menuItems';
import type { ContextMenuState } from './useContextMenu';
import { ZoneLayer } from './ZoneLayer';

type SharedProps = Omit<
  DiagramCanvasProps,
  | 'resolveDrop'
  | 'onAddByDrop'
  | 'onAddDomainGroupByDrop'
  | 'onPaletteDragOver'
  | 'resolvePaneMenuTarget'
  | 'onMenuAction'
  | 'canTidyGroup'
  | 'children'
>;

/**
 * Layer 7 landscape: resizable zone bands + explicit domain-group rects.
 * Dragging reassigns `zone` from the drop point; landing inside a domain
 * group rectangle joins it (containment). A corner chip shows the host's
 * scope-level cost summary.
 */
export function Layer7Canvas(
  props: SharedProps & {
    model: DesignModel;
    diagram: DesignDiagram;
    /** Right-click → "Tidy this group": re-lay-out one group's members in place. */
    onTidyGroup?(name: string): void;
    /**
     * Settings for the per-group tidy. Held by the editor but kept SEPARATE
     * from the toolbar's board settings, so a group can be tidied tight and
     * vertical inside a loose horizontal board.
     */
    groupTidyOptions?: TidyOptions;
    onGroupTidyOptionsChange?(options: TidyOptions): void;
  },
) {
  const { t } = useStrings();
  const { diagram, actions } = props;
  const layoutConfig = diagram.layoutConfig;
  // The settings popover for one group — what "Tidy this group" opens. Anchored
  // at the same point the menu was, so it appears where the user clicked.
  const [groupSettings, setGroupSettings] = useState<{ name: string; position: Point } | null>(
    null,
  );
  // The colour popover for one group, anchored the same way.
  const [groupColor, setGroupColor] = useState<{ name: string; position: Point } | null>(null);
  const colorOfGroup = groupColor
    ? (layoutConfig?.domainGroups ?? []).find((g) => g.name === groupColor.name)?.color
    : undefined;
  // "Rename" from the group menu (or F2): hands the group to the layer's inline
  // editor, the same one a double-click on the label opens.
  const [groupRename, setGroupRename] = useState<{ name: string; nonce: number } | undefined>(
    undefined,
  );
  const renameNonce = useRef(0);

  // Right-click INSIDE a group box. The boxes are drawn `pointer-events: none`
  // (so the pane keeps panning/selection and the nodes on top stay clickable),
  // so the click lands on the pane and the canvas asks us what it hit: the group
  // is resolved by hit-testing the point — the same containment rule that
  // assigns membership on drop. Over open landscape the canvas's own menu opens.
  const resolvePaneMenuTarget = useCallback(
    (point: Point): MenuTarget | undefined => {
      const name = domainGroupForPoint(point, domainGroupRectMap(layoutConfig));
      return name ? { kind: 'group', name } : undefined;
    },
    [layoutConfig],
  );

  // The group actions that need THIS component's state — two popovers and the
  // inline rename. Everything else about a group (select members, remove) goes
  // through the shared dispatcher like any other item.
  const handleMenuAction = useCallback((item: MenuItem, state: ContextMenuState): boolean => {
    if (state.target.kind !== 'group') return false;
    const { name } = state.target;
    switch (item.action) {
      case 'tidy-group':
        // Opens the settings panel rather than tidying on the spot — the panel
        // carries the Apply button that runs it.
        setGroupSettings({ name, position: state.screen });
        return true;
      case 'group-color':
        // A colour picked in the palette must be changeable afterwards, or the
        // first wrong guess is permanent.
        setGroupColor({ name, position: state.screen });
        return true;
      case 'rename-group':
        renameNonce.current += 1;
        setGroupRename({ name, nonce: renameNonce.current });
        return true;
      default:
        return false;
    }
  }, []);

  // Left-click inside a group box selects it — same click-through, same
  // containment hit-test as the right-click menu above. Clicking a node still
  // selects the node (React Flow never reports those as pane clicks), and a
  // click on open landscape clears the selection exactly as it always did.
  // Selection works in read-only too: it drives the inspector, not an edit.
  const resolvePaneClick = useCallback(
    (point: Point) => {
      const name = domainGroupForPoint(point, domainGroupRectMap(layoutConfig));
      return name ? selectDomainGroup(name) : undefined;
    },
    [layoutConfig],
  );

  const resolveDrop = useCallback(
    (_elementId: ElementId, center: Point) => {
      const zone = zoneForPoint(center, layoutConfig);
      if (zone !== 'landscape') return { zone, domainGroup: undefined };
      const groups = domainGroupRectMap(layoutConfig);
      return { zone, domainGroup: domainGroupForPoint(center, groups) };
    },
    [layoutConfig],
  );

  const onAddByDrop = useCallback(
    (kind: ElementKind, position: Point, seed?: ElementSeedPatch) => {
      const zone = zoneForPoint(position, layoutConfig);
      actions.addElement({
        // The kind is whatever was dragged. The drop point decides *where* it
        // lands, never *what* it is — an Application dropped in the external
        // band is an application placed in that band.
        kind,
        position,
        zone,
        domainGroup:
          zone === 'landscape'
            ? domainGroupForPoint(position, domainGroupRectMap(layoutConfig))
            : undefined,
        ...seed,
      });
    },
    [actions, layoutConfig],
  );

  // A domain group dropped on the board: the box lands centred on the cursor,
  // clamped into the landscape. Same helper the palette's Place button uses, so
  // a dropped group and a placed group differ only in where they end up.
  const onAddDomainGroupByDrop = useCallback(
    (position: Point, seed?: DomainGroupSeed) => {
      actions.upsertDomainGroup(
        newDomainGroupRect({ layoutConfig, center: position, translate: t, ...seed }),
      );
    },
    [actions, layoutConfig],
  );

  // Which band a palette drag would land in, for the drop outline. Flow
  // coordinates in, zone out; null while nothing is being dragged over the board.
  const [dropZone, setDropZone] = useState<Layer7Zone | null>(null);
  const handlePaletteDragOver = useCallback(
    (position: Point | null) => {
      setDropZone(position ? zoneForPoint(position, layoutConfig) : null);
    },
    [layoutConfig],
  );

  return (
    <DiagramCanvas
      {...props}
      resolveDrop={resolveDrop}
      onAddByDrop={onAddByDrop}
      onAddDomainGroupByDrop={props.readOnly ? undefined : onAddDomainGroupByDrop}
      onPaletteDragOver={handlePaletteDragOver}
      resolvePaneMenuTarget={resolvePaneMenuTarget}
      onMenuAction={handleMenuAction}
      canTidyGroup={Boolean(props.onTidyGroup)}
      resolvePaneClick={resolvePaneClick}
    >
      <ZoneLayer
        layoutConfig={layoutConfig}
        readOnly={props.readOnly}
        dropZone={dropZone}
        onZoneResize={actions.setZoneSize}
        onCanvasResize={actions.setCanvasSize}
      />
      <DomainGroupLayer
        layoutConfig={layoutConfig}
        readOnly={props.readOnly}
        selected={props.selection.domainGroups}
        onSelect={(name) => props.onSelectionChange(selectDomainGroup(name))}
        onUpsert={actions.upsertDomainGroup}
        onMove={actions.moveDomainGroup}
        onRename={actions.renameDomainGroup}
        renameRequest={groupRename}
      />
      <Popover
        open={groupColor !== null}
        onClose={() => setGroupColor(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          groupColor ? { top: groupColor.position.y, left: groupColor.position.x } : undefined
        }
        slotProps={{ paper: { sx: { p: 1.5 } } }}
      >
        <ColorField
          label={t('canvas.groupColour')}
          ariaLabel={t('palette.groupColour')}
          value={colorOfGroup}
          readOnly={false}
          // Writes the whole rect back: `upsertDomainGroup` keys on the name, so
          // it replaces this group's box and nothing else. Clearing writes the
          // rect WITHOUT a colour, which is what absent-means-inherit needs —
          // a `color: undefined` left on the object would serialise as a null.
          onChange={(value) => {
            const rect = groupColor
              ? (layoutConfig?.domainGroups ?? []).find((g) => g.name === groupColor.name)
              : undefined;
            if (!rect) return;
            const { color: _dropped, ...rest } = rect;
            actions.upsertDomainGroup(value ? { ...rest, color: value } : rest);
          }}
        />
      </Popover>
      <Popover
        open={groupSettings !== null}
        onClose={() => setGroupSettings(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          groupSettings
            ? { top: groupSettings.position.y, left: groupSettings.position.x }
            : undefined
        }
        slotProps={{ paper: { sx: { p: 1.5 } } }}
      >
        <TidySettingsPanel
          options={props.groupTidyOptions ?? DEFAULT_TIDY_OPTIONS}
          onChange={(next) => props.onGroupTidyOptionsChange?.(next)}
          applyLabel={
            groupSettings
              ? t('group.tidyApply', { name: groupSettings.name })
              : t('group.tidyApplyAny')
          }
          onApply={() => {
            if (groupSettings) props.onTidyGroup?.(groupSettings.name);
            setGroupSettings(null);
          }}
        />
      </Popover>
    </DiagramCanvas>
  );
}
