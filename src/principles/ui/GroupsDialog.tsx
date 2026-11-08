// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Groups* (ADR-0041 §3): the scope's own ordered list, named, described and
 * ordered in advance, by dragging or by the arrows, which are the keyboard's way.
 * A group removed is taken off its principles, and none of them goes. A group is
 * also made on the spot from the editor's picker.
 */
import { useEffect, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { CloseIcon } from '../../widgets/icons'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextInput } from '../../widgets/kit/Field'
import type { PrincipleGroup } from '../principle'
import { usePrinciples } from './PrinciplesContext'

let made = 0

export function GroupsDialog({ open, scope, onClose }: { open: boolean; scope: string; onClose: () => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [list, setList] = useState<PrincipleGroup[]>([])
  const [dragged, setDragged] = useState<number | undefined>(undefined)
  useEffect(() => { if (open && access) setList([...access.own(scope).groups]) }, [open, access, scope])
  if (!access) return null
  const used = (id: string) => access.own(scope).principles.filter((one) => one.groups.includes(id) && !one.mergedInto).length
  const moveTo = (from: number, to: number) => setList((held) => {
    const next = [...held]
    const [one] = next.splice(from, 1)
    next.splice(to, 0, one!)
    return next
  })
  const set = (id: string, patch: Partial<PrincipleGroup>) => setList((held) => held.map((one) => (one.id === id ? { ...one, ...patch } : one)))
  return (
    <Dialog
      open={open} size="m" title={t('principles.groupsTitle')} onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { onClick: () => { access.setGroups(scope, list.filter((one) => one.name.trim())); onClose() }, 'data-testid': 'groups-save', label: t('principles.save') },
      }}
    >
      <p>{t('principles.groupsIntro')}</p>
      {list.map((group, index) => (
        <div
          key={group.id} className="guidance-form__group" data-testid={`group-${group.id}`} data-dragged={dragged === index || undefined} draggable
          onDragStart={() => setDragged(index)} onDragEnd={() => setDragged(undefined)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => { if (dragged !== undefined && dragged !== index) moveTo(dragged, index); setDragged(undefined) }}
        >
          <TextInput value={group.name} onChange={(event) => set(group.id, { name: event.target.value })} aria-label={t('principles.groupName')} />
          <TextInput value={group.description ?? ''} onChange={(event) => set(group.id, { description: event.target.value || undefined })} placeholder={t('principles.groupDescription')} aria-label={t('principles.groupDescription')} />
          <span className="guidance-read__quiet">{t('principles.groupCount', { count: used(group.id) })}</span>
          <IconButton label={t('principles.moveUp')} disabled={index === 0} onClick={() => moveTo(index, index - 1)}>↑</IconButton>
          <IconButton label={t('principles.moveDown')} disabled={index === list.length - 1} onClick={() => moveTo(index, index + 1)}>↓</IconButton>
          <IconButton label={t('principles.groupRemove')} onClick={() => setList((held) => held.filter((one) => one.id !== group.id))}><CloseIcon size={14} /></IconButton>
        </div>
      ))}
      <Button variant="quiet" onClick={() => { made += 1; setList((held) => [...held, { id: `grp-new-${Date.now()}-${made}`, name: '' }]) }} data-testid="group-add">{t('principles.groupAdd')}</Button>
    </Dialog>
  )
}
