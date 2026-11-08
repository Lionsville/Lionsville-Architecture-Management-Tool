// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions the decisions page asks in a dialog: what a new record is called
 * and what it is about, which record replaces one being superseded, why one is
 * rejected or withdrawn, whether to accept one, and whether to delete one.
 *
 * Each says what it wants and lets the page perform it: the page owns the lists,
 * the numbering and the date. The title says the act, the body the effect, the
 * button the outcome.
 */
import { useEffect, useState } from 'react'
import { useFreshFor } from '../../widgets/useFreshFor'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import type { SelectOption } from '../../widgets/kit/Field'
import type { Translate } from '../../i18n'
import { adrFieldItems, formatAdrNumber } from '../adr'
import type { Adr } from '../adr'
import { ABOUT_THE_SCOPE } from '../adrList'

export type NewAdrDialogProps = {
  open: boolean
  /** What a record may be about, this scope first. */
  subjects: readonly SelectOption[]
  /** Where it lands unless somebody says otherwise: the filter that is on. */
  about?: string
  onCancel: () => void
  onCreate: (title: string, about: string) => void
  s: Translate
}

export function NewAdrDialog({ open, subjects, about = ABOUT_THE_SCOPE, onCancel, onCreate, s }: NewAdrDialogProps) {
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState(about)
  useEffect(() => { if (open) { setTitle(''); setChosen(about) } }, [open, about])
  const ready = title.trim().length > 0
  return (
    <Dialog
      open={open} size="m" title={s('adr.new')} onClose={onCancel}
      onSubmit={() => { if (ready) onCreate(title.trim(), chosen) }}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { type: 'submit', disabled: !ready, label: s('adr.create') },
      }}
    >
      <TextField autoFocus label={s('adr.newTitleField')} hint={s('adr.newTitleHelp')} value={title} onChange={setTitle} />
      <SelectField label={s('adr.aboutField')} hint={s('adr.aboutHelp')} value={chosen} options={subjects} onChange={setChosen} />
    </Dialog>
  )
}

export type SupersedeDialogProps = {
  /** The record being superseded; the dialog is closed while undefined. */
  target?: Adr
  /**
   * The accepted records in the same list — the only ones a link can point
   * at: a link to another list is a dead end, and a proposal cannot replace a
   * decision in force (ADR-0008, amended 28 September 2026).
   */
  candidates: readonly Adr[]
  onCancel: () => void
  onConfirm: (successorId: string) => void
  s: Translate
}

export function SupersedeDialog({ target, candidates, onCancel, onConfirm, s }: SupersedeDialogProps) {
  const [successor, setSuccessor] = useState('')
  // Afresh for each record superseded, not for each render: the page builds
  // the candidates on every one, and following them sent the choice back to
  // the first record a second after it was made. A choice the list no
  // longer offers reads as the first one, so Confirm never names a record
  // the picker does not show.
  useFreshFor(target, (one) => one.id, () => setSuccessor(''))
  const chosen = candidates.some((adr) => adr.id === successor) ? successor : candidates[0]?.id ?? ''
  return (
    <Dialog
      open={Boolean(target)} size="m" title={s('adr.supersedeTitle')} onClose={onCancel}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { disabled: !chosen, onClick: () => onConfirm(chosen), label: s('adr.supersedeConfirm') },
      }}
    >
      <p>{s('adr.supersedeBody')}</p>
      {candidates.length === 0
        ? <p>{s('adr.noSuccessor')}</p>
        : (
          <SelectField
            label={s('adr.successor')} value={chosen} onChange={setSuccessor}
            options={candidates.map((adr) => ({ value: adr.id, label: `${formatAdrNumber(adr.number)} · ${adr.title}` }))}
          />
        )}
    </Dialog>
  )
}

export type ReasonDialogProps = {
  /** The record being rejected or withdrawn; the dialog is closed while undefined. */
  target?: Adr
  /** A proposal withdrawn, rather than a reviewed record rejected: the words differ, the move is the same. */
  withdraw: boolean
  /** Whether a reason must be given: always to withdraw, and to reject when no signer rejected it. */
  required: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
  s: Translate
}

/**
 * Why a record ends rejected. It keeps its number and is locked afterwards,
 * so the reason is the one thing a later reader has to go on.
 */
export function ReasonDialog({ target, withdraw, required, onCancel, onConfirm, s }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  useFreshFor(target, (one) => one.id, () => setReason(''))
  const ready = !required || reason.trim().length > 0
  const name = target ? `${formatAdrNumber(target.number)} ${target.title}` : ''
  return (
    <Dialog
      open={Boolean(target)} size="m" title={s(withdraw ? 'adr.withdrawTitle' : 'adr.rejectTitle', { name })} onClose={onCancel}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { disabled: !ready, onClick: () => onConfirm(reason.trim()), label: s(withdraw ? 'adr.withdraw' : 'adr.reject'), danger: true },
      }}
    >
      <p>{s(withdraw ? 'adr.withdrawBody' : 'adr.rejectBody')}</p>
      <TextField autoFocus rows={3} required={required} label={s('adr.reasonField')} value={reason} onChange={setReason} />
    </Dialog>
  )
}

/**
 * Acceptance confirms, naming what it supersedes on the way; rejection and
 * withdrawal ask why (ADR-0008, amended 28 September 2026). A reason is
 * required unless a reviewer's rejection already gives one.
 */
export function MoveDialogs({ accepting, rejecting, listOf, onAccept, onReject, onCancel, s }: {
  accepting?: Adr
  rejecting?: Adr
  /** The list a record sits in, where what it supersedes is found. */
  listOf: (adr: Adr) => readonly Adr[]
  onAccept: (adr: Adr) => void
  onReject: (adr: Adr, reason: string) => void
  onCancel: () => void
  s: Translate
}) {
  const replaced = (adr: Adr) => (adr.supersedes ?? [])
    .map((id) => listOf(adr).find((one) => one.id === id))
    .filter((one): one is Adr => one !== undefined && one.status === 'accepted')
    .map((one) => formatAdrNumber(one.number))
  const replacing = accepting ? replaced(accepting) : []
  return (
    <>
      <Dialog
        open={Boolean(accepting)} title={accepting ? s('adr.acceptTitle', { name: formatAdrNumber(accepting.number) }) : ''} onClose={onCancel}
        actions={{
          cancel: { onClick: onCancel, label: s('common.cancel') },
          outcome: { onClick: () => { if (accepting) onAccept(accepting) }, label: s('adr.accept') },
        }}
      >
        <p>{s('adr.acceptBody')}{replacing.length > 0 && ` ${s('adr.acceptSupersedes', { names: replacing.join(', ') })}`}</p>
      </Dialog>
      <ReasonDialog
        target={rejecting}
        withdraw={rejecting?.status === 'proposed'}
        required={rejecting ? !adrFieldItems(rejecting, 'rejected', listOf(rejecting)).every((one) => one.ok) : true}
        onCancel={onCancel}
        onConfirm={(reason) => { if (rejecting) onReject(rejecting, reason) }}
        s={s}
      />
    </>
  )
}

/** The number and the title: a person confirming a delete should not have to remember which record ADR-0007 was. */
export function DeleteDialog({ target, onCancel, onConfirm, s }: { target?: Adr; onCancel: () => void; onConfirm: () => void; s: Translate }) {
  return (
    <Dialog
      open={Boolean(target)} title={target ? s('adr.deleteTitle', { name: `${formatAdrNumber(target.number)} ${target.title}` }) : ''} onClose={onCancel}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { onClick: onConfirm, label: s('adr.delete'), danger: true },
      }}
    >
      <p>{s('adr.deleteBody')}</p>
    </Dialog>
  )
}
