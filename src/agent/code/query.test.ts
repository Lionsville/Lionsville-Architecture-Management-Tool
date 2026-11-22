// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `query` and `api.describe` through the real handler and the real
 * interpreter: a join over the tree in one call, what a query may not do,
 * the limits its caller counts, and what the host is told about a script —
 * which is never the script.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../../people/policy'
import type { Person } from '../../people/person'
import type { PeopleView } from '../../agent/people'
import { TOOLS } from '../tools'
import { apiOf } from './api'
import { codeMode } from './query'
import { DESKTOP_LIMITS, SHARED_HOST_LIMITS } from './limits'
import { hostOver, said, shellOver } from './testing/codeHost'

const query = (script: string, host = hostOver(), scope?: string) =>
  codeMode().answer({ id: '1', tool: 'query', args: { script, ...(scope !== undefined ? { scope } : {}) } }, host)

/** The applications nobody answers for, in every scope, each with the open observations about it. */
const UNOWNED = `
  const { scopes } = await lv.scopes.list({ fields: ["path"] })
  const found = []
  for (const { path } of scopes.filter((one) => one.path !== "")) {
    const here = lv.in(path)
    const [{ elements }, { observations }] = await Promise.all([
      here.elements.list({ kind: "application", fields: ["name", "owner"] }),
      here.observations.list({ fields: ["label", "title", "about"] }),
    ])
    for (const app of elements.filter((one) => one.owner === undefined)) {
      found.push({ scope: path, id: app.id, name: app.name, open: observations.filter((one) => (one.about ?? []).includes(app.id)).map((one) => one.label) })
    }
  }
  return found
`

describe('a query', () => {
  it('joins applications without an owner to the open observations about them, across the tree, in one call', async () => {
    const host = hostOver()
    const answer = said(await query(UNOWNED, host))
    expect(answer.result).toEqual([
      { scope: 'acme/retail', id: 'wms', name: 'Warehouse system', open: ['OB-0001'] },
      { scope: 'acme/finance', id: 'erp', name: 'Finance system', open: ['OB-0001'] },
    ])
    expect(answer.calls).toBe(5)
    expect(host.asked).toEqual(['scopes.list', 'elements.list', 'observations.list', 'elements.list', 'observations.list'])
    expect(host.session.history()).toHaveLength(0)
  })

  it('starts lv at the scope it was given, and a call names another with lv.in or its own argument', async () => {
    const names = 'return [(await lv.elements.list()).elements.length, (await lv.in("acme/finance").elements.list()).elements.length, (await lv.elements.list({ scope: "acme/finance" })).elements.length]'
    expect(said(await query(names, hostOver(), 'acme/retail')).result).toEqual([3, 2, 2])
  })

  it('refuses a call that changes something, and a call a script may not make, each where it is made', async () => {
    const host = hostOver()
    const tried = said(await query(`
      const refusals = []
      for (const attempt of [
        () => lv.elements.add({ name: "Billing" }),
        () => lv.observations.move({ id: "ob-1", to: "acme/finance" }),
        () => lv.people.add({ name: "Somebody" }),
        () => lv.canvas.moveBy({ ids: ["wms"], dx: 1, dy: 1 }),
      ]) { try { await attempt() } catch (e) { refusals.push([e.refusal, e.message]) } }
      return refusals
    `, host))
    expect((tried.result as [string, string][]).map(([key]) => key)).toEqual(Array.from({ length: 4 }, () => 'agent.notInScript'))
    expect((tried.result as [string, string][])[0][1]).toBe('elements.add changes something, and a query only reads')
    expect((tried.result as [string, string][])[1][1]).toContain('use the plain tool, or call')
    expect(host.asked).toEqual([])
    expect(host.session.history()).toHaveLength(0)
  })

  it('throws the handler\'s own refusal for a call the handler refuses', async () => {
    const answer = said(await query('try { await lv.elements.describe({ id: "nowhere" }) } catch (e) { return [e.refusal, e.message] }'))
    expect(answer.result).toEqual(['agent.unknownId', expect.stringContaining('nowhere')])
    expect(said(await query('try { await lv.elements.list({ kind: "spaceship" }) } catch (e) { return e.refusal }')).result).toBe('agent.badArguments')
    expect(said(await query('try { await lv.elements.list({ scope: "acme/nowhere" }) } catch (e) { return e.refusal }')).result).toBe('agent.unknownScope')
  })

  it('has no method for batch or undo, and none for a tool its host does not have', async () => {
    const answer = said(await query('return [typeof lv.batch, typeof lv.undo, typeof lv.canvas, typeof lv.elements.list]', hostOver({ }), undefined))
    expect(answer.result).toEqual(['undefined', 'undefined', 'object', 'function'])
    const noScreen = { ...hostOver(), tools: (tool: (typeof TOOLS)[number]) => tool.tier !== 'see' && tool.tier !== 'drive' }
    expect(said(await query('return [typeof lv.canvas, typeof lv.app, typeof lv.elements.list]', noScreen)).result).toEqual(['undefined', 'undefined', 'function'])
  })

  it('says a person in what it returns as an answer says one, under a pseudonym policy too', async () => {
    const people: Person[] = [{ id: 'pe-pia', name: 'Pia Schulz', pseudonym: '4K7Q', kind: 'internal', state: 'active' }]
    const register = (agentsSee: 'names' | 'pseudonyms'): PeopleView => ({
      read: () => Promise.resolve({ people, policy: { ...DEFAULT_POLICY, agentsSee } }),
      add: () => Promise.reject(new Error('not asked')), leave: () => Promise.reject(new Error('not asked')),
      takeBackLeaving: () => Promise.reject(new Error('not asked')), today: () => '2026-11-22', readOnly: () => true,
    })
    const owners = 'const { elements } = await lv.elements.list({ fields: ["owner"] }); return { owners: elements.map((one) => one.owner), again: { owner: { person: "pe-pia" } } }'
    const named = JSON.stringify(said(await query(owners, hostOver({ shell: shellOver(register('names')) }))).result)
    expect(named).toContain('Pia Schulz')
    const withheld = JSON.stringify(said(await query(owners, hostOver({ shell: shellOver(register('pseudonyms')) }))).result)
    expect(withheld).not.toContain('Pia')
    expect(withheld).not.toContain('Schulz')
    // What a call answered, and an id the script wrote out for itself: both leave under the pseudonym.
    expect(withheld.match(/4K7Q/g)).toHaveLength(2)
  })
})

describe('a query that costs too much', () => {
  const stopped = async (script: string, host = hostOver()) => {
    const answer = await query(script, host)
    if (answer.ok) throw new Error('answered')
    return { refusal: answer.refusal, detail: answer.detail, line: host.lines.at(-1) }
  }

  it('is stopped at its calls, whatever it catches', async () => {
    const host = hostOver({ limits: { calls: 7 } })
    const out = await stopped('for (;;) { try { await lv.elements.list() } catch (e) {} }', host)
    expect(out).toMatchObject({ refusal: 'agent.scriptLimit', line: { limit: 'calls', calls: 8, outcome: 'agent.scriptLimit' } })
    expect(out.detail).toBe('The script was stopped at 7 calls (limit: calls). Nothing was changed. Read lists once and join them in the script, or split the work.')
    expect(host.asked).toHaveLength(7)
  })

  it('is stopped where it returns more than its answer may hold, measured as it is serialised', async () => {
    const host = hostOver({ limits: { resultBytes: 1024 } })
    expect(await stopped('return "é".repeat(600)', host)).toMatchObject({ refusal: 'agent.scriptLimit', line: { limit: 'result' } })
    expect(said(await query('return "é".repeat(500)', host)).result).toHaveLength(500)
    expect((await stopped('return "x".repeat(300000)')).detail).toContain('256 kB')
  })

  it('is refused before it is run where its text is too long', async () => {
    const host = hostOver()
    const out = await stopped(`return 1 // ${'x'.repeat(DESKTOP_LIMITS.scriptBytes)}`, host)
    expect(out).toMatchObject({ refusal: 'agent.scriptLimit', line: { limit: 'script', calls: 0 } })
    expect(out.detail).toContain('Nothing was run')
  })

  it('is stopped at its processing, and says at how much', async () => {
    const out = await stopped('for (;;) {}', hostOver({ limits: { cpuMs: 200 } }))
    expect(out).toMatchObject({ refusal: 'agent.scriptLimit', line: { limit: 'cpu' } })
    expect(out.detail).toBe('The script was stopped at 0.2 s of processing (limit: cpu). Nothing was changed. Narrow the reads with fields and limit, or split the work.')
    expect(out.line?.cpuMs).toBeGreaterThanOrEqual(200)
  })

  it('runs one at a time for each caller, and beside another caller\'s', async () => {
    const mode = codeMode()
    const slow = { id: '1', tool: 'query', args: { script: 'await lv.scopes.list(); await lv.scopes.list(); return 1' } }
    const [first, second, other] = await Promise.all([
      mode.answer(slow, hostOver({ holder: 'one' })), mode.answer(slow, hostOver({ holder: 'one' })), mode.answer(slow, hostOver({ holder: 'another' })),
    ])
    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: false, refusal: 'agent.scriptLimit', detail: expect.stringContaining('limit: concurrent') as string })
    expect(other).toMatchObject({ ok: true })
    // And again once the first has answered.
    expect(await mode.answer(slow, hostOver({ holder: 'one' }))).toMatchObject({ ok: true })
  })

  it('is charged for its calls as they happen, ten to a charge, and ends where the charge is refused', async () => {
    let charged = 0
    const host = { ...hostOver(), charge: () => (charged += 1) < 3 }
    const out = await stopped('for (;;) await lv.scopes.list()', host)
    expect(out).toMatchObject({ refusal: 'agent.scriptLimit', line: { limit: 'rate', calls: 30 } })
    expect(charged).toBe(3)
  })

  it('says a script that throws in its own words, cut short, and says none of them to the host', async () => {
    const host = hostOver()
    const out = await stopped(`throw new Error("secret-message " + "m".repeat(5000))`, host)
    expect(out.refusal).toBe('agent.scriptFailed')
    expect(out.detail).toHaveLength(2001)
    expect(out.detail?.startsWith('secret-message')).toBe(true)
    expect(JSON.stringify(host.lines)).not.toContain('secret-message')
  })
})

describe('what a host is told about a script', () => {
  it('is its fingerprint, its counts and its outcome — never its text, an argument, a value or a message', async () => {
    const host = hostOver()
    const script = 'const marker = "script-text-marker"; const { elements } = await lv.in("acme/finance").elements.list({ fields: ["name"], kind: "application" }); return { marker: "returned-marker", names: elements.map((one) => one.name) }'
    const answer = said(await query(script, host))
    expect(answer.result).toMatchObject({ marker: 'returned-marker', names: ['Finance system', 'Billing'] })
    expect(host.lines).toHaveLength(1)
    const [line] = host.lines
    expect(line).toEqual({
      op: 'query', hash: expect.stringMatching(/^[0-9a-f]{64}$/) as string, bytes: script.length,
      scopesRead: ['acme/finance'], scopesWritten: [], calls: 1, writes: 0,
      cpuMs: expect.any(Number) as number, resultBytes: JSON.stringify(answer.result).length, outcome: 'ok',
    })
    const told = JSON.stringify(host.lines)
    for (const never of ['script-text-marker', 'returned-marker', 'Finance system', 'Billing', 'application', 'fields']) expect(told).not.toContain(never)
    // The same script is the same fingerprint, and another script another.
    await query(script, host)
    await query(`${script} `, host)
    expect(host.lines[1].hash).toBe(line.hash)
    expect(host.lines[2].hash).not.toBe(line.hash)
  })
})

describe('api.describe', () => {
  const describeApi = (args: object, host = hostOver()) => codeMode().answer({ id: '1', tool: 'api.describe', args }, host)

  it('answers a map with nothing asked: how a script is written, the host\'s limits, every area and its methods', async () => {
    const answer = await describeApi({})
    const map = said(answer)
    const areas = map.areas as Record<string, string[]>
    expect(areas.elements).toEqual(expect.arrayContaining(['list', 'describe', 'add', 'update', 'remove']))
    expect(areas.lv).toEqual(['search'])
    expect(Object.values(areas).flat()).toHaveLength(apiOf().length)
    expect(map.how).toContain('1 s of processing')
    expect(said(await describeApi({}, { ...hostOver(), limits: SHARED_HOST_LIMITS })).how).toContain('2 s of processing')
    expect(map.notInScripts).toContain('observations.move')
    expect(Object.keys(map.topics as object)).toEqual(['scope', 'person', 'paging', 'sheet'])
    // The map is a map: a small part of what the whole vocabulary costs to carry.
    const whole = JSON.stringify(TOOLS).length
    const size = answer.ok && answer.content[0].type === 'text' ? answer.content[0].text.length : 0
    expect(size).toBeLessThan(9_000)
    expect(size * 20).toBeLessThan(whole)
  })

  it('answers an area with its signatures and what each method does, and in full with every argument and the rules', async () => {
    const short = said(await describeApi({ area: 'observations' })).methods as { signature: string; does: string; args?: object; rules?: string }[]
    expect(short.map((one) => one.signature.slice(0, one.signature.indexOf('(')))).toEqual(expect.arrayContaining(['observations.list', 'observations.record', 'observations.move']))
    expect(short.every((one) => one.args === undefined && one.rules === undefined)).toBe(true)
    expect(short.find((one) => one.signature.startsWith('observations.record'))?.does).not.toContain('rules.read')
    const full = said(await describeApi({ area: 'observations', detail: 'full' })).methods as { signature: string; args: Record<string, string>; rules?: string; notInScript?: string }[]
    const record = full.find((one) => one.signature.startsWith('observations.record'))!
    expect(record.args.about).toContain('elements it is about')
    expect(record.args['principles[].stance']).toBeDefined()
    expect(record.args.scope).toBeUndefined()
    expect(record.rules).toContain('An observation is a')
    expect(full.find((one) => one.signature.startsWith('observations.move'))?.notInScript).toContain('two scopes')
    expect(said(await describeApi({ area: 'lv' })).methods).toHaveLength(1)
  })

  it('answers one method in full, and one topic\'s rule, and refuses what is not there', async () => {
    const method = said(await describeApi({ method: 'connections.add' }))
    expect(method).toMatchObject({ method: 'connections.add', tool: 'connect' })
    expect((method.args as Record<string, string>).sourceId).toBeDefined()
    expect(said(await describeApi({ topic: 'paging' })).text).toContain('cursor')
    for (const args of [{ method: 'elements.nothing' }, { area: 'nothing' }, { topic: 'batch' }, { topic: 'nothing' }]) {
      expect(await describeApi(args)).toMatchObject({ ok: false, refusal: 'agent.unknownId' })
    }
    expect(await describeApi({ detail: 'some' })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('describes what the host has, as tools/list offers it', async () => {
    const noScreen = { ...hostOver(), tools: (tool: (typeof TOOLS)[number]) => tool.tier !== 'see' && tool.tier !== 'drive' }
    const areas = said(await describeApi({}, noScreen)).areas as Record<string, string[]>
    expect(areas.canvas).toBeUndefined()
    expect(areas.app).toBeUndefined()
  })
})
