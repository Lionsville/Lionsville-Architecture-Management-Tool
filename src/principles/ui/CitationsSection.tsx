// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The *Principles* section on every citable reader (ADR-0041): what the
 * record cites and with which stance, *Cite…*, and *May apply* — the
 * principles in force here whose words the record shares, or that other
 * records about the same subject cite, each with what matched. One line per
 * citation, the number written `PR-0001.2` where an aspect is cited.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { CloseIcon } from '../../widgets/icons'
import { CITABLE, formatAspectNumber, formatPrincipleNumber } from '../principle'
import type { Citation, CitationStance, CitingKind, CitingRecord, PrincipleRef } from '../principle'
import { suggestPrinciples } from '../suggest'
import type { Suggestion } from '../suggest'
import { CiteDialog } from './CiteDialog'
import { usePrinciples } from './PrinciplesContext'
import type { PrinciplesAccess } from './PrinciplesContext'
import { STANCE_WORD } from './words'

export function CitationsSection({ about, subject, readOnly = false }: {
  about: { kind: CitingKind; id: string }
  /** What the record says, for *May apply*: its title and body. */
  subject: string
  readOnly?: boolean
}) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [citing, setCiting] = useState<{ ref?: PrincipleRef; aspect?: number; stance?: CitationStance } | undefined>(undefined)
  const here = access?.here ?? ''
  const version = access?.version ?? 0
  const citations = useMemo(() => access?.citationsOf(about, here) ?? [], [access, about, here, version])
  const suggestions = useMemo(() => (access ? suggestPrinciples({
    text: subject, inForce: access.inForce(here), citedNearby: access.citedNearby(about, here),
    alreadyCited: citations.map((one) => one.principle), limit: 3,
  }) : []), [access, subject, here, about, citations, version])
  if (!access) return null
  const quickStance = CITABLE[about.kind][0]!
  return (
    <Box data-testid="citations-section" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>{t('principles.sectionTitle')}</Typography>
        {!readOnly && (
          <Button size="small" onClick={() => setCiting({})} data-testid="cite-open">{t('principles.cite')}</Button>
        )}
      </Box>
      {citations.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{t('principles.citesNone')}</Typography>
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {citations.map((citation) => (
          <CitationLine key={citation.id} citation={citation} access={access} readOnly={readOnly} />
        ))}
      </Box>
      {!readOnly && suggestions.length > 0 && (
        <Box data-testid="may-apply" sx={{ mt: 1.5, p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>{t('principles.mayApply')}</Typography>
          {suggestions.map((one) => (
            <SuggestionLine
              key={`${one.ref.scope}/${one.ref.id}`} suggestion={one} access={access} quickStance={quickStance}
              onQuick={() => access.cite({ about, scope: here, principle: one.ref, ...(one.aspect ? { aspect: one.aspect.number } : {}), stance: quickStance })}
              onCite={() => setCiting({ ref: one.ref, ...(one.aspect ? { aspect: one.aspect.number } : {}) })}
            />
          ))}
        </Box>
      )}
      {citing && (
        <CiteDialog
          open about={about as CitingRecord} here={here} initial={citing} onClose={() => setCiting(undefined)}
        />
      )}
    </Box>
  )
}

function principleLabel(access: PrinciplesAccess, ref: PrincipleRef, aspect: number | undefined): { number: string; title: string; gone: boolean } {
  const found = access.find(ref)
  if (!found) return { number: '—', title: '', gone: true }
  const { principle } = found
  return {
    number: aspect !== undefined ? formatAspectNumber(principle.number, aspect) : formatPrincipleNumber(principle.number),
    title: principle.title,
    gone: false,
  }
}

function CitationLine({ citation, access, readOnly }: { citation: Citation; access: PrinciplesAccess; readOnly: boolean }) {
  const { t } = useStrings()
  const label = principleLabel(access, citation.principle, citation.aspect)
  const found = access.find(citation.principle)
  const predates = found?.principle.sharpened?.some((one) => one.on > citation.on)
  const from = access.sourceOf(access.here, citation.principle.scope)
  return (
    <Box component="li" data-testid={`citation-${citation.id}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', fontSize: 14 }}>
      <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{label.number}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {label.gone ? (
          <Typography component="span" color="warning.main" sx={{ fontSize: 13 }}>{t('principles.citationGone')}</Typography>
        ) : access.open ? (
          <Link component="button" type="button" underline="hover" onClick={() => access.open?.(citation.principle)} sx={{ textAlign: 'left', fontSize: 14 }}>{label.title}</Link>
        ) : label.title}
        {from.kind !== 'here' && (
          <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {from.kind === 'topic' ? t('principles.fromTopic', { scope: access.scopeLabel(from.scope) }) : t('principles.from', { scope: access.scopeLabel(from.scope) })}
          </Typography>
        )}
        {citation.reason && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{citation.reason}</Typography>}
        {predates && <Typography sx={{ fontSize: 11, color: 'text.secondary', fontStyle: 'italic' }}>{t('principles.predates')}</Typography>}
      </Box>
      <Typography component="span" sx={{ fontSize: 12, color: citation.stance === 'deviates' || citation.stance === 'chafes' ? 'warning.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
        {t(STANCE_WORD[citation.stance])}
      </Typography>
      {!readOnly && (
        <Tooltip title={t('principles.uncite')}>
          <IconButton size="small" aria-label={t('principles.uncite')} onClick={() => access.uncite(citation.scope, citation.id)}><CloseIcon size={14} /></IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

function SuggestionLine({ suggestion, access, quickStance, onQuick, onCite }: {
  suggestion: Suggestion; access: PrinciplesAccess; quickStance: CitationStance; onQuick: () => void; onCite: () => void
}) {
  const { t } = useStrings()
  const { principle, aspect, matched, why } = suggestion
  const number = aspect ? formatAspectNumber(principle.number, aspect.number) : formatPrincipleNumber(principle.number)
  const reason = why === 'subject'
    ? t('principles.whySubject')
    : t('principles.whyWords', { words: matched.slice(0, 4).join(', ') })
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25, fontSize: 13 }} data-testid={`may-apply-${principle.id}`}>
      <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>{number}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {access.open
          ? <Link component="button" type="button" underline="hover" onClick={() => access.open?.(suggestion.ref)} sx={{ textAlign: 'left', fontSize: 13 }}>{principle.title}</Link>
          : principle.title}
        <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>{reason}</Typography>
      </Box>
      <Button size="small" onClick={onQuick} sx={{ fontSize: 11, minWidth: 0, px: 0.75 }}>{t(STANCE_WORD[quickStance])}</Button>
      <Button size="small" onClick={onCite} sx={{ fontSize: 11, minWidth: 0, px: 0.75 }}>{t('principles.citeMore')}</Button>
    </Box>
  )
}
