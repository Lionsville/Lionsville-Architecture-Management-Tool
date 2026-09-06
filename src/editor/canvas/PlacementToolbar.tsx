import type { ComponentType } from 'react';
import { Panel } from '@xyflow/react';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import type { AlignAxis, DistributeAxis } from './alignDistribute';
import {
  AlignBottomIcon,
  AlignCenterXIcon,
  AlignCenterYIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
  GridIcon,
  SnapGridIcon,
} from '../../widgets/icons';
import { useStrings } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';

export interface PlacementToolbarProps {
  snapToGrid: boolean;
  onToggleSnapToGrid(): void;
  showGrid: boolean;
  onToggleShowGrid(): void;
  /** ≥2 elements selected — align is meaningful. */
  canAlign: boolean;
  /** ≥3 elements selected — distribute is meaningful. */
  canDistribute: boolean;
  onAlign(axis: AlignAxis): void;
  onDistribute(axis: DistributeAxis): void;
}

const ALIGN_BUTTONS: Array<{
  axis: AlignAxis;
  labelKey: StringKey;
  Icon: ComponentType<{ size?: number }>;
}> = [
  { axis: 'left', labelKey: 'canvas.alignLeft', Icon: AlignLeftIcon },
  { axis: 'centerX', labelKey: 'canvas.alignCenterX', Icon: AlignCenterXIcon },
  { axis: 'right', labelKey: 'canvas.alignRight', Icon: AlignRightIcon },
  { axis: 'top', labelKey: 'canvas.alignTop', Icon: AlignTopIcon },
  { axis: 'centerY', labelKey: 'canvas.alignCenterY', Icon: AlignCenterYIcon },
  { axis: 'bottom', labelKey: 'canvas.alignBottom', Icon: AlignBottomIcon },
];

/**
 * Canvas-overlay placement toolbar (top-centre): grid-snap toggle plus the
 * align/distribute groups. Rendered only when the canvas is editable; the
 * align/distribute buttons disable until the selection qualifies.
 */
export function PlacementToolbar(props: PlacementToolbarProps) {
  const theme = useTheme();
  const { t } = useStrings();
  return (
    <Panel position="top-center">
      <Paper
        elevation={2}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25, borderRadius: 2 }}
      >
        <Tooltip title={props.showGrid ? t('canvas.gridOn') : t('canvas.gridOff')}>
          <IconButton
            size="small"
            aria-label={t('canvas.gridToggle')}
            aria-pressed={props.showGrid}
            onClick={props.onToggleShowGrid}
            sx={{
              color: props.showGrid ? 'primary.main' : 'text.secondary',
              backgroundColor: props.showGrid
                ? alpha(theme.palette.primary.main, 0.12)
                : 'transparent',
            }}
          >
            <GridIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={props.snapToGrid ? t('canvas.snapOn') : t('canvas.snapOff')}>
          <IconButton
            size="small"
            aria-label={t('canvas.snapToggle')}
            aria-pressed={props.snapToGrid}
            onClick={props.onToggleSnapToGrid}
            sx={{
              color: props.snapToGrid ? 'primary.main' : 'text.secondary',
              backgroundColor: props.snapToGrid
                ? alpha(theme.palette.primary.main, 0.12)
                : 'transparent',
            }}
          >
            <SnapGridIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        {ALIGN_BUTTONS.map(({ axis, labelKey, Icon }) => (
          <Tooltip key={axis} title={t(labelKey)}>
            <span>
              <IconButton
                size="small"
                aria-label={t(labelKey)}
                disabled={!props.canAlign}
                onClick={() => props.onAlign(axis)}
              >
                <Icon />
              </IconButton>
            </span>
          </Tooltip>
        ))}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        <Tooltip title={t('canvas.distributeHorizontally')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('canvas.distributeHorizontally')}
              disabled={!props.canDistribute}
              onClick={() => props.onDistribute('horizontal')}
            >
              <DistributeHorizontalIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('canvas.distributeVertically')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('canvas.distributeVertically')}
              disabled={!props.canDistribute}
              onClick={() => props.onDistribute('vertical')}
            >
              <DistributeVerticalIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Panel>
  );
}
