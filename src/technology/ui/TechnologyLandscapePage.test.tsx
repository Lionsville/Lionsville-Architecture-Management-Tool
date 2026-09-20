// @vitest-environment jsdom
/**
 * The technology landscape, on screen (ADR-0015).
 *
 * The arithmetic is pinned in `model/technologyLandscape.test.ts`; what is
 * pinned here is what the page promises a reader — three bands, the
 * applications in a box per scope, no lines until a card is chosen, the
 * service band that folds and reroutes, the domains that fold above the
 * threshold and open under a filter, and the record on the right.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { TechnologyLandscapePage } from './TechnologyLandscapePage'
import type { TechnologyLandscapePageProps } from './TechnologyLandscapePage'
import { renderShell } from '../../app/testing/renderShell'
import { element } from '../../model/testFixtures'
import { FOLD_ABOVE } from '../../model'
import type { DesignDiagram, DesignModel, PlatformDescribe, Relation } from '../../model'

afterEach(() => cleanup())

const VIEW: DesignDiagram = { id: 'tl-1', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } }
const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation => ({ id, type, sourceId, targetId })

function model(): DesignModel {
  return {
    name: 'Platforms',
    diagrams: [VIEW],
    elements: [
      element('containers', { kind: 'platformService', name: 'Container platform', description: 'A namespace on a managed cluster.', shared: true }),
      element('brokering', { kind: 'platformService', name: 'Message brokering' }),
      element('landing-zone', { kind: 'platform', name: 'Landing zone', platformArchetype: 'place', outside: true }),
      element('openshift', { kind: 'platform', name: 'OpenShift', platformArchetype: 'place', parentId: 'landing-zone' }),
      element('kafka', { kind: 'platform', name: 'Event broker' }),
    ],
    relations: [
      row('r1', 'realises', 'openshift', 'containers'),
      row('r2', 'realises', 'kafka', 'brokering'),
    ],
  }
}
const elsewhere: Relation[] = [
  row('l1', 'uses', 'wms', 'containers'),
  row('l2', 'uses', 'wms', 'brokering'),
  row('l3', 'hostedOn', 'wms-api', 'openshift'),
  row('l4', 'uses', 'portal', 'containers'),
  row('l5', 'uses', 'rater', 'kafka'),
  row('l6', 'uses', 'rater', 'containers'),
]
const describe_: PlatformDescribe = (id) => ({
  wms: { name: 'Warehouse Management', kind: 'application' as const, where: 'logistics' },
  'wms-api': { name: 'WMS API', kind: 'component' as const, parentId: 'wms', where: 'logistics' },
  portal: { name: 'Customer portal', kind: 'application' as const, where: 'channels' },
  rater: { name: 'Rating (legacy)', kind: 'application' as const, where: 'logistics' },
}[id])

function open(over: Partial<TechnologyLandscapePageProps> = {}) {
  return renderShell(
    <TechnologyLandscapePage open model={model()} diagram={VIEW} readOnly={false} onClose={() => {}} elsewhere={elsewhere} describe={describe_} {...over} />,
  )
}

describe('the three bands', () => {
  it('draws the applications in a box per scope, the services, and the platforms nested', () => {
    open()
    expect(screen.getByTestId('landscape-summary').textContent).toBe('3 applications · 2 services · 3 platforms')
    const apps = screen.getByTestId('landscape-applications')
    expect(within(apps).getAllByTestId(/^landscape-group-/).map((box) => box.dataset.testid)).toEqual(['landscape-group-channels', 'landscape-group-logistics'])
    // A platform bound to is said as one, not counted among the services (ADR-0020).
    expect(within(screen.getByTestId('landscape-group-logistics')).getAllByTestId(/^landscape-application-/).map((card) => card.textContent)).toEqual([
      'Rating (legacy)1 service · 1 platform', 'Warehouse Managementon OpenShift · 2 services',
    ])
    expect(screen.getByTestId('landscape-service-containers').textContent).toContain('A namespace on a managed cluster.')
    expect(screen.getByTestId('landscape-service-containers').textContent).toContain('3 users')
    // The cluster sits in the landing zone, so its card is inside the zone's box.
    const zone = screen.getByTestId('landscape-platform-landing-zone')
    expect(within(zone).getByTestId('landscape-platform-openshift').textContent).toContain('OpenShift')
    expect(zone.textContent).toContain('outside')
  })

  it('draws no lines at rest, and the lines of the card that is chosen', () => {
    open()
    expect(screen.getByTestId('landscape-lines').querySelectorAll('path')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('landscape-service-containers'))
    const titles = [...screen.getByTestId('landscape-lines').querySelectorAll('path title')].map((title) => title.textContent)
    // The model's own word on the line, as the agent reads it; the legend
    // says "delivers". The hosting of a consumer whose platform the service
    // touches is drawn too: hosting is a line at rest (ADR-0020).
    expect(titles).toEqual(['uses', 'uses', 'uses', 'hostedOn', 'realises'])
    // What the selection does not touch is dimmed; what it does is not.
    expect(screen.getByTestId('landscape-platform-kafka').dataset.dimmed).toBe('true')
    expect(screen.getByTestId('landscape-application-wms').dataset.dimmed).toBeUndefined()
    expect(screen.getByTestId('landscape-inspector-title').textContent).toBe('Container platform')
    // Clicking the card again lets go.
    fireEvent.click(screen.getByTestId('landscape-service-containers'))
    expect(screen.queryByTestId('landscape-inspector')).toBeNull()
  })

  it('draws every line when asked to', () => {
    open()
    fireEvent.click(screen.getByTestId('landscape-lines-mode'))
    expect(screen.getByTestId('landscape-lines').querySelectorAll('path')).toHaveLength(8)
  })
})

describe('the service band', () => {
  it('folds to a strip and reroutes the lines straight to the platforms', () => {
    open()
    fireEvent.click(screen.getByTestId('landscape-services'))
    expect(screen.queryByTestId('landscape-service-containers')).toBeNull()
    expect(screen.getByTestId('landscape-band-services').textContent).toContain('2 services hidden')
    fireEvent.click(screen.getByTestId('landscape-application-wms'))
    const titles = [...screen.getByTestId('landscape-lines').querySelectorAll('path title')].map((title) => title.textContent)
    expect(titles).toEqual(['leverages · containers', 'leverages · brokering', 'hostedOn'])
    // The record says the same, and through which service.
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('OpenShift · for Container platform')
  })
})

describe('the domains', () => {
  it('fold by hand into one box, and the lines merge with a count', () => {
    open()
    fireEvent.click(screen.getByTestId('landscape-fold-logistics'))
    expect(screen.getByTestId('landscape-group-logistics').textContent).toContain('2 applications')
    expect(screen.queryByTestId('landscape-application-wms')).toBeNull()
    fireEvent.click(screen.getByTestId('landscape-lines-mode'))
    const counts = [...screen.getByTestId('landscape-lines').querySelectorAll('text')].map((text) => text.textContent)
    expect(counts).toEqual(['2'])
    fireEvent.click(screen.getByTestId('landscape-unfold-logistics'))
    expect(screen.getByTestId('landscape-application-wms')).toBeTruthy()
  })

  it('start folded above the threshold, and a filter that narrows the set opens them', () => {
    const many: Relation[] = Array.from({ length: FOLD_ABOVE + 1 }, (_, at) => row(`m${at}`, 'uses', `app-${at}`, 'containers'))
    open({ elsewhere: many, describe: (id) => ({ name: `Application ${id.slice(4)}`, kind: 'application' as const, where: `domain-${Number(id.slice(4)) % 3}` }) })
    expect(screen.getByTestId('landscape-applications').textContent).toContain(`${FOLD_ABOVE + 1} applications: the domains start folded`)
    expect(screen.queryByTestId('landscape-application-app-1')).toBeNull()
    expect(screen.getByTestId('landscape-fold').textContent).toBe('Unfold domains')
    fireEvent.change(screen.getByTestId('landscape-filter'), { target: { value: 'Application 1' } })
    expect(screen.getByTestId('landscape-application-app-1')).toBeTruthy()
  })

  it('hide behind a chip when they are switched off', () => {
    open()
    fireEvent.click(screen.getByTestId('landscape-domain-chip-channels'))
    expect(screen.queryByTestId('landscape-group-channels')).toBeNull()
    expect(screen.getByTestId('landscape-group-logistics')).toBeTruthy()
  })
})

describe('the record on the right', () => {
  it('opens a service\'s report and a platform\'s, and an application\'s chain', () => {
    const onOpenServiceReport = vi.fn()
    const onOpenPlatformReport = vi.fn()
    open({ onOpenServiceReport, onOpenPlatformReport })
    fireEvent.click(screen.getByTestId('landscape-service-brokering'))
    fireEvent.click(screen.getByTestId('landscape-report'))
    expect(onOpenServiceReport).toHaveBeenCalledWith('brokering')
    fireEvent.click(screen.getByTestId('landscape-platform-kafka'))
    expect(screen.getByTestId('landscape-inspector').textContent).toContain('Rating (legacy) · logistics')
    fireEvent.click(screen.getByTestId('landscape-report'))
    expect(onOpenPlatformReport).toHaveBeenCalledWith('kafka')
    fireEvent.click(screen.getByTestId('landscape-application-wms'))
    const record = screen.getByTestId('landscape-inspector').textContent
    expect(record).toContain('Hosted onOpenShift')
    expect(record).toContain('UsesContainer platformMessage brokering')
  })

  it('hides what the selection does not touch when asked', () => {
    open()
    fireEvent.click(screen.getByTestId('landscape-platform-kafka'))
    fireEvent.click(screen.getByTestId('landscape-only-touched'))
    expect(screen.getByTestId('landscape-application-portal').hidden).toBe(true)
    expect(screen.getByTestId('landscape-application-wms').hidden).toBe(false)
  })
})

describe('in the tab (ADR-0016)', () => {
  it('adds a service or a platform from the bands, filed under a group’s parent', () => {
    const onAdd = vi.fn()
    open({ inline: true, onAdd })
    fireEvent.click(screen.getByTestId('landscape-add-service'))
    expect(onAdd).toHaveBeenLastCalledWith({ kind: 'platformService' })
    fireEvent.click(screen.getByTestId('landscape-add-platform-landing-zone'))
    expect(onAdd).toHaveBeenLastCalledWith({ kind: 'platform', parentId: 'landing-zone' })
    expect(screen.queryByLabelText('Close the technology landscape')).toBeNull()
  })

  it('hands what this scope holds to the editor’s selection, and keeps its own record for the rest', () => {
    const onSelect = vi.fn()
    open({ inline: true, onSelect })
    fireEvent.click(screen.getByTestId('landscape-service-containers'))
    expect(onSelect).toHaveBeenLastCalledWith('containers')
    expect(screen.queryByTestId('landscape-inspector')).toBeNull()
    fireEvent.click(screen.getByTestId('landscape-application-wms'))
    expect(onSelect).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByTestId('landscape-inspector-title').textContent).toBe('Warehouse Management')
  })

  it('chooses the card the editor selected', () => {
    open({ inline: true, selectedId: 'kafka' })
    expect(screen.getByTestId('landscape-lines').querySelectorAll('path').length).toBeGreaterThan(0)
    expect(screen.getByTestId('landscape-application-portal').dataset.dimmed).toBe('true')
  })

  it('starts on the card a door led to, chosen as a click would choose it (ADR-0020)', () => {
    const onSelect = vi.fn()
    open({ inline: true, onSelect, focus: 'application:wms' })
    expect(screen.getByTestId('landscape-inspector-title').textContent).toBe('Warehouse Management')
    expect(screen.getByTestId('landscape-lines').querySelectorAll('path').length).toBeGreaterThan(0)
    expect(screen.getByTestId('landscape-application-portal').dataset.dimmed).toBe('true')
    // Not held here, so the page's own record shows and the editor is told nothing is its.
    expect(onSelect).toHaveBeenLastCalledWith(undefined)
  })

  it('offers nothing to add when read only', () => {
    open({ inline: true, onAdd: vi.fn(), readOnly: true })
    expect(screen.queryByTestId('landscape-add-service')).toBeNull()
  })
})

/**
 * The landscape as the place technology use is written (ADR-0020): hosting
 * drawn at rest and folded on request, the band that degrades to a strip,
 * the shared row, and the one write gesture — a drop, or the button while an
 * application is chosen — calling the editor's own actions.
 */
describe('a scope with places and no offerings (ADR-0020)', () => {
  // The spreadsheet case: an application that only says where it runs.
  function bare(): DesignModel {
    return {
      name: 'Finance',
      diagrams: [VIEW],
      elements: [
        element('sheets', { name: 'Spreadsheets' }),
        element('portal', { name: 'Order portal' }),
        element('o365', { kind: 'platform', name: 'Office 365', platformArchetype: 'place', outside: true }),
        element('k8s', { kind: 'platform', name: 'Cluster', platformArchetype: 'place' }),
        element('bus', { kind: 'platform', name: 'Event bus' }),
      ],
      relations: [row('h1', 'hostedOn', 'sheets', 'o365'), row('h2', 'hostedOn', 'portal', 'k8s'), row('u1', 'uses', 'portal', 'k8s')],
    }
  }
  const shared = [
    { id: 'managed-db', name: 'Managed database', where: 'platforms', realisedBy: ['azure-sql'] },
    { id: 'ent-bus', name: 'Enterprise bus', where: 'platforms', realisedBy: [] },
  ]
  const describeShared: PlatformDescribe = (id) => ({ 'azure-sql': { name: 'Azure SQL', kind: 'platform' as const, where: 'platforms' } }[id])
  const titles = () => [...screen.getByTestId('landscape-lines').querySelectorAll('path title')].map((title) => title.textContent)

  it('draws the hosting of a card that says nothing else, and folds it only into a line that reaches the same platform', () => {
    open({ model: bare(), elsewhere: [], describe: () => undefined })
    expect(screen.getByTestId('landscape-application-sheets').textContent).toBe('Spreadsheetson Office 365')
    fireEvent.click(screen.getByTestId('landscape-application-sheets'))
    expect(titles()).toEqual(['hostedOn'])
    fireEvent.click(screen.getByTestId('landscape-fold-hosting'))
    expect(titles()).toEqual(['hostedOn'])
    fireEvent.click(screen.getByTestId('landscape-application-portal'))
    // Bound to the cluster it runs on: the binding stands for both.
    expect(titles()).toEqual(['binds'])
    fireEvent.click(screen.getByTestId('landscape-fold-hosting'))
    expect(titles()).toEqual(['binds', 'hostedOn'])
  })

  it('folds the services band to a strip when there is nothing to show in it', () => {
    open({ model: bare(), elsewhere: [], describe: () => undefined })
    const band = screen.getByTestId('landscape-band-services')
    expect(band.dataset.strip).toBe('true')
    expect(band.textContent).toContain('no offerings in this scope')
    cleanup()
    open({ model: bare(), elsewhere: [], describe: () => undefined, sharedElsewhere: shared })
    expect(screen.getByTestId('landscape-band-services').dataset.strip).toBeUndefined()
    fireEvent.click(screen.getByTestId('landscape-show-shared'))
    expect(screen.getByTestId('landscape-band-services').dataset.strip).toBe('true')
  })

  it('shows the shared offerings from elsewhere, dimmed until something here uses one', () => {
    const model = bare()
    model.relations.push(row('u2', 'uses', 'sheets', 'ent-bus'))
    open({ model, elsewhere: [], describe: describeShared, sharedElsewhere: shared })
    const row_ = screen.getByTestId('landscape-shared-row')
    expect(row_.textContent).toContain('Shared in the organisation')
    const db = within(row_).getByTestId('landscape-shared-managed-db')
    expect(db.dataset.ghost).toBe('true')
    expect(db.textContent).toContain('from platforms · realised by Azure SQL')
    expect(db.textContent).toContain('shared')
    const bus = within(row_).getByTestId('landscape-shared-ent-bus')
    expect(bus.dataset.ghost).toBeUndefined()
    expect(bus.textContent).toContain('1 user')
    // A use of one is a line like any other.
    fireEvent.click(screen.getByTestId('landscape-application-sheets'))
    expect(titles()).toEqual(['uses', 'hostedOn'])
    // And the row can be hidden.
    fireEvent.click(screen.getByTestId('landscape-show-shared'))
    expect(screen.queryByTestId('landscape-shared-row')).toBeNull()
  })

  it('writes the row a drop means: hosting on a place, a use on a service platform or an offering', () => {
    const onHost = vi.fn()
    const onUse = vi.fn()
    const notify = vi.fn()
    open({ model: bare(), elsewhere: [], describe: describeShared, sharedElsewhere: shared, onHost, onUse, notify })
    expect(screen.getByTestId('landscape-applications').textContent).toContain('drag a card onto a platform')
    fireEvent.dragStart(screen.getByTestId('landscape-application-sheets'))
    fireEvent.drop(screen.getByTestId('landscape-platform-k8s'))
    expect(onHost).toHaveBeenCalledWith('sheets', 'k8s')
    fireEvent.dragStart(screen.getByTestId('landscape-application-sheets'))
    fireEvent.drop(screen.getByTestId('landscape-platform-bus'))
    expect(onUse).toHaveBeenLastCalledWith('sheets', ['bus'])
    // A shared offering: the same row, the stand-in being the editor's business.
    fireEvent.dragStart(screen.getByTestId('landscape-application-portal'))
    fireEvent.drop(screen.getByTestId('landscape-shared-managed-db'))
    expect(onUse).toHaveBeenLastCalledWith('portal', ['k8s', 'managed-db'])
    // What is already said is said, not written twice.
    fireEvent.dragStart(screen.getByTestId('landscape-application-portal'))
    fireEvent.drop(screen.getByTestId('landscape-platform-k8s'))
    expect(notify).toHaveBeenLastCalledWith('Order portal is already hosted on Cluster.')
    fireEvent.dragStart(screen.getByTestId('landscape-application-portal'))
    fireEvent.drop(screen.getByTestId('landscape-platform-k8s'))
    expect(onHost).toHaveBeenCalledTimes(1)
  })

  it('offers the same two verbs as buttons on the targets while an application is chosen', () => {
    const onHost = vi.fn()
    const onUse = vi.fn()
    open({ model: bare(), elsewhere: [], describe: describeShared, sharedElsewhere: shared, onHost, onUse })
    expect(screen.queryByTestId('landscape-host-k8s')).toBeNull()
    fireEvent.click(screen.getByTestId('landscape-application-sheets'))
    fireEvent.click(screen.getByTestId('landscape-host-k8s'))
    expect(onHost).toHaveBeenCalledWith('sheets', 'k8s')
    fireEvent.click(screen.getByTestId('landscape-use-bus'))
    expect(onUse).toHaveBeenLastCalledWith('sheets', ['bus'])
    fireEvent.click(screen.getByTestId('landscape-use-ent-bus'))
    expect(onUse).toHaveBeenLastCalledWith('sheets', ['ent-bus'])
    // Choosing a platform instead takes the buttons away.
    fireEvent.click(screen.getByTestId('landscape-platform-bus'))
    expect(screen.queryByTestId('landscape-host-k8s')).toBeNull()
  })

  it('neither drags nor offers a button when read only', () => {
    const onHost = vi.fn()
    const onUse = vi.fn()
    open({ model: bare(), elsewhere: [], describe: describeShared, sharedElsewhere: shared, onHost, onUse, readOnly: true })
    expect(screen.getByTestId('landscape-application-sheets').getAttribute('draggable')).not.toBe('true')
    fireEvent.click(screen.getByTestId('landscape-application-sheets'))
    expect(screen.queryByTestId('landscape-host-k8s')).toBeNull()
    fireEvent.dragStart(screen.getByTestId('landscape-application-sheets'))
    fireEvent.drop(screen.getByTestId('landscape-platform-k8s'))
    expect(onHost).not.toHaveBeenCalled()
    expect(onUse).not.toHaveBeenCalled()
  })
})
