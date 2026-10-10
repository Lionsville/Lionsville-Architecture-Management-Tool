// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a double-click offers when an element has more than one place to open:
 * its container view beside the drawings anchored to it, or its page beside
 * those drawings. One place is opened without asking. Nothing here makes a view.
 */
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { useStrings } from '../i18n/LanguageContext';
import type { InsideOffer } from './useEditorHandle';

export function InsideChoice({ offers, onClose }: {
  offers: readonly InsideOffer[] | undefined;
  onClose: () => void;
}) {
  const { t } = useStrings();
  if (!offers) return null;
  return (
    <Dialog open onClose={onClose} aria-labelledby="inside-choice-title">
      <DialogTitle id="inside-choice-title">{t('menu.openInside')}</DialogTitle>
      <List data-testid="inside-choice" dense>
        {offers?.map((offer) => (
          <ListItemButton key={offer.key} onClick={() => { onClose(); offer.open(); }}>
            <ListItemText primary={offer.label} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
