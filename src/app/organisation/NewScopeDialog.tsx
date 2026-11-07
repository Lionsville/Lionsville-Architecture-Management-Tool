// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * New scope: named for what it makes.
 *
 * Every scope is the same document (ADR-0012 §1), so there is one question:
 * what is it called, what is it, and where does it go. No view is made unless
 * asked for, and *Create* stays on the new scope's home: a default that made an
 * empty board and landed on it is where most of an organisation's empty boards
 * came from, and a scope that holds nothing is a perfectly good scope.
 *
 * A name that is one of the folders a scope writes into is refused here, where
 * a person can see it and type another, rather than quietly suffixed by the
 * addressing (`scopePath.ts`).
 *
 * **Served by, from the start** (ADR-0036, amended 13 October 2026). Where the
 * organisation has units, one may be picked to serve the new scope. It is
 * written once the scope is made, as the step of the scope that keeps the unit;
 * the dialog only holds the pick.
 */
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import type { Translate } from '../../i18n'
import { PickToAdd } from '../../widgets/PickToAdd'
import type { PickOption } from '../../widgets/PickToAdd'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { isReservedScopeName } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { TypeChoice } from '../../projects/scopeType'
import { slug } from '../../model/keys'
import { ScopeField } from './ScopeField'
import { TypeField } from './TypeField'

export type NewScopeDialogProps = {
  open: boolean
  tree: ScopeSummary
  parent: ScopePath
  name: string
  /** Start it with a landscape view. Off unless asked for. */
  withBoard: boolean
  /** What it is, from the operating model or the built-in kinds; a label, and nothing asks it. */
  type: string
  unitTypes?: readonly { id: string; name: string }[]
  onParentChange: (next: ScopePath) => void
  onNameChange: (name: string) => void
  onWithBoardChange: (withBoard: boolean) => void
  onTypeChange: (type: string) => void
  /**
   * The unit picked to serve it, and what may be picked. Absent, or with
   * nothing to offer — an organisation with no units — the field is not drawn.
   */
  servedBy?: { options: readonly PickOption[]; value: string | undefined; onChange: (unitId: string | undefined) => void }
  onCancel: () => void
  onCreate: () => void
  s: Translate
}

export function NewScopeDialog({
  open, tree, parent, name, withBoard, type, unitTypes = [], onParentChange, onNameChange, onWithBoardChange, onTypeChange, servedBy, onCancel, onCreate, s,
}: NewScopeDialogProps) {
  const typed = name.trim()
  // Slugged, because that is what becomes the folder: "Docs" and "docs" are the
  // same name as far as the tree is concerned.
  const reserved = typed.length > 0 && isReservedScopeName(slug(typed))
  const ready = typed.length > 0 && !reserved
  const parentDraws = (flattenScopes(tree).find((one) => one.path === parent)?.diagrams ?? 0) > 0
  return (
    <Dialog
      open={open} title={s('picker.newScopeTitle')} onClose={onCancel} onSubmit={() => { if (ready) onCreate() }}
      actions={(
        <>
          <Button variant="quiet" onClick={onCancel}>{s('common.cancel')}</Button>
          <Button variant="primary" reason={ready ? undefined : s('picker.nameFirst')} onClick={onCreate}>{s('picker.create')}</Button>
        </>
      )}
    >
      {open && (
        <>
          <TextField
            autoFocus label={s('picker.scopeName')} value={name} onChange={onNameChange}
            {...(reserved ? { error: s('picker.reservedName') } : {})}
          />
          <TypeField type={type as TypeChoice} unitTypes={unitTypes} onChange={onTypeChange} help={s('org.newScopeTypeHelp')} s={s} />
          <ScopeField
            tree={tree} value={parent} onChange={onParentChange} label={s('picker.under')} s={s}
            {...(parentDraws ? { helperText: s('org.treeEmptyLandscape') } : {})}
          />
          {servedBy && servedBy.options.length > 0 && <ServedByField {...servedBy} s={s} />}
          <FormControlLabel
            control={(
              <Checkbox
                checked={withBoard}
                onChange={(e) => onWithBoardChange(e.target.checked)}
                slotProps={{ input: { 'aria-label': s('picker.withBoard') } }}
              />
            )}
            label={s('picker.withBoard')}
            slotProps={{ typography: { sx: { fontSize: 'var(--t-body)' } } }}
          />
        </>
      )}
    </Dialog>
  )
}

/** The one unit picked to serve the new scope: a chip once picked, *+ Unit* until then. */
function ServedByField({ options, value, onChange, s }: NonNullable<NewScopeDialogProps['servedBy']> & { s: Translate }) {
  const picked = options.find((one) => one.id === value)
  return (
    <div data-testid="new-scope-served-by">
      <p className="kit-factline">{s('org.newScopeServedBy')}: {s('org.newScopeServedByHint')}</p>
      {picked
        ? (
            <Chip
              label={picked.label} data-testid="new-scope-served-by-unit"
              // Backspace or Delete on the chip takes the pick back, as the cross does.
              onDelete={() => onChange(undefined)}
            />
          )
        : (
            <PickToAdd
              options={options} label={s('org.servedByAdd')} field={s('pick.findUnit')} nothing={s('pick.noUnit')}
              onPick={onChange} testId="new-scope-served-by-add" disabled={options.every((one) => one.disabled === true)}
            />
          )}
    </div>
  )
}
