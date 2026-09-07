/**
 * One request in, one answer out: the handler the shell binds to the seam.
 *
 * It takes the session as a *narrow* view — what it needs and nothing wider,
 * the way every consumer in this codebase declares its interface — so that it
 * is tested in node over the real reducer with no window, the arrangement
 * `editor/testing/editorHost` uses for the editor. The four things only the
 * renderer can do arrive through {@link RendererView}, a plain object in a
 * test and the editor's handle in the app.
 *
 * Everything about a call may say no, and every no is a key from
 * `tools.ts`: a tool nobody registered, arguments that do not fit, a session
 * that is waiting on a person, a window that cannot draw. The reducer's own
 * refusals pass through.
 */
import type { Adr } from '../model/adr'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/fromInterchange'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Diagram, Model } from '../model/normalised'
import { decisionsOf } from '../model/normalised'
import { expandRect, placementRect, unionRects } from '../model/placement'
import { apply } from '../model/reducer'
import type { Rect } from '../model/types'
import { canvasRect } from '../model/zones'
import { isLayoutRefusal } from '../layout/elkLayout'
import type { Translate } from '../i18n/strings'
import { formatAdrNumber } from '../decisions/adr'
import { answer } from './answer'
import type { ReadTool } from './answer'
import { commandFor } from './commandFor'
import { boundsOf, inspect } from './inspect'
import { isRendererRefusal, toBase64 } from './renderer'
import type { RendererView } from './renderer'
import type { AgentAnswer, AgentRefusal, AgentRequest } from './tools'
import { RESOURCE_LIST, RESOURCE_READ, checkArguments, isToolName, json, refused, toolSpec } from './tools'

/** What the handler needs from the live session. Every one of these is on `ModelSession`. */
export type SessionView = {
  /** The model as a command is built against. */
  indexed(): Model
  /** The same model as the file has it, cached by the session. */
  current(): HostModel
  activeDiagramId(): string
  /** The group's own records, which live beside the project rather than on it. */
  groupDecisions(): readonly Adr[]
  /**
   * Why nothing may change right now, or nothing: the person is resolving a
   * conflict, or the project is read-only. A read still answers.
   */
  blocked(): Extract<AgentRefusal, 'agent.conflict' | 'agent.readOnly'> | undefined
  /**
   * The one way in (ADR-0002): apply a command at the session, so it is one
   * undo step and one Activity line. Answers with nothing when the reducer
   * refused, which the handler has already asked about itself.
   */
  dispatch(command: Command, options?: { activeDiagramId?: string }): HostModel | undefined
  /** Where a new element's or connection's id comes from. The session's, so nothing collides. */
  ids: IdPolicy
  /** Where a diagram's or a decision's id comes from. */
  makeId: MakeId
  /** Today as `yyyy-mm-dd`, for a decision's date. */
  today(): string
  translate: Translate
  /** What a container view is called, after its application. */
  containerName(applicationName: string): string
  /** The canvas, where there is one. Absent in a test with no window, and every see-tool then refuses. */
  renderer?: RendererView
}

const RESOURCE_SCHEME = 'lvarch://'

/**
 * How many image pixels a render may hand over unless asked otherwise. Four
 * megapixels is a 2000x2000 picture: plenty for a model to read a crop, and
 * an order of magnitude under what the export makes for paper.
 */
const DEFAULT_MAX_PIXELS = 4_000_000
/** Around a crop, in flow pixels, so a box at the edge is not cut off. */
const RENDER_PADDING = 40
/** Around the named elements, so their neighbours are in the picture too. */
const CROP_MARGIN = 60

export async function handle(request: AgentRequest, session: SessionView): Promise<AgentAnswer> {
  const view = {
    model: session.indexed(),
    current: session.current,
    activeDiagramId: session.activeDiagramId(),
    groupDecisions: session.groupDecisions(),
  }
  if (request.tool === RESOURCE_LIST) return listResources(view.model, view.groupDecisions)
  if (request.tool === RESOURCE_READ) return readResource(view.model, view.groupDecisions, request.args)

  if (!isToolName(request.tool)) return refused('agent.unknownTool', request.tool)
  const spec = toolSpec(request.tool)
  if (spec.tier === 'read') return answer(request.tool as ReadTool, request.args, view)

  const wrong = checkArguments(spec.inputSchema, request.args)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (request.args ?? {}) as Record<string, unknown>

  // The report changes nothing, so it is answered like a read: while the
  // session is blocked, and without a command.
  if (request.tool === 'diagram.inspect') {
    const diagram = diagramOf(view.model, args, view.activeDiagramId)
    if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
    return json(inspect(view.model, diagram, args.limit as number | undefined))
  }

  // Looking and pointing change nothing either.
  if (request.tool === 'diagram.render' || request.tool === 'focus') {
    return seeing(request.tool, args, session)
  }

  const blocked = session.blocked()
  if (blocked) return refused(blocked)

  if (request.tool === 'diagram.tidy' || request.tool === 'diagram.route') {
    return seeing(request.tool, args, session)
  }

  const prepared = commandFor(request.tool, request.args, {
    ...view,
    ids: session.ids,
    makeId: session.makeId,
    today: session.today,
    translate: session.translate,
    containerName: session.containerName,
  })
  if ('ok' in prepared) return prepared

  // Asked of the reducer first, so a refusal comes back with its reason: the
  // session shows one to the person and answers with nothing, and an agent
  // needs the key. Applying twice is cheap; a command touches the path it
  // names and copies nothing else.
  const trial = apply(view.model, prepared.command)
  if (!trial.ok) return refused(trial.reason)
  session.dispatch(prepared.command, prepared.activeDiagramId ? { activeDiagramId: prepared.activeDiagramId } : undefined)
  return prepared.answer
}

function diagramOf(model: Model, args: Record<string, unknown>, active: string): Diagram | undefined {
  return model.diagrams[typeof args.diagramId === 'string' ? args.diagramId : active]
}

// --- the four things only the renderer can do ------------------------------------

async function seeing(
  tool: 'diagram.render' | 'diagram.tidy' | 'diagram.route' | 'focus',
  args: Record<string, unknown>,
  session: SessionView,
): Promise<AgentAnswer> {
  const renderer = session.renderer
  if (!renderer) return refused('agent.noAnswer', 'no canvas')
  const model = session.indexed()

  if (tool === 'focus') {
    const elementId = args.elementId as string
    if (!model.elements[elementId]) return refused('agent.unknownId', `element ${elementId}`)
    renderer.focus(elementId)
    return json({ elementId, name: model.elements[elementId].name, focused: true })
  }

  const diagram = diagramOf(model, args, session.activeDiagramId())
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)

  try {
    await renderer.show(diagram.id)
    if (tool === 'diagram.tidy' || tool === 'diagram.route') {
      await (tool === 'diagram.tidy' ? renderer.tidy() : renderer.route())
      // The report afterwards, against the model as it now stands: the loop
      // an agent runs is inspect, change, inspect again.
      const after = session.indexed()
      return json(inspect(after, after.diagrams[diagram.id] ?? diagram))
    }
    return await render(model, diagram, args, renderer)
  } catch (error) {
    if (isLayoutRefusal(error, 'tooLarge')) {
      return refused('agent.tooLarge', `${error.count ?? '?'} boxes, the cap is ${error.limit ?? '?'}`)
    }
    if (isLayoutRefusal(error, 'cancelled')) return refused('agent.cancelled')
    if (isRendererRefusal(error)) {
      switch (error.reason) {
        case 'hidden': return refused('agent.windowHidden')
        case 'busy': return refused('agent.busy')
        case 'gone': return refused('agent.noAnswer', 'the board went away')
      }
    }
    return refused('agent.noAnswer', error instanceof Error ? error.message : String(error))
  }
}

/**
 * The board as pixels, with the transform it was drawn with, so a pixel maps
 * back to a flow coordinate: `flowX = bounds.x - padding + px / pixelRatio`.
 * Cropped to the named elements or region when asked; the whole board is the
 * fallback, and a whole landscape at four megapixels is a thumbnail — which
 * is why the description tells the agent to crop.
 */
async function render(
  model: Model, diagram: Diagram, args: Record<string, unknown>, renderer: RendererView,
): Promise<AgentAnswer> {
  let bounds: Rect | undefined
  if (Array.isArray(args.elementIds) && args.elementIds.length > 0) {
    for (const id of args.elementIds as string[]) {
      if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
      if (!diagram.placements[id]) return refused('agent.notDrawn', id)
    }
    const box = boundsOf(model, diagram, args.elementIds as string[])
    bounds = box && expandRect(box, CROP_MARGIN)
  } else if ([args.x, args.y, args.width, args.height].every((v) => typeof v === 'number')) {
    bounds = { x: args.x as number, y: args.y as number, width: args.width as number, height: args.height as number }
  } else {
    const rects = diagram.order.placements
      .filter((id) => model.elements[id])
      .map((id) => placementRect(model.elements[id].kind, diagram.placements[id]))
    const drawn = unionRects(rects)
    bounds = diagram.kind === 'layer7'
      ? unionRects([canvasRect(diagram.layoutConfig), ...(drawn ? [drawn] : [])])
      : drawn
  }
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return refused('agent.notDrawn', 'nothing to draw')

  const maxPixels = (args.maxPixels as number | undefined) ?? DEFAULT_MAX_PIXELS
  const width = bounds.width + RENDER_PADDING * 2
  const height = bounds.height + RENDER_PADDING * 2
  // At most two image pixels per flow pixel — a retina screen — and fewer
  // when the region would otherwise overflow the budget. Two decimals,
  // rounded down, for the same reason the export rounds down.
  const pixelRatio = Math.max(0.05, Math.floor(Math.min(2, Math.sqrt(maxPixels / (width * height))) * 100) / 100)

  const png = await renderer.capture({ bounds, pixelRatio, padding: RENDER_PADDING })
  return {
    ok: true,
    content: [
      { type: 'image', data: toBase64(png), mimeType: 'image/png' },
      {
        type: 'text',
        text: JSON.stringify({
          diagramId: diagram.id,
          bounds,
          padding: RENDER_PADDING,
          pixelRatio,
          width: Math.round(width * pixelRatio),
          height: Math.round(height * pixelRatio),
          toFlow: 'flowX = bounds.x - padding + px / pixelRatio; flowY = bounds.y - padding + py / pixelRatio',
        }, undefined, 2),
      },
    ],
  }
}

// --- MCP resources: descriptions and decisions, readable without a call ---------------

function listResources(model: Model, groupDecisions: readonly Adr[]): AgentAnswer {
  const resources: { uri: string; name: string; mimeType: string; description: string }[] = []
  for (const id of model.order.elements) {
    const element = model.elements[id]
    if (!element.description?.trim()) continue
    resources.push({
      uri: `${RESOURCE_SCHEME}element/${id}/description`,
      name: element.name,
      mimeType: 'text/markdown',
      description: `The documentation of ${element.name} (${element.kind}).`,
    })
  }
  const own = decisionsOf(model)
  const decisions = [
    ...groupDecisions.map((adr) => ({ adr, scope: 'group' })),
    ...model.order.decisions.map((id) => ({ adr: own[id], scope: own[id].applicationId ? 'application' : 'landscape' })),
  ]
  for (const { adr, scope } of decisions) {
    resources.push({
      uri: `${RESOURCE_SCHEME}decision/${adr.id}`,
      name: `${formatAdrNumber(adr.number)} ${adr.title}`,
      mimeType: 'text/markdown',
      description: `A ${scope} decision record, ${adr.status}.`,
    })
  }
  return json({ resources })
}

function readResource(model: Model, groupDecisions: readonly Adr[], args: unknown): AgentAnswer {
  const uri = (args as { uri?: unknown } | undefined)?.uri
  if (typeof uri !== 'string' || !uri.startsWith(RESOURCE_SCHEME)) return refused('agent.unknownId', String(uri))
  const path = uri.slice(RESOURCE_SCHEME.length).split('/')
  if (path[0] === 'element' && path[2] === 'description') {
    const element = model.elements[path[1]]
    if (!element) return refused('agent.unknownId', uri)
    return json({ contents: [{ uri, mimeType: 'text/markdown', text: element.description ?? '' }] })
  }
  if (path[0] === 'decision') {
    const adr = decisionsOf(model)[path[1]] ?? groupDecisions.find((held) => held.id === path[1])
    if (!adr) return refused('agent.unknownId', uri)
    const head = `# ${adr.title}\n\n*${formatAdrNumber(adr.number)} · ${adr.status} · ${adr.date}*\n\n`
    return json({ contents: [{ uri, mimeType: 'text/markdown', text: head + adr.body }] })
  }
  return refused('agent.unknownId', uri)
}
