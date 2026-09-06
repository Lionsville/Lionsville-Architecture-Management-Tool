import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import {
  CANVAS_SHORTCUTS,
  detectPlatform,
  formatChord,
  type ShortcutDef,
  type ShortcutGroup,
} from './keymap';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';

export interface ShortcutsHelpDialogProps {
  open: boolean;
  onClose(): void;
}

const GROUP_LABELS: Array<{ group: ShortcutGroup; labelKey: StringKey }> = [
  { group: 'selection', labelKey: 'shortcutGroup.selection' },
  { group: 'edit', labelKey: 'shortcutGroup.edit' },
  { group: 'view', labelKey: 'shortcutGroup.view' },
  { group: 'general', labelKey: 'shortcutGroup.general' },
];

/**
 * Keyboard-shortcut overlay. Mirrors hal_app's `FunnelHelpDialog` MUI-Dialog
 * pattern (title + dividers + close) rather than importing it — this package
 * must not depend on the host. It renders `CANVAS_SHORTCUTS` grouped by
 * `group`, so it can never fall out of sync with the dispatch hook. Glyphs are
 * resolved for the viewer's platform (⌘/Ctrl, ⇧, ⌥).
 */
export function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const { t } = useStrings();
  const platform = useMemo(() => detectPlatform(), []);
  const byGroup = useMemo(() => {
    const map = new Map<ShortcutGroup, ShortcutDef[]>();
    for (const def of CANVAS_SHORTCUTS) {
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return map;
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('help.title')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('help.intro')}
        </Typography>
        {GROUP_LABELS.map(({ group, labelKey }) => {
          const defs = byGroup.get(group);
          if (!defs || defs.length === 0) return null;
          return (
            <Box key={group} sx={{ mb: 2, '&:last-of-type': { mb: 0 } }}>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ color: 'text.primary', mb: 1 }}
              >
                {t(labelKey)}
              </Typography>
              {defs.map((def) => (
                <Box
                  key={def.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 0.5,
                  }}
                >
                  <Typography variant="body2">{t(def.labelKey)}</Typography>
                  <Box
                    component="kbd"
                    sx={{
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'text.secondary',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'action.hover',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatChord(def, platform)}
                  </Box>
                </Box>
              ))}
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
