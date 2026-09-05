import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { TidyOptions } from '../layout/tidy';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';

const DIRECTIONS: {
  value: TidyOptions['direction'];
  labelKey: StringKey;
  titleKey?: StringKey;
}[] = [
  { value: 'auto', labelKey: 'tidy.auto' },
  { value: 'horizontal', labelKey: 'tidy.across' },
  { value: 'vertical', labelKey: 'tidy.down' },
  {
    value: 'hybrid',
    labelKey: 'tidy.hybrid',
    titleKey: 'tidy.hybridTip',
  },
];

const DENSITIES: { value: TidyOptions['density']; labelKey: StringKey }[] = [
  { value: 'compact', labelKey: 'tidy.compact' },
  { value: 'normal', labelKey: 'tidy.normal' },
  { value: 'spacious', labelKey: 'tidy.spacious' },
];

export interface TidySettingsPanelProps {
  options: TidyOptions;
  onChange(options: TidyOptions): void;
  /** Runs the tidy this panel belongs to. */
  onApply(): void;
  /** Apply-button text — names what gets tidied ("Tidy layout" / "Tidy group"). */
  applyLabel: string;
  /**
   * Offer the two group pins. Board-level only: a per-group tidy already leaves
   * its own box where it is and re-lays-out only its members, so both options
   * would be no-ops there.
   */
  showPinGroups?: boolean;
  /**
   * Label the pins for a container diagram, where the single "group" is the
   * application boundary. Same options, same code — only the words change,
   * because "group" is not what the user is looking at.
   */
  boundaryLabels?: boolean;
  /**
   * Panel width. A popover sizes itself to its content, so it keeps the fixed
   * default; the inspector already has a column and passes `'100%'` to fill it.
   */
  width?: number | string;
}

/**
 * The Tidy settings, shared by the toolbar's caret popover (whole board), the
 * domain-group menu and the group inspector (one group). Each host owns its own
 * {@link TidyOptions} state, so the board and group settings are independent —
 * but the two group hosts share one, so they can never disagree.
 */
export function TidySettingsPanel(props: TidySettingsPanelProps) {
  const { t } = useStrings();
  const { options, onChange } = props;

  return (
    <Box sx={{ width: props.width ?? 260 }}>
      <Typography variant="caption" color="text.secondary">
        {t('tidy.direction')}
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={options.direction}
        // `exclusive` hands back null when the active button is clicked again;
        // keep the current value rather than leaving it unset.
        onChange={(_e, value: TidyOptions['direction'] | null) =>
          value && onChange({ ...options, direction: value })
        }
        sx={{ mt: 0.5, mb: 1.5 }}
      >
        {DIRECTIONS.map((entry) => (
          <ToggleButton
            key={entry.value}
            value={entry.value}
            title={entry.titleKey ? t(entry.titleKey) : undefined}
          >
            {t(entry.labelKey)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="caption" color="text.secondary">
        {t('tidy.density')}
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={options.density}
        onChange={(_e, value: TidyOptions['density'] | null) =>
          value && onChange({ ...options, density: value })
        }
        sx={{ mt: 0.5, mb: 0.5 }}
      >
        {DENSITIES.map((entry) => (
          <ToggleButton key={entry.value} value={entry.value}>
            {t(entry.labelKey)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={options.pinAnchorPoints}
            onChange={(e) => onChange({ ...options, pinAnchorPoints: e.target.checked })}
          />
        }
        label={<Typography variant="body2">{t('tidy.pinAnchors')}</Typography>}
      />
      {/* Says "you positioned yourself" rather than "have bend points": the option
          now keys off who drew the route, so it covers a label chip somebody
          dragged as well as a bend, and it no longer protects an earlier Tidy's
          own output. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {t('tidy.pinAnchorsNote')}
      </Typography>

      {props.showPinGroups && (
        <>
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={
              <Checkbox
                size="small"
                checked={options.pinGroups}
                onChange={(e) => onChange({ ...options, pinGroups: e.target.checked })}
              />
            }
            label={
              <Typography variant="body2">
                {props.boundaryLabels ? t('tidy.pinBoundary') : t('tidy.pinGroups')}
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {props.boundaryLabels ? t('tidy.pinBoundaryNote') : t('tidy.pinGroupsNote')}
          </Typography>
          {/* The independent half: this one pins the INTERIOR and lets the box
              move. Ticking both is the "tidy everything except my groups" cell —
              the bands still reflow and every line is still re-routed. */}
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={
              <Checkbox
                size="small"
                checked={options.pinGroupContents}
                onChange={(e) => onChange({ ...options, pinGroupContents: e.target.checked })}
              />
            }
            label={
              <Typography variant="body2">
                {props.boundaryLabels ? t('tidy.pinBoundaryContents') : t('tidy.pinGroupContents')}
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {props.boundaryLabels
              ? t('tidy.pinBoundaryContentsNote')
              : t('tidy.pinGroupContentsNote')}
          </Typography>
        </>
      )}

      <Button size="small" fullWidth variant="contained" sx={{ mt: 1.5 }} onClick={props.onApply}>
        {props.applyLabel}
      </Button>
    </Box>
  );
}
