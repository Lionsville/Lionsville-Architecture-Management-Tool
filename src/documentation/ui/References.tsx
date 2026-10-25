// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document refers to, for every editor and reader under the shell
 * (ADR-0043 §9, §10): the catalogue *Insert ▾* and the completion offer, and
 * how a `ref` fence is drawn — handed down once, because what it names (a
 * principle, an evaluation, a decision, an observation) is other modules'
 * and this one renders a description. With no provider, *Insert ▾* offers
 * what it always did and a `ref` fence shows its source.
 */
import { createContext, useContext, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { parseRef, refKind } from '../references'
import type { Referable, RefFields } from '../references'

export type ReferencesAccess = {
  /** Everything a document here may refer to, in the catalogue's words. */
  referables(): readonly Referable[]
  /** A `ref` fence drawn from the model as it is, or `undefined` where what it names is gone. */
  draw(fields: RefFields): ReactNode | undefined
}

const ReferencesContext = createContext<ReferencesAccess | undefined>(undefined)

export function ReferencesProvider({ value, children }: { value: ReferencesAccess | undefined; children: ReactNode }) {
  return <ReferencesContext.Provider value={value}>{children}</ReferencesContext.Provider>
}

export function useReferences(): ReferencesAccess | undefined {
  return useContext(ReferencesContext)
}

/** A ```ref fence: what it names, drawn as it stands; a line where it is gone; its source where nothing here can draw it. */
export function RefBlock({ code }: { code: string }) {
  const access = useReferences()
  const { t } = useStrings()
  const fields = parseRef(code)
  const kind = refKind(fields)
  const drawn = access && kind ? access.draw(fields) : undefined
  if (drawn !== undefined) return <Box component="span" data-testid={`ref-${kind}`} sx={{ display: 'block', my: '0.8em' }}>{drawn}</Box>
  if (!access) {
    return <Box component="code" data-testid="ref-source" sx={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '0.85em', color: 'text.secondary', my: '0.7em' }}>{code}</Box>
  }
  return (
    <Typography component="span" data-testid="ref-gone" sx={{ display: 'block', my: '0.7em', fontSize: '0.9em', color: 'text.secondary', fontStyle: 'italic', borderLeft: 3, borderColor: 'divider', pl: 1.5 }}>
      {t('doc.refGone', { what: kind ? `${kind}: ${fields[kind]}` : code.split('\n')[0] ?? '' })}
    </Typography>
  )
}
