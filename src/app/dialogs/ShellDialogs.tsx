/**
 * The shell's three dialogs, together.
 *
 * They sit here so the workspace spends one line on them instead of blocks of
 * fifteen. Which text a delete dialog carries depends on *what* you are
 * deleting, and that choice lives here — not in `App` and not in the reusable
 * {@link ConfirmDialog}.
 */
import type { Translate } from '../../i18n'
import type { DesignDiagram } from '../../model'
import { ConfirmDialog } from './ConfirmDialog'
import { NewDiagramDialog } from './NewDiagramDialog'

export type ShellDialogsProps = {
  s: Translate

  diagramToDelete: DesignDiagram | undefined
  isLastLandscape: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void

  newDiagramName: string | null
  onNewDiagramNameChange: (name: string | null) => void
  onConfirmNewDiagram: () => void
}

export function ShellDialogs({
  s,
  diagramToDelete, isLastLandscape, onCancelDelete, onConfirmDelete,
  newDiagramName, onNewDiagramNameChange, onConfirmNewDiagram,
}: ShellDialogsProps) {
  const deleteBody = isLastLandscape
    ? 'shell.lastLandscape'
    : diagramToDelete?.kind === 'layer7'
      ? 'shell.deleteLandscapeBody'
      : 'shell.deleteContainerBody'

  return (
    <>
      <ConfirmDialog
        open={diagramToDelete !== undefined}
        title={s('shell.deleteDiagramTitle', { name: diagramToDelete?.name ?? '' })}
        body={s(deleteBody)}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        confirmDisabled={isLastLandscape}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
      <NewDiagramDialog
        name={newDiagramName}
        onNameChange={onNewDiagramNameChange}
        onConfirm={onConfirmNewDiagram}
        s={s}
      />
    </>
  )
}
