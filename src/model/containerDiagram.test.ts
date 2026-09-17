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
  containerDiagramMembers, findContainerDiagram, hoistedEnd, landedInterfaces,
  removeContainerDiagram, seedContainerDiagram,
} from './containerDiagram'
import { apply } from './reducer'
import { fromArrays, toArrays } from './normalised'
import { placedNodes } from './placement'

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
  it('puts the application first and brings its own components along, in a stable order', () => {
    expect(containerDiagramMembers(model(), 'crews')[0]).toBe('crews')
    expect(containerDiagramMembers(model(), 'crews')).toEqual(
      expect.arrayContaining(['crews-api', 'crews-ui']),
    )
    expect(containerDiagramMembers(model(), 'crews')).toEqual(containerDiagramMembers(model(), 'crews'))
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

  it('brings a connected external system along as it is, and leaves what is attached to nothing out', () => {
    expect(containerDiagramMembers(model(), 'crews')).toContain('extern')
    expect(containerDiagramMembers(model(), 'crews')).not.toContain('losstaand')
    expect(containerDiagramMembers(model(), 'losstaand')).toEqual(['losstaand'])
  })

  it('looks in both directions, names nobody twice, and ignores a connection to nothing', () => {
    // `extern → crews` points inward, `crews-api → reisinfo-api` outward.
    expect(containerDiagramMembers(model(), 'crews'))
      .toEqual(expect.arrayContaining(['extern', 'reisinfo']))
    const twice = model({
      relations: [
        link('c1', 'crews-api', 'reisinfo-api'),
        link('c2', 'crews-ui', 'reisinfo-api'),
        link('c3', 'crews', 'reisinfo'),
      ],
    })
    expect(containerDiagramMembers(twice, 'crews').filter((id) => id === 'reisinfo')).toHaveLength(1)
    const ghost = model({ relations: [link('c1', 'crews', 'spook')] })
    expect(containerDiagramMembers(ghost, 'crews')).toEqual(['crews', 'crews-api', 'crews-ui'])
  })
})

describe('seedContainerDiagram', () => {
  const make = { id: 'cd-1', name: (n: string) => `${n} · containers` }

  it('makes a diagram that points at its application, holds its members, and asks for a layout', () => {
    const diagram = seedContainerDiagram(model(), 'crews', make)
    expect(diagram).toMatchObject({ id: 'cd-1', kind: 'container', applicationElementId: 'crews' })
    // The caller makes the name, because the caller knows the language.
    expect(diagram?.name).toBe('crews · containers')
    expect(diagram?.members.map((m) => m.id)).toEqual(containerDiagramMembers(model(), 'crews'))
    // There are no coordinates yet.
    expect(diagram?.geometry.needsLayout).toBe(true)
    expect(diagram?.geometry.nodes).toEqual([])
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

  it('finds the diagram belonging to the application, and nothing where there is none yet', () => {
    expect(findContainerDiagram(withContainer, 'crews')?.id).toBe('cd')
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

  it('leaves the boundary line alone off a container view, or where the container is not drawn', () => {
    const relations: Relation[] = [{ ...link('r1', 'reisinfo', 'crews-api'), refines: 'c9' }]
    expect([...landedInterfaces(relations, held, view, new Set(['crews', 'reisinfo']))]).toEqual([])
    expect([...landedInterfaces(relations, held, { kind: 'layer7' }, placed)]).toEqual([])
  })
})


/**
 * The other direction (`removeContainerDiagram`): somebody has decided not to
 * model the inside of this system after all. The detail goes; the system stays
 * on the landscape, and so does everything the landscape knew about it —
 * including the interfaces only the container lines were carrying.
 *
 * Run through the reducer rather than read off the command, because what makes
 * this safe is the ORDER: an interface written after its landings were deleted
 * would be an interface with nothing on it, and a landing written after its
 * interface was deleted is a refusal that takes the whole step with it.
 */
describe('removing a container diagram', () => {
  /** Crews and Reisinfo on the landscape, Crews\'s two containers on a view. */
  function withView(over: Partial<HostModel> = {}): HostModel {
    const base = model({
      diagrams: [laidOut({
        id: 'l7',
        kind: 'layer7',
        name: 'Landschap',
        placements: [
          { id: 'crews', zone: 'landscape', x: 100, y: 100 },
          { id: 'reisinfo', zone: 'landscape', x: 400, y: 100 },
        ],
      })],
      ...over,
    })
    const view = seedContainerDiagram(base, 'crews', { id: 'cd', name: (name) => `${name} · containers` })!
    return { ...base, diagrams: [...base.diagrams, view] }
  }

  function removed(held: HostModel, id = 'cd'): HostModel {
    const command = removeContainerDiagram(held, id, () => 'i1')
    if (!command) throw new Error('nothing to do')
    const result = apply(fromArrays(held), command)
    if (!result.ok) throw new Error(result.reason)
    return toArrays(result.model)
  }

  it('takes the view and the containers, and leaves the application where it was drawn', () => {
    const after = removed(withView())
    expect(after.diagrams.map((d) => d.id)).toEqual(['l7'])
    expect(after.elements.map((e) => e.id)).not.toContain('crews-api')
    expect(after.elements.map((e) => e.id)).not.toContain('crews-ui')
    expect(after.elements.map((e) => e.id)).toContain('crews')
    expect(placedNodes(after.diagrams[0]).map((p) => p.id)).toContain('crews')
  })

  it('leaves the application\'s own lines alone: deleting it is what takes those', () => {
    // `c2` ends on Crews itself, not on a container of it.
    expect(removed(withView()).relations.map((r) => r.id)).toContain('c2')
  })

  it('writes the interface the container lines were carrying onto the two applications', () => {
    const after = removed(withView())
    expect(after.relations.find((r) => r.id === 'i1')).toMatchObject({
      type: 'flow', sourceId: 'crews', targetId: 'reisinfo',
    })
    // And the container line itself went with the container it was drawn from.
    expect(after.relations.map((r) => r.id)).not.toContain('c1')
  })

  it('writes nothing for a line that had already landed: its interface is on the landscape', () => {
    const landed = withView({
      relations: [
        link('i0', 'crews', 'reisinfo'),
        { ...link('c1', 'crews-api', 'reisinfo-api'), refines: 'i0' },
      ],
    })
    const after = removed(landed)
    expect(after.relations.map((r) => r.id)).toEqual(['i0'])
    expect(after.relations[0].refines).toBeUndefined()
  })

  it('carries a two-way pair up as one two-way interface', () => {
    const both = withView({
      relations: [
        link('c1', 'crews-api', 'reisinfo-api'),
        link('c3', 'reisinfo-api', 'crews-ui'),
      ],
    })
    expect(removed(both).relations).toEqual([
      expect.objectContaining({ id: 'i1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: true }),
    ])
  })

  it('leaves another pair\'s unrefined lines to their own finding', () => {
    const elsewhere = withView({
      relations: [link('c4', 'reisinfo-api', 'losstaand')],
    })
    const after = removed(elsewhere)
    expect(after.relations.map((r) => r.id)).toEqual(['c4'])
    expect(after.relations[0].refines).toBeUndefined()
  })

  it('is the plain drop where the application has no containers, and nothing at all for a landscape', () => {
    const bare = withView({
      elements: model().elements.filter((e) => e.kind !== 'component' || e.parentId !== 'crews'),
    })
    expect(removeContainerDiagram(bare, 'cd', () => 'i1')).toEqual({ type: 'diagram.delete', id: 'cd' })
    expect(removeContainerDiagram(withView(), 'l7', () => 'i1')).toBeUndefined()
    expect(removeContainerDiagram(withView(), 'nope', () => 'i1')).toBeUndefined()
  })
})
