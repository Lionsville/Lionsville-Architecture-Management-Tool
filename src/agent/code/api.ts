// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The vocabulary as a script sees it (ADR-0051): one object, `lv`, generated
 * from the tool table, so a script calls what a plain call calls and nothing
 * is said twice.
 *
 * `noun.verb` is `lv.<area>.<verb>`, the area being the plural the noun's
 * list tool already uses, so `element.describe` and `elements.list` are
 * neighbours on `lv.elements`. What the rule cannot place is in one typed
 * table of exceptions below, and what a script does not hold at all is in
 * {@link ABSENT}. **No tool is renamed**: a tool's name stays what a plain
 * call says, and a method's name is derived from it here and nowhere else.
 *
 * A tool a script may name and not call — one that writes another scope, the
 * tree, the register, the screen — keeps its method, which is refused with
 * `agent.notInScript` and the sentence in {@link NOT_IN_SCRIPTS}: a script
 * that reaches for it is told where to go instead, where a missing method
 * would only say that something is not a function.
 */
import { TOOLS } from '../tools'
import type { ToolName, ToolSpec } from '../tools'

/** A method of `lv`: the area it is on, `''` for one on `lv` itself, and its name there. */
export type ScriptMethod = { readonly area: string; readonly method: string }

/** A noun's area, where it is not the noun itself: the plural its list tool uses, or would. */
const AREA_OF: Readonly<Record<string, string>> = {
  aspect: 'aspects',
  aspectScale: 'aspectScales',
  assignment: 'assignments',
  block: 'blocks',
  cause: 'causes',
  citation: 'citations',
  comment: 'comments',
  connection: 'connections',
  decision: 'decisions',
  diagram: 'diagrams',
  element: 'elements',
  evaluation: 'evaluations',
  experiment: 'experiments',
  function: 'functions',
  image: 'images',
  interface: 'interfaces',
  milestone: 'milestones',
  observation: 'observations',
  operatingRule: 'operatingRules',
  person: 'people',
  plan: 'plans',
  posterItem: 'posterItems',
  principle: 'principles',
  relation: 'relations',
  reportingLine: 'reportingLines',
  responsibility: 'responsibilities',
  role: 'roles',
  scope: 'scopes',
  solution: 'solutions',
  unitType: 'unitTypes',
}

/**
 * The nouns that are their own area: the ones already plural, and the ones
 * that are one thing and stay singular — the RACI, the technology register, the
 * project, the activity log, the application register, the roadmap, the app
 * and its driving session.
 */
const OWN_AREA: readonly string[] = [
  'activity', 'app', 'aspectScales', 'assignments', 'blocks', 'causes', 'changes', 'checks', 'comments', 'connections', 'decisions',
  'diagrams', 'elements', 'experiments', 'images', 'observations', 'people', 'plans', 'principles', 'project', 'raci', 'references',
  'register', 'reportingLines', 'responsibilities', 'roadmap', 'roles', 'rules', 'scopes', 'session', 'solutions', 'technology',
  'topics', 'unitTypes', 'views',
]

/** What the rule cannot place, each said whole. */
const EXCEPTIONS: Partial<Record<ToolName, ScriptMethod>> = {
  // A connection is made by its verb, and joins the area the others are on.
  'connect': { area: 'connections', method: 'add' },
  // One connection, and several: two tools the rule would give one name.
  'connections.update': { area: 'connections', method: 'updateMany' },
  'connections.remove': { area: 'connections', method: 'removeMany' },
  // The two reads that say what a write would do, beside each other.
  'merge.plan': { area: 'preview', method: 'merge' },
  'move.plan': { area: 'preview', method: 'move' },
  'principleGroups.set': { area: 'principles', method: 'setGroups' },
  'platform.report': { area: 'reports', method: 'platform' },
  'service.report': { area: 'reports', method: 'service' },
  // On `lv` itself: it is about everything.
  'search': { area: '', method: 'search' },
  // The tools that are a verb on the canvas and name no noun.
  'focus': { area: 'canvas', method: 'focus' },
  'moveBy': { area: 'canvas', method: 'moveBy' },
  'placeNextTo': { area: 'canvas', method: 'placeNextTo' },
  'group': { area: 'canvas', method: 'group' },
  'ungroup': { area: 'canvas', method: 'ungroup' },
  'align': { area: 'canvas', method: 'align' },
  'distribute': { area: 'canvas', method: 'distribute' },
}

/** The tools a script has no method for at all, each with why. */
export const ABSENT: Partial<Record<ToolName, string>> = {
  'batch': 'A script is the batch: its changes are tried together and land as one step for each scope.',
  'undo': 'A script lands nothing to take back: discard the simulation instead of running it.',
}

const TREE = 'The tree of scopes is changed one scope at a time, each its own step outside any trial: use the plain tool, or call.'
const REGISTER = 'The people register is outside a scope\'s history and cannot be tried on a copy: use the plain tool, or call.'
const SCREEN = 'It needs the screen, which a script does not have: use the plain tool, or call.'
const APP = 'It is about the app on the person\'s screen and not about the model: use the plain tool, or call.'

/**
 * The tools a script names and may not call, each with the sentence the
 * refusal carries. What they share: they cannot be tried on a copy of one
 * scope and then landed as that scope's one step.
 */
export const NOT_IN_SCRIPTS: Partial<Record<ToolName, string>> = {
  'observation.move': 'A move always writes two scopes, and a script tries each scope on its own: use the plain tool, or call.',
  'scope.create': TREE,
  'scope.update': TREE,
  'scope.move': TREE,
  'scope.remove': TREE,
  'person.add': REGISTER,
  'person.leave': REGISTER,
  'person.takeBackLeaving': REGISTER,
  'image.upload': 'A picture is kept beside the model and not in it, so it cannot be tried: use the plain tool, or call.',
  'project.save': 'A script saves nothing: what it changes lands with run. Use the plain tool, or call.',
  'diagram.tidy': SCREEN,
  'diagram.route': SCREEN,
  'diagram.render': 'It answers a picture, and a script answers data: use the plain tool, or call.',
  'focus': SCREEN,
  'app.current': APP,
  'app.open': APP,
  'session.start': APP,
  'session.end': APP,
}

/** A tool's method by the rule, where the rule places it. */
function byRule(name: string): ScriptMethod | undefined {
  const dot = name.indexOf('.')
  if (dot < 0) return undefined
  const noun = name.slice(0, dot)
  const area = OWN_AREA.includes(noun) ? noun : AREA_OF[noun]
  return area === undefined ? undefined : { area, method: name.slice(dot + 1) }
}

/** The method a tool is in a script, or nothing for one a script has none for. */
export function scriptMethod(tool: ToolName): ScriptMethod | undefined {
  if (tool in ABSENT) return undefined
  return EXCEPTIONS[tool] ?? byRule(tool)
}

/** `elements.list`, `search`: a method as a script, a refusal and a description say it. */
export function methodName({ area, method }: ScriptMethod): string {
  return area === '' ? method : `${area}.${method}`
}

/** One method of the generated API: the tool it calls, where it is on `lv`, and why it is refused where it is. */
export type ApiMethod = ScriptMethod & {
  readonly name: string
  readonly tool: ToolSpec
  /** The sentence it is refused with inside a script; absent for a method a script may call. */
  readonly notInScript?: string
}

/**
 * The API over the tools a host has: every tool with a method, in the tool
 * table's order. A host's `tools` predicate decides what is on it, as it
 * decides what `tools/list` offers, so a script is offered what a plain call
 * would be answered.
 */
export function apiOf(has: (tool: ToolSpec) => boolean = () => true): readonly ApiMethod[] {
  return TOOLS.filter(has).flatMap((tool): ApiMethod[] => {
    const at = scriptMethod(tool.name)
    if (!at) return []
    const refusedWith = NOT_IN_SCRIPTS[tool.name]
    return [{ ...at, name: methodName(at), tool, ...(refusedWith !== undefined ? { notInScript: refusedWith } : {}) }]
  })
}

/** The areas of an API, in the order their first method is in the tool table, `''` (on `lv` itself) among them. */
export function areasOf(api: readonly ApiMethod[]): readonly string[] {
  return [...new Set(api.map((one) => one.area))]
}
