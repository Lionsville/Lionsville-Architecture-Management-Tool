// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import type { DesignElement } from '../model/types';
import { useStrings } from '../i18n/LanguageContext';
import { RolesEnded } from '../widgets/RolesEnded';
import type { UnitDeletion } from './props';

export interface DeleteElementDialogProps {
  element: DesignElement;
  /** The application acting as boundary cannot be removed from its own diagram. */
  isBoundaryApplication: boolean;
  /** Applications with components must shed them before model deletion. */
  hasComponents: boolean;
  /**
   * Who stops being what if it is deleted from the model: a unit's
   * assignments go with it (ADR-0036, amended 12 October 2026). Removing it
   * from this diagram ends nobody's role.
   */
  endsRoles?: readonly string[];
  /**
   * A unit (3.6.2): the host's part of the question — ending first, who stops
   * being what, the units inside it and where they go, what else goes —
   * drawn in place of `endsRoles`, and the choice handed to
   * `onDeleteFromModel`. The units inside are that question's, so they do
   * not hold the delete back the way an application's components do.
   */
  units?: UnitDeletion;
  onRemoveFromDiagram(): void;
  onDeleteFromModel(choice?: string): void;
  onClose(): void;
}

/**
 * Delete decision dialog: remove the element from this diagram only (it stays
 * in the model and on other diagrams) or delete it from the model everywhere.
 */
export function DeleteElementDialog(props: DeleteElementDialogProps) {
  const { t } = useStrings();
  const { units } = props;
  const [choice, setChoice] = useState(units?.initial ?? '');
  const held = props.hasComponents && !units;
  return (
    <Dialog open onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.deleteElementTitle', { name: props.element.name })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>
          <strong>{t('dialog.removeFromDiagram')}</strong> {t('dialog.deleteElementKeeps')}{' '}
          <strong>{t('dialog.deleteFromModelButton')}</strong>{' '}
          {t('dialog.deleteElementRemoves')}
        </DialogContentText>
        {units
          ? units.render(choice, setChoice, props.onClose)
          : <RolesEnded lines={props.endsRoles ?? []} instead={t('dialog.retireInstead')} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{t('common.cancel')}</Button>
        <Tooltip title={props.isBoundaryApplication ? t('menu.boundaryApplication') : ''}>
          <span>
            <Button onClick={props.onRemoveFromDiagram} disabled={props.isBoundaryApplication}>
              {t('dialog.removeFromDiagram')}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={held ? t('dialog.deleteComponentsFirst') : ''}>
          <span>
            <Button color="error" onClick={() => props.onDeleteFromModel(units ? choice : undefined)} disabled={held}>
              {t('dialog.deleteFromModelButton')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
