// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Asking why, one rung at a time, in a panel beside the records it is about.
 *
 * It replaces a dialog that wanted the ending first and took one record at a time,
 * which is why the chain was left unused. So the question is a single field, for one
 * record or a group, since one cause explains many: strength and *assumed* take their
 * defaults and say so, and nothing asks whether it is a root yet. The next rung is
 * *And why is that?*, and a root cause is decided at the end, when nobody can go
 * deeper. *Stop here* is honest: it leaves an open end on the Why list. For a bright
 * spot the same ladder reads *Why does this work?*
 *
 * **One press is one step**: the cause and every link. What it makes lands where the
 * records live, here or in a scope below, as that scope's step.
 */
import { useState } from 'react'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { TextField } from '../../widgets/kit/Field'
import { Panel } from '../../widgets/kit/Panel'
import type { MakeId } from '../../model/keys'
import {
  causeLabel, formatCauseNumber, isRootCause, linkCause, linkRefusal, liveCauses, nextCauseNumber, toneOf,
} from '../observation'
import type { Cause, CauseStrength, LinkContext, Observation, ScopeAnalysis } from '../observation'
import { addCauseLinked } from '../form'
import { similarTitles } from '../wording'
import { nodeKey } from '../graph'
import { STRENGTH_LABEL } from '../observationScope'
import type { ObservationWork } from './ObservationsPage'
import type { LadderAsk } from './useAnalysisForms'
import { StrengthSelect } from './FormParts'

export type WhyLadderProps = {
  ask: LadderAsk
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  context: LinkContext
  scopeName: string
  scopeLabel: (path: string) => string
  makeId: MakeId
  s: Translate
  /** Absent where nothing may be written. A change to one scope's causes, and what follows once it has landed. */
  write?: (scope: string | undefined, change: (causes: Cause[]) => Cause[], landed: () => void) => void
  rootStep: (id: string, scope?: string) => { onRoot?: () => void; rootRefused?: string }
  nameOf: (id: string, scope?: string) => string
  onPropose?: ((causeId: string) => void) | undefined
  onNext: (ask: LadderAsk) => void
  onSelect: (key: string) => void
  onClose: () => void
}

/** What a group may be linked to: a live cause each of them can take, whichever rung this is. */
function candidatesFor(causes: readonly Cause[], ask: LadderAsk, context: LinkContext, scoped: boolean): Cause[] {
  const allowed = (cause: Cause) => ask.ids.every((id) => (
    id !== cause.id && !cause.explains.some((link) => link.id === id && link.scope === undefined)
    && linkRefusal(causes, cause.id, { id }, scoped ? undefined : context) === undefined
  ))
  return liveCauses(causes).filter(allowed)
}

export function WhyLadder(props: WhyLadderProps) {
  const { ask, work, below, s, write } = props
  const { scope } = ask
  const lists: { observations: readonly Observation[]; causes: readonly Cause[] } = scope === undefined ? work : below.find((one) => one.scope === scope) ?? { observations: [], causes: [] }
  const count = ask.ids.length
  const first = ask.ids[0]
  const about = ask.mode === 'cause' ? lists.observations.find((one) => one.id === first) : undefined
  const aboutCause = ask.mode === 'deeper' ? lists.causes.find((one) => one.id === first) : undefined
  const bright = ask.mode === 'cause' && ask.ids.every((id) => {
    const one = lists.observations.find((held) => held.id === id)
    return one !== undefined && toneOf(one) === 'bright'
  })
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('normal')
  const [root, setRoot] = useState(false)
  const [missing, setMissing] = useState(false)
  const [picking, setPicking] = useState(ask.existing === true)
  const [refused, setRefused] = useState<string | undefined>(undefined)

  const where = scope === undefined ? props.scopeName : props.scopeLabel(scope)
  const madeAs = formatCauseNumber(nextCauseNumber(lists.causes), root)
  const candidates = candidatesFor(lists.causes, ask, props.context, scope !== undefined)
  const alike = title.trim().length >= 6 ? similarTitles(title, candidates) : []

  const question = ask.mode === 'deeper' ? s('observation.andWhy')
    : count > 1 ? (bright ? s('observation.askWhyBrightMany', { count }) : s('observation.askWhyMany', { count }))
      : bright ? s('observation.askWhyBright') : s('observation.askWhy')
  const subject = about?.title ?? aboutCause?.title ?? ''
  const code = aboutCause ? causeLabel(aboutCause) : s('observation.ladderKind')

  /** The cause made or chosen is the next rung, unless it is a root, which ends the chain. */
  const rungOn = (id: string, isRoot: boolean) => {
    if (isRoot) { props.onSelect(nodeKey(id, scope)); props.onClose(); return }
    props.onNext({ mode: 'deeper', ids: [id], ...(scope !== undefined ? { scope } : {}) })
  }
  const add = () => {
    const words = title.trim()
    if (!words) { setMissing(true); return }
    const id = props.makeId('ca')
    write?.(scope, (causes) => {
      let list = addCauseLinked(causes, {
        draft: { title: words, why: why.trim(), root, strength }, explains: { id: first }, behind: [], id, t: s,
      })
      for (const other of ask.ids.slice(1)) list = linkCause(list, id, { id: other, strength })
      return list
    }, () => rungOn(id, root))
  }
  const use = (cause: Cause) => {
    write?.(scope, (causes) => ask.ids.reduce((list, id) => linkCause(list, cause.id, { id, strength }), causes), () => rungOn(cause.id, isRootCause(cause)))
  }
  const step = aboutCause && !isRootCause(aboutCause) ? props.rootStep(aboutCause.id, scope) : undefined
  const makeRoot = () => {
    if (step?.rootRefused) { setRefused(step.rootRefused); return }
    step?.onRoot?.()
    props.onClose()
  }
  const addLabel = ask.mode === 'deeper' ? s('observation.ladderAddDeeper')
    : count > 1 ? s('observation.ladderAddMany', { count }) : s('observation.ladderAdd')

  return (
    <Panel kind={code} name={question} wide onClose={props.onClose} dataGuide="observations.ladder">
      <div className="chain-form" data-testid="why-ladder">
        <p className="chain-note">
          {count > 1 ? s('observation.ladderGroup', { count, scope: where }) : subject}
        </p>
        {write && !picking && (
          <>
            <TextField
              label={s('observation.ladderField')} value={title} onChange={(value) => { setTitle(value); setMissing(false) }}
              hint={s('observation.causeTitleExample')} {...(missing ? { error: s('observation.causeTitleMissing') } : {})}
              autoFocus data-testid="ladder-title"
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
            />
            {alike.length > 0 && (
              <div className="chain-alike" data-testid="ladder-alike">
                <div className="chain-alike__said">{s('observation.causeAlike')}</div>
                {alike.map((one) => (
                  <div key={one.id} className="chain-alike__row">
                    <span>{causeLabel(one)} {one.title}</span>
                    <Button size="small" onClick={() => use(one)}>{s('observation.causeUse')}</Button>
                  </div>
                ))}
              </div>
            )}
            <p className="chain-note" data-testid="ladder-made-as">
              {s('observation.ladderMadeAs', { label: madeAs, strength: s(STRENGTH_LABEL[strength]).toLowerCase() })}
            </p>
            <details className="chain-more">
              <summary>{s('observation.ladderMore')}</summary>
              <div className="chain-form">
                <TextField label={s('observation.causeWhy')} rows={3} value={why} onChange={setWhy} hint={s('observation.causeWhyExample')} />
                <StrengthSelect value={strength} onChange={setStrength} label={s('observation.causeStrength')} helperText={s('observation.causeStrengthExample')} s={s} />
                <label className="chain-check">
                  <input type="checkbox" checked={root} onChange={(event) => setRoot(event.target.checked)} data-testid="ladder-root" />
                  {s('observation.causeRoot')}
                </label>
              </div>
            </details>
            <div className="chain-form__foot">
              <Button variant="primary" onClick={add} data-testid="ladder-add" data-guide="observations.newCause">{addLabel}</Button>
              {candidates.length > 0 && <Button onClick={() => setPicking(true)} data-testid="ladder-existing">{s('observation.linkExistingOne')}</Button>}
              {step && (step.onRoot || step.rootRefused) && <Button onClick={makeRoot} data-testid="ladder-is-root">{s('observation.thisIsRoot')}</Button>}
              <Button variant="quiet" onClick={props.onClose} data-testid="ladder-stop">{ask.mode === 'deeper' ? s('observation.ladderStop') : s('common.cancel')}</Button>
            </div>
            {refused && <p className="chain-form__refused" role="alert" data-testid="ladder-refused">{refused}</p>}
            <p className="chain-form__said">{ask.mode === 'deeper' ? s('observation.ladderRootSaid') : s('observation.ladderOneStep')}</p>
          </>
        )}
        {write && picking && (
          <>
            {candidates.length === 0 && <p className="chain-note">{s('observation.linkNone')}</p>}
            <ul className="chain-pick" data-testid="ladder-candidates">
              {candidates.map((one) => (
                <li key={one.id}>
                  <button type="button" onClick={() => use(one)} data-testid={`ladder-candidate-${one.id}`}>
                    <span className="chain-pick__code">{causeLabel(one)}</span> {one.title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="chain-form__foot">
              <Button variant="quiet" onClick={() => setPicking(false)} data-testid="ladder-write-new">{s('observation.ladderWriteNew')}</Button>
              <Button variant="quiet" onClick={props.onClose}>{s('common.cancel')}</Button>
            </div>
          </>
        )}
        {aboutCause && isRootCause(aboutCause) && props.onPropose && (
          <Button variant="primary" onClick={() => props.onPropose?.(aboutCause.id)}>{s('observation.actSolution')}</Button>
        )}
      </div>
    </Panel>
  )
}
