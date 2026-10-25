// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One principle (ADR-0041): its statement, its aspects as a plain numbered
 * list, how it is used — cited, departed from, tested — its relations, and,
 * folded, the rest: rationale, implications, keywords and its changes.
 * Fixed or flexible is said once, in words.
 */
import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { formatDay } from '../../i18n/dates'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { formatAspectNumber, formatPrincipleNumber, mayRemove, principleUse } from '../principle'
import type { PrincipleRef, PrincipleRelationKind } from '../principle'
import type { PrincipleInForce } from '../suggest'
import { MergeDialog } from './MergeDialog'
import { CommentThread } from '../../comments/ui/threadPart'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { usePrinciples } from './PrinciplesContext'
import { NATURE_WORD, REGIME_SENTENCE, STANCE_WORD, STATUS_WORD } from './words'

const MONO = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' } as const

export function PrincipleReader({ found, here, onEdit, onPick }: {
  found: PrincipleInForce
  here: string
  onEdit: () => void
  onPick: (ref: PrincipleRef) => void
}) {
  const access = usePrinciples()
  const { t, language } = useStrings()
  const day = (date: string) => formatDay(date, language)
  const [showUse, setShowUse] = useState(false)
  const [merging, setMerging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [refused, setRefused] = useState(false)
  const { principle, scope } = found
  const ref = { scope, id: principle.id }
  const version = access?.version ?? 0
  const citations = useMemo(() => access?.citationsTo(ref) ?? [], [access, scope, principle.id, version])
  if (!access) return null
  const from = access.sourceOf(here, scope)
  const use = principleUse(ref, citations)
  const setStatus = (status: 'candidate' | 'accepted' | 'retired') => access.setStatus(scope, principle.id, status)
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: 4, py: 3 }} data-testid="principle-reader">
      <ReaderHeading found={found} here={here} />
      {access.mayWrite(scope) && <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={onEdit} data-testid="principle-edit">{t('principles.edit')}</Button>
        {principle.status === 'candidate' && <Button size="small" onClick={() => setStatus('accepted')} data-testid="principle-accept">{t('principles.accept')}</Button>}
        {principle.status === 'accepted' && <Button size="small" onClick={() => setStatus('retired')}>{t('principles.retire')}</Button>}
        {principle.status === 'retired' && <Button size="small" onClick={() => setStatus('accepted')}>{t('principles.restore')}</Button>}
        <Button size="small" onClick={() => setMerging(true)}>{t('principles.merge')}</Button>
        <Button size="small" color="error" onClick={() => (mayRemove(principle, scope, citations) ? setRemoving(true) : setRefused(true))}>{t('principles.remove')}</Button>
      </Box>}
      {refused && (
        <Alert severity="warning" sx={{ mt: 1.5 }} onClose={() => setRefused(false)} action={principle.status !== 'retired' ? <Button size="small" onClick={() => { setStatus('retired'); setRefused(false) }}>{t('principles.retire')}</Button> : undefined}>
          {t('principles.removeRefused', { count: citations.length })}
        </Alert>
      )}

      <Box sx={{ fontSize: 16, mt: 2.5 }} data-document><MarkdownView markdown={principle.statement} /></Box>

      {principle.aspects.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('principles.aspects')}</Typography>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} data-testid="principle-aspects">
            {principle.aspects.map((aspect) => (
              <Box component="li" key={aspect.id} sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                <Box component="span" sx={MONO}>{formatAspectNumber(principle.number, aspect.number)}</Box>
                <Box>
                  <Typography sx={{ fontSize: 14 }}>{aspect.text}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {[t(NATURE_WORD[aspect.nature]), aspect.signal && t('principles.signal', { signal: aspect.signal }), aspect.steering && t('principles.steering', { steering: aspect.steering })].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('principles.use')}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 14 }} data-testid="principle-use">
          {t('principles.useLine', { cited: use.cited, departed: use.departed, tested: use.tested })}
          {use.tested > 0 && ` ${t('principles.useTested', { holds: use.holds, chafes: use.chafes, missing: use.missing })}`}
        </Typography>
        {citations.length > 0 && <Button size="small" onClick={() => setShowUse((was) => !was)} sx={{ fontSize: 11, minWidth: 0, px: 0.75, py: 0 }}>{showUse ? t('principles.hide') : t('principles.show')}</Button>}
      </Box>
      {showUse && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0 }} data-testid="principle-citations">
          {citations.map((citation) => (
            <Box component="li" key={citation.id} sx={{ display: 'flex', gap: 1.5, py: 0.25, fontSize: 13, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ flex: 1 }}>
                {access.openRecord
                  ? <Link component="button" type="button" underline="hover" onClick={() => access.openRecord?.(citation)} sx={{ fontSize: 13, textAlign: 'left' }}>{access.recordLabel(citation)}</Link>
                  : access.recordLabel(citation)}
                {citation.aspect !== undefined && <Box component="span" sx={{ ...MONO, ml: 1 }}>{formatAspectNumber(principle.number, citation.aspect)}</Box>}
                {citation.reason && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{citation.reason}</Typography>}
              </Box>
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{t(STANCE_WORD[citation.stance])}</Box>
            </Box>
          ))}
        </Box>
      )}

      <Relations found={found} onPick={onPick} />

      {(principle.sharpened ?? []).length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('principles.sharpenedHeading')}</Typography>
          {principle.sharpened!.map((one, index) => (
            <Typography key={index} sx={{ fontSize: 13 }}><Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>{day(one.on)}</Box>{one.note}</Typography>
          ))}
        </>
      )}

      <Box component="details" sx={{ mt: 3, '& summary': { cursor: 'pointer', fontSize: 13, color: 'text.secondary' } }}>
        <summary>{t('principles.folded')}</summary>
        <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
          <Folded heading={t('principles.rationale')} text={principle.rationale} />
          <Folded heading={t('principles.implications')} text={principle.implications} />
          <Folded heading={t('principles.keywords')} text={(principle.keywords ?? []).join(', ')} />
          <RecordChanges about={{ kind: 'principle', id: principle.id }} scope={scope} first="proposed" defaultOpen />
        </Box>
      </Box>

      {/* Its thread where it is kept; a principle from above is commented on there (ADR-0037). */}
      {from.kind === 'here' && <Box sx={{ mt: 3 }}><CommentThread about={{ kind: 'principle', id: principle.id }} /></Box>}
      {merging && <MergeDialog open scope={scope} into={principle} onClose={() => setMerging(false)} />}
      <ConfirmDialog
        open={removing}
        title={t('principles.removeTitle', { number: formatPrincipleNumber(principle.number) })}
        body={t('principles.removeBody')}
        confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        onCancel={() => setRemoving(false)}
        onConfirm={() => { setRemoving(false); access.remove(scope, principle.id) }}
      />
    </Box>
  )
}

/** Where a principle stands: its number and groups, where it comes from, its title, its status and regime, and a candidate's question. */
function ReaderHeading({ found, here }: { found: PrincipleInForce; here: string }) {
  const access = usePrinciples()
  const { t, language } = useStrings()
  if (!access) return null
  const { principle, scope, groups } = found
  const groupNames = groups.filter((group) => principle.groups.includes(group.id)).map((group) => group.name)
  const from = access.sourceOf(here, scope)
  const statusLine = [
    principle.status === 'accepted' && principle.acceptedOn ? t('principles.acceptedOn', { date: formatDay(principle.acceptedOn, language) }) : t(STATUS_WORD[principle.status]),
    t(REGIME_SENTENCE[principle.regime]),
  ].join(' · ')
  const fromWords = from.kind === 'here' ? '' : ` · ${t(from.kind === 'topic' ? 'principles.fromTopic' : 'principles.from', { scope: access.scopeLabel(from.scope) })}`
  return (
    <>
      <Typography variant="overline" color="text.secondary">{[formatPrincipleNumber(principle.number), ...groupNames].join(' · ')}{fromWords}</Typography>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mt: 0.5 }}>{principle.title}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }} data-testid="principle-status">{statusLine}</Typography>
      {principle.status === 'candidate' && principle.question && (
        <Alert severity="info" sx={{ mt: 1.5, py: 0.25 }}>{t('principles.question', { question: principle.question })}</Alert>
      )}
    </>
  )
}

function Folded({ heading, text }: { heading: string; text: string | undefined }) {
  const { t } = useStrings()
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{heading}</Typography>
      {text?.trim() ? <Box sx={{ fontSize: 14 }}><MarkdownView markdown={text} /></Box> : <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('common.empty')}</Typography>}
    </Box>
  )
}

/** *In tension with* and *Refines*: to a principle here or above, added and taken off here. */
function Relations({ found, onPick }: { found: PrincipleInForce; onPick: (ref: PrincipleRef) => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<PrincipleRelationKind>('tension')
  const [to, setTo] = useState('')
  if (!access) return null
  const { principle, scope } = found
  const relations = principle.relations ?? []
  const candidates = access.inForce(scope).filter((one) => !(one.scope === scope && one.principle.id === principle.id) && !one.principle.mergedInto)
  const word = (relation: PrincipleRelationKind) => (relation === 'tension' ? t('principles.inTensionWith') : t('principles.refines'))
  return (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3 }}>{t('principles.related')}</Typography>
      {relations.length === 0 && !adding && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('principles.relatedNone')}</Typography>}
      {relations.map((relation, index) => {
        const other = access.find(relation.to)
        return (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', fontSize: 14 }}>
            <Box component="span">{word(relation.kind)}</Box>
            {other ? (
              <Link component="button" type="button" underline="hover" onClick={() => onPick(relation.to)} sx={{ fontSize: 14 }}>
                {formatPrincipleNumber(other.principle.number)} {other.principle.title}
              </Link>
            ) : <Box component="span" sx={{ color: 'warning.main' }}>{t('principles.citationGone')}</Box>}
            {access.mayWrite(scope) && <Button size="small" onClick={() => access.unrelate(scope, principle.id, relation)} sx={{ fontSize: 11, minWidth: 0, px: 0.5 }}>{t('principles.unrelate')}</Button>}
          </Box>
        )
      })}
      {adding ? (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
          <TextField select size="small" value={kind} onChange={(event) => setKind(event.target.value as PrincipleRelationKind)} sx={{ width: 170 }}>
            <MenuItem value="tension">{t('principles.inTensionWith')}</MenuItem>
            <MenuItem value="refines">{t('principles.refines')}</MenuItem>
          </TextField>
          <TextField select size="small" value={to} onChange={(event) => setTo(event.target.value)} sx={{ flex: 1 }} label={t('principles.principleField')}>
            {candidates.map((one) => <MenuItem key={`${one.scope}/${one.principle.id}`} value={`${one.scope}\u0000${one.principle.id}`}>{formatPrincipleNumber(one.principle.number)} {one.principle.title}</MenuItem>)}
          </TextField>
          <Button size="small" variant="contained" disabled={!to} onClick={() => {
            const [toScope, toId] = to.split('\u0000') as [string, string]
            access.relate(scope, principle.id, { kind, to: { scope: toScope, id: toId } })
            setAdding(false); setTo('')
          }}>{t('principles.relateAdd')}</Button>
          <Button size="small" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
        </Box>
      ) : access.mayWrite(scope) && (
        <Button size="small" onClick={() => setAdding(true)} sx={{ mt: 0.5 }}>{t('principles.relate')}</Button>
      )}
    </>
  )
}
