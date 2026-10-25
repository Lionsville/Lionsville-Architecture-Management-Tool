// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Building blocks* (ADR-0043 §8): on the organisation's home, how many there
 * are in the organisation; on any other home that keeps or evaluates one,
 * how many it keeps and how many it evaluates — and the way into the
 * register over that home. A home that has none says nothing about them.
 */
import Button from '@mui/material/Button'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { useBlocks } from '../../blocks/ui/BlocksContext'
import { ROOT_SCOPE } from '../../projects/scopePath'
import { RegisterIcon } from '../../widgets/icons'
import { OnePage } from './OrganisationCards'

export function BlocksCard({ at, onOpen, s }: { at: string; onOpen: () => void; s: Translate }) {
  const access = useBlocks()
  if (!access) return null
  const all = access.blocks().length
  const { kept, evaluated } = access.blocksAt(at)
  if (at !== ROOT_SCOPE && kept.length + evaluated.length === 0) return null
  const count = at === ROOT_SCOPE
    ? (all > 0 ? plural(s, { one: 'homeBlocks.countAllOne', other: 'homeBlocks.countAll' }, all) : s('homeBlocks.none'))
    : s('homeBlocks.countHere', { kept: kept.length, evaluated: evaluated.length })
  return (
    <OnePage
      icon={<RegisterIcon />}
      title={s('homeBlocks.card')}
      description={s('homeBlocks.describe')}
      count={count}
      action={(
        <Button size="small" onClick={onOpen} sx={{ fontSize: 11, minWidth: 0, px: 1, whiteSpace: 'nowrap' }} data-testid="open-block-register" data-guide="org.card.blocks" aria-label={s('picker.openNamed', { name: s('homeBlocks.card') })}>
          {s('picker.open')}
        </Button>
      )}
    />
  )
}
