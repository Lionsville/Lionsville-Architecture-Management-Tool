/**
 * What belongs on a container diagram when you have just made it.
 *
 * This lived in `main.tsx`, in the middle of a `useCallback`, tangled up with
 * `setModel` and an id generator — and so only checkable by hand, even though it
 * is the one place where rule 5 of the format is carried out: a component of
 * *another* application does not belong here, its parent application does. That
 * is an agreement about the format, not screen work.
 */
import type { DesignDiagram } from '@lionsville/solution-design'
import type { HostModel } from './model/fromInterchange'

/** The container diagram already belonging to this application, if there is one. */
export function findContainerDiagram(
  model: HostModel,
  applicationId: string,
): DesignDiagram | undefined {
  return model.diagrams.find(
    (d) => d.kind === 'container' && d.applicationElementId === applicationId,
  )
}

/**
 * The elements the fresh diagram carries: the application, its components, and
 * the context they are attached to.
 *
 * "Context" is everything on the far side of a connection that does not itself
 * belong here. If that is a component of another application, its parent
 * application takes its place — a stray component from elsewhere says nothing on
 * this drawing, and the format does not allow it.
 *
 * The order is fixed (application, components, context) because placement
 * follows it: a diagram that comes up differently every time is not a diagram.
 */
export function containerDiagramMembers(model: HostModel, applicationId: string): string[] {
  const componentIds = model.elements
    .filter((e) => e.kind === 'component' && e.parentApplicationId === applicationId)
    .map((e) => e.id)
  const inScope = new Set([applicationId, ...componentIds])

  const context = new Set<string>()
  const addContext = (id: string) => {
    const other = model.elements.find((e) => e.id === id)
    if (!other) return
    const hoisted = other.kind === 'component' && other.parentApplicationId !== applicationId
      ? other.parentApplicationId
      : other.id
    if (hoisted && !inScope.has(hoisted)) context.add(hoisted)
  }
  model.connections.forEach((c) => {
    if (inScope.has(c.sourceId) && !inScope.has(c.targetId)) addContext(c.targetId)
    if (inScope.has(c.targetId) && !inScope.has(c.sourceId)) addContext(c.sourceId)
  })

  return [applicationId, ...componentIds, ...context]
}

/**
 * The fresh diagram, or `undefined` when that application does not exist.
 *
 * `id` and `name` come from outside: one is a counter with a clock in it, the
 * other hangs off the shell's language. Neither belongs in a function you must
 * be able to call twice for the same answer.
 */
export function seedContainerDiagram(
  model: HostModel,
  applicationId: string,
  make: { id: string; name: (applicationName: string) => string },
): DesignDiagram | undefined {
  const app = model.elements.find((e) => e.id === applicationId)
  if (!app) return undefined
  return {
    id: make.id,
    kind: 'container',
    name: make.name(app.name),
    applicationElementId: applicationId,
    placements: containerDiagramMembers(model, applicationId)
      .map((id) => ({ elementId: id, x: 0, y: 0 })),
    needsLayout: true,
  }
}
