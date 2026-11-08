// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The same rows as a table, nothing at rest to hover for: applications down,
 * what they use across, each heading with what delivers it. A press selects,
 * and Space writes, as everywhere a matrix writes: reading a row must not
 * change the model.
 */
import { useMemo } from 'react'
import type { ElementId } from '../../model'
import { nodeKey, platformList, serviceList } from '../../model/technologyLandscape'
import type { LandscapeApplication, NodeKey, TechnologyLandscape } from '../../model/technologyLandscape'
import { useStrings } from '../../i18n'
import { KeyStrip } from '../../widgets/kit/KeyStrip'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell, MatrixPick } from '../../widgets/kit/Matrix'

const COUNTS = '__counts'

export function LandscapeMatrix({ landscape, selected, onSelect, onToggle }: {
  landscape: TechnologyLandscape
  selected: NodeKey | undefined
  onSelect(key: NodeKey): void
  /** Absent for a reader: the matrix then has no key that writes. */
  onToggle: ((applicationId: ElementId, targetId: ElementId, on: boolean) => void) | undefined
}) {
  const { t } = useStrings()
  const apps = useMemo(() => landscape.groups.flatMap((group) => group.applications), [landscape.groups])
  const byId = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps])
  const platforms = useMemo(() => platformList(landscape), [landscape])
  const nameOfPlatform = useMemo(() => new Map(platforms.map(({ node }) => [node.id, node.name])), [platforms])
  const bound = useMemo(() => new Set(apps.flatMap((app) => app.binds)), [apps])
  const services = useMemo(() => serviceList(landscape), [landscape])
  const columns = useMemo(() => [
    ...services.map(({ node }) => ({
      id: node.id,
      label: [node.name, node.realisedBy.map((id) => nameOfPlatform.get(id) ?? id).join(', ') || t('landscape.noPlatform')].join(' · '),
    })),
    // A platform an application binds to directly has a column of its own, or that use would be nowhere on this page.
    ...platforms.filter(({ node }) => bound.has(node.id)).map(({ node }) => ({ id: node.id, label: node.name })),
  ], [services, platforms, bound, nameOfPlatform, t])
  const standing = (id: ElementId) => apps.filter((app) => app.uses.includes(id) || app.implied.includes(id) || app.binds.includes(id)).length

  const cellOf = (row: string, column: string): MatrixCell | null => {
    if (row === COUNTS) {
      const count = standing(column)
      return count > 0 ? { show: count, meaning: t('landscape.matrixCount', { count }), tone: 'plain' } : null
    }
    const app = byId.get(row)
    if (!app) return null
    if (app.uses.includes(column) || app.binds.includes(column)) return { show: '●', meaning: t('landscape.matrixUses') }
    if (app.implied.includes(column)) return { show: '○', meaning: t('landscape.matrixImplied') }
    return null
  }
  const kindOf = (column: string) => (services.some(({ node }) => node.id === column) ? nodeKey.service(column) : nodeKey.platform(column))
  const appOf = (key: NodeKey | undefined) => (key?.startsWith('application:') ? key.slice('application:'.length) : undefined)
  const pick = (one: MatrixPick) => { if (one.row !== COUNTS) onSelect(nodeKey.application(one.row)) }
  const on = (app: LandscapeApplication, column: string) => app.saysUses.includes(column)
  return (
    <div className="tl-matrix" data-testid="landscape-matrix">
      <Matrix
        label={t('landscape.matrixLabel')}
        rowHeading={t('landscape.matrixApplication')}
        rows={[...apps.map((app) => ({ id: app.id, label: app.name })), ...(apps.length > 0 ? [{ id: COUNTS, label: t('landscape.matrixCounts') }] : [])]}
        columns={columns}
        cellOf={cellOf}
        answer={{ label: t('landscape.runsOn'), of: (row) => byId.get(row)?.hostedOn.map((id) => nameOfPlatform.get(id) ?? id).join(', ') }}
        selected={appOf(selected) !== undefined ? { row: appOf(selected)!, column: '' } : null}
        onSelect={pick}
        onOpenRow={(row) => { if (row !== COUNTS) onSelect(nodeKey.application(row)) }}
        onOpenColumn={(column) => onSelect(kindOf(column))}
        hint={onToggle ? t('landscape.matrixHint') : t('landscape.matrixReadHint')}
        {...(onToggle ? {
          keys: [' '],
          onKey: (at: MatrixPick) => {
            const app = byId.get(at.row)
            if (app) onToggle(app.id, at.column, !on(app, at.column))
          },
        } : {})}
      />
      <KeyStrip all values={[
        { id: 'uses', label: t('landscape.matrixUses'), shown: <span aria-hidden="true">●</span> },
        { id: 'implied', label: t('landscape.matrixImplied'), shown: <span aria-hidden="true">○</span> },
      ]} />
    </div>
  )
}
