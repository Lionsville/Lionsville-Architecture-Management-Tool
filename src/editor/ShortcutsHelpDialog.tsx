// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useMemo } from 'react';
import { canvasKeyRows, detectPlatform, type ShortcutGroup } from './keymap';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { KeySheet } from '../widgets/kit/KeySheet';

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
 * The canvas's keys, for an editor drawn with no host around it: the kit's one
 * sheet of keys over `CANVAS_SHORTCUTS`, so it cannot fall out of sync with the
 * dispatch hook. A host that has a sheet of its own for every screen hands it in
 * as `onShowShortcuts`, and this is not drawn (`EditorDialogs`).
 */
export function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const { t } = useStrings();
  const groups = useMemo(() => {
    const rows = canvasKeyRows(detectPlatform());
    const help = { label: t('shortcut.help'), keys: ['?'] };
    return GROUP_LABELS.map(({ group, labelKey }) => ({
      title: t(labelKey),
      rows: [...rows.filter((row) => row.group === group).map((row) => ({ label: t(row.labelKey as StringKey), keys: row.keys })), ...(group === 'general' ? [help] : [])],
    }));
  }, [t]);
  return <KeySheet open={open} onClose={onClose} title={t('shortcuts.title')} closeLabel={t('common.close')} orWord={t('shortcuts.or')} groups={groups} />;
}
