// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move to…* on a building block (ADR-0043, amended 24 November 2026): where
 * it is kept now, where it is to be kept — a topic first, never the scope it
 * is in, and only a scope this person may change — and one sentence saying
 * what goes with it. The block keeps its id, so its page, its address and
 * every reference to it stay as they are.
 *
 * The access lands the move and says how it went. A move that did not land
 * leaves the dialog up, since another place may take it; one that did closes
 * it. It opens with *Move* in focus, so Enter is the answer and the list is
 * one Tab back.
 *
 * {@link useMoveBlock} is the way in, said once for the two places that
 * offer it.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { useBlocks } from './BlocksContext'
import type { BlockRow, BlocksAccess } from './BlocksContext'
import { scopeOptions } from './scopeOptions'

/** Where a block may be moved to by this person: every place a block is kept in but its own, the topics first. */
export function moveChoices(access: BlocksAccess, row: BlockRow) {
  return access.placeChoices().filter((one) => one.path !== row.scope && access.mayWrite(one.path))
}

export function MoveBlockDialog({ row, onClose }: { row: BlockRow; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const places = access ? moveChoices(access, row) : []
  const [to, setTo] = useState(places[0]?.path)
  const [busy, setBusy] = useState(false)
  if (!access) return null
  const ready = !busy && to !== undefined
  const move = () => {
    if (!ready) return
    setBusy(true)
    // The access says a refusal, and a write the place did not take stands in *Your work*: here the dialog only waits again.
    void access.move(row.block.id, to).then((moved) => (moved ? onClose() : setBusy(false)), () => setBusy(false))
  }
  return (
    <Dialog
      open size="m" title={t('blocks.moveTitle', { name: row.block.name })} onClose={onClose} working={busy} onSubmit={move}
      data-testid="block-move-dialog"
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { disabled: !ready, autoFocus: true, onClick: move, 'data-testid': 'block-move', label: t('blocks.moveAction') },
      }}
    >
      <p>{t('blocks.moveKeptNow', { scope: access.scopeLabel(row.scope) })}</p>
      {to === undefined
        ? <p role="status">{t('blocks.moveNowhere')}</p>
        : <SelectField label={t('blocks.moveTo')} value={to} onChange={setTo} options={scopeOptions(places, t)} data-testid="block-move-to" />}
      {to !== undefined && <p>{t('blocks.moveWith')}</p>}
    </Dialog>
  )
}

/**
 * *Move to…* as a block's ⋯ offers it on its page and on its preview, and the
 * dialog behind it: nothing at all for a person who may not change the scope
 * that keeps the block. Where it may go is the dialog's to say.
 */
export function useMoveBlock(row: BlockRow | undefined): { more: readonly MenuEntry[]; dialog: ReactNode } {
  const access = useBlocks()
  const { t } = useStrings()
  const [asked, setAsked] = useState(false)
  if (!access || !row || !access.mayWrite(row.scope)) return { more: [], dialog: null }
  return {
    more: [{ label: t('blocks.move'), onSelect: () => setAsked(true), 'data-testid': 'block-move-open' }],
    dialog: asked ? <MoveBlockDialog row={row} onClose={() => setAsked(false)} /> : null,
  }
}
