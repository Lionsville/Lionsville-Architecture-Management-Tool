import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import type { Point } from '../../model/types';
import { LogoGrid } from '../nodes/LogoGrid';
import { useStrings } from '../../i18n/LanguageContext';

/**
 * The element menu's "Icon…" target: the same `LogoGrid` the inspector and the
 * palette show, in a small popover anchored where the user right-clicked.
 *
 * A popover rather than a submenu because the grid needs a search field, and a
 * text field inside a MUI `Menu` fights the menu's own type-ahead and arrow-key
 * handling. It closes on pick, on Escape and on a click outside — so choosing a
 * mark is one gesture from the right-click, and changing your mind is none.
 *
 * No upload tile here on purpose: uploading is a shell dialog, and starting one
 * from a transient popover anchored to a canvas click is a worse place for it
 * than the inspector or the palette tray, which both offer it.
 */
export function LogoPickerPopover({
  anchorPosition,
  value,
  onChange,
  onClose,
}: {
  /** Client coordinates — the same point the context menu used. */
  anchorPosition: Point;
  value?: string;
  /** A mark was picked (`undefined` = None). The popover closes itself after. */
  onChange(iconKey: string | undefined): void;
  onClose(): void;
}) {
  const { t } = useStrings();
  return (
    <Popover
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: anchorPosition.y, left: anchorPosition.x }}
      slotProps={{ paper: { sx: { width: 300 }, 'aria-label': t('logo.picker') } }}
    >
      <Box sx={{ p: 1 }}>
        <LogoGrid
          label={t('field.icon')}
          value={value}
          maxHeight={260}
          onChange={(iconKey) => {
            onChange(iconKey);
            onClose();
          }}
        />
      </Box>
    </Popover>
  );
}
