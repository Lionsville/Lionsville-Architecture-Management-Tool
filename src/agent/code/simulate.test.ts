// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `simulate`, `run` and `discard` through the real handler, reducer and
 * interpreter: a script that changes things changes nothing until it is run,
 * what it answers is what lands, and a simulation lands once, for whoever
 * tried it, on a scope that has not moved.
 */
import { describe, expect, it } from 'vitest'
import type { AgentAnswer } from '../tools'
import { codeMode } from './query'
import type { CodeMode } from './query'
import { RETAIL, hostOver, said, sessionOver, shellOver } from './testing/codeHost'
import type { TestHost } from './testing/codeHost'

const ask = (mode: CodeMode, host: TestHost, tool: string, args: object): Promise<AgentAnswer> => mode.answer({ id: '1', tool, args }, host)

type Simulated = {
  token?: string; expires?: string; result: unknown; calls: number
  scopes: { scope: string; revision: number; writes: number; diff: { kind: string; what: string; id: string; name: string; fields?: string[] }[]; counts: Record<string, number> }[]
  steps: { n: number; call: string; scope: string; answer: Record<string, unknown> }[]
  refusals: { n: number; call: string; refusal: string; detail?: string }[]
}

const simulate = async (mode: CodeMode, host: TestHost, script: string, scope?: string): Promise<Simulated> =>
  said(await ask(mode, host, 'simulate', { script, ...(scope !== undefined ? { scope } : {}) })) as unknown as Simulated

/** An owner for the application nobody answers for, and an observation that says it had none. */
const OWN = `
  const { elements } = await lv.elements.list({ kind: "application", fields: ["name", "owner"] })
  const done = []
  for (const app of elements.filter((one) => one.owner === undefined)) {
    await lv.elements.update({ id: app.id, owner: "Operations" })
    const seen = await lv.observations.record({ title: app.name + " had no owner", where: "The register", by: "The agent", about: [app.id] })
    done.push({ id: app.id, observation: seen.id })
  }
  return done
`

describe('a script tried', () => {
  it('answers what would change, each call\'s answer and a token, and changes nothing', async () => {
    const [mode, host] = [codeMode(), hostOver()]
    const tried = await simulate(mode, host, OWN)
    expect(tried.token).toMatch(/^sim_[0-9a-f]{32}$/)
    expect(Date.parse(tried.expires!)).toBeGreaterThan(Date.now())
    expect(tried.scopes).toHaveLength(1)
    const [changed] = tried.scopes
    expect(changed).toMatchObject({ scope: 'acme/retail', revision: 0, writes: 2, counts: { added: 1, removed: 0, changed: 1, moved: 0 } })
    expect(changed.diff).toEqual([
      expect.objectContaining({ kind: 'changed', what: 'element', id: 'wms', name: 'Warehouse system', fields: ['owner'] }),
      expect.objectContaining({ kind: 'added', what: 'observation', name: 'Warehouse system had no owner' }),
    ])
    expect(tried.steps.map((step) => [step.n, step.call, step.scope])).toEqual([[2, 'elements.update', 'acme/retail'], [3, 'observations.record', 'acme/retail']])
    expect(tried.steps[1].answer).toMatchObject({ label: 'OB-0004' })
    expect(tried.result).toEqual([{ id: 'wms', observation: tried.steps[1].answer.id }])
    expect(tried.refusals).toEqual([])
    // Nothing has changed: no step, the same revision, the same model.
    expect(host.session.history()).toHaveLength(0)
    expect(host.session.revision()).toBe(0)
    expect(host.session.current().elements.find((one) => one.id === 'wms')).not.toHaveProperty('owner')
    expect(host.lines).toEqual([expect.objectContaining({ op: 'simulate', calls: 3, writes: 2, scopesWritten: ['acme/retail'], outcome: 'ok' })])
  })

  it('reads its own writes in the scope it wrote, as the script goes', async () => {
    const tried = await simulate(codeMode(), hostOver(), `
      const added = await lv.elements.add({ name: "Billing", kind: "application" })
      const listed = (await lv.elements.list({ fields: ["name"] })).elements.map((one) => one.id)
      await lv.elements.update({ id: added.id, owner: "Finance desk" })
      return { added: added.id, listed, owner: (await lv.elements.describe({ id: added.id })).owner }
    `)
    expect(tried.result).toEqual({ added: 'billing', listed: ['wms', 'pos', 'loyalty', 'billing'], owner: 'Finance desk' })
    expect(tried.scopes[0]).toMatchObject({ writes: 2, counts: { added: 1, changed: 0 } })
  })

  it('gives the same ids every time the same script is tried on the same scope at the same revision', async () => {
    const script = `
      const seen = await lv.observations.record({ title: "Till freezes again", where: "Shop", by: "The agent" })
      const billing = await lv.elements.add({ name: "Billing" })
      const line = await lv.connections.add({ sourceId: billing.id, targetId: "wms", label: "invoices" })
      return [seen.id, billing.id, line.id]
    `
    const [mode, host] = [codeMode(), hostOver()]
    const first = await simulate(mode, host, script)
    const second = await simulate(mode, host, script)
    expect(second.result).toEqual(first.result)
    expect(second.token).not.toBe(first.token)
    // Another script, another id where no name gives one.
    const other = await simulate(mode, host, `${script} // another`)
    expect((other.result as string[])[0]).not.toBe((first.result as string[])[0])
    expect((other.result as string[])[1]).toBe('billing')
  })

  it('lists every refusal the script met, caught or not, and a call a script may not make is one of them', async () => {
    const tried = await simulate(codeMode(), hostOver(), `
      const met = []
      for (const attempt of [
        () => lv.observations.move({ id: "ob-1", to: "acme/finance" }),
        () => lv.elements.update({ id: "nowhere", owner: "Somebody" }),
        () => lv.in("acme/finance").elements.add({ name: "Ledger" }),
        () => lv.scopes.create({ parent: "acme", name: "New" }),
      ]) { try { await attempt() } catch (e) { met.push(e.refusal) } }
      await lv.elements.update({ id: "wms", owner: "Operations" })
      return met
    `)
    expect(tried.result).toEqual(['agent.notInScript', 'agent.unknownId', 'agent.scopeNotOpen', 'agent.notInScript'])
    expect(tried.refusals.map((one) => [one.n, one.call, one.refusal])).toEqual([
      [1, 'observations.move', 'agent.notInScript'], [2, 'elements.update', 'agent.unknownId'],
      [3, 'elements.add', 'agent.scopeNotOpen'], [4, 'scopes.create', 'agent.notInScript'],
    ])
    expect(tried.refusals[0].detail).toContain('use the plain tool, or call')
    // What was not refused is still offered to be run.
    expect(tried.token).toBeDefined()
    expect(tried.scopes[0]).toMatchObject({ writes: 1 })
  })

  it('answers no token where it changed nothing, and none where it failed', async () => {
    const [mode, host] = [codeMode(), hostOver()]
    const read = await simulate(mode, host, 'return (await lv.elements.list()).total')
    expect(read).toMatchObject({ result: 3, scopes: [], steps: [] })
    expect(read.token).toBeUndefined()
    const failed = await ask(mode, host, 'simulate', { script: 'await lv.elements.update({ id: "wms", owner: "Operations" }); await lv.elements.update({ id: "nowhere", owner: "x" })' })
    expect(failed).toMatchObject({ ok: false, refusal: 'agent.scriptFailed' })
    expect(host.session.history()).toHaveLength(0)
  })

  it('is stopped at its changes, as a batch is held to its steps', async () => {
    const host = hostOver({ limits: { writes: 3 } })
    const stopped = await ask(codeMode(), host, 'simulate', { script: 'for (let n = 0; n < 10; n++) await lv.elements.add({ name: "Application " + n })' })
    expect(stopped).toMatchObject({ ok: false, refusal: 'agent.scriptLimit', detail: expect.stringContaining('3 changes (limit: writes)') as string })
    expect(host.lines.at(-1)).toMatchObject({ op: 'simulate', limit: 'writes', writes: 4 })
    expect(host.session.history()).toHaveLength(0)
  })
})

describe('a simulation run', () => {
  it('lands exactly what was tried, as one step of the agent\'s, and the script is not run again', async () => {
    const [mode, host] = [codeMode(), hostOver()]
    const tried = await simulate(mode, host, OWN)
    host.asked.length = 0
    const landed = said(await ask(mode, host, 'run', { token: tried.token }))
    expect(landed).toEqual({ landed: [{ scope: 'acme/retail', revision: 1, writes: 2 }] })
    // No call of the script was made again: the commands were kept, and landed.
    expect(host.asked).toEqual([])
    expect(host.session.history()).toHaveLength(1)
    expect(host.session.history()[0]).toMatchObject({ origin: 'agent' })
    expect(host.session.history()[0].commands[0]).toMatchObject({ type: 'transaction' })
    expect(host.session.current().elements.find((one) => one.id === 'wms')).toMatchObject({ owner: 'Operations' })
    // The ids the simulation answered are the ids that landed.
    const id = tried.steps[1].answer.id as string
    expect(host.session.current().observations?.find((one) => one.id === id)).toMatchObject({ title: 'Warehouse system had no owner', about: ['wms'] })
    expect(host.lines.at(-1)).toEqual(expect.objectContaining({ op: 'run', scopesWritten: ['acme/retail'], writes: 2, outcome: 'ok' }))
  })

  it('is refused where the scope has moved since it was tried, naming the scope, and lands nothing', async () => {
    const [mode, host] = [codeMode(), hostOver()]
    const tried = await simulate(mode, host, OWN)
    host.session.dispatch({ type: 'element.update', id: 'pos', patch: { name: 'Tills' } })
    const refusedRun = await ask(mode, host, 'run', { token: tried.token })
    expect(refusedRun).toMatchObject({ ok: false, refusal: 'agent.stale', detail: 'acme/retail is at revision 1, and the simulation was tried at 0: simulate again' })
    expect(host.session.history()).toHaveLength(1)
    // And is not rebased: the token is spent, and the script is tried again on the scope as it is.
    expect(await ask(mode, host, 'run', { token: tried.token })).toMatchObject({ ok: false, refusal: 'agent.unknownSimulation' })
    const again = await simulate(mode, host, OWN)
    expect(again.scopes[0].revision).toBe(1)
    expect(said(await ask(mode, host, 'run', { token: again.token }))).toMatchObject({ landed: [{ revision: 2 }] })
  })

  it('lands once: a token used, discarded, unknown or somebody else\'s is one answer', async () => {
    const mode = codeMode()
    const session = sessionOver(RETAIL, 'acme/retail')
    const [one, another] = [hostOver({ session, holder: 'one' }), hostOver({ session, holder: 'another' })]
    const unknown = { ok: false, refusal: 'agent.unknownSimulation' }
    const tried = await simulate(mode, one, OWN)
    expect(await ask(mode, another, 'run', { token: tried.token })).toMatchObject(unknown)
    expect(await ask(mode, another, 'discard', { token: tried.token })).toMatchObject(unknown)
    expect(session.history()).toHaveLength(0)
    expect(said(await ask(mode, one, 'run', { token: tried.token }))).toMatchObject({ landed: [{ scope: 'acme/retail' }] })
    expect(await ask(mode, one, 'run', { token: tried.token })).toMatchObject(unknown)
    expect(session.history()).toHaveLength(1)
    const next = await simulate(mode, one, 'await lv.elements.update({ id: "pos", name: "Tills" })')
    expect(said(await ask(mode, one, 'discard', { token: next.token }))).toEqual({ discarded: true })
    expect(await ask(mode, one, 'run', { token: next.token })).toMatchObject(unknown)
    expect(await ask(mode, one, 'run', { token: 'sim_00000000000000000000000000000000' })).toMatchObject(unknown)
    expect(await ask(mode, one, 'run', {})).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    expect(session.history()).toHaveLength(1)
    // A simulation is another code mode's to know nothing of: a restart forgets them all.
    const before = await simulate(mode, one, 'await lv.elements.update({ id: "pos", name: "Tills" })')
    expect(await ask(codeMode(), one, 'run', { token: before.token })).toMatchObject(unknown)
  })

  it('is refused while nothing may change, and where the person stopped the session', async () => {
    const mode = codeMode()
    const now: { blocked?: 'agent.readOnly' } = {}
    const host = hostOver({ session: sessionOver(RETAIL, 'acme/retail', { blocked: () => now.blocked }) })
    const tried = await simulate(mode, host, 'await lv.elements.update({ id: "pos", name: "Tills" })')
    now.blocked = 'agent.readOnly'
    expect(await ask(mode, host, 'run', { token: tried.token })).toMatchObject({ ok: false, refusal: 'agent.readOnly' })
    expect(host.session.history()).toHaveLength(0)
    // A script that would change something is told so while it is tried, too.
    expect(await ask(mode, host, 'simulate', { script: 'await lv.elements.update({ id: "pos", name: "Tills" })' })).toMatchObject({ ok: false, refusal: 'agent.scriptFailed' })
  })

  it('drives when it lands and not while it is tried: the banner goes up at the run, and Stop refuses it', async () => {
    const [mode, shell] = [codeMode(), shellOver()]
    const host = hostOver({ shell })
    const tried = await simulate(mode, host, 'await lv.elements.update({ id: "pos", name: "Tills" })')
    expect(shell.driving.current().session).toBeUndefined()
    await ask(mode, host, 'run', { token: tried.token })
    expect(shell.driving.current().session).toMatchObject({ client: 'a test client', calls: 1 })
    // The person presses Stop: a script may still be tried, and nothing of it lands.
    shell.driving.end('person')
    const next = await simulate(mode, host, 'await lv.elements.update({ id: "pos", name: "Point of sale" })')
    expect(await ask(mode, host, 'run', { token: next.token })).toMatchObject({ ok: false, refusal: 'agent.stopped' })
    expect(host.session.history()).toHaveLength(1)
  })

  it('says a person in what a simulation answers as an answer says one', async () => {
    const tried = await simulate(codeMode(), hostOver(), 'await lv.elements.update({ id: "wms", owner: { person: "pe-pia" } }); return (await lv.elements.describe({ id: "pos" })).owner')
    // No register here, so an id is said as an id: what matters is that the pass ran over the whole answer.
    expect(tried.result).toMatchObject({ person: 'pe-pia' })
  })
})
