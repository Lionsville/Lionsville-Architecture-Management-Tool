// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { DialogFooter } from '../widgets/kit/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
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
  /** Absent where the thing is on no view here to be removed from: a technology landscape draws what is, and holds no members. */
  onRemoveFromDiagram?: () => void;
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
    // Wide enough for the menu's own two words on one row in German (Aus der Ansicht entfernen, Aus dem Modell löschen).
    <Dialog open onClose={props.onClose} maxWidth="sm" fullWidth>
      {/* A choice between the two acts is asked as one: the title says both where both are offered. */}
      <DialogTitle>{t(props.onRemoveFromDiagram ? 'dialog.removeOrDeleteTitle' : 'dialog.deleteElementTitle', { name: props.element.name })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 'var(--t-body)' }}>
          {props.onRemoveFromDiagram && <><strong>{t('dialog.removeFromDiagram')}</strong> {t('dialog.deleteElementKeeps')}{' '}</>}
          <strong>{t('dialog.deleteFromModelButton')}</strong>{' '}
          {t('dialog.deleteElementRemoves')}
        </DialogContentText>
        {units
          ? units.render(choice, setChoice, props.onClose)
          : <RolesEnded lines={props.endsRoles ?? []} instead={t('dialog.retireInstead')} />}
      </DialogContent>
      <DialogFooter
        cancel={{ onClick: props.onClose, label: t('common.cancel') }}
        also={props.onRemoveFromDiagram ? [{ onClick: props.onRemoveFromDiagram, reason: props.isBoundaryApplication ? t('menu.boundaryApplication') : undefined, label: t('dialog.removeFromDiagram') }] : []}
        outcome={{ onClick: () => props.onDeleteFromModel(units ? choice : undefined), reason: held ? t('dialog.deleteComponentsFirst') : undefined, label: t('dialog.deleteFromModelButton'), danger: true }}
      />
    </Dialog>
  );
}
