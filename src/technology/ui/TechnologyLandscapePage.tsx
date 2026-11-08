// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The technology landscape, on one page (ADR-0015; 4.0.0).
 *
 * It answers one question: what stands on what, and what falls if a piece goes.
 * So it is three columns of plain rows that read left to right, with the same
 * rows as a matrix one press away, and it does not dress as a board: nothing
 * here is placed, so it has no palette and no canvas words. Every mark is read
 * from the rows by `model/technologyLandscape`, on the day it is looked at.
 *
 * **No lines at rest.** Hovering a row previews its lines and pressing it pins
 * them; nothing moves when a row is chosen, because the eye is following it.
 *
 * **One way to say a use.** The reader writes, *Edit uses* puts a tick on every
 * row, a matrix cell takes Space, and a row may be dragged: all four end in the
 * two calls the host hands in, and all four can say no as easily as yes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DesignDiagram, DesignModel, ElementId, Relation } from '../../model'
import { applicationList, drawsCard, LANDSCAPE_COLOURS, landscapeColours, nodeKey, platformList, serviceList, technologyLandscape } from '../../model/technologyLandscape'
import type { LandscapeApplication, LandscapeColour, LandscapeGroup, LandscapePlatform, LandscapeService, NodeKey, SharedElsewhere, TechnologyLandscape } from '../../model/technologyLandscape'
import type { PlatformDescribe } from '../../model/platformReport'
import type { PlatformTree } from '../../model/hosting'
import { refText } from '../../model/person'
import type { PersonRef } from '../../model/person'
import { PictureDialog } from '../../widgets/kit/PictureDialog'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { Button } from '../../widgets/kit/Button'
import { ColourMenu } from '../../widgets/kit/ColourMenu'
import { daysWorthLooking } from '../../model/daysWorthLooking'
import { DayControl } from '../../widgets/kit/DayControl'
import type { DayGroup } from '../../widgets/kit/DayControl'
import { FindField } from '../../widgets/kit/FindField'
import { KeyStrip } from '../../widgets/kit/KeyStrip'
import type { KeyValue } from '../../widgets/kit/KeyStrip'
import { PageState } from '../../widgets/kit/PageState'
import { PanelSection } from '../../widgets/kit/Panel'
import type { PanelUndo } from '../../widgets/kit/Panel'
import { PickerAt } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import { Segmented } from '../../widgets/kit/Segmented'
import { tokenVar } from '../../widgets/kit/tokens'
import type { ColourToken } from '../../widgets/kit/tokens'
import { ViewBar, ViewBarButton, ViewBarMenu } from '../../widgets/kit/ViewBar'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceTab } from '../../widgets/placeTab'
import type { WindowChrome } from '../../platform/windowChrome'
import { LandscapeChain } from './LandscapeChain'
import { LandscapeMatrix } from './LandscapeMatrix'
import { LandscapeReader } from './LandscapeReader'
import type { ReaderDoors } from './LandscapeReader'
import { COLOUR_WORD, lensOf, LINE_KINDS, PHASE_SWATCH, PHASE_WORD } from './landscapeWords'
import { useLandscapeShowing } from './useLandscapeShowing'
import './TechnologyLandscapePage.css'

/** A change the host could not land says why; nothing is a change that landed. */
export type LandscapeWritten = string | undefined | void | Promise<string | undefined | void>

export type TechnologyElsewhere = { id: ElementId; name: string; kind: 'platform' | 'platformService'; where: string; place?: boolean }

export type TechnologyLandscapePageProps = {
  open: boolean
  /** Drawn in the tab rather than as a page over the editor (ADR-0016). */
  inline?: boolean
  /** The editor's selected element, and the way to choose one, with `inline`. */
  selectedId?: ElementId
  onSelect?(elementId: ElementId | undefined): void
  /** The row the page starts on: a record's door opened it here (ADR-0020). */
  focus?: NodeKey
  /** Make a service or a platform, filed under `parentId` where given. Absent = no `+`. */
  onAdd?(seed: { kind: 'platform' | 'platformService'; name?: string; parentId?: ElementId }): void
  /** Draw here, as a stand-in, what another scope defines. */
  onBring?(id: ElementId): void
  /** What the rest of the organisation defines, for the `+` and the reader's picker. A STABLE array. */
  technologyElsewhere?: readonly TechnologyElsewhere[]
  /**
   * Say or take back a use, and where an application runs: in the scope that
   * keeps the application. Absent = nothing on the page writes.
   */
  onSetUse?(applicationId: ElementId, targetId: ElementId, on: boolean): LandscapeWritten
  onSetHost?(applicationId: ElementId, platformId: ElementId | undefined): LandscapeWritten
  /** A gesture that would say what is already said: told, rather than written twice. */
  notify?(message: string): void
  /** Every offering the rest of the tree marks shared. A STABLE array. */
  sharedElsewhere?: readonly SharedElsewhere[]
  model: DesignModel
  /** Absent while the page is closing, or when the view was deleted under it. `asOf` is the day looked at. */
  diagram: DesignDiagram | undefined
  /** What it is read on with no day chosen, so the rows and the reports count the same rows. */
  today?: string
  readOnly: boolean
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it: the same handle the sheet hands over. */
  onHandle?(handle: PageHandle | undefined): void
  /** Rows written in another scope that name a service or platform this scope holds. A STABLE array. */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name. Stable, likewise. */
  describe?: PlatformDescribe
  /** The platform tree, off the index, where a stand-in carries no parent. Stable. */
  tree?: PlatformTree
  /** The record, opened from the reader, in the reader's own column: the same inspector a board has. */
  record?: React.ReactNode
  /** The way to a record another scope keeps. */
  onOpenElsewhere?(id: ElementId): void
  /** Open what is inside an application; false where nothing is. */
  onOpenContainers?(id: ElementId): boolean
  hasContainers?(id: ElementId): boolean
  onOpenServiceReport?(id: ElementId): void
  onOpenPlatformReport?(id: ElementId): void
  /** Look at another day; nothing is today. Absent = no Day control. */
  onDay?(day: string | undefined): void
  /** What a lens kept with the view is, and keeping one. */
  kept?: string
  onKeepColour?(colour: LandscapeColour): void
  /** Hand over the page as a picture, to be kept where a person says. Absent = no Export. */
  onExport?(name: string, png: Uint8Array): void
  /** The register's word for a picked person, which this module may not read. Absent: the text as typed. */
  ownerText?(owner: PersonRef): string
}

/** Choose the row a door led to, once per door: the landscape is rebuilt on every change, and an effect on that would keep taking the person back. */
function useDoorFocus(focus: NodeKey | undefined, landscape: TechnologyLandscape | undefined, choose: (key: NodeKey) => void) {
  const honoured = useRef<NodeKey | undefined>(undefined)
  useEffect(() => {
    if (focus === undefined) { honoured.current = undefined; return }
    if (!landscape || honoured.current === focus) return
    honoured.current = focus
    if (drawsCard(landscape, focus)) choose(focus)
  }, [focus, landscape, choose])
}

const NOTES = (t: Translate) => ({
  application: (app: LandscapeApplication) => [
    app.assumed ? t('landscape.assumed') : '',
    String(app.uses.length + app.implied.length + app.binds.length),
  ].filter(Boolean).join(' · '),
  service: (service: LandscapeService) => {
    const assumed = service.assumed ? `${t('landscape.assumed')} · ` : ''
    return service.realisedBy.length === 0 && service.where === undefined
      ? { note: `${assumed}${t('landscape.noPlatform')} · ${service.consumers}`, attention: true }
      : { note: `${assumed}${service.where ?? String(service.consumers)}`, attention: false }
  },
  platform: (platform: LandscapePlatform) => [
    platform.assumed ? t('landscape.assumed') : '',
    platform.outside ? t('landscape.outside') : '',
    platform.archetype === 'place' ? t('landscape.place') : '',
    String(platform.applications),
  ].filter(Boolean).join(' · '),
})

const holdsNothing = (landscape: TechnologyLandscape) => landscape.counts.applications === 0 && landscape.services.length === 0 && landscape.platforms.length === 0

const idOf = (key: NodeKey) => key.slice(key.indexOf(':') + 1)

function worthALook(landscape: TechnologyLandscape, t: ReturnType<typeof useStrings>['t']): string[] {
  const apps = applicationList(landscape)
  const nothing = serviceList(landscape).filter(({ node }) => node.realisedBy.length === 0).map(({ node }) => {
    const leaning = apps.find((app) => app.uses.includes(node.id))
    return leaning ? t('landscape.lookNoPlatformLeans', { name: node.name, app: leaning.name }) : t('landscape.lookNoPlatform', { name: node.name })
  })
  const platforms = platformList(landscape)
  const top = [...platforms].filter(({ node }) => node.archetype === 'place').sort((a, b) => b.node.applications - a.node.applications || b.depth - a.depth)[0]?.node
  return [
    ...nothing,
    ...(top && apps.length > 1 && top.applications > apps.length / 2 ? [t('landscape.lookMost', { count: top.applications, all: apps.length, name: top.name })] : []),
    ...platforms.filter(({ node }) => node.outside).map(({ node }) => t('landscape.lookOutside', { name: node.name })),
  ]
}

function usePick(landscape: TechnologyLandscape | undefined, props: Pick<TechnologyLandscapePageProps, 'onSelect' | 'selectedId' | 'focus' | 'model'>, setSelected: React.Dispatch<React.SetStateAction<NodeKey | undefined>>) {
  const { onSelect, selectedId, focus, model } = props
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  // What this scope holds is the editor's selection as well (ADR-0016): the agent and the record read it.
  const tell = useRef(onSelect)
  tell.current = onSelect
  const said = useRef(held)
  said.current = held
  const choose = useCallback((key: NodeKey | undefined) => {
    setSelected(key)
    const id = key === undefined || key.startsWith('group:') ? undefined : idOf(key)
    tell.current?.(id !== undefined && said.current.has(id) ? id : undefined)
  }, [setSelected])
  // And the other way: a row the editor selected, one the + just made, is chosen here.
  useEffect(() => {
    if (!landscape || selectedId === undefined) return
    if (serviceList(landscape).some(({ node }) => node.id === selectedId)) setSelected(nodeKey.service(selectedId))
    else if (platformList(landscape).some(({ node }) => node.id === selectedId)) setSelected(nodeKey.platform(selectedId))
    else if (applicationList(landscape).some((app) => app.id === selectedId)) setSelected(nodeKey.application(selectedId))
  }, [landscape, selectedId, setSelected])
  useDoorFocus(focus, landscape, choose)
  return choose
}

type Adding = { kind: 'platform' | 'platformService'; parentId?: ElementId; at: { x: number; y: number } }

/** A value's colour with its number in it, on a row and in the key alike; a value with no colour is an outline round its number. */
function LensCode({ code, swatch }: { code: number | undefined; swatch: ColourToken | undefined }) {
  return (
    <span className="tl-swatch" data-code={code} data-outline={swatch ? undefined : true} style={swatch ? { background: tokenVar(swatch) } : undefined}>
      {code}
    </span>
  )
}

function useColouring(landscape: TechnologyLandscape | undefined, lens: LandscapeColour | undefined, ownerText: ((owner: PersonRef) => string) | undefined) {
  const { t } = useStrings()
  const [pressed, setPressed] = useState<string | undefined>(undefined)
  useEffect(() => setPressed(undefined), [lens])
  const owner = useCallback((ref: PersonRef) => ownerText?.(ref) ?? refText(ref) ?? '', [ownerText])
  const colours = useMemo(() => (landscape && lens ? landscapeColours(landscape, lens, owner) : undefined), [landscape, lens, owner])
  const phases = lens === 'lifecycle' || lens === 'technologyLifecycle'
  const values = useMemo<KeyValue[]>(() => {
    const counts = new Map<string, number>()
    for (const value of colours?.values() ?? []) counts.set(value, (counts.get(value) ?? 0) + 1)
    // Each value has a number, on its rows and in the key, as the board's lens has: colour is never the only signal.
    return [...counts].sort(([, a], [, b]) => b - a).map(([id, count], at) => {
      const swatch = phases ? PHASE_SWATCH[id as keyof typeof PHASE_SWATCH] : lensOf(at)
      return { id, count, label: phases ? t(PHASE_WORD[id as keyof typeof PHASE_WORD]) : id, ...(swatch ? { swatch } : {}), shown: <LensCode code={at + 1} swatch={swatch} /> }
    })
  }, [colours, phases, t])
  const swatchOf = useCallback((key: NodeKey) => {
    const value = colours?.get(key)
    if (!lens) return null
    const at = values.findIndex((one) => one.id === value)
    return <LensCode code={at < 0 ? undefined : at + 1} swatch={values[at]?.swatch} />
  }, [colours, lens, values])
  const quiet = useCallback((key: NodeKey) => pressed !== undefined && colours?.get(key) !== pressed, [pressed, colours])
  return { values, pressed, setPressed, swatchOf, quiet }
}

function useWrites(props: TechnologyLandscapePageProps, nameOf: (id: ElementId) => string, onUndo: (undo: PanelUndo | undefined) => void) {
  const { t } = useStrings()
  const { onSetUse, onSetHost, notify, readOnly } = props
  const land = useCallback(async (written: LandscapeWritten, undo: PanelUndo) => {
    const refused = await written
    if (typeof refused === 'string') { notify?.(t('landscape.notWritten', { reason: refused })); return }
    onUndo(undo)
  }, [notify, onUndo, t])
  return useMemo(() => {
    if (readOnly || !onSetUse || !onSetHost) return undefined
    const setUse = (app: ElementId, target: ElementId, on: boolean) => {
      void land(onSetUse(app, target, on), {
        word: t(on ? 'landscape.nowUses' : 'landscape.noLongerUses', { app: nameOf(app), name: nameOf(target) }),
        onUndo: () => { onUndo(undefined); void onSetUse(app, target, !on) },
      })
    }
    const setHost = (app: ElementId, platform: ElementId | undefined, was?: ElementId) => {
      void land(onSetHost(app, platform), {
        word: t('landscape.nowRuns', { app: nameOf(app), name: platform ? nameOf(platform) : t('landscape.runsNowhere') }),
        onUndo: () => { onUndo(undefined); void onSetHost(app, was) },
      })
    }
    return { setUse, setHost }
  }, [readOnly, onSetUse, onSetHost, land, nameOf, onUndo, t])
}

function showMenu(showing: ReturnType<typeof useLandscapeShowing>, groups: readonly LandscapeGroup[], hasShared: boolean, t: ReturnType<typeof useStrings>['t'], groupLabel: (key: string, label?: string) => string): MenuEntry[] {
  const allFolded = showing.grouped !== undefined && showing.grouped.groups.length > 0 && showing.grouped.groups.every((group) => showing.folded.has(group.key))
  return [
    { label: t('landscape.showServices'), checked: showing.services, onSelect: () => showing.setServices((on) => !on) },
    { label: t('landscape.showEveryLine'), checked: showing.everyLine, onSelect: () => showing.setEveryLine((on) => !on) },
    { label: t('landscape.showOnlyTouched'), checked: showing.onlyTouched, onSelect: () => showing.setOnlyTouched((on) => !on) },
    { label: t('landscape.showFoldHosting'), checked: showing.foldHosting, onSelect: () => showing.setFoldHosting((on) => !on) },
    ...(hasShared ? [{ label: t('landscape.showShared'), checked: showing.showShared, onSelect: () => showing.setShowShared((on) => !on) }] : []),
    ...(groups.length > 1 ? [{ label: t(allFolded ? 'landscape.unfoldAll' : 'landscape.foldAll'), onSelect: () => showing.setFolded(new Set(allFolded ? [] : groups.map((group) => group.key))) }] : []),
    { heading: t('landscape.groupBy') },
    { label: t('landscape.groupByScope'), checked: showing.groupBy === 'scope', onSelect: () => showing.setGroupBy('scope') },
    { label: t('landscape.groupByCategory'), checked: showing.groupBy === 'category', onSelect: () => showing.setGroupBy('category') },
    ...(showing.groupBy === 'scope' && groups.length > 0 ? [
      { heading: t('landscape.showScopes') },
      ...groups.map((group) => ({ label: groupLabel(group.key, group.label), checked: !showing.scopesOff.has(group.key), onSelect: () => showing.toggleScope(group.key) })),
    ] : []),
  ]
}

/** What a press, a drag and a tick do: every way of saying a use ends in the same two calls. */
function useGestures(props: TechnologyLandscapePageProps, landscape: TechnologyLandscape | undefined, selected: NodeKey | undefined, choose: (key: NodeKey | undefined) => void, onUndo: (undo: PanelUndo | undefined) => void) {
  const { t } = useStrings()
  const [ticking, setTicking] = useState<ElementId | undefined>(undefined)
  const [recordUp, setRecordUp] = useState(false)
  const [dragging, setDragging] = useState<ElementId | undefined>(undefined)
  const [dropTarget, setDropTarget] = useState<NodeKey | undefined>(undefined)
  const nameOf = useCallback((id: ElementId) => (landscape
    ? serviceList(landscape).find(({ node }) => node.id === id)?.node.name
      ?? platformList(landscape).find(({ node }) => node.id === id)?.node.name
      ?? applicationList(landscape).find((app) => app.id === id)?.name
      ?? props.describe?.(id)?.name ?? id
    : id), [landscape, props.describe])
  const writes = useWrites(props, nameOf, onUndo)
  const appOf = useCallback((id: ElementId) => (landscape ? applicationList(landscape).find((one) => one.id === id) : undefined), [landscape])
  const isPlace = useCallback((key: NodeKey) => key.startsWith('platform:') && landscape !== undefined
    && platformList(landscape).find(({ node }) => node.id === idOf(key))?.node.archetype === 'place', [landscape])

  /** A place takes where it runs; anything else takes a use. */
  const toggle = useCallback((applicationId: ElementId, key: NodeKey) => {
    const app = appOf(applicationId)
    if (!app || !writes) return
    const id = idOf(key)
    if (isPlace(key)) writes.setHost(applicationId, app.saysHosted === id ? undefined : id, app.saysHosted)
    else writes.setUse(applicationId, id, !app.saysUses.includes(id))
  }, [appOf, isPlace, writes])

  const press = useCallback((key: NodeKey) => {
    if (ticking !== undefined && !key.startsWith('application:') && !key.startsWith('group:')) { toggle(ticking, key); return }
    setRecordUp(false)
    setTicking(undefined)
    choose(selected === key ? undefined : key)
  }, [ticking, toggle, choose, selected])

  const dropWord = dragging !== undefined && dropTarget !== undefined
    ? t(isPlace(dropTarget) ? 'landscape.willRun' : 'landscape.willUse', { app: nameOf(dragging), name: nameOf(idOf(dropTarget)) })
    : undefined
  const drop = (key: NodeKey) => {
    const app = dragging !== undefined ? appOf(dragging) : undefined
    setDragging(undefined)
    setDropTarget(undefined)
    if (!app) return
    const id = idOf(key)
    const place = isPlace(key)
    if (place ? app.hostedOn.includes(id) : app.saysUses.includes(id)) {
      props.notify?.(t(place ? 'landscape.alreadyHosted' : 'landscape.alreadyUses', { app: app.name, name: nameOf(id) }))
      return
    }
    toggle(app.id, key)
    // The application dragged is picked, so the line it was just given is drawn.
    choose(nodeKey.application(app.id))
  }
  return { ticking, setTicking, recordUp, setRecordUp, dragging, setDragging, dropTarget, setDropTarget, nameOf, writes, appOf, press, dropWord, drop }
}

/** Most of a sheet of A3 at a good resolution: the whole page, and small enough to send to somebody. */
const EXPORT_PIXELS = 16_000_000

function useHandle(props: TechnologyLandscapePageProps, page: React.RefObject<HTMLDivElement | null>, selected: NodeKey | undefined) {
  const { onHandle } = props
  const diagramId = props.diagram?.id
  const capture = useCallback(async (options: PageCaptureOptions) => {
    if (!page.current) throw new Error('TechnologyLandscapePage: the page is not on screen')
    return captureSheet(page.current, { ...options, background: getComputedStyle(page.current).backgroundColor })
  }, [page])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || diagramId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId, capture, ...(selected !== undefined && !selected.startsWith('group:') ? { selectedId: idOf(selected) } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, props.open, diagramId, capture, selected])
  return capture
}

/** Export…: the kit's one export dialog, then the picture of the page as it is drawn. */
function useExport(props: TechnologyLandscapePageProps, capture: PageHandle['capture']) {
  const { t } = useStrings()
  const { onExport } = props
  const [asking, setAsking] = useState(false)
  const name = props.diagram?.name ?? t('landscape.page')
  if (!onExport) return { open: undefined, dialog: null }
  const dialog = asking
    ? (
      <PictureDialog
        name={name} onClose={() => setAsking(false)} about={<p>{t('landscape.exportAbout')}</p>} data-testid="landscape-export-dialog"
        onSave={async () => { const shot = await capture({ maxPixels: EXPORT_PIXELS }); onExport(`${name}.png`, shot.png) }}
        failed={() => t('landscape.exportFailed')}
      />
    )
    : null
  return { open: () => setAsking(true), dialog }
}

const DAY_PHASE = { live: 'landscape.dayLive', retiring: 'landscape.dayRetiring', retired: 'landscape.dayRetired' } as const

function LandscapeBar({ props, showing, landscape, groupLabel, reading, setReading, onExport }: {
  props: TechnologyLandscapePageProps; showing: ReturnType<typeof useLandscapeShowing>; landscape: TechnologyLandscape
  groupLabel(key: string, label?: string): string; reading: string; setReading(tab: string): void; onExport: (() => void) | undefined
}) {
  const { t } = useStrings()
  // The days the board offers, from the same reading: a plan's milestones, when something goes live or goes, a view saved on a day.
  const days = useMemo<DayGroup[]>(() => {
    const worth = daysWorthLooking(props.model, props.today ?? '', {
      plan: (plan, milestone) => t('landscape.dayPlan', { plan, milestone }),
      phase: (phase, name) => t(DAY_PHASE[phase], { name }),
      board: (name) => t('landscape.dayBoard', { name }),
    })
    return worth.length === 0 ? [] : [{ heading: t('landscape.dayHere'), days: worth }]
  }, [props.model, props.today, t])
  return (
    <ViewBar
      label={t('landscape.page')}
      data-guide="landscape.bar"
      reading={(
        <Segmented
          label={t('landscape.reading')} value={reading === 'matrix' ? 'matrix' : 'chain'} onChange={setReading} data-guide="landscape.reading"
          options={[{ value: 'chain', label: t('landscape.chain') }, { value: 'matrix', label: t('landscape.matrix') }]}
        />
      )}
      show={<ViewBarMenu label={t('landscape.show')} items={showMenu(showing, showing.grouped?.groups ?? [], landscape.services.some((one) => one.where !== undefined), t, groupLabel)} data-guide="landscape.show" />}
      colour={<ColourMenu questions={LANDSCAPE_COLOURS.map((id) => ({ id, label: t(COLOUR_WORD[id]) }))} value={showing.lens} onChange={(id) => showing.setLens(id as LandscapeColour | undefined)} data-guide="landscape.colour" />}
      {...(props.onDay ? { day: <DayControl day={props.diagram?.asOf} groups={days} onChange={props.onDay} data-guide="landscape.day" /> } : {})}
      find={<span className="tl-find"><FindField label={t('landscape.filter')} value={showing.query} onChange={showing.setQuery} data-testid="landscape-filter" /></span>}
      {...(onExport ? { exportAs: <ViewBarButton data-testid="landscape-export" onClick={onExport}>{t('landscape.export')}</ViewBarButton> } : {})}
    />
  )
}

/** Keeping is offered to whoever may write, and only for a lens that is not the one kept. */
function keepOf(props: TechnologyLandscapePageProps, lens: LandscapeColour | undefined) {
  const { onKeepColour, readOnly, kept } = props
  return onKeepColour && !readOnly && lens && kept !== lens ? () => onKeepColour(lens) : undefined
}

function LandscapeFoot({ dropWord, lens, colouring, onKeep, onLensOff, chain }: {
  dropWord: string | undefined; lens: LandscapeColour | undefined; colouring: ReturnType<typeof useColouring>; onKeep: (() => void) | undefined; onLensOff: () => void; chain: boolean
}) {
  const { t } = useStrings()
  if (!dropWord && !lens && !chain) return null
  return (
    <div className="tl-foot">
      {/* Said beside the row it would land on; here only for a screen reader, which is told as it changes. */}
      {dropWord && <div className="tl-verb kit-hidden" role="status" data-testid="landscape-verb">{dropWord}</div>}
      {lens && <KeyStrip values={colouring.values} pressed={colouring.pressed} onPress={colouring.setPressed} {...(onKeep ? { onKeep } : {})} onClose={{ label: t('landscape.lensOff'), press: onLensOff }} />}
      {chain && (
        <div className="tl-legend" data-testid="landscape-legend">
          {LINE_KINDS.map(({ kind, label }) => (
            <span key={kind}><svg aria-hidden="true"><path className="tl-line" data-kind={kind} d="M0,2 L26,2" /></svg>{t(label)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyLandscape({ add }: { add: TechnologyLandscapePageProps['onAdd'] }) {
  const { t } = useStrings()
  return (
    <div className="tl-empty">
      <PageState
        state="empty" title={t('landscape.emptyTitle')} body={t('landscape.emptyBody')}
        {...(add ? { action: { label: t('landscape.emptyService'), onPress: () => add({ kind: 'platformService' }) } } : {})}
      />
      {add && <Button variant="plain" onClick={() => add({ kind: 'platform' })}>{t('landscape.emptyPlatform')}</Button>}
    </div>
  )
}

function ReaderColumn({ props, landscape, grouped, selected, gestures, undo, onLetGo, onAddUnder }: {
  props: TechnologyLandscapePageProps; landscape: TechnologyLandscape; grouped: TechnologyLandscape; selected: NodeKey | undefined
  gestures: ReturnType<typeof useGestures>; undo: PanelUndo | undefined; onLetGo(): void
  onAddUnder: ReaderDoors['onAddUnder']
}) {
  const { t } = useStrings()
  const { writes, ticking, setTicking, appOf, nameOf } = gestures
  const usable = useMemo<PickerOption[]>(() => [
    ...serviceList(landscape).map(({ node }) => ({ id: node.id, label: node.name, ...(node.where ? { detail: node.where } : {}) })),
    ...platformList(landscape).filter(({ node }) => node.archetype !== 'place').map(({ node }) => ({ id: node.id, label: node.name })),
    ...(props.technologyElsewhere ?? []).map((one) => ({ id: one.id, label: one.name, detail: one.where, group: t('landscape.addElsewhere') })),
  ], [landscape, props.technologyElsewhere, t])
  const placesElsewhere = useMemo(() => (props.technologyElsewhere ?? []).filter((one) => one.place), [props.technologyElsewhere])
  const doors: ReaderDoors = {
    onEditRecord: props.record !== undefined ? () => gestures.setRecordUp(true) : undefined,
    onOpenElsewhere: props.onOpenElsewhere,
    onOpenContainers: props.onOpenContainers,
    hasContainers: props.hasContainers,
    onServiceReport: props.onOpenServiceReport,
    onPlatformReport: props.onOpenPlatformReport,
    onAddUnder,
  }
  const scopes = new Set(applicationList(landscape).map((app) => app.where ?? '')).size
  const looks = worthALook(landscape, t)
  const rest = (
    <>
      <PanelSection><p>{t('landscape.helpBody')}</p>{writes && <p>{t('landscape.helpDrag')}</p>}</PanelSection>
      {looks.length > 0 && <PanelSection title={t('landscape.lookTitle')}>{looks.map((line) => <p key={line}>{line}</p>)}</PanelSection>}
    </>
  )
  const savedIn = (id: ElementId) => {
    const where = appOf(id)?.where
    return where ? t('landscape.savedIn', { scope: where }) : t('landscape.savedHere')
  }
  return (
    <LandscapeReader
      landscape={grouped} model={props.model} selected={selected} doors={doors} undo={undo} rest={rest} nameOf={nameOf} savedIn={savedIn}
      restFoot={scopes > 0 ? t('landscape.fromScopes', { scopes: t(scopes === 1 ? 'landscape.scopesOne' : 'landscape.scopesOther', { count: scopes }) }) : undefined}
      onClose={onLetGo}
      writes={writes ? { setUse: writes.setUse, setHost: (app, platform) => writes.setHost(app, platform, appOf(app)?.saysHosted), usable, placesElsewhere, ticking, onTicking: setTicking } : undefined}
    />
  )
}

function AddPicker({ adding, onClose, add, onBring, elsewhere }: {
  adding: Adding; onClose(): void; add: TechnologyLandscapePageProps['onAdd']; onBring: TechnologyLandscapePageProps['onBring']; elsewhere: readonly TechnologyElsewhere[] | undefined
}) {
  const { t } = useStrings()
  const options = useMemo<PickerOption[]>(() => (elsewhere ?? [])
    .filter((one) => one.kind === adding.kind)
    .map((one) => ({ id: one.id, label: one.name, detail: one.where, group: t('landscape.addElsewhere') })), [adding.kind, elsewhere, t])
  return (
    <PickerAt
      open at={adding.at} onClose={onClose}
      label={adding.kind === 'platform' ? t('landscape.addPlatform') : t('landscape.addService')}
      placeholder={t('landscape.addHint')} options={options} recent={options.slice(0, 12)}
      onCreate={(name) => add?.({ kind: adding.kind, name, ...(adding.parentId !== undefined ? { parentId: adding.parentId } : {}) })}
      createLabel={(name) => t('landscape.addHere', { name })}
      onPick={(option) => onBring?.(option.id)}
    />
  )
}

export function TechnologyLandscapePage(props: TechnologyLandscapePageProps) {
  const { model, diagram, readOnly } = props
  const { t } = useStrings()
  const page = useRef<HTMLDivElement | null>(null)
  const readOn = diagram?.asOf ?? props.today
  const landscape = useMemo(() => (diagram ? technologyLandscape(model, diagram, {
    ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
    ...(props.describe ? { describe: props.describe } : {}),
    ...(props.tree ? { tree: props.tree } : {}),
    ...(props.sharedElsewhere ? { sharedElsewhere: props.sharedElsewhere } : {}),
    ...(readOn !== undefined ? { day: readOn } : {}),
  }) : undefined), [model, diagram, props.elsewhere, props.describe, props.tree, props.sharedElsewhere, readOn])

  const showing = useLandscapeShowing(landscape)
  const { selected, setSelected, lens, setLens, grouped, shown } = showing
  const { kept } = props
  useEffect(() => { if (LANDSCAPE_COLOURS.includes(kept as LandscapeColour)) setLens(kept as LandscapeColour) }, [kept, setLens])
  const colouring = useColouring(landscape, lens, props.ownerText)
  const choose = usePick(grouped, props, setSelected)
  const [reading, setReading] = usePlaceTab('chain')
  const [undo, setUndo] = useState<PanelUndo | undefined>(undefined)
  const [adding, setAdding] = useState<Adding | undefined>(undefined)
  const gestures = useGestures(props, landscape, selected, choose, setUndo)
  const { ticking, setTicking, recordUp, setRecordUp, writes, appOf } = gestures
  const capture = useHandle(props, page, selected)
  const exporting = useExport(props, capture)

  const { onOpenServiceReport, onOpenPlatformReport, onOpenContainers, onOpenElsewhere } = props
  const open = useCallback((key: NodeKey) => {
    const id = idOf(key)
    if (key.startsWith('service:')) onOpenServiceReport?.(id)
    else if (key.startsWith('platform:')) onOpenPlatformReport?.(id)
    else if (key.startsWith('application:') && !onOpenContainers?.(id) && !model.elements.some((one) => one.id === id)) onOpenElsewhere?.(id)
  }, [onOpenServiceReport, onOpenPlatformReport, onOpenContainers, onOpenElsewhere, model.elements])

  const groupLabel = useCallback((key: string, label?: string) => label ?? t(showing.groupBy === 'category' && key === '' ? 'landscape.noCategory' : 'landscape.thisScope'), [t, showing.groupBy])
  const tickApp = ticking !== undefined ? appOf(ticking) : undefined
  const markOf = useCallback((key: NodeKey) => {
    if (!tickApp || key.startsWith('application:') || key.startsWith('group:')) return colouring.swatchOf(key)
    const id = idOf(key)
    const tick = tickApp.hostedOn.includes(id) ? 'runs'
      : tickApp.uses.includes(id) || tickApp.binds.includes(id) ? 'use'
        : tickApp.implied.includes(id) ? 'implied' : 'none'
    const word = { runs: 'landscape.tickRuns', use: 'landscape.tickUses', implied: 'landscape.tickImplied', none: 'landscape.tickNone' } as const
    return <span className="tl-tick" data-tick={tick} role="img" aria-label={t(word[tick])} />
  }, [tickApp, colouring.swatchOf, t])

  const notes = useMemo(() => NOTES(t), [t])
  const add = readOnly ? undefined : props.onAdd
  const Frame = props.inline ? InlineFrame : PageDialog
  if (!landscape || !shown || !grouped) {
    return <Frame open={props.open} onClose={props.onClose} aria-label={t('landscape.page')}><div className="tl-empty"><p>{t('landscape.noView')}</p></div></Frame>
  }
  const isEmpty = holdsNothing(landscape)
  const chain = reading !== 'matrix'
  return (
    <Frame open={props.open} onClose={props.onClose} aria-label={t('landscape.page')}>
      <div className="tl-page">
        <div className="tl-first">
          <h2>{t('landscape.question')}</h2>
          <span data-testid="landscape-summary">{t('landscape.summary', landscape.counts)}</span>
        </div>
        <LandscapeBar props={props} showing={showing} landscape={landscape} groupLabel={groupLabel} reading={reading} setReading={setReading} onExport={exporting.open} />
        {exporting.dialog}
        <div className="tl-work">
          <div className="tl-main">
            {isEmpty ? <EmptyLandscape add={add} /> : (
              <div className="tl-scroll" data-testid="landscape-body" ref={page}>
                {chain ? (
                  <LandscapeChain
                    showing={showing} landscape={shown} markOf={markOf} quiet={colouring.quiet} dropTarget={gestures.dropTarget} dragging={gestures.dragging !== undefined} groupLabel={groupLabel}
                    {...(gestures.dragging !== undefined ? { draggedId: gestures.dragging } : {})} {...(gestures.dropWord !== undefined ? { dropWord: gestures.dropWord } : {})}
                    noteOfApplication={notes.application} noteOfService={notes.service} noteOfPlatform={notes.platform}
                    onPress={gestures.press} onOpen={open}
                    onAdd={add ? (kind, parentId, at) => setAdding({ kind, ...(parentId !== undefined ? { parentId } : {}), at: at ?? { x: 400, y: 200 } }) : undefined}
                    onDragStart={writes ? (id) => { gestures.setDragging(id); setTicking(undefined) } : undefined}
                    onDragEnd={() => { gestures.setDragging(undefined); gestures.setDropTarget(undefined) }}
                    onDragOverRow={gestures.setDropTarget} onDropRow={gestures.drop}
                  />
                ) : (
                  <LandscapeMatrix
                    landscape={shown} selected={selected} onSelect={(key) => { setRecordUp(false); choose(key) }}
                    onToggle={writes ? (app, target, on) => writes.setUse(app, target, on) : undefined}
                  />
                )}
              </div>
            )}
            {!isEmpty && (
              <LandscapeFoot
                dropWord={gestures.dropWord} lens={lens} colouring={colouring} chain={chain}
                onKeep={keepOf(props, lens)} onLensOff={() => setLens(undefined)}
              />
            )}
          </div>
          {recordUp && props.record && selected !== undefined ? (
            <div className="tl-record" data-testid="landscape-record">
              <div className="tl-recordBack"><Button variant="plain" size="small" data-testid="landscape-back-to-reader" onClick={() => setRecordUp(false)}>{t('landscape.backToReader')}</Button></div>
              <div className="tl-recordBody">{props.record}</div>
            </div>
          ) : !isEmpty && (
            <ReaderColumn props={props} landscape={landscape} grouped={grouped} selected={selected} gestures={gestures} undo={undo} onLetGo={() => { setTicking(undefined); choose(undefined) }}
              onAddUnder={add ? (kind, parentId, at) => setAdding({ kind, parentId, at }) : undefined} />
          )}
        </div>
        {adding && <AddPicker adding={adding} onClose={() => setAdding(undefined)} add={add} onBring={props.onBring} elsewhere={props.technologyElsewhere} />}
      </div>
    </Frame>
  )
}

/** The page in the tab: the same column, with no dialog around it. */
function InlineFrame({ children }: { children?: React.ReactNode; open?: boolean; onClose?(): void; 'aria-label'?: string }) {
  return <div className="tl-page">{children}</div>
}
