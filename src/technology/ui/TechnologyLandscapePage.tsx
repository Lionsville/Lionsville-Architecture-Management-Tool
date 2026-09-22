// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The technology landscape, on one page (ADR-0015).
 *
 * A page, not a canvas, for the reason the sheet and the map are pages:
 * every mark on it is derived from the rows by `model/technologyLandscape`,
 * and this file turns that answer into three bands — the applications by
 * the scope that answers for each, the services nested by parent, the
 * platforms nested where the tree nests — with an inspector on the right for
 * the card that is chosen. The arithmetic is tested in node; what this pins
 * is what a reader is promised on screen.
 *
 * **No lines at rest.** The cards carry counts, so the resting page is a
 * catalogue; hovering a card previews its lines, clicking pins them and dims
 * everything they do not touch. *All lines* is the escape hatch. The lines
 * are an SVG laid over the bands, drawn from where the cards ended up, and
 * redrawn when the page changes size — which is the one piece of geometry
 * on the page, and it is measured, never stored.
 *
 * Above `FOLD_ABOVE` applications every domain starts folded into one box;
 * a filter that brings the visible set under it unfolds the matches again.
 *
 * **One write gesture** (ADR-0020). A service or a platform is authored
 * through the docked inspector (ADR-0016); what an application uses or
 * runs on is written here, by dropping its card on a card in the lower
 * bands — a place takes `hostedOn`, a service platform or an offering takes
 * `uses`, and a shared offering from elsewhere brings its stand-in — or,
 * while an application is selected, by the small button every target card
 * then shows. The page calls the editor's own actions through the page
 * slot and builds no command itself. The board keeps its rule that only a
 * flow is a line; these lines are rows, never geometry.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { DesignDiagram, DesignModel, ElementId, Relation } from '../../model'
import {
  applicationList, landscapeEdges, nodeKey, platformList, serviceList, startsFolded, technologyLandscape, touchedBy,
} from '../../model'
import type {
  LandscapeApplication, LandscapeEdge, LandscapeEdgeKind, LandscapeGroup, LandscapePlatform, LandscapeService,
  LandscapeView, NodeKey, PlatformDescribe, PlatformTree, SharedElsewhere, TechnologyLandscape,
} from '../../model'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { AddIcon } from '../../widgets/icons'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'

export type TechnologyLandscapePageProps = {
  open: boolean
  /**
   * Drawn in the tab rather than as a page over the editor (ADR-0016): no
   * dialog, no back button; the editor's inspector edits the chosen service
   * or platform, so the record on the right is kept only for what this scope
   * does not hold — an application, a domain.
   */
  inline?: boolean
  /** The editor's selected element, and the way to choose one — with `inline`. */
  selectedId?: ElementId
  onSelect?(elementId: ElementId | undefined): void
  /** The card the page starts on: a record's door opened it here (ADR-0020). */
  focus?: NodeKey
  /** Make a service or a platform, filed under `parentId` where given. Absent = no `+` on the bands. */
  onAdd?(seed: { kind: 'platform' | 'platformService'; parentId?: ElementId }): void
  /**
   * The one write gesture (ADR-0020), as the editor's own actions: where an
   * application runs, and what it uses as the whole list. A target this
   * scope does not hold is the host's to bring as a stand-in. Absent = the
   * cards do not drag and offer no button.
   */
  onHost?(elementId: ElementId, platformId: ElementId): void
  onUse?(elementId: ElementId, targetIds: readonly ElementId[]): void
  /** A gesture that would say what is already said: told, rather than written twice. */
  notify?(message: string): void
  /** Every offering the rest of the tree marks shared, for the shared row (ADR-0020). A STABLE array. */
  sharedElsewhere?: readonly SharedElsewhere[]
  model: DesignModel
  /** Absent while the page is closing, or when the view was deleted under it. */
  diagram: DesignDiagram | undefined
  readOnly: boolean
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it — the same handle the sheet hands over. */
  onHandle?(handle: PageHandle | undefined): void
  /** Rows written in another scope that name a service or platform this scope holds. A STABLE array. */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name. Stable, likewise. */
  describe?: PlatformDescribe
  /** The platform tree, off the index, where a stand-in carries no parent. Stable. */
  tree?: PlatformTree
  /** The way to an element's own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
  /** The two reports, from the inspector. */
  onOpenServiceReport?(id: ElementId): void
  onOpenPlatformReport?(id: ElementId): void
}

const INSPECTOR_WIDTH = 300
/** Above this many domains the chips fold behind one menu rather than wrapping the toolbar. */
const CHIPS_BEFORE_MENU = 8

type Lines = 'focus' | 'all'

export function TechnologyLandscapePage(props: TechnologyLandscapePageProps) {
  const { model, diagram } = props
  const { t } = useStrings()
  const theme = useTheme()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const page = useRef<HTMLDivElement | null>(null)
  const board = useRef<HTMLDivElement | null>(null)

  const landscape = useMemo(
    () => (diagram
      ? technologyLandscape(model, diagram, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.tree ? { tree: props.tree } : {}),
        ...(props.sharedElsewhere ? { sharedElsewhere: props.sharedElsewhere } : {}),
      })
      : undefined),
    [model, diagram, props.elsewhere, props.describe, props.tree, props.sharedElsewhere],
  )
  // This scope's own offerings, and the shared row (ADR-0020).
  const own = useMemo(() => (landscape ?? { services: [] }).services.filter((service) => service.where === undefined), [landscape])
  const shared = useMemo(() => (landscape ?? { services: [] }).services.filter((service) => service.where !== undefined), [landscape])

  // --- what the page is showing --------------------------------------------
  const [query, setQuery] = useState('')
  const [domainsOff, setDomainsOff] = useState<ReadonlySet<string>>(new Set())
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [services, setServices] = useState(true)
  const [lines, setLines] = useState<Lines>('focus')
  const [foldHosting, setFoldHosting] = useState(false)
  const [showShared, setShowShared] = useState(true)
  const [onlyTouched, setOnlyTouched] = useState(false)
  const [selected, setSelected] = useState<NodeKey | undefined>(undefined)
  const [hovered, setHovered] = useState<NodeKey | undefined>(undefined)

  const asked = query.trim().toLowerCase()
  const visible = useMemo<LandscapeGroup[]>(() => (landscape ?? { groups: [] }).groups
    .filter((group) => !domainsOff.has(group.key))
    .map((group) => ({ ...group, applications: group.applications.filter((app) => !asked || app.name.toLowerCase().includes(asked)) }))
    .filter((group) => group.applications.length > 0), [landscape, domainsOff, asked])
  const shown = visible.reduce((sum, group) => sum + group.applications.length, 0)

  // Above the threshold every group starts folded; a filter that brings the
  // set under it opens them again. A hand fold on top is kept until the
  // threshold is crossed the other way.
  const wasBig = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    if (!landscape) return
    const big = startsFolded(shown)
    if (big === wasBig.current) return
    wasBig.current = big
    setFolded(new Set(big ? landscape.groups.map((group) => group.key) : []))
  }, [landscape, shown])

  const view = useMemo<LandscapeView>(() => ({ services, foldHosting, folded }), [services, foldHosting, folded])
  const focus = selected ?? hovered
  const touched = useMemo(
    () => (landscape && focus ? touchedBy(landscape, focus, view) : undefined),
    [landscape, focus, view],
  )
  const edges = useMemo<LandscapeEdge[]>(() => {
    if (!landscape) return []
    const all = landscapeEdges(landscape, view)
    if (lines === 'all') return all
    if (!touched) return []
    return all.filter((edge) => touched.has(edge.from) && touched.has(edge.to))
  }, [landscape, view, lines, touched])
  const dims = selected !== undefined ? touched : undefined
  const hides = (key: NodeKey) => onlyTouched && dims !== undefined && !dims.has(key)

  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const onSelect = props.onSelect
  const choose = useCallback((key: NodeKey) => {
    setSelected((was) => {
      const next = was === key ? undefined : key
      // What this scope holds is the editor's selection as well (ADR-0016);
      // an application or a domain is this page's alone.
      if (onSelect) {
        const id = next === undefined ? undefined : next.slice(next.indexOf(':') + 1)
        onSelect(id !== undefined && held.has(id) && !next!.startsWith('group:') ? id : undefined)
      }
      return next
    })
  }, [onSelect, held])
  // And the other way: a card the editor selected — one the palette just
  // made, say — is chosen here.
  const selectedId = props.selectedId
  useEffect(() => {
    if (!landscape || selectedId === undefined) return
    if (serviceList(landscape).some(({ node }) => node.id === selectedId)) setSelected(nodeKey.service(selectedId))
    else if (platformList(landscape).some(({ node }) => node.id === selectedId)) setSelected(nodeKey.platform(selectedId))
  }, [landscape, selectedId])
  // Where a door led: chosen as a click would choose it, so the editor's
  // panel edits an application this scope holds.
  const focusKey = props.focus
  useEffect(() => {
    if (!landscape || focusKey === undefined) return
    setSelected(focusKey)
    if (onSelect) {
      const id = focusKey.slice(focusKey.indexOf(':') + 1)
      onSelect(held.has(id) && !focusKey.startsWith('group:') ? id : undefined)
    }
  }, [landscape, focusKey, onSelect, held])
  const add = props.readOnly ? undefined : props.onAdd

  // --- the one write gesture (ADR-0020) ----------------------------------------
  const { onHost, onUse, notify } = props
  const writes = !props.readOnly && onHost !== undefined && onUse !== undefined
  const [dragging, setDragging] = useState<ElementId | undefined>(undefined)
  const nameOfCard = useCallback((id: ElementId) => (landscape ? nameOf(landscape, id) : id), [landscape])
  /**
   * The row follows the target: a place takes `hostedOn`, anything else
   * takes `uses`. A row already there is said rather than written twice;
   * the stand-in for a shared offering is the host's business, behind
   * `onUse`.
   */
  const write = useCallback((applicationId: ElementId, target: Target) => {
    if (!writes || !landscape) return
    const app = nameOfCard(applicationId)
    if (target.kind === 'platform' && target.archetype === 'place') {
      const hosted = model.relations.some((row) => row.type === 'hostedOn' && row.sourceId === applicationId && row.targetId === target.id)
      if (hosted) { notify?.(t('landscape.alreadyHosted', { app, name: nameOfCard(target.id) })); return }
      onHost(applicationId, target.id)
      return
    }
    const used = model.relations.filter((row) => row.type === 'uses' && row.sourceId === applicationId).map((row) => row.targetId)
    if (used.includes(target.id)) { notify?.(t('landscape.alreadyUses', { app, name: nameOfCard(target.id) })); return }
    onUse(applicationId, [...used, target.id])
  }, [writes, landscape, model.relations, onHost, onUse, notify, nameOfCard, t])
  const drop = useCallback((target: Target) => {
    if (dragging === undefined) return
    write(dragging, target)
    setDragging(undefined)
  }, [dragging, write])
  const dragStart = writes ? (id: ElementId) => { setDragging(id); setSelected(nodeKey.application(id)) } : undefined
  // The buttons every target shows while an application is chosen: the keyboard and touch path.
  const offering = writes && selected !== undefined && selected.startsWith('application:') ? selected.slice('application:'.length) : undefined
  const targeting = useMemo<Targeting | undefined>(() => (writes ? {
    over: dragging !== undefined,
    onDrop: drop,
    ...(offering !== undefined ? { onPress: (target: Target) => write(offering, target) } : {}),
  } : undefined), [writes, dragging, drop, offering, write])

  const fold = useCallback((key: string) => setFolded((held) => {
    const next = new Set(held)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  }), [])
  const allFolded = visible.length > 0 && visible.every((group) => folded.has(group.key))

  // --- the handle for the agent's renderer -----------------------------------
  const onHandle = props.onHandle
  const diagramId = diagram?.id
  const capture = useCallback(async (options: PageCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('TechnologyLandscapePage: the page is not on screen')
    return captureSheet(node, { ...options, background: theme.palette.background.default })
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || diagramId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId, capture })
    return () => onHandle(undefined)
  }, [onHandle, props.open, diagramId, capture])

  // --- the lines, measured off the cards --------------------------------------
  const [paths, setPaths] = useState<Drawn[]>([])
  const measure = useCallback(() => {
    const held = board.current
    if (!held) { setPaths([]); return }
    setPaths(drawEdges(held, edges))
  }, [edges])
  useLayoutEffect(() => { measure() }, [measure, visible, folded, services, foldHosting])
  useEffect(() => {
    const held = board.current
    if (!held || typeof ResizeObserver === 'undefined') return undefined
    const watcher = new ResizeObserver(() => measure())
    watcher.observe(held)
    return () => watcher.disconnect()
  }, [measure])

  const onHover = useCallback((event: React.MouseEvent) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-node]')
    const key = card?.dataset.node as NodeKey | undefined
    setHovered((held) => (held === key ? held : key))
  }, [])

  const menuDomains = landscape !== undefined && landscape.groups.length > CHIPS_BEFORE_MENU
  const [domainMenu, setDomainMenu] = useState(false)

  const Frame = props.inline ? InlineFrame : PageDialog
  return (
    <Frame open={props.open} topInset={chrome.topInset} onClose={props.onClose} aria-label={t('landscape.page')}>
      <Box
        data-testid="landscape-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: props.inline ? undefined : `${12 + bar.controlsInset}px`,
          WebkitAppRegion: !props.inline && bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        {!props.inline && (
          <Tooltip title={t('landscape.close')}>
            <IconButton size="small" aria-label={t('landscape.close')} onClick={props.onClose}>
              <BackIcon />
            </IconButton>
          </Tooltip>
        )}
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{diagram?.name ?? t('landscape.page')}</Typography>
        {landscape && (
          <Typography data-testid="landscape-summary" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {t('landscape.summary', landscape.counts)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      {landscape && (
        <Box
          data-testid="landscape-toolbar"
          sx={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, flexShrink: 0,
            borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', fontSize: 12,
          }}
        >
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('landscape.filter')}
            inputProps={{ 'aria-label': t('landscape.filter'), 'data-testid': 'landscape-filter' }}
            sx={{ fontSize: 12, px: 1, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, width: 200 }}
          />
          <Button size="small" variant={allFolded ? 'contained' : 'outlined'} data-testid="landscape-fold" disableElevation
            onClick={() => setFolded(new Set(allFolded ? [] : visible.map((group) => group.key)))}>
            {allFolded ? t('landscape.unfold') : t('landscape.fold')}
          </Button>
          {menuDomains ? (
            <Box sx={{ position: 'relative' }}>
              <Chip size="small" variant="outlined" label={t('landscape.domainsMenu', { count: landscape.groups.length })}
                onClick={() => setDomainMenu((held) => !held)} data-testid="landscape-domains-menu" />
              {domainMenu && (
                <Box sx={{
                  position: 'absolute', zIndex: 3, top: 28, left: 0, p: 1, width: 360, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5,
                  bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 4,
                }}>
                  {landscape.groups.map((group) => <DomainChip key={group.key} group={group} off={domainsOff.has(group.key)} onToggle={() => toggle(setDomainsOff, group.key)} t={t} theme={theme} />)}
                </Box>
              )}
            </Box>
          ) : landscape.groups.map((group) => (
            <DomainChip key={group.key} group={group} off={domainsOff.has(group.key)} onToggle={() => toggle(setDomainsOff, group.key)} t={t} theme={theme} />
          ))}
          <Box sx={{ width: 8 }} />
          <Button size="small" variant={services ? 'contained' : 'outlined'} data-testid="landscape-services" disableElevation
            onClick={() => setServices((held) => !held)}>
            {services ? t('landscape.hideServices') : t('landscape.showServices')}
          </Button>
          <Button size="small" variant={lines === 'all' ? 'contained' : 'outlined'} data-testid="landscape-lines-mode" disableElevation
            onClick={() => setLines((held) => (held === 'all' ? 'focus' : 'all'))}>
            {lines === 'all' ? t('landscape.linesAll') : t('landscape.linesFocus')}
          </Button>
          <FormControlLabel
            sx={{ ml: 0, '& .MuiTypography-root': { fontSize: 12 } }}
            control={<Checkbox size="small" checked={foldHosting} onChange={(event) => setFoldHosting(event.target.checked)} inputProps={{ 'data-testid': 'landscape-fold-hosting' } as never} />}
            label={t('landscape.foldHosting')}
          />
          {shared.length > 0 && (
            <FormControlLabel
              sx={{ ml: 0, '& .MuiTypography-root': { fontSize: 12 } }}
              control={<Checkbox size="small" checked={showShared} onChange={(event) => setShowShared(event.target.checked)} inputProps={{ 'data-testid': 'landscape-show-shared' } as never} />}
              label={t('landscape.sharedRow')}
            />
          )}
          <FormControlLabel
            sx={{ ml: 0, '& .MuiTypography-root': { fontSize: 12 } }}
            control={<Checkbox size="small" checked={onlyTouched} onChange={(event) => setOnlyTouched(event.target.checked)} inputProps={{ 'data-testid': 'landscape-only-touched' } as never} />}
            label={t('landscape.onlyTouched')}
          />
        </Box>
      )}

      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <Box
          ref={page}
          data-testid="landscape-body"
          sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2, position: 'relative' }}
          onClick={() => { setSelected(undefined); setDomainMenu(false) }}
        >
          {landscape ? (
            <Box ref={board} sx={{ position: 'relative' }} onMouseOver={onHover} onMouseLeave={() => setHovered(undefined)}>
              <svg data-testid="landscape-lines" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 2 }}>
                {paths.map((drawn) => (
                  <g key={drawn.key}>
                    <path d={drawn.d} fill="none" stroke={strokeOf(drawn.edge.kind, theme)} strokeWidth={drawn.edge.from === focus || drawn.edge.to === focus ? 2.2 : 1.4}
                      strokeDasharray={drawn.edge.implied ? '1 3' : dashOf(drawn.edge.kind)} opacity={0.85}>
                      <title>{drawn.title}</title>
                    </path>
                    {drawn.edge.count > 1 && (
                      <g>
                        <rect x={drawn.mid.x - 10} y={drawn.mid.y - 8} width={20} height={16} rx={8} fill={theme.palette.background.paper} stroke={theme.palette.divider} />
                        <text x={drawn.mid.x} y={drawn.mid.y + 4} textAnchor="middle" fontSize={10} fill={theme.palette.text.primary}>{drawn.edge.count}</text>
                      </g>
                    )}
                  </g>
                ))}
              </svg>

              <Band title={t('landscape.applications')} testId="landscape-applications"
                note={startsFolded(shown) ? t('landscape.foldedAbove', { count: shown }) : writes ? t('landscape.dragHint') : undefined}>
                {visible.length === 0 ? <Empty text={t('landscape.noApplications')} /> : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                    {visible.map((group, at) => (
                      <Domain key={group.key} group={group} colour={groupColour(at, theme)} folded={folded.has(group.key)}
                        onFold={() => fold(group.key)} selected={selected} dims={dims} hides={hides} onChoose={choose}
                        nameOf={(id) => nameOf(landscape, id)} onDragStart={dragStart} t={t} />
                    ))}
                  </Box>
                )}
              </Band>

              {/* No offerings here and none shared to show: the band is a strip,
                  and the layer degrades to one level (ADR-0020). */}
              <Band title={t('landscape.services')} testId="landscape-band-services"
                strip={own.length === 0 && (shared.length === 0 || !showShared)}
                note={!services ? t('landscape.servicesHidden', { count: landscape.counts.services })
                  : own.length === 0 && (shared.length === 0 || !showShared) ? t('landscape.noServicesStrip') : undefined}
                action={(
                  <>
                    {add && services && <AddButton label={t('landscape.addService')} testId="landscape-add-service" onClick={() => add({ kind: 'platformService' })} />}
                    <Button size="small" data-testid="landscape-services-band" onClick={(event) => { event.stopPropagation(); setServices((held) => !held) }} sx={{ fontSize: 11, py: 0 }}>
                      {services ? t('landscape.hideServices') : t('landscape.showServices')}
                    </Button>
                  </>
                )}>
                {services && own.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                    {own.map((service) => (
                      <ServiceNode key={service.id} service={service} selected={selected} dims={dims} onChoose={choose} onAdd={add} targeting={targeting} t={t} theme={theme} />
                    ))}
                  </Box>
                )}
                {services && shared.length > 0 && showShared && (
                  <Box data-testid="landscape-shared-row" sx={{ mt: own.length > 0 ? 1.5 : 0, pt: own.length > 0 ? 1.5 : 0, borderTop: own.length > 0 ? 1 : 0, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                      <Typography sx={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap' }}>{t('landscape.sharedRow')}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('landscape.sharedRowNote')}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                      {shared.map((service) => (
                        <SharedCard key={service.id} service={service} selected={selected} dims={dims} onChoose={choose} targeting={targeting}
                          nameOf={(id) => props.describe?.(id)?.name ?? nameOf(landscape, id)} t={t} />
                      ))}
                    </Box>
                  </Box>
                )}
              </Band>

              <Band title={t('landscape.platforms')} testId="landscape-band-platforms" last action={
                add ? <AddButton label={t('landscape.addPlatform')} testId="landscape-add-platform" onClick={() => add({ kind: 'platform' })} /> : undefined
              }>
                {landscape.platforms.length === 0 ? <Empty text={t('landscape.noPlatforms')} /> : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                    {landscape.platforms.map((platform) => (
                      <PlatformNode key={platform.id} platform={platform} selected={selected} dims={dims} onChoose={choose} onAdd={add} targeting={targeting} t={t} theme={theme} />
                    ))}
                  </Box>
                )}
              </Band>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>{t('landscape.noView')}</Typography>
          )}
        </Box>

        {landscape && selected !== undefined && !(props.inline && held.has(selected.slice(selected.indexOf(':') + 1)) && !selected.startsWith('group:')) && (
          <Inspector landscape={landscape} model={model} selected={selected} view={view} t={t}
            {...(props.onOpenDocumentation ? { onOpenDocumentation: props.onOpenDocumentation } : {})}
            {...(props.onOpenServiceReport ? { onOpenServiceReport: props.onOpenServiceReport } : {})}
            {...(props.onOpenPlatformReport ? { onOpenPlatformReport: props.onOpenPlatformReport } : {})} />
        )}
      </Box>

      <Box data-testid="landscape-legend" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 2, py: 0.5, borderTop: 1, borderColor: 'divider', fontSize: 11, color: 'text.secondary', bgcolor: 'background.paper' }}>
        {(['uses', 'realises', 'leverages', 'binds', 'hostedOn'] as const).map((kind) => (
          <Box key={kind} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <svg width={26} height={4}><line x1={0} y1={2} x2={26} y2={2} stroke={strokeOf(kind, theme)} strokeWidth={2} strokeDasharray={dashOf(kind)} /></svg>
            {t(LEGEND[kind])}
          </Box>
        ))}
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <svg width={26} height={4}><line x1={0} y1={2} x2={26} y2={2} stroke={strokeOf('uses', theme)} strokeWidth={2} strokeDasharray="1 3" /></svg>
          {t('landscape.legendImplied')}
        </Box>
      </Box>
    </Frame>
  )
}

/** The page in the tab: the same column, with no dialog around it. */
function InlineFrame({ children }: { children?: React.ReactNode; open?: boolean; topInset?: number; onClose?(): void; 'aria-label'?: string }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
}

function AddButton({ label, testId, onClick }: { label: string; testId: string; onClick(): void }) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} data-testid={testId} data-sheet-add onClick={(event) => { event.stopPropagation(); onClick() }} sx={{ p: 0.25 }}>
        <AddIcon />
      </IconButton>
    </Tooltip>
  )
}

const LEGEND = {
  uses: 'landscape.legendUses', realises: 'landscape.legendRealises', leverages: 'landscape.legendLeverages',
  binds: 'landscape.legendBinds', hostedOn: 'landscape.legendHosting',
} as const

function toggle(set: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>, key: string) {
  set((held) => { const next = new Set(held); if (next.has(key)) next.delete(key); else next.add(key); return next })
}

function strokeOf(kind: LandscapeEdgeKind, theme: Theme): string {
  switch (kind) {
    case 'uses': return theme.palette.text.secondary
    case 'realises': return theme.palette.secondary.main
    case 'leverages': return theme.palette.warning.main
    case 'binds': return theme.palette.info.main
    case 'hostedOn': return theme.palette.text.disabled
  }
}

function dashOf(kind: LandscapeEdgeKind): string | undefined {
  switch (kind) {
    case 'realises': return '5 4'
    case 'binds': return '2 3'
    case 'hostedOn': return '1 4'
    default: return undefined
  }
}

/** A domain's strip colour: the palette's mains, round and round. */
function groupColour(at: number, theme: Theme): string {
  const mains = [
    theme.palette.primary.main, theme.palette.secondary.main, theme.palette.success.main,
    theme.palette.warning.main, theme.palette.info.main, theme.palette.error.main,
  ]
  return mains[at % mains.length]!
}

function nameOf(landscape: TechnologyLandscape, id: ElementId): string {
  return serviceList(landscape).find(({ node }) => node.id === id)?.node.name
    ?? platformList(landscape).find(({ node }) => node.id === id)?.node.name
    ?? applicationList(landscape).find((app) => app.id === id)?.name
    ?? id
}

// --- drawing the lines ------------------------------------------------------

type Drawn = { key: string; d: string; mid: { x: number; y: number }; edge: LandscapeEdge; title: string }

/**
 * A cubic from the bottom edge of the source to the top edge of the target,
 * the anchors spread along each edge in the order of the other end's
 * position so the lines from one card fan out rather than stack.
 */
function drawEdges(board: HTMLElement, edges: readonly LandscapeEdge[]): Drawn[] {
  const origin = board.getBoundingClientRect()
  const box = (key: NodeKey) => {
    const node = board.querySelector<HTMLElement>(`[data-node="${key}"]`)
    if (!node) return undefined
    const rect = node.getBoundingClientRect()
    return { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height }
  }
  const placed = edges.map((edge) => ({ edge, a: box(edge.from), b: box(edge.to) }))
    .filter((one): one is { edge: LandscapeEdge; a: NonNullable<ReturnType<typeof box>>; b: NonNullable<ReturnType<typeof box>> } => one.a !== undefined && one.b !== undefined)
    .map((one) => ({ ...one, sx: 0, sy: 0, tx: 0, ty: 0 }))
  const bySource = new Map<NodeKey, typeof placed>()
  const byTarget = new Map<NodeKey, typeof placed>()
  for (const one of placed) {
    bySource.set(one.edge.from, [...(bySource.get(one.edge.from) ?? []), one])
    byTarget.set(one.edge.to, [...(byTarget.get(one.edge.to) ?? []), one])
  }
  for (const list of bySource.values()) {
    list.sort((p, q) => (p.b.x + p.b.w / 2) - (q.b.x + q.b.w / 2))
    list.forEach((one, at) => { one.sx = one.a.x + one.a.w * (0.15 + 0.7 * (at + 0.5) / list.length); one.sy = one.a.y + one.a.h })
  }
  for (const list of byTarget.values()) {
    list.sort((p, q) => (p.a.x + p.a.w / 2) - (q.a.x + q.a.w / 2))
    list.forEach((one, at) => { one.tx = one.b.x + one.b.w * (0.15 + 0.7 * (at + 0.5) / list.length); one.ty = one.b.y })
  }
  return placed.map((one) => {
    const dy = Math.max(30, (one.ty - one.sy) / 2)
    return {
      key: `${one.edge.from}|${one.edge.to}|${one.edge.kind}`,
      d: `M${one.sx},${one.sy} C${one.sx},${one.sy + dy} ${one.tx},${one.ty - dy} ${one.tx},${one.ty}`,
      mid: { x: (one.sx + one.tx) / 2, y: (one.sy + one.ty) / 2 },
      edge: one.edge,
      title: `${one.edge.kind}${one.edge.implied ? ' · implied' : ''}${one.edge.via ? ` · ${one.edge.via.join(', ')}` : ''}${one.edge.count > 1 ? ` × ${one.edge.count}` : ''}`,
    }
  })
}

// --- the bands and their cards ----------------------------------------------

/** A band, or — with `strip` — its one-line header alone, with a small margin so the band below moves up. */
function Band({ title, note, action, testId, last, strip, children }: {
  title: string; note?: string; action?: React.ReactNode; testId: string; last?: boolean; strip?: boolean; children: React.ReactNode
}) {
  return (
    <Box data-testid={testId} data-strip={strip ? 'true' : undefined}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: strip ? 0.5 : 1.5, mb: last ? 0 : strip ? 3 : 8, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: strip ? 0 : 1, minHeight: 22 }}>
        <Typography sx={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap' }}>{title}</Typography>
        {note && <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</Typography>}
        <Box sx={{ flex: 1 }} />
        {action}
      </Box>
      {children}
    </Box>
  )
}

function Empty({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>{text}</Typography>
}

/** The look a card shares: chosen, dimmed, or hidden. */
function cardSx(key: NodeKey, selected: NodeKey | undefined, dims: ReadonlySet<NodeKey> | undefined, hidden: boolean) {
  return {
    position: 'relative' as const, zIndex: 3, cursor: 'pointer',
    outline: selected === key ? 2 : 0, outlineColor: 'primary.main', outlineOffset: '1px',
    opacity: dims !== undefined && !dims.has(key) ? 0.28 : 1,
    display: hidden ? 'none' : undefined,
  }
}

/** The same, said on the element, so a test and a screen reader can read it. */
function cardData(key: NodeKey, dims: ReadonlySet<NodeKey> | undefined, hidden: boolean) {
  return {
    ...(dims !== undefined && !dims.has(key) ? { 'data-dimmed': 'true' } : {}),
    ...(hidden ? { hidden: true } : {}),
  }
}

function DomainChip({ group, off, onToggle, t }: { group: LandscapeGroup; off: boolean; onToggle(): void; t: Translate; theme: Theme }) {
  return (
    <Chip size="small" variant="outlined" label={group.label ?? t('landscape.thisScope')} onClick={onToggle}
      data-testid={`landscape-domain-chip-${group.key}`} sx={{ opacity: off ? 0.4 : 1, fontSize: 11 }} />
  )
}

function Domain({ group, colour, folded, onFold, selected, dims, hides, onChoose, nameOf: name, onDragStart, t }: {
  group: LandscapeGroup; colour: string; folded: boolean; onFold(): void
  selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; hides(key: NodeKey): boolean
  onChoose(key: NodeKey): void; nameOf(id: ElementId): string; onDragStart?: ((id: ElementId) => void) | undefined; t: Translate
}) {
  const key = nodeKey.group(group.key)
  const label = group.label ?? t('landscape.thisScope')
  if (folded) {
    return (
      <Box data-node={key} data-testid={`landscape-group-${group.key}`} {...cardData(key, dims, hides(key))} onClick={(event) => { event.stopPropagation(); onChoose(key) }}
        sx={{ ...cardSx(key, selected, dims, hides(key)), border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: colour, borderRadius: 1, px: 1.25, py: 0.5, bgcolor: 'background.paper' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, display: 'flex', gap: 1, alignItems: 'baseline' }}>
          <Box component="span" role="button" data-testid={`landscape-unfold-${group.key}`} onClick={(event) => { event.stopPropagation(); onFold() }} sx={{ cursor: 'pointer' }}>{label}</Box>
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: 11 }}>
            {plural(t, { one: 'landscape.applicationsOne', other: 'landscape.applicationsOther' }, group.applications.length)}
          </Box>
        </Typography>
      </Box>
    )
  }
  return (
    <Box data-testid={`landscape-group-${group.key}`} sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5, pt: 2.5, px: 1, pb: 1, position: 'relative', minWidth: 120, opacity: dims !== undefined && !group.applications.some((app) => dims.has(nodeKey.application(app.id))) ? 0.28 : 1 }}>
      <Box role="button" data-testid={`landscape-fold-${group.key}`} onClick={(event) => { event.stopPropagation(); onFold() }}
        sx={{ position: 'absolute', left: 8, top: 2, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', gap: 0.75, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: colour }} />
        {label}
        <Box component="span" sx={{ fontSize: 9, opacity: 0.7 }}>▾</Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: 470 }}>
        {group.applications.map((app) => (
          <ApplicationCard key={app.id} app={app} colour={colour} selected={selected} dims={dims} hidden={hides(nodeKey.application(app.id))} onChoose={onChoose} nameOf={name} onDragStart={onDragStart} t={t} />
        ))}
      </Box>
    </Box>
  )
}

function ApplicationCard({ app, colour, selected, dims, hidden, onChoose, nameOf: name, onDragStart, t }: {
  app: LandscapeApplication; colour: string; selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; hidden: boolean
  onChoose(key: NodeKey): void; nameOf(id: ElementId): string; onDragStart?: ((id: ElementId) => void) | undefined; t: Translate
}) {
  const key = nodeKey.application(app.id)
  // The hosting, the offerings it uses, the platforms it binds to: each
  // said only where it is said, so a card that only runs somewhere says
  // that alone rather than "0 services" (ADR-0020).
  const uses = app.uses.length + app.implied.length
  const said = [
    app.hostedOn.length > 0 ? t('landscape.on', { name: name(app.hostedOn[0]!) }) : '',
    uses > 0 ? plural(t, { one: 'landscape.servicesOne', other: 'landscape.servicesOther' }, uses) : '',
    app.binds.length > 0 ? plural(t, { one: 'landscape.platformsOne', other: 'landscape.platformsOther' }, app.binds.length) : '',
  ].filter(Boolean)
  return (
    <Box data-node={key} data-testid={`landscape-application-${app.id}`} {...cardData(key, dims, hidden)} onClick={(event) => { event.stopPropagation(); onChoose(key) }}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart ? (event) => { event.dataTransfer?.setData('text/plain', app.id); onDragStart(app.id) } : undefined}
      sx={{ ...cardSx(key, selected, dims, hidden), width: 144, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderTop: 3, borderTopColor: colour, borderRadius: 1, px: 0.875, py: 0.5, cursor: onDragStart ? 'grab' : 'pointer' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: app.known ? undefined : 'italic' }}>{app.name}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {said.length > 0 ? said.join(' · ') : t('landscape.nothingSaid')}
      </Typography>
    </Box>
  )
}

// --- the targets of the write gesture ------------------------------------------

/** A card an application may be dropped on, and what the drop means. */
type Target = { kind: 'platform'; id: ElementId; archetype: LandscapePlatform['archetype'] } | { kind: 'service'; id: ElementId }

/** How the lower bands take the gesture: a drop in flight, and the button while an application is chosen. */
type Targeting = {
  /** An application is being dragged: the cards may take it. */
  over: boolean
  onDrop(target: Target): void
  /** Present while an application is selected: the button's action. */
  onPress?(target: Target): void
}

/** The drop handlers a target card wears, and the button it shows. */
function targetProps(targeting: Targeting | undefined, target: Target) {
  if (!targeting) return {}
  return {
    onDragOver: (event: React.DragEvent) => { if (targeting.over) event.preventDefault() },
    onDrop: (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); targeting.onDrop(target) },
  }
}

function TargetButton({ targeting, target, t }: { targeting: Targeting | undefined; target: Target; t: Translate }) {
  const press = targeting?.onPress
  if (!press) return null
  const hosts = target.kind === 'platform' && target.archetype === 'place'
  return (
    <Button size="small" variant="outlined" color="primary" data-testid={`landscape-${hosts ? 'host' : 'use'}-${target.id}`}
      onClick={(event) => { event.stopPropagation(); press(target) }}
      sx={{ position: 'absolute', right: 4, top: 4, fontSize: 10, py: 0, px: 0.75, minWidth: 0, lineHeight: '16px', zIndex: 4, bgcolor: 'background.paper' }}>
      {hosts ? t('landscape.hostHere') : t('landscape.use')}
    </Button>
  )
}

/** An offering another scope marks shared (ADR-0020): dimmed until something here uses it. */
function SharedCard({ service, selected, dims, onChoose, targeting, nameOf: name, t }: {
  service: LandscapeService; selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; onChoose(key: NodeKey): void
  targeting: Targeting | undefined; nameOf(id: ElementId): string; t: Translate
}) {
  const key = nodeKey.service(service.id)
  const ghost = service.consumers === 0
  return (
    <Box data-node={key} data-testid={`landscape-shared-${service.id}`} {...cardData(key, dims, false)} {...(ghost ? { 'data-ghost': 'true' } : {})}
      {...targetProps(targeting, { kind: 'service', id: service.id })}
      onClick={(event) => { event.stopPropagation(); onChoose(key) }}
      sx={{
        ...cardSx(key, selected, dims, false), width: 180, bgcolor: 'background.paper', border: 1, borderStyle: ghost ? 'dashed' : 'solid', borderColor: 'divider',
        borderLeft: 3, borderLeftColor: 'secondary.main', borderRadius: 1, px: 1, py: 0.75,
        opacity: dims !== undefined && !dims.has(key) ? 0.28 : ghost ? 0.6 : 1,
      }}>
      <TargetButton targeting={targeting} target={{ kind: 'service', id: service.id }} t={t} />
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, pr: targeting?.onPress ? 5 : 0 }}>{service.name}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
        {[t('landscape.from', { name: service.where ?? '' }), service.realisedBy.length > 0 ? t('landscape.realisedByNames', { names: service.realisedBy.map(name).join(', ') }) : ''].filter(Boolean).join(' · ')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
        {lifecycleTag(service.lifecycle, t)}
        <Tag text={t('landscape.shared')} tone="service" />
        {service.standIn && <Tag text={t('landscape.standInHere')} />}
        <Tag text={plural(t, { one: 'landscape.usersOne', other: 'landscape.usersOther' }, service.consumers)} />
      </Box>
    </Box>
  )
}

function Tag({ text, tone }: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'service' }) {
  const colour = tone === 'ok' ? 'success.main' : tone === 'warn' ? 'warning.main' : tone === 'bad' ? 'error.main' : tone === 'service' ? 'secondary.main' : 'text.secondary'
  return (
    <Box component="span" sx={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', border: 1, borderColor: colour, color: colour, borderRadius: 0.5, px: 0.5, lineHeight: '14px' }}>{text}</Box>
  )
}

function lifecycleTag(lifecycle: LandscapeService['lifecycle'], t: Translate) {
  if (lifecycle === 'live') return null
  const tone = lifecycle === 'planned' ? 'warn' : 'bad'
  const key = lifecycle === 'planned' ? 'landscape.planned' : lifecycle === 'retiring' ? 'landscape.retiring' : 'landscape.retired'
  return <Tag text={t(key)} tone={tone} />
}

type OnAdd = ((seed: { kind: 'platform' | 'platformService'; parentId?: ElementId }) => void) | undefined

function ServiceNode({ service, selected, dims, onChoose, onAdd, targeting, t, theme }: {
  service: LandscapeService; selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; onChoose(key: NodeKey): void; onAdd: OnAdd
  targeting: Targeting | undefined; t: Translate; theme: Theme
}) {
  const card = <ServiceCard service={service} selected={selected} dims={dims} onChoose={onChoose} targeting={targeting} t={t} />
  if (service.children.length === 0) return card
  return (
    <Box data-testid={`landscape-service-group-${service.id}`} sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5, p: 1, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
      {card}
      {service.children.map((child) => <ServiceNode key={child.id} service={child} selected={selected} dims={dims} onChoose={onChoose} onAdd={onAdd} targeting={targeting} t={t} theme={theme} />)}
      {onAdd && <AddButton label={t('landscape.addServiceUnder', { name: service.name })} testId={`landscape-add-service-${service.id}`} onClick={() => onAdd({ kind: 'platformService', parentId: service.id })} />}
    </Box>
  )
}

function ServiceCard({ service, selected, dims, onChoose, targeting, t }: {
  service: LandscapeService; selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; onChoose(key: NodeKey): void
  targeting: Targeting | undefined; t: Translate
}) {
  const key = nodeKey.service(service.id)
  return (
    <Box data-node={key} data-testid={`landscape-service-${service.id}`} {...cardData(key, dims, false)} {...targetProps(targeting, { kind: 'service', id: service.id })}
      onClick={(event) => { event.stopPropagation(); onChoose(key) }}
      sx={{ ...cardSx(key, selected, dims, false), width: 180, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: 'secondary.main', borderRadius: 1, px: 1, py: 0.75 }}>
      <TargetButton targeting={targeting} target={{ kind: 'service', id: service.id }} t={t} />
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, pr: targeting?.onPress ? 5 : 0 }}>{service.name}</Typography>
      {service.summary && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{service.summary}</Typography>}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
        {lifecycleTag(service.lifecycle, t)}
        {service.shared && <Tag text={t('landscape.shared')} tone="service" />}
        <Tag text={plural(t, { one: 'landscape.usersOne', other: 'landscape.usersOther' }, service.consumers)} />
        <Tag text={plural(t, { one: 'landscape.realisersOne', other: 'landscape.realisersOther' }, service.realisedBy.length)} tone={service.realisedBy.length === 0 ? 'warn' : undefined} />
      </Box>
    </Box>
  )
}

function PlatformNode({ platform, selected, dims, onChoose, onAdd, targeting, t, theme }: {
  platform: LandscapePlatform; selected: NodeKey | undefined; dims: ReadonlySet<NodeKey> | undefined; onChoose(key: NodeKey): void; onAdd: OnAdd
  targeting: Targeting | undefined; t: Translate; theme: Theme
}) {
  const key = nodeKey.platform(platform.id)
  const target: Target = { kind: 'platform', id: platform.id, archetype: platform.archetype }
  const tags = (
    <>
      {platform.outside && <Tag text={t('landscape.outside')} />}
      {lifecycleTag(platform.lifecycle, t)}
      {platform.realises.length === 0
        ? <Tag text={t('landscape.placeOnly')} />
        : <Tag text={plural(t, { one: 'landscape.applicationsOne', other: 'landscape.applicationsOther' }, platform.applications)} />}
    </>
  )
  if (platform.children.length === 0) {
    return (
      <Box data-node={key} data-testid={`landscape-platform-${platform.id}`} {...cardData(key, dims, false)} {...targetProps(targeting, target)}
        onClick={(event) => { event.stopPropagation(); onChoose(key) }}
        sx={{ ...cardSx(key, selected, dims, false), width: 156, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: 'text.disabled', borderRadius: 1, px: 0.875, py: 0.625 }}>
        <TargetButton targeting={targeting} target={target} t={t} />
        <Typography sx={{ fontSize: 12, fontWeight: 600, pr: targeting?.onPress ? 5 : 0 }}>{platform.name}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>{tags}</Box>
      </Box>
    )
  }
  return (
    <Box data-testid={`landscape-platform-${platform.id}`} sx={{ border: 1, borderStyle: platform.outside ? 'dashed' : 'solid', borderColor: 'divider', borderRadius: 1.5, pt: 3, px: 1, pb: 1, position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', bgcolor: alpha(theme.palette.background.paper, 0.4) }}>
      <Box data-node={key} {...cardData(key, dims, false)} {...targetProps(targeting, target)} onClick={(event) => { event.stopPropagation(); onChoose(key) }}
        sx={{ ...cardSx(key, selected, dims, false), position: 'absolute', left: 8, top: 4, fontSize: 11, display: 'flex', gap: 0.75, alignItems: 'center', px: 0.5, borderRadius: 0.5 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{platform.name}</Box>
        {tags}
        {targeting?.onPress && (
          <Button size="small" variant="outlined" color="primary" data-testid={`landscape-${platform.archetype === 'place' ? 'host' : 'use'}-${platform.id}`}
            onClick={(event) => { event.stopPropagation(); targeting.onPress?.(target) }}
            sx={{ fontSize: 10, py: 0, px: 0.75, minWidth: 0, lineHeight: '16px', bgcolor: 'background.paper' }}>
            {platform.archetype === 'place' ? t('landscape.hostHere') : t('landscape.use')}
          </Button>
        )}
      </Box>
      {platform.children.map((child) => <PlatformNode key={child.id} platform={child} selected={selected} dims={dims} onChoose={onChoose} onAdd={onAdd} targeting={targeting} t={t} theme={theme} />)}
      {onAdd && <AddButton label={t('landscape.addPlatformUnder', { name: platform.name })} testId={`landscape-add-platform-${platform.id}`} onClick={() => onAdd({ kind: 'platform', parentId: platform.id })} />}
    </Box>
  )
}

// --- the inspector ------------------------------------------------------------

function Inspector({ landscape, model, selected, view, t, onOpenDocumentation, onOpenServiceReport, onOpenPlatformReport }: {
  landscape: TechnologyLandscape; model: DesignModel; selected: NodeKey; view: LandscapeView; t: Translate
  onOpenDocumentation?(id: ElementId): void; onOpenServiceReport?(id: ElementId): void; onOpenPlatformReport?(id: ElementId): void
}) {
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const at = selected.indexOf(':')
  const kind = selected.slice(0, at) as 'application' | 'group' | 'service' | 'platform'
  const id = selected.slice(at + 1)
  const name = (of: ElementId) => nameOf(landscape, of)
  const link = (of: ElementId) => (onOpenDocumentation && held.has(of)
    ? <Box component="a" role="link" onClick={(event) => { event.stopPropagation(); onOpenDocumentation(of) }} sx={{ cursor: 'pointer', color: 'primary.main' }}>{name(of)}</Box>
    : <>{name(of)}</>)
  const edges = landscapeEdges(landscape, { ...view, folded: new Set() })
  const list = (ids: readonly ElementId[], note?: (of: ElementId) => string | undefined) => (ids.length === 0
    ? <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{t('landscape.nothing')}</Typography>
    : <Box component="ul" sx={{ m: 0, pl: 2, fontSize: 12.5 }}>{ids.map((of) => <li key={of}>{link(of)}{note?.(of) ? <Box component="span" sx={{ color: 'text.secondary' }}> · {note(of)}</Box> : null}</li>)}</Box>)

  let title = ''
  let body: React.ReactNode = null
  let report: (() => void) | undefined
  if (kind === 'application') {
    const app = applicationList(landscape).find((one) => one.id === id)
    if (app) {
      title = app.name
      const leverages = edges.filter((edge) => edge.from === selected && edge.kind === 'leverages')
      const behind = landscapeEdges(landscape, { services: false, foldHosting: false, folded: new Set() }).filter((edge) => edge.from === selected && edge.kind === 'leverages')
      const stands = leverages.length > 0 ? leverages : behind
      body = (
        <>
          <Caption text={t('landscape.hostedOn')} />{list(app.hostedOn)}
          <Caption text={t('landscape.uses')} />{list(app.uses)}
          {app.implied.length > 0 && <><Caption text={t('landscape.implied')} />{list(app.implied)}</>}
          {app.binds.length > 0 && <><Caption text={t('landscape.binds')} />{list(app.binds)}</>}
          <Caption text={t('landscape.leverages')} />
          {list(stands.map((edge) => edge.to.slice('platform:'.length)), (of) => {
            const via = stands.find((edge) => edge.to === nodeKey.platform(of))?.via
            return via ? t('landscape.leveragesVia', { services: via.map(name).join(', ') }) : undefined
          })}
        </>
      )
    }
  }
  if (kind === 'group') {
    const group = landscape.groups.find((one) => one.key === id)
    if (group) {
      title = group.label ?? t('landscape.thisScope')
      const used = new Map<ElementId, number>()
      for (const app of group.applications) for (const of of [...app.uses, ...app.implied]) used.set(of, (used.get(of) ?? 0) + 1)
      body = (
        <>
          <Caption text={t('landscape.applications')} />{list(group.applications.map((app) => app.id))}
          <Caption text={t('landscape.uses')} />
          {list([...used.keys()].sort((a, b) => (used.get(b) ?? 0) - (used.get(a) ?? 0)), (of) => String(used.get(of)))}
        </>
      )
    }
  }
  if (kind === 'service') {
    const service = serviceList(landscape).find(({ node }) => node.id === id)?.node
    if (service) {
      title = service.name
      report = onOpenServiceReport && held.has(id) ? () => onOpenServiceReport(id) : undefined
      const users = applicationList(landscape).filter((app) => app.uses.includes(id) || app.implied.includes(id))
      body = (
        <>
          {service.summary && <Typography sx={{ fontSize: 12.5, mb: 1 }}>{service.summary}</Typography>}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{lifecycleTag(service.lifecycle, t)}{service.shared && <Tag text={t('landscape.shared')} tone="service" />}</Box>
          <Caption text={t('landscape.realisedBy')} />{list(service.realisedBy)}
          <Caption text={t('landscape.usedBy')} />
          {list(users.map((app) => app.id), (of) => {
            const app = users.find((one) => one.id === of)
            return [app?.where, app?.implied.includes(id) ? t('landscape.impliedNote') : undefined].filter(Boolean).join(' · ') || undefined
          })}
        </>
      )
    }
  }
  if (kind === 'platform') {
    const found = platformList(landscape).find(({ node }) => node.id === id)
    if (found) {
      const { node: platform, above } = found
      title = platform.name
      report = onOpenPlatformReport && held.has(id) ? () => onOpenPlatformReport(id) : undefined
      const standing = applicationList(landscape).filter((app) => (
        app.binds.includes(id) || app.hostedOn.includes(id)
        || landscapeEdges(landscape, { services: false, foldHosting: false, folded: new Set() })
          .some((edge) => edge.kind === 'leverages' && edge.from === nodeKey.application(app.id) && edge.to === selected)
      ))
      body = (
        <>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Tag text={platform.archetype} />{platform.outside && <Tag text={t('landscape.outside')} />}{lifecycleTag(platform.lifecycle, t)}
          </Box>
          <Caption text={t('landscape.standsUnder')} />{list(above.map((one) => one.id))}
          {platform.children.length > 0 && <><Caption text={t('landscape.under')} />{list(platform.children.map((one) => one.id))}</>}
          <Caption text={t('landscape.realises')} />{list(platform.realises)}
          <Caption text={t('landscape.standingOn')} />{list(standing.map((app) => app.id), (of) => standing.find((app) => app.id === of)?.where)}
        </>
      )
    }
  }

  return (
    <Box data-testid="landscape-inspector" onClick={(event) => event.stopPropagation()}
      sx={{ width: INSPECTOR_WIDTH, flexShrink: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto', p: 2 }}>
      <Typography data-testid="landscape-inspector-title" sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>{t(KIND_LABEL[kind])}</Typography>
      {report && (
        <Button size="small" variant="outlined" data-testid="landscape-report" onClick={report} sx={{ mb: 1, fontSize: 11 }}>{t('landscape.report')}</Button>
      )}
      {body}
    </Box>
  )
}

const KIND_LABEL = {
  application: 'landscape.kindApplication', group: 'landscape.kindGroup', service: 'landscape.kindService', platform: 'landscape.kindPlatform',
} as const

function Caption({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'text.secondary', mt: 1.5, mb: 0.25 }}>{text}</Typography>
}
