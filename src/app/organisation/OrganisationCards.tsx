/**
 * The organisation's own pages, as a row of cards.
 *
 * Four of them, and one of the four is not like the others. Business,
 * decisions and the roadmap are about the ROOT's own document and come from
 * {@link organisationPages}, which is one read of it; the register is about
 * the whole tree and comes from the index the shell already holds
 * (ADR-0012 §2). Neither is a load of its own, which is the point: a load per
 * card is the shape ADR-0004 keeps catching.
 *
 * Nothing here loads, and nothing here counts.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { STATUS_LABEL as ADR_STATUS_LABEL, formatAdrNumber } from '../../decisions'
import { CHECK_SENTENCE, PLAN_STATUS_LABEL } from '../../roadmap'
import { RELATION_LABEL } from '../../model'
import { DecisionIcon, RegisterIcon, SheetIcon, TimelineIcon } from '../../widgets/icons'
import type { OrganisationPages, StatusTally } from './organisationPages'
import type { RegisterSummary } from './register'

export type OrganisationCardsProps = {
  pages: OrganisationPages
  /** The root has been read at least once. Before that the cards say nothing. */
  ready: boolean
  /**
   * The register's own numbers (ADR-0012 §2).
   *
   * From the index rather than from a load, which is why this card can say
   * something about the WHOLE tree while the other three speak for the root's
   * own document: the index is one pass over every `model.json`, held by the
   * shell and already read.
   */
  register: RegisterSummary
  onOpenBusiness: () => void
  onOpenDecisions: () => void
  onOpenRoadmap: () => void
  onOpenRegister: () => void
  s: Translate
}

function OnePage({ icon, title, count, finding, action }: {
  icon: ReactNode
  title: string
  count?: string
  finding?: string
  action?: ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 200px', minWidth: 180, p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', minHeight: 16 }}>
        {count ?? ''}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', minHeight: 16, mb: 1 }}>
        {finding ?? ''}
      </Typography>
      {action}
    </Card>
  )
}

/** "3 accepted · 1 proposed", in the vocabulary's own order and without zeroes. */
function tallyLine<T extends string>(
  tally: StatusTally<T>, label: Record<T, Parameters<Translate>[0]>, s: Translate,
): string {
  return tally
    .map((one) => s('org.statusCount', { count: one.count, status: s(label[one.status]).toLowerCase() }))
    .join(' · ')
}

export function OrganisationCards({
  pages, ready, register, onOpenBusiness, onOpenDecisions, onOpenRoadmap, onOpenRegister, s,
}: OrganisationCardsProps) {
  // A fresh folder, and the shipped example's organisation until the sheet
  // moves up to it: one sentence on each card rather than four zeroes, which
  // read as a fault rather than as a beginning.
  const nothing = ready && pages.empty
  const quiet = { fontSize: 11, minWidth: 0, px: 1 } as const

  const businessCount = nothing ? s('org.nothingHere') : ready ? [
    plural(s, { one: 'org.journeysOne', other: 'org.journeysOther' }, pages.business.journeys),
    plural(s, { one: 'org.areasOne', other: 'org.areasOther' }, pages.business.areas),
    plural(s, { one: 'org.functionsOne', other: 'org.functionsOther' }, pages.business.functions),
    plural(s, { one: 'org.stakeholdersOne', other: 'org.stakeholdersOther' }, pages.business.stakeholders),
  ].join(' · ') : undefined

  const businessFinding = nothing || !ready
    ? undefined
    : pages.business.unmapped > 0
      ? plural(s, { one: 'org.unmappedOne', other: 'org.unmappedOther' }, pages.business.unmapped)
      : s('org.allMapped')

  const finding = pages.roadmap.finding

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, mb: 4 }} data-testid="organisation-cards">
      <OnePage
        icon={<SheetIcon />}
        title={s('org.business')}
        count={businessCount}
        finding={businessFinding}
        action={(
          <Button size="small" onClick={onOpenBusiness} sx={quiet} data-testid="open-business">
            {/* A scope with no sheet is not missing one; it has not been given
                one yet, and the word says which. */}
            {pages.business.sheetId ? s('picker.open') : s('org.businessMake')}
          </Button>
        )}
      />

      <OnePage
        icon={<DecisionIcon />}
        title={s('shell.decisions')}
        count={nothing ? s('org.nothingHere') : ready
          ? [
            plural(s, { one: 'org.recordsOne', other: 'org.recordsOther' }, pages.decisions.total),
            tallyLine(pages.decisions.byStatus, ADR_STATUS_LABEL, s),
          ].filter(Boolean).join(' · ')
          : undefined}
        finding={pages.decisions.latest
          ? s('org.latest', {
            name: `${formatAdrNumber(pages.decisions.latest.number)} ${pages.decisions.latest.title}`,
          })
          : undefined}
        action={(
          <Button size="small" onClick={onOpenDecisions} sx={quiet} data-testid="open-decisions">
            {s('picker.open')}
          </Button>
        )}
      />

      <OnePage
        icon={<TimelineIcon />}
        title={s('shell.roadmap')}
        count={nothing ? s('org.nothingHere') : ready
          ? [
            plural(s, { one: 'org.plansOne', other: 'org.plansOther' }, pages.roadmap.total),
            tallyLine(pages.roadmap.byStatus, PLAN_STATUS_LABEL, s),
          ].filter(Boolean).join(' · ')
          : undefined}
        finding={nothing || !ready
          ? undefined
          : finding
            ? s(CHECK_SENTENCE[finding.kind], {
              name: finding.name,
              detail: finding.detail ?? '',
              count: finding.count ?? 0,
              type: finding.relationType ? s(RELATION_LABEL[finding.relationType]) : '',
            })
            : s('org.noFindings')}
        action={(
          <Button size="small" onClick={onOpenRoadmap} sx={quiet} data-testid="open-roadmap">
            {s('picker.open')}
          </Button>
        )}
      />

      {/* The one card that is about the whole tree rather than about the
          root's own document — the register is derived over every scope
          (ADR-0012 §2), so its numbers come from the index and not from a
          load of its own. */}
      <OnePage
        icon={<RegisterIcon />}
        title={s('org.register')}
        count={[
          plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, register.applications),
          plural(s, { one: 'register.ownedOne', other: 'register.ownedOther' }, register.ownedByADomain),
          plural(s, { one: 'register.outsideOne', other: 'register.outsideOther' }, register.outside),
        ].join(' · ')}
        finding={[
          register.definedTwice > 0
            ? plural(s, { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther' }, register.definedTwice)
            : '',
          register.unattributed > 0
            ? plural(s, { one: 'register.unattributedOne', other: 'register.unattributedOther' }, register.unattributed)
            : '',
        ].filter(Boolean).join(' · ') || s('register.settled')}
        action={(
          <Button size="small" onClick={onOpenRegister} sx={quiet} data-testid="open-register">
            {s('picker.open')}
          </Button>
        )}
      />
    </Stack>
  )
}
