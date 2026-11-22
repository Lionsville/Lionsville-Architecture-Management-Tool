// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `api.describe` (ADR-0050): the API a script sees, said as much at a time
 * as was asked.
 *
 * The point of a script is that a client does not carry the vocabulary on
 * every turn, so its description is not handed over whole either. With
 * nothing asked it is a map: how a script is written, and every area with
 * the names of its methods. An area is its methods' signatures and what each
 * does. A method, or an area in full, adds what every argument means and the
 * method's own rules. Nothing here is written for this file: the signatures
 * come from the schemas (`signature.ts`), the sentences from the tool table,
 * and the rules from the one table of them (`rules.ts`).
 */
import { RULES, RULE_TOPICS } from '../rules'
import { checkArguments, json, refused } from '../tools'
import type { AgentAnswer, ToolSpec } from '../tools'
import { ABSENT, apiOf, areasOf } from './api'
import type { ApiMethod } from './api'
import { codeToolSpec } from './codeTools'
import type { ScriptLimits } from './limits'
import { argumentDocs, sharedDeclarations, signatureOf } from './signature'

/** The area's name for the methods on `lv` itself, which have none. */
const ON_LV = 'lv'

/** The rules a script has no use for: it does not guard a revision, and it is the batch. */
const NOT_A_SCRIPTS: readonly string[] = ['ifRevision', 'batch']

/** How a script is written, said once: what every method shares, so no signature says it. */
function how(limits: ScriptLimits): string {
  return 'A script is the body of an async function with one thing in scope, lv: '
    + '`const apps = await lv.elements.list({ kind: "application", fields: ["name", "owner"] }); return apps.elements.length`. '
    + 'It has the language and lv and nothing else: no network, no files, no modules, no timers. '
    + 'Every method takes one object and answers a promise of what the tool of that name answers, already parsed. '
    + 'A method that works on a scope also takes scope, a path ("" the organisation): lv.in("acme/retail") is lv with '
    + 'that scope on every call, and the scope argument of query is where lv starts. No method takes ifRevision. '
    + 'A refusal is thrown as an Error with refusal (its key) and message, and may be caught. '
    + 'Return what you want back; it is answered as JSON. '
    + 'query runs a script that reads. '
    + `Limits: ${limits.scriptBytes / 1024} kB of script, ${limits.cpuMs / 1000} s of processing, ${limits.wallMs / 1000} s in all, `
    + `${limits.calls} calls, ${limits.resultBytes / 1024} kB returned; one script at a time. `
    + 'Ask api.describe for an area to see its signatures, for a method to see its arguments, for a topic to read a rule.'
}

/** One method as an area lists it: its signature, what it does, and where it may not be called. */
function described(method: ApiMethod, full: boolean) {
  const rules = full ? RULES[method.tool.name]?.text : undefined
  return {
    signature: `${method.name === method.method ? '' : `${method.area}.`}${signatureOf(method.method, method.tool.inputSchema)}`,
    does: method.tool.description.replace(/ ?\(rules\.read\)$/, ''),
    ...(method.notInScript !== undefined ? { notInScript: method.notInScript } : {}),
    ...(full ? { args: argumentDocs(method.tool.inputSchema) } : {}),
    ...(rules !== undefined ? { rules } : {}),
  }
}

/** The answer with nothing asked: the map. */
function overview(api: readonly ApiMethod[], limits: ScriptLimits) {
  return {
    how: how(limits),
    areas: Object.fromEntries(areasOf(api).map((area) => [area || ON_LV, api.filter((one) => one.area === area).map((one) => one.method)])),
    notInScripts: api.filter((one) => one.notInScript !== undefined).map((one) => one.name),
    absent: ABSENT,
    shapes: sharedDeclarations(),
    topics: Object.fromEntries(RULE_TOPICS.filter((topic) => !NOT_A_SCRIPTS.includes(topic)).map((topic) => [topic, RULES[topic].about])),
  }
}

/**
 * `api.describe`, over the tools a host has. `limits` are the host's, so the
 * numbers a script is told are the numbers it is held to.
 */
export function describeApi(rawArgs: unknown, has: ((tool: ToolSpec) => boolean) | undefined, limits: ScriptLimits): AgentAnswer {
  const wrong = checkArguments(codeToolSpec('api.describe').inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const { area, method, detail, topic } = (rawArgs ?? {}) as { area?: string; method?: string; detail?: 'full'; topic?: string }
  const api = apiOf(has)
  if (topic !== undefined) {
    const rule = (RULE_TOPICS as readonly string[]).includes(topic) && !NOT_A_SCRIPTS.includes(topic) ? RULES[topic] : undefined
    return rule ? json({ topic, about: rule.about, text: rule.text }) : refused('agent.unknownId', `topic ${topic}: api.describe with nothing asked lists them`)
  }
  if (method !== undefined) {
    const one = api.find((held) => held.name === method)
    return one ? json({ method: one.name, tool: one.tool.name, ...described(one, true) }) : refused('agent.unknownId', `method ${method}: api.describe with nothing asked lists them`)
  }
  if (area !== undefined) {
    const held = api.filter((one) => (one.area || ON_LV) === area)
    if (held.length === 0) return refused('agent.unknownId', `area ${area}: api.describe with nothing asked lists them`)
    return json({ area, methods: held.map((one) => described(one, detail === 'full')), shapes: sharedDeclarations() })
  }
  return json(overview(api, limits))
}
