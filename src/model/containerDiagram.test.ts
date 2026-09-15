/**
 * Rule 5 of the format, carried out: a component of another application does not
 * belong on this diagram, its parent application does. Until now that could only
 * be checked by hand.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import type { DesignElement, Relation } from '.'
import type { HostModel } from './fromInterchange'
import {
  containerDiagramMembers, findContainerDiagram, hoistedEnd, landedInterfaces, seedContainerDiagram,
} from './containerDiagram'

function el(id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}
const link = (id: string, sourceId: string, targetId: string): Relation =>
  ({ id, type: 'flow', sourceId, targetId, isBidirectional: false })

/**
 * Crews (with two components) talks to Reisinfo (another application, through one
 * of ITS components) and to a standalone system nobody here owns.
 */
function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Acme Logistics',
    elements: [
      el('crews', 'application'),
      el('crews-api', 'component', { parentId: 'crews' }),
      el('crews-ui', 'component', { parentId: 'crews' }),
      el('reisinfo', 'application'),
      el('reisinfo-api', 'component', { parentId: 'reisinfo' }),
      el('extern', 'application', { outside: true }),
      el('losstaand', 'application'),
    ],
    relations: [
      link('c1', 'crews-api', 'reisinfo-api'),
      link('c2', 'extern', 'crews'),
    ],
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'Landschap', placements: [] })],
    ...over,
  }
}

describe('containerDiagramMembers', () => {
  it('puts the application first', () => {
    expect(containerDiagramMembers(model(), 'crews')[0]).toBe('crews')
  })

  it('brings its own components along', () => {
    expect(containerDiagramMembers(model(), 'crews')).toEqual(
      expect.arrayContaining(['crews-api', 'crews-ui']),
    )
  })

  it('leaves what the application runs on and uses off it: a platform is not context', () => {
    // A platform on a container diagram is a dashed box around what it hosts
    // (ADR-0013), never a card beside it.
    const withPlatform = model({
      elements: [...model().elements, el('openshift', 'platform')],
      relations: [
        ...model().relations,
        { id: 'h1', type: 'hostedOn', sourceId: 'crews-api', targetId: 'openshift' },
        { id: 'u1', type: 'uses', sourceId: 'crews', targetId: 'openshift' },
      ],
    })
    expect(containerDiagramMembers(withPlatform, 'crews')).not.toContain('openshift')
  })

  it('replaces a component from elsewhere with its parent application', () => {
    // This is rule 5. `reisinfo-api` does not belong here; `reisinfo` does.
    const members = containerDiagramMembers(model(), 'crews')
    expect(members).toContain('reisinfo')
    expect(members).not.toContain('reisinfo-api')
  })

  it('brings a connected external system along as it is', () => {
    expect(containerDiagramMembers(model(), 'crews')).toContain('extern')
  })

  it('leaves out whatever is attached to nothing', () => {
    expect(containerDiagramMembers(model(), 'crews')).not.toContain('losstaand')
  })

  it('names nobody twice, not even with two connections to the same neighbour', () => {
    const m = model({
      relations: [
        link('c1', 'crews-api', 'reisinfo-api'),
        link('c2', 'crews-ui', 'reisinfo-api'),
        link('c3', 'crews', 'reisinfo'),
      ],
    })
    const members = containerDiagramMembers(m, 'crews')
    expect(members.filter((id) => id === 'reisinfo')).toHaveLength(1)
  })

  it('looks at connections in both directions', () => {
    // `extern → crews` points inward, `crews-api → reisinfo-api` outward.
    const members = containerDiagramMembers(model(), 'crews')
    expect(members).toEqual(expect.arrayContaining(['extern', 'reisinfo']))
  })

  it('gives the same order on every call', () => {
    expect(containerDiagramMembers(model(), 'crews')).toEqual(containerDiagramMembers(model(), 'crews'))
  })

  it('yields only itself for an application with no components or neighbours', () => {
    expect(containerDiagramMembers(model(), 'losstaand')).toEqual(['losstaand'])
  })

  it('ignores a connection to something that does not exist', () => {
    const m = model({ relations: [link('c1', 'crews', 'spook')] })
    expect(containerDiagramMembers(m, 'crews')).toEqual(['crews', 'crews-api', 'crews-ui'])
  })
})

describe('seedContainerDiagram', () => {
  const make = { id: 'cd-1', name: (n: string) => `${n} · containers` }

  it('makes a container diagram that points at its application', () => {
    const diagram = seedContainerDiagram(model(), 'crews', make)
    expect(diagram).toMatchObject({ id: 'cd-1', kind: 'container', applicationElementId: 'crews' })
  })

  it('lets the caller make the name, because the caller knows the language', () => {
    expect(seedContainerDiagram(model(), 'crews', make)?.name).toBe('crews · containers')
  })

  it('asks for a layout — there are no coordinates yet', () => {
    const diagram = seedContainerDiagram(model(), 'crews', make)
    expect(diagram?.geometry.needsLayout).toBe(true)
    expect(diagram?.geometry.nodes).toEqual([])
  })

  it('places exactly the members, in the same order', () => {
    const diagram = seedContainerDiagram(model(), 'crews', make)
    expect(diagram?.members.map((m) => m.id))
      .toEqual(containerDiagramMembers(model(), 'crews'))
  })

  it('returns nothing for an application that does not exist', () => {
    expect(seedContainerDiagram(model(), 'does-not-exist', make)).toBeUndefined()
  })
})

describe('findContainerDiagram', () => {
  const withContainer = model({
    diagrams: [
      laidOut({ id: 'l7', kind: 'layer7', name: 'Landschap', placements: [] }),
      laidOut({ id: 'cd', kind: 'container', name: 'Crews', applicationElementId: 'crews', placements: [] }),
    ],
  })

  it('finds the diagram belonging to the application', () => {
    expect(findContainerDiagram(withContainer, 'crews')?.id).toBe('cd')
  })

  it('gives nothing when there is none yet', () => {
    expect(findContainerDiagram(withContainer, 'reisinfo')).toBeUndefined()
    expect(findContainerDiagram(model(), 'crews')).toBeUndefined()
  })
})


/**
 * What the diagram draws once interfaces land on it (ADR-0013, redone). The
 * canvas asks these two questions and nothing else, so this is where they are
 * pinned; `editor/graph.landing.test.ts` pins what it does with the answers.
 */
describe('an interface landing on a container diagram', () => {
  const view = { kind: 'container' as const, applicationElementId: 'crews' }
  const held = (id: string) => model().elements.find((e) => e.id === id)
  const placed = new Set(['crews', 'crews-api', 'crews-ui', 'reisinfo'])

  it('hoists a component of another application to that application, and leaves its own alone', () => {
    expect(hoistedEnd(held, view, 'reisinfo-api')).toBe('reisinfo')
    expect(hoistedEnd(held, view, 'crews-api')).toBe('crews-api')
    expect(hoistedEnd(held, view, 'reisinfo')).toBe('reisinfo')
  })

  it('hoists nothing on a view that is not a container diagram', () => {
    expect(hoistedEnd(held, { kind: 'layer7' }, 'reisinfo-api')).toBe('reisinfo-api')
  })

  it('says which interfaces landed here, and therefore draw no line to the boundary', () => {
    const relations: Relation[] = [
      { ...link('r1', 'reisinfo', 'crews-api'), refines: 'c9' },
      // A landing on ANOTHER application\'s container is not one here.
      { ...link('r2', 'crews', 'reisinfo-api'), refines: 'c8' },
      link('r3', 'reisinfo', 'crews-ui'),
    ]
    expect([...landedInterfaces(relations, held, view, placed)]).toEqual(['c9'])
  })

  it('leaves the boundary line alone when the container it landed on is not drawn today', () => {
    const relations: Relation[] = [{ ...link('r1', 'reisinfo', 'crews-api'), refines: 'c9' }]
    expect([...landedInterfaces(relations, held, view, new Set(['crews', 'reisinfo']))]).toEqual([])
  })

  it('says nothing at all about a view that is not a container diagram', () => {
    const relations: Relation[] = [{ ...link('r1', 'reisinfo', 'crews-api'), refines: 'c9' }]
    expect([...landedInterfaces(relations, held, { kind: 'layer7' }, placed)]).toEqual([])
  })
})
