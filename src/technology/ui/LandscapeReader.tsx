// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one reader beside the columns: it reads and it writes, so taking a use
 * away is as near as adding one. It is the kit's Panel, and what a record holds
 * besides the essentials stays in the record, a press away in the same column.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { applicationList, landscapeEdges, nodeKey, platformList, serviceList } from '../../model/technologyLandscape'
import type { LandscapeApplication, LandscapeGroup, LandscapePlatform, LandscapeService, NodeKey, TechnologyLandscape } from '../../model/technologyLandscape'
import type { DesignModel, ElementId } from '../../model'
import { plural } from '../../i18n/strings'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Button, IconButton } from '../../widgets/kit/Button'
import { Select } from '../../widgets/kit/Field'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { Panel, PanelLink, PanelSection } from '../../widgets/kit/Panel'
import type { PanelUndo } from '../../widgets/kit/Panel'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import { CloseIcon } from '../../widgets/icons'
import { PHASE_WORD } from './landscapeWords'
import { PANEL_HELP } from '../../platform/helpPlaces'

export type ReaderDoors = {
  onEditRecord?: ((id: ElementId) => void) | undefined
  onOpenElsewhere?: ((id: ElementId) => void) | undefined
  onOpenContainers?: ((id: ElementId) => boolean) | undefined
  hasContainers?: ((id: ElementId) => boolean) | undefined
  onServiceReport?: ((id: ElementId) => void) | undefined
  onPlatformReport?: ((id: ElementId) => void) | undefined
  onAddUnder?: ((kind: 'platform' | 'platformService', id: ElementId, at: { x: number; y: number }) => void) | undefined
  /** Delete a record this scope keeps, through the editor's one question. Absent: nothing is deleted from here. */
  onDelete?: ((id: ElementId) => void) | undefined
}

export type ReaderWrites = {
  setUse(applicationId: ElementId, targetId: ElementId, on: boolean): void
  setHost(applicationId: ElementId, platformId: ElementId | undefined): void
  /** What may be picked to use, this scope's and the organisation's. */
  usable: readonly PickerOption[]
  /** The places another scope defines, for *Runs on*; choosing one writes its stand-in. */
  placesElsewhere: readonly { id: ElementId; name: string; where: string }[]
  /** Which ticks are up, and the way to bring them up. */
  ticking: ElementId | undefined
  onTicking(id: ElementId | undefined): void
}

type Props = {
  landscape: TechnologyLandscape
  model: DesignModel
  selected: NodeKey | undefined
  doors: ReaderDoors
  writes: ReaderWrites | undefined
  undo: PanelUndo | undefined
  /** What the page says with nothing chosen. */
  rest: ReactNode
  restFoot: string | undefined
  nameOf(id: ElementId): string
  /** Where a change to this application is saved, in words. */
  savedIn(applicationId: ElementId): string
}

function Part({ label, children }: { label: string; children: ReactNode }) {
  return <div className="tl-readerPart"><span className="tl-readerLabel">{label}</span>{children}</div>
}

const said = (ids: readonly ElementId[], nameOf: (id: ElementId) => string, none: string) => (ids.length > 0 ? ids.map(nameOf).join(', ') : none)

function ApplicationBody({ app, landscape, writes, nameOf, t }: {
  app: LandscapeApplication; landscape: TechnologyLandscape; writes: ReaderWrites | undefined; nameOf(id: ElementId): string; t: Translate
}) {
  const [adding, setAdding] = useState(false)
  const places = platformList(landscape).filter(({ node }) => node.archetype === 'place' || app.hostedOn.includes(node.id))
  const uses = [...app.uses, ...app.binds]
  const reached = landscapeEdges(landscape, { services: false, foldHosting: false, folded: new Set() })
    .filter((edge) => edge.from === nodeKey.application(app.id)).map((edge) => edge.to.slice('platform:'.length))
  // And what those sit in: a thing stands on the whole chain above where it runs.
  const behind = reached.flatMap((id) => [id, ...(platformList(landscape).find(({ node }) => node.id === id)?.above.map((one) => one.id) ?? [])])
  const hosts = [...new Set(serviceList(landscape).filter(({ node }) => app.implied.includes(node.id)).flatMap(({ node }) => node.realisedBy))]
  // An application with containers answers through them: its own *Runs on* is theirs to say.
  const mayHost = writes !== undefined && (app.saysHosted !== undefined || app.hostedOn.length === 0)
  return (
    <>
      <Part label={t('landscape.runsOn')}>
        {mayHost ? (
          <Select
            aria-label={t('landscape.runsOn')}
            data-testid="landscape-runs-on"
            value={app.saysHosted ?? ''}
            onChange={(value) => writes.setHost(app.id, value || undefined)}
            options={[
              { value: '', label: t('landscape.runsNowhere') },
              ...places.map(({ node }) => ({ value: node.id, label: node.name })),
              ...writes.placesElsewhere.map((one) => ({ value: one.id, label: `${one.name} · ${one.where}` })),
            ]}
          />
        ) : (
          <>
            <div>{said(app.hostedOn, nameOf, t('landscape.runsNowhere'))}</div>
            {app.hostedOn.length > 0 && app.saysHosted === undefined && <div className="tl-readerNote">{t('landscape.throughContainers')}</div>}
          </>
        )}
      </Part>
      <Part label={t('landscape.uses')}>
        {uses.length === 0 && <div className="tl-readerNote">{t('landscape.usesNothing')}</div>}
        {uses.map((id) => {
          const own = app.saysUses.includes(id)
          return (
            <div className="tl-readerRow" key={id} data-testid={`landscape-use-${id}`}>
              <span>{nameOf(id)}</span>
              {!own && <span className="tl-readerNote">{t('landscape.usesContainers')}</span>}
              {writes && own && (
                <IconButton size="small" label={t('landscape.removeUse', { name: nameOf(id) })} data-testid={`landscape-unuse-${id}`} onClick={() => writes.setUse(app.id, id, false)}><CloseIcon size={14} /></IconButton>
              )}
            </div>
          )
        })}
        {writes && (adding ? (
          <Picker
            label={t('landscape.addUse')} placeholder={t('landscape.addUse')} autoFocus
            options={writes.usable.filter((option) => !uses.includes(option.id))}
            recent={writes.usable.filter((option) => !uses.includes(option.id)).slice(0, 12)}
            onPick={(option) => { writes.setUse(app.id, option.id, true); setAdding(false) }}
            onEscape={() => setAdding(false)}
          />
        ) : <Button variant="plain" size="small" data-testid="landscape-add-use" onClick={() => setAdding(true)}>{t('landscape.addUse')}</Button>)}
      </Part>
      {app.implied.length > 0 && (
        <Part label={t('landscape.comesWithHosting')}>
          <div>{app.implied.map(nameOf).join(', ')}</div>
          {hosts.length > 0 && <div className="tl-readerNote">{t('landscape.comesBecause', { names: hosts.map(nameOf).join(', ') })}</div>}
        </Part>
      )}
      <Part label={t('landscape.standsOn')}>{said([...new Set(behind)], nameOf, t('landscape.nothing'))}</Part>
    </>
  )
}

function GroupBody({ group, nameOf, t }: { group: LandscapeGroup; nameOf(id: ElementId): string; t: Translate }) {
  const used = new Map<ElementId, number>()
  for (const app of group.applications) for (const id of [...app.uses, ...app.implied]) used.set(id, (used.get(id) ?? 0) + 1)
  return (
    <>
      <Part label={t('landscape.applications')}>{group.applications.map((app) => app.name).join(', ')}</Part>
      <Part label={t('landscape.uses')}>
        {used.size === 0 && t('landscape.nothing')}
        {[...used].sort(([, a], [, b]) => b - a).map(([id, count]) => (
          <div className="tl-readerRow" key={id}><span>{nameOf(id)}</span><span className="tl-readerNote">{count}</span></div>
        ))}
      </Part>
    </>
  )
}

function ServiceBody({ service, landscape, maintainers, nameOf, t }: {
  service: LandscapeService; landscape: TechnologyLandscape; maintainers: readonly string[]; nameOf(id: ElementId): string; t: Translate
}) {
  const users = applicationList(landscape).filter((app) => app.uses.includes(service.id) || app.implied.includes(service.id))
  const scopes = new Set(users.map((app) => app.where ?? '')).size
  return (
    <>
      {service.summary && <p>{service.summary}</p>}
      <Part label={t('landscape.deliveredBy')}>{said(service.realisedBy, nameOf, t('landscape.nothingDelivers'))}</Part>
      {maintainers.length > 0 && <Part label={t('landscape.maintainedBy')}>{maintainers.join(', ')}</Part>}
      <Part label={t('landscape.whoStands')}>
        <div>{t('landscape.whoStandsCount', {
          applications: plural(t, { one: 'landscape.applicationsOne', other: 'landscape.applicationsOther' }, users.length),
          scopes: plural(t, { one: 'landscape.scopesOne', other: 'landscape.scopesOther' }, scopes),
        })}</div>
        {users.length > 0 && <div className="tl-readerNote">{users.map((app) => app.name).join(', ')}</div>}
      </Part>
      <Part label={t('landscape.lifecycle')}>{t(PHASE_WORD[service.lifecycle])}</Part>
    </>
  )
}

function PlatformBody({ platform, above, landscape, maintainers, nameOf, t }: {
  platform: LandscapePlatform; above: readonly LandscapePlatform[]; landscape: TechnologyLandscape; maintainers: readonly string[]; nameOf(id: ElementId): string; t: Translate
}) {
  const leaning = [...new Set(platform.standing.map((one) => one.applicationId))]
  const named = new Map(applicationList(landscape).map((app) => [app.id, app.name]))
  const via = [...new Set(platform.standing.flatMap((one) => (one.via ? [one.via] : [])))]
  return (
    <>
      {platform.realises.length > 0 && <Part label={t('landscape.delivers')}>{platform.realises.map(nameOf).join(', ')}</Part>}
      {above.length > 0 && <Part label={t('landscape.partOf')}>{above.map((one) => one.name).join(', ')}</Part>}
      {platform.children.length > 0 && <Part label={t('landscape.holds')}>{platform.children.map((one) => one.name).join(', ')}</Part>}
      <Part label={t('landscape.leaning')}>
        <div>{leaning.length > 0 ? leaning.map((id) => named.get(id) ?? id).join(', ') : t('landscape.nothing')}</div>
        {via.length > 0 && <div className="tl-readerNote">{t('technology.through')}: {via.map(nameOf).join(', ')}</div>}
      </Part>
      {maintainers.length > 0 && <Part label={t('landscape.maintainedBy')}>{maintainers.join(', ')}</Part>}
      <Part label={t('landscape.lifecycle')}>{t(PHASE_WORD[platform.lifecycle])}</Part>
    </>
  )
}

/**
 * What the reader says of the thing chosen, in the kit Panel's own places, as a
 * board's panel does: the record a press away in the head (*Record ›*), what is
 * done to the whole thing in ⋯ with the delete last, and in the body only what
 * is added beneath it.
 */
type Shown = { kind: string; name: string; status?: string; body: ReactNode; record?: ReactNode; more?: readonly MenuEntry[]; doors?: ReactNode }

function maintainersOf(model: DesignModel, id: ElementId, nameOf: (id: ElementId) => string): string[] {
  return model.relations.filter((row) => row.type === 'assigned' && row.targetId === id).map((row) => model.elements.find((one) => one.id === row.sourceId)?.name ?? nameOf(row.sourceId))
}

/** *Record ›*: the record in its own column where this scope keeps it, or where another scope does. */
function recordLink(doors: ReaderDoors, id: ElementId, held: boolean, known: boolean, t: Translate): ReactNode {
  if (held && doors.onEditRecord) return <PanelLink data-testid="landscape-edit-record" onPress={() => doors.onEditRecord!(id)}>{t('landscape.record')} ›</PanelLink>
  if (!held && known && doors.onOpenElsewhere) return <PanelLink data-testid="landscape-open-record" onPress={() => doors.onOpenElsewhere!(id)}>{t('landscape.record')} ›</PanelLink>
  return undefined
}

/** The delete, last in ⋯, for a record this scope keeps. */
function deleteEntry(doors: ReaderDoors, id: ElementId, held: boolean, t: Translate): MenuEntry[] {
  return held && doors.onDelete ? [{ label: t('landscape.deleteFromModel'), final: true, 'data-testid': 'landscape-delete', onSelect: () => doors.onDelete!(id) }] : []
}

function reportEntry(open: ((id: ElementId) => void) | undefined, id: ElementId, held: boolean, t: Translate): MenuEntry[] {
  return held && open ? [{ label: t('landscape.ifItWent'), 'data-testid': 'landscape-report', onSelect: () => open(id) }] : []
}

function shownApplication(props: Props, id: ElementId, held: boolean, t: Translate): Shown | undefined {
  const { landscape, doors, writes, nameOf } = props
  const app = applicationList(landscape).find((one) => one.id === id)
  if (!app) return undefined
  const ticking = writes?.ticking === id
  return {
    kind: t('landscape.kindApplication'), name: app.name,
    status: app.where ? t('landscape.keptIn', { scope: app.where }) : t('landscape.keptHere'),
    body: <ApplicationBody key={id} app={app} landscape={landscape} writes={writes} nameOf={nameOf} t={t} />,
    // While the rows carry ticks, the way out of them stands in the head where the eye is.
    record: (
      <>
        {/* A button of its own, apart from the link beside it: it ends a mode, where Record › goes somewhere. */}
        {ticking && writes && <span className="tl-done"><Button variant="primary" size="small" data-testid="landscape-edit-uses" onClick={() => writes.onTicking(undefined)}>{t('landscape.editDone')}</Button></span>}
        {recordLink(doors, id, held, app.known, t)}
      </>
    ),
    more: [
      ...(writes && !ticking ? [{ label: t('landscape.editUses'), detail: t('landscape.editUsesHint'), 'data-testid': 'landscape-edit-uses', onSelect: () => writes.onTicking(id) }] : []),
      ...(doors.hasContainers?.(id) ? [{ label: t('landscape.containers'), 'data-testid': 'landscape-containers', onSelect: () => { doors.onOpenContainers?.(id) } }] : []),
      ...deleteEntry(doors, id, held, t),
    ],
  }
}

function addDoor(doors: ReaderDoors, kind: 'platform' | 'platformService', id: ElementId, name: string, t: Translate) {
  const add = doors.onAddUnder
  return add ? (
    <Button
      variant="plain" size="small" data-testid={`landscape-add-under-${id}`}
      onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); add(kind, id, { x: box.left, y: box.bottom }) }}
    >{t(kind === 'platform' ? 'landscape.addPlatformUnder' : 'landscape.addServiceUnder', { name })}</Button>
  ) : null
}

function shownService(props: Props, id: ElementId, held: boolean, t: Translate): Shown | undefined {
  const { landscape, model, doors, nameOf } = props
  const service = serviceList(landscape).find(({ node }) => node.id === id)?.node
  if (!service) return undefined
  return {
    kind: service.shared ? t('landscape.kindServiceShared') : t('landscape.kindService'), name: service.name,
    ...(service.where ? { status: t('landscape.keptIn', { scope: service.where }) } : {}),
    body: <ServiceBody service={service} landscape={landscape} maintainers={maintainersOf(model, id, nameOf)} nameOf={nameOf} t={t} />,
    record: recordLink(doors, id, held, false, t),
    more: [...reportEntry(doors.onServiceReport, id, held, t), ...deleteEntry(doors, id, held, t)],
    doors: service.where === undefined && addDoor(doors, 'platformService', id, service.name, t),
  }
}

function shownPlatform(props: Props, id: ElementId, held: boolean, t: Translate): Shown | undefined {
  const { landscape, model, doors, nameOf } = props
  const found = platformList(landscape).find(({ node }) => node.id === id)
  if (!found) return undefined
  return {
    kind: t('landscape.kindPlatform'), name: found.node.name,
    body: <PlatformBody platform={found.node} above={found.above} landscape={landscape} maintainers={maintainersOf(model, id, nameOf)} nameOf={nameOf} t={t} />,
    record: recordLink(doors, id, held, false, t),
    more: [...reportEntry(doors.onPlatformReport, id, held, t), ...deleteEntry(doors, id, held, t)],
    doors: addDoor(doors, 'platform', id, found.node.name, t),
  }
}

function shownOf(props: Props, t: Translate): Shown | undefined {
  const { selected, landscape, model, nameOf } = props
  if (selected === undefined) return undefined
  const at = selected.indexOf(':')
  const kind = selected.slice(0, at)
  const id = selected.slice(at + 1)
  const held = model.elements.some((one) => one.id === id)
  if (kind === 'application') return shownApplication(props, id, held, t)
  if (kind === 'service') return shownService(props, id, held, t)
  if (kind === 'platform') return shownPlatform(props, id, held, t)
  const group = landscape.groups.find((one) => one.key === id)
  return group && { kind: t('landscape.kindGroup'), name: group.label ?? t('landscape.thisScope'), body: <GroupBody group={group} nameOf={nameOf} t={t} /> }
}

export function LandscapeReader(props: Props) {
  const { t } = useStrings()
  // Folded to its edge as a board's panel folds, and kept folded from one pick to the next.
  const [collapsed, setCollapsed] = useState(false)
  const shown = shownOf(props, t)
  if (!shown) {
    return (
      <div className="tl-reader" data-testid="landscape-rest">
        <Panel helpAt={PANEL_HELP.technology} kind={t('landscape.page')} name={t('landscape.helpTitle')} {...(props.restFoot ? { help: props.restFoot } : {})} {...(props.undo ? { undo: props.undo } : {})}>
          {props.rest}
        </Panel>
      </div>
    )
  }
  const application = props.selected?.startsWith('application:') ? props.selected.slice('application:'.length) : undefined
  const more = shown.more ?? []
  return (
    <div className="tl-reader" data-testid="landscape-inspector" data-collapsed={collapsed || undefined}>
      <Panel helpAt={PANEL_HELP.technology}
        kind={shown.kind} name={shown.name} dataGuide="landscape.inspector" collapsed={collapsed} onCollapse={setCollapsed}
        actions={<>{shown.record}{more.length > 0 && <MoreMenu items={more} label={t('landscape.more')} size="small" />}</>}
        {...(shown.status ? { status: shown.status } : {})}
        {...(props.undo ? { undo: props.undo } : application && props.writes ? { help: props.savedIn(application) } : {})}
      >
        <PanelSection>{shown.body}{shown.doors && <div className="tl-doors">{shown.doors}</div>}</PanelSection>
      </Panel>
    </div>
  )
}
