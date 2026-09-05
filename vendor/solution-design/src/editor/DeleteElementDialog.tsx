import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import type { DesignElement } from '../types';
import { useStrings } from '../i18n/LanguageContext';

export interface DeleteElementDialogProps {
  element: DesignElement;
  /** The application acting as boundary cannot be removed from its own diagram. */
  isBoundaryApplication: boolean;
  /** Applications with components must shed them before model deletion. */
  hasComponents: boolean;
  onRemoveFromDiagram(): void;
  onDeleteFromModel(): void;
  onClose(): void;
}

/**
 * Delete decision dialog: remove the element from this diagram only (it stays
 * in the model and on other diagrams) or delete it from the model everywhere.
 */
export function DeleteElementDialog(props: DeleteElementDialogProps) {
  const { t } = useStrings();
  return (
    <Dialog open onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.deleteElementTitle', { name: props.element.name })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>
          <strong>{t('dialog.removeFromDiagram')}</strong> {t('dialog.deleteElementKeeps')}{' '}
          <strong>{t('dialog.deleteFromModelButton')}</strong>{' '}
          {t('dialog.deleteElementRemoves')}
        </DialogContentText>
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
        <Tooltip title={props.hasComponents ? t('dialog.deleteComponentsFirst') : ''}>
          <span>
            <Button color="error" onClick={props.onDeleteFromModel} disabled={props.hasComponents}>
              {t('dialog.deleteFromModelButton')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
