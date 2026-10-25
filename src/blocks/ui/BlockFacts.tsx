// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an element's inspector says about building blocks (ADR-0043 §8):
 * on a building block, the way to its page — its requirements, its
 * solutions and where it is used are written there, not in the panel — and
 * on an element that is a solution a scope chose, *is <solution>, the
 * <block> chosen for <scope>*, linked to that scope's evaluation. Handed
 * in by the workspace; absent, the inspector says nothing about blocks.
 */
import { createContext, useContext, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import type { DesignElement } from '../../model/types'

/** One choice an element is the solution of, as the line says it. */
export type ChosenFact = { readonly block: string; readonly blockName: string; readonly sbb: string; readonly scope: string; readonly scopeName: string }

export type BlockFactsAccess = {
  /** Every scope's choice this element is the solution of. */
  chosenAs(element: string): readonly ChosenFact[]
  /** A block's page, on a scope's evaluation where one is named. */
  openBlock(block: string, evaluation?: string): void
}

const BlockFactsContext = createContext<BlockFactsAccess | undefined>(undefined)

export function BlockFactsProvider({ value, children }: { value: BlockFactsAccess | undefined; children: ReactNode }) {
  return <BlockFactsContext.Provider value={value}>{children}</BlockFactsContext.Provider>
}

export function BlockFacts({ element }: { element: Pick<DesignElement, 'id' | 'kind'> }) {
  const facts = useContext(BlockFactsContext)
  const { t } = useStrings()
  if (!facts) return null
  const chosen = facts.chosenAs(element.id)
  if (element.kind !== 'buildingBlock' && chosen.length === 0) return null
  return (
    <Box sx={{ fontSize: 13, display: 'grid', gap: 0.5 }} data-testid="block-facts">
      {element.kind === 'buildingBlock' && (
        <Typography sx={{ fontSize: 13 }}>
          {t('blocks.factBlock')}{' '}
          <Link component="button" type="button" onClick={() => facts.openBlock(element.id)} data-testid="block-facts-open">{t('blocks.factOpen')}</Link>
        </Typography>
      )}
      {chosen.map((one) => (
        <Typography key={`${one.scope}~${one.block}`} sx={{ fontSize: 13 }}>
          {t('blocks.factChosen', { sbb: one.sbb, block: one.blockName, scope: one.scopeName })}{' '}
          <Link component="button" type="button" onClick={() => facts.openBlock(one.block, one.scope)}>{t('blocks.factEvaluation')}</Link>
        </Typography>
      ))}
    </Box>
  )
}
