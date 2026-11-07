// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding carried to where it is fixed: its weight, its sentence, how to fix it,
 * how far through the check, and the way back to the check and the row you left.
 * Before this a finding opened the right scope and forgot why you came, so ten
 * findings of one check cost ten restarts from the top.
 *
 * It holds only which finding it is on and reads the rest afresh, off what the
 * Checks page reads (`useHomeChecks`), so it can see the finding clear and turn to
 * *Put right* without anybody going back to count. Mounted only while one is being
 * carried, because working out every finding has no place on an ordinary screen.
 */
import { useEffect, useMemo, useRef } from 'react'
import { CHECK_CATALOGUE } from '../../model/checkCatalogue'
import { flattenScopes } from '../../projects/scope'
import { scopeDisplayName } from '../../projects/scopeLabel'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { CloseIcon } from '../../widgets/icons'
import { Button, IconButton } from '../../widgets/kit/Button'
import { BandStack } from '../../widgets/kit/Band'
import type { StackedBand } from '../../widgets/kit/Band'
import { plural } from '../../i18n/strings'
import { useHomeChecks } from '../organisation/useHomeChecks'
import { walkable } from '../organisation/checksView'
import type { CheckInstance, CheckPlace } from '../organisation/treeChecks'
import type { ShellParts } from '../shellParts'
import type { Destination } from '../../agent/screen'
import type { FindingWalk, FrameStore } from './frameStore'

/** Where a finding opens, in the words an open takes. */
export function destinationOf(place: CheckPlace, home: ScopePath): Destination & { scope: string } {
  if ('person' in place) return { scope: home, page: 'people', select: place.person }
  if ('topic' in place) return { scope: ROOT_SCOPE, page: 'topics', id: place.topic }
  if ('home' in place) return { scope: place.home, page: 'home' }
  return { scope: place.scope, ...place.page } as Destination & { scope: string }
}

export function FindingBandStack({ walk, frame, parts, others }: {
  walk: FindingWalk; frame: FrameStore; parts: ShellParts; others: readonly StackedBand[]
}) {
  const { services: { s }, agent, findings, tree, organisation } = parts
  const open = agent.openSomewhere
  const everyScope = useMemo(() => flattenScopes(organisation.tree), [organisation.tree])
  const scopeName = useMemo(() => (path: ScopePath) => (path === ROOT_SCOPE ? s('common.organisation') : scopeDisplayName(path, everyScope, s('common.organisation'))), [everyScope, s])
  const treeRead = useMemo(() => ({ index: tree.index, models: tree.models }), [tree.index, tree.models])
  const checks = useHomeChecks({
    findings: findings.treeFindings, register: findings.register, technology: findings.technology, at: walk.home,
    root: organisation.root ? { path: organisation.at, model: organisation.root.model } : undefined, tree: treeRead,
    marks: tree.index.checkMarks(), people: parts.people, platformTree: findings.platformTree, today: parts.todayDay, scopeName, s,
  })
  const row = checks.rows.flatMap((one) => one.rows).find((one) => one.key === walk.check)
  const ways = row ? walkable(row) : []
  const at = ways.findIndex((one) => one.id === walk.id)
  const here = at >= 0 ? ways[at] : undefined
  const go = (instance: CheckInstance | undefined) => {
    if (!instance?.opens) return
    frame.set({ finding: { ...walk, id: instance.id } })
    open(destinationOf(instance.opens, walk.home))
  }
  const back = () => {
    frame.set({ finding: undefined })
    open({ scope: walk.home, page: 'checks', id: walk.check, select: walk.id })
  }
  const dismiss = () => frame.set({ finding: undefined })
  // Back on the Checks page by any way, Back included, there is nothing left to carry.
  const screen = agent.screen ?? agent.screenNow()
  const onChecks = screen.page?.page === 'checks'
  const left = useRef(false)
  useEffect(() => {
    if (!onChecks) left.current = true
    else if (left.current) frame.set({ finding: undefined })
  }, [onChecks, frame])
  if (onChecks) return <BandStack bands={others} />
  const entry = CHECK_CATALOGUE[walk.check]
  const close = <IconButton label={s('checks.band.dismiss')} size="small" onClick={dismiss}><CloseIcon size={12} /></IconButton>
  const band: StackedBand = here
    ? {
      id: 'finding', tone: 'finding', mark: entry.weight, title: here.text, detail: s(entry.how),
      position: {
        at: at + 1, total: ways.length,
        ...(at > 0 ? { onPrevious: () => go(ways[at - 1]) } : {}),
        ...(at < ways.length - 1 ? { onNext: () => go(ways[at + 1]) } : {}),
      },
      action: <><Button size="small" onClick={back} data-testid="finding-back">{s('checks.band.back')}</Button>{close}</>,
    }
    : {
      id: 'finding', tone: 'finding', mark: 'agree', title: s('checks.band.done'),
      detail: ways.length > 0 ? plural(s, { one: 'checks.band.moreOne', other: 'checks.band.moreOther' }, ways.length) : s('checks.band.none'),
      action: (
        <>
          {ways[0] && <Button size="small" onClick={() => go(ways[0])} data-testid="finding-next">{s('checks.band.next')}</Button>}
          <Button size="small" onClick={back} data-testid="finding-back">{s('checks.band.back')}</Button>
          {close}
        </>
      ),
    }
  return <BandStack bands={[...others.filter((one) => one.tone === 'agent'), band, ...others.filter((one) => one.tone !== 'agent')]} />
}
