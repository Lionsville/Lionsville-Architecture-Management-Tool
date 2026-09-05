/**
 * Rule 5 of the format, carried out: a component of another application does not
 * belong on this diagram, its parent application does. Until now that could only
 * be checked by hand.
 */
import { describe, expect, it } from 'vitest'
import type { DesignConnection, DesignElement } from '@lionsville/solution-design'
import type { HostModel } from './model/fromInterchange'
import {
  containerDiagramMembers, findContainerDiagram, seedContainerDiagram,
} from './containerDiagram'

function el(id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {}, ...over }
}
const link = (id: string, sourceId: string, targetId: string): DesignConnection =>
  ({ id, sourceId, targetId, isBidirectional: false })

/**
 * Crews (with two components) talks to Reisinfo (another application, through one
 * of ITS components) and to a standalone external system.
 */
function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Acme Logistics',
    customerName: 'Acme Logistics',
    elements: [
      el('crews', 'application'),
      el('crews-api', 'component', { parentApplicationId: 'crews' }),
      el('crews-ui', 'component', { parentApplicationId: 'crews' }),
      el('reisinfo', 'application'),
      el('reisinfo-api', 'component', { parentApplicationId: 'reisinfo' }),
      el('extern', 'externalSystem'),
      el('losstaand', 'application'),
    ],
    connections: [
      link('c1', 'crews-api', 'reisinfo-api'),
      link('c2', 'extern', 'crews'),
    ],
    diagrams: [{ id: 'l7', kind: 'layer7', name: 'Landschap', placements: [] }],
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
      connections: [
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
    const m = model({ connections: [link('c1', 'crews', 'spook')] })
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
    expect(diagram?.needsLayout).toBe(true)
    expect(diagram?.placements.every((p) => p.x === 0 && p.y === 0)).toBe(true)
  })

  it('places exactly the members, in the same order', () => {
    const diagram = seedContainerDiagram(model(), 'crews', make)
    expect(diagram?.placements.map((p) => p.elementId))
      .toEqual(containerDiagramMembers(model(), 'crews'))
  })

  it('returns nothing for an application that does not exist', () => {
    expect(seedContainerDiagram(model(), 'does-not-exist', make)).toBeUndefined()
  })
})

describe('findContainerDiagram', () => {
  const withContainer = model({
    diagrams: [
      { id: 'l7', kind: 'layer7', name: 'Landschap', placements: [] },
      { id: 'cd', kind: 'container', name: 'Crews', applicationElementId: 'crews', placements: [] },
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
