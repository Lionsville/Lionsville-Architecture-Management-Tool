import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type {
  AttachSide,
  DesignConnection,
  DesignDiagram,
  DesignModel,
  EdgeArrowhead,
  EdgeLineStyle,
  EdgeRouting,
} from '../model/types';
import { routeFor, routeSource, type AttachSidesPatch } from '../model/routes';
import { ColorField } from './ColorField';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import type { EditorActions } from './useEditorState';

/**
 * Style controls follow the NULL-inherit contract (U4b): the "default" choice
 * of each control writes `undefined`, which the save path stores as NULL so the
 * edge keeps inheriting the current runtime default (theme stroke / solid /
 * smooth / Direction-derived arrowheads). Line "Solid" and routing "Smooth" ARE
 * the defaults, so they map to the empty option rather than a stored token — no
 * explicit default ever lands in the DB.
 */
const LINE_STYLE_OPTIONS: { value: EdgeLineStyle | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.solidDefault' },
  { value: 'dashed', labelKey: 'option.dashed' },
  { value: 'dotted', labelKey: 'option.dotted' },
];
const ROUTING_OPTIONS: { value: EdgeRouting | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.smoothDefault' },
  { value: 'orthogonal', labelKey: 'shape.orthogonal' },
  { value: 'straight', labelKey: 'shape.straight' },
  { value: 'curved', labelKey: 'shape.curved' },
];
const ARROWHEAD_OPTIONS: { value: EdgeArrowhead | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.default' },
  { value: 'arrow', labelKey: 'option.arrow' },
  { value: 'none', labelKey: 'common.none' },
];
/** Attach sides (Route section): the empty option is Automatic, stored as no side. */
const ATTACH_SIDE_OPTIONS: { value: AttachSide | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'side.auto' },
  { value: 'top', labelKey: 'side.top' },
  { value: 'right', labelKey: 'side.right' },
  { value: 'bottom', labelKey: 'side.bottom' },
  { value: 'left', labelKey: 'side.left' },
];

/**
 * The stored sides as text — "Leaves from Top · Arrives at Left" — for a viewer
 * who cannot change them (read-only, or an editor that wired no callback). The
 * line still honours a stored side, so hiding the selects must not hide the fact.
 */
function describeSides(
  route: { sourceSide?: AttachSide; targetSide?: AttachSide } | undefined,
  t: Translate,
): string {
  if (!route) return '';
  const label = (side: AttachSide) => {
    const option = ATTACH_SIDE_OPTIONS.find((o) => o.value === side);
    return option ? t(option.labelKey) : side;
  };
  return [
    route.sourceSide ? t('route.leavesFromSide', { name: label(route.sourceSide) }) : '',
    route.targetSide ? t('route.arrivesAtSide', { name: label(route.targetSide) }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Tab label with an optional "set values" dot (mirrors the InspectorSection "●" badge). */
function TabLabel({ text, dot }: { text: string; dot: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {text}
      {dot && (
        <Box component="span" aria-hidden sx={{ fontSize: 9, lineHeight: 1, color: 'primary.main' }}>
          ●
        </Box>
      )}
    </Box>
  );
}

/**
 * Connection property form (U7a): a two-tab split — General / Appearance.
 * General carries Label, Protocol, and the single **Direction** control that is
 * the source of truth for `isBidirectional` (D2). Appearance carries the colour,
 * line style, routing, and the per-end arrowhead selects — the latter demoted to
 * a subordinate override: Direction drives the default arrowheads, and these
 * still round-trip the persisted `sourceArrowhead`/`targetArrowhead` for a per-
 * end tweak. Nothing persisted was dropped; the two arrowhead selects are simply
 * no longer a top-level peer that can contradict Direction. Tab selection resets
 * to General when the selected connection id changes.
 *
 * Below the tabs sits the **Route** section: who owns this line's route on the
 * active diagram (Automatic / Hand-drawn / None), how many bends it has, the
 * three things a person can do about it — Pin, Unpin, Reset to automatic — and
 * which side of its node each end attaches to ("Leaves from" / "Arrives at"). It
 * needs the `diagram`, because a route is per diagram while the connection is
 * design-wide.
 */
export function ConnectionInspector({
  connection,
  model,
  diagram,
  readOnly,
  actions,
  onResetRoute,
  onSetRouteSides,
  onRequestDelete,
}: {
  connection: DesignConnection;
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  actions: EditorActions;
  /**
   * "Reset to automatic": the editor owns it because, with live routing off, it
   * has to run the routing pass and amend it into the reset's undo step. Absent
   * hides the button.
   */
  onResetRoute?(connectionId: string): void;
  /**
   * "Leaves from" / "Arrives at": the editor owns it for the same reason as the
   * reset — with live routing off it runs the pass that routes the line out of
   * its new side. Absent hides the two selects.
   */
  onSetRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  /**
   * Ask the editor to confirm before the line goes. Absent, the button deletes
   * straight away as it always did — the same fallback the menu and the Delete
   * key use, so a host embedding the inspector alone is not left with a dead
   * button.
   */
  onRequestDelete?(connectionId: string): void;
}) {
  const { t } = useStrings();
  const name = (id: string) => model.elements.find((e) => e.id === id)?.name ?? '?';
  const update = (patch: Partial<Omit<DesignConnection, 'id'>>) =>
    actions.updateConnection(connection.id, patch);

  const route = routeFor(diagram, connection.id);
  const routeStatus: 'none' | 'auto' | 'manual' = route ? routeSource(route) : 'none';
  const bendCount = route?.waypoints.length ?? 0;
  const ROUTE_BADGE = {
    none: t('route.none'),
    auto: t('route.auto'),
    manual: t('route.manual'),
  } as const;
  const ROUTE_NOTE = {
    none: t('route.noteNone'),
    auto: t('route.noteAuto'),
    manual: t('route.noteManual'),
  } as const;

  const [activeTab, setActiveTab] = useState(0);
  const [seenId, setSeenId] = useState(connection.id);
  if (seenId !== connection.id) {
    setSeenId(connection.id);
    setActiveTab(0);
  }

  const generalHasValues = Boolean(connection.label || connection.protocol);
  const appearanceHasValues = Boolean(
    connection.color ||
      connection.lineStyle ||
      connection.routing ||
      connection.sourceArrowhead ||
      connection.targetArrowhead,
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('section.connection')}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {name(connection.sourceId)} {connection.isBidirectional ? '↔' : '→'}{' '}
          {name(connection.targetId)}
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_e, value: number) => setActiveTab(value)}
        variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5, minWidth: 0 } }}
      >
        <Tab label={<TabLabel text={t('tab.general')} dot={generalHasValues} />} />
        <Tab label={<TabLabel text={t('tab.appearance')} dot={appearanceHasValues} />} />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label={t('field.label')}
            value={connection.label ?? ''}
            fullWidth
            multiline
            maxRows={5}
            disabled={readOnly}
            placeholder={t('field.labelPlaceholder')}
            helperText={t('field.labelHelp')}
            onChange={(e) => update({ label: e.target.value || undefined })}
          />
          <TextField
            label={t('field.protocol')}
            value={connection.protocol ?? ''}
            fullWidth
            disabled={readOnly}
            placeholder={t('field.protocolPlaceholder')}
            onChange={(e) => update({ protocol: e.target.value || undefined })}
          />
          <TextField
            select
            label={t('field.direction')}
            value={connection.isBidirectional ? 'bidirectional' : 'oneway'}
            fullWidth
            disabled={readOnly}
            helperText={t('field.directionHelp')}
            onChange={(e) => update({ isBidirectional: e.target.value === 'bidirectional' })}
          >
            <MenuItem value="oneway">{t('field.oneWay')}</MenuItem>
            <MenuItem value="bidirectional">{t('field.bidirectional')}</MenuItem>
          </TextField>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ColorField
            label={t('field.colour')}
            ariaLabel={t('field.edgeColour')}
            value={connection.color}
            readOnly={readOnly}
            onChange={(value) => update({ color: value })}
          />

          <TextField
            select
            label={t('field.lineStyle')}
            value={connection.lineStyle ?? ''}
            fullWidth
            size="small"
            disabled={readOnly}
            onChange={(e) =>
              update({ lineStyle: e.target.value === '' ? undefined : (e.target.value as EdgeLineStyle) })
            }
          >
            {LINE_STYLE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label={t('field.routing')}
            value={connection.routing ?? ''}
            fullWidth
            size="small"
            disabled={readOnly}
            helperText={t('field.routingHelp')}
            onChange={(e) =>
              update({ routing: e.target.value === '' ? undefined : (e.target.value as EdgeRouting) })
            }
          >
            {ROUTING_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </MenuItem>
            ))}
          </TextField>

          {/* Subordinate arrowhead override (D2): Direction (General) is the
              source of truth and sets the default arrowheads; these tweak a
              single end without becoming a competing top-level control. Kept
              compact so the two selects don't fight the 320px width. */}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Arrowhead override
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select
                label={t('field.source')}
                value={connection.sourceArrowhead ?? ''}
                sx={{ flex: 1 }}
                size="small"
                disabled={readOnly}
                onChange={(e) =>
                  update({
                    sourceArrowhead:
                      e.target.value === '' ? undefined : (e.target.value as EdgeArrowhead),
                  })
                }
              >
                {ARROWHEAD_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('field.target')}
                value={connection.targetArrowhead ?? ''}
                sx={{ flex: 1 }}
                size="small"
                disabled={readOnly}
                onChange={(e) =>
                  update({
                    targetArrowhead:
                      e.target.value === '' ? undefined : (e.target.value as EdgeArrowhead),
                  })
                }
              >
                {ARROWHEAD_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </Box>
      )}

      <Divider />
      <Box data-testid="route-section" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="overline" color="text.secondary">
          {t('section.route')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            data-testid="route-badge"
            label={ROUTE_BADGE[routeStatus]}
            color={routeStatus === 'manual' ? 'primary' : 'default'}
            variant={routeStatus === 'none' ? 'outlined' : 'filled'}
          />
          <Typography variant="caption" color="text.secondary" data-testid="route-bends">
            {bendCount === 1 ? t('route.bendsOne') : t('route.bendsOther', { count: bendCount })}
            {route?.pinned ? ` · ${t('route.pinned')}` : ''}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {ROUTE_NOTE[routeStatus]}
        </Typography>
        {!readOnly && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {routeStatus !== 'manual' && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => actions.setRouteSource(connection.id, 'manual')}
              >
                {t('route.pin')}
              </Button>
            )}
            {routeStatus === 'manual' && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => actions.setRouteSource(connection.id, 'auto')}
              >
                {t('route.unpin')}
              </Button>
            )}
            {onResetRoute && (
              <Button size="small" variant="text" onClick={() => onResetRoute(connection.id)}>
                {t('route.resetToAutomatic')}
              </Button>
            )}
          </Box>
        )}
        {!readOnly && onSetRouteSides && (
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <TextField
              select
              label={t('field.leavesFrom')}
              value={route?.sourceSide ?? ''}
              sx={{ flex: 1 }}
              size="small"
              onChange={(e) =>
                onSetRouteSides(connection.id, {
                  sourceSide: e.target.value === '' ? undefined : (e.target.value as AttachSide),
                })
              }
            >
              {ATTACH_SIDE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('field.arrivesAt')}
              value={route?.targetSide ?? ''}
              sx={{ flex: 1 }}
              size="small"
              onChange={(e) =>
                onSetRouteSides(connection.id, {
                  targetSide: e.target.value === '' ? undefined : (e.target.value as AttachSide),
                })
              }
            >
              {ATTACH_SIDE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}
        {(readOnly || !onSetRouteSides) && describeSides(route, t) && (
          <Typography variant="caption" color="text.secondary" data-testid="route-sides">
            {describeSides(route, t)}
          </Typography>
        )}
      </Box>

      {!readOnly && (
        <>
          <Divider />
          <Button
            color="error"
            variant="outlined"
            size="small"
            onClick={() =>
              onRequestDelete ? onRequestDelete(connection.id) : actions.deleteConnection(connection.id)
            }
          >
            {t('route.deleteConnection')}
          </Button>
        </>
      )}
    </Box>
  );
}
