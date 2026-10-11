// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every people register must do — written once, run by all of them, and
 * by a server's own over its database (ADR-0036).
 *
 * The register is where a name lives and the only place it does, so what
 * matters most is that a name goes when it is told to and never comes back:
 * a forget is final, a merge leaves a redirect with no name, a removal takes
 * the redirects with it, and entries carried in from a file never give a name
 * back. And because it is outside the history, nothing here writes a step:
 * the scopes, their revisions and their histories do not move.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../people/person'
import { ok, over, refusal } from './Repositories.contract'
import type { MakeRepositories } from './Repositories.contract'
import type { PeopleRefused, PersonWritten } from './PeopleRepository'

/** The entry a change answered, which must be there. */
function entry(answer: PersonWritten | PeopleRefused): Person {
  return ok(answer).person
}

export function describePeopleRepository(name: string, make: MakeRepositories): void {
  describe(`PeopleRepository contract — ${name}`, () => {
    const fresh = async () => {
      const under = await make()
      return { under, repositories: over(under) }
    }

    it('names itself, and starts with nobody', async () => {
      const { repositories } = await fresh()
      expect(repositories.people.id).toMatch(/\S/)
      expect((await repositories.people.list()).people).toEqual([])
    })

    it('adds an active entry with an id and a pseudonym of its own, and reads it back', async () => {
      const { repositories } = await fresh()
      const pia = entry(await repositories.people.add({ name: '  Pia   Schulz ', email: ' Pia.Schulz@Acme.example ' }))
      expect(pia).toMatchObject({ name: 'Pia Schulz', email: 'pia.schulz@acme.example', kind: 'internal', state: 'active' })
      expect(pia.pseudonym).toMatch(/\S/)
      expect(await repositories.people.read(pia.id)).toEqual(pia)
      expect((await repositories.people.list()).people).toEqual([pia])
      expect(await repositories.people.read('pe-nobody')).toBeUndefined()
    })

    it('never takes an id from the name: two people of one name are two entries', async () => {
      const { repositories } = await fresh()
      const one = entry(await repositories.people.add({ name: 'Ivo Peters' }))
      const other = entry(await repositories.people.add({ name: 'Ivo Peters', kind: 'external' }))
      expect(one.id).not.toBe(other.id)
      expect(one.pseudonym).not.toBe(other.pseudonym)
      for (const id of [one.id, other.id]) expect(id.toLowerCase()).not.toMatch(/ivo|peters/)
      expect(other.kind).toBe('external')
    })

    it('refuses an entry with no name or with an address that is none, and writes nothing', async () => {
      const { repositories } = await fresh()
      const before = (await repositories.people.list()).revision
      expect(refusal(await repositories.people.add({ name: '   ' }))).toBe('people.nameRequired')
      expect(refusal(await repositories.people.add({ name: 'Ada Verbeek', email: 'not an address' }))).toBe('people.badEmail')
      expect(await repositories.people.list()).toEqual({ revision: before, people: [] })
    })

    it('corrects a name, an address and a kind, and takes an address out for `null`', async () => {
      const { repositories } = await fresh()
      const bram = entry(await repositories.people.add({ name: 'Bram de Witt', email: 'bram@acme.example' }))
      const corrected = entry(await repositories.people.change(bram.id, { name: 'Bram de Wit', kind: 'external' }))
      expect(corrected).toMatchObject({ id: bram.id, name: 'Bram de Wit', email: 'bram@acme.example', kind: 'external', pseudonym: bram.pseudonym })
      const without = entry(await repositories.people.change(bram.id, { email: null }))
      expect(without.email).toBeUndefined()
      expect(await repositories.people.read(bram.id)).toEqual(without)
      expect(refusal(await repositories.people.change('pe-nobody', { name: 'X' }))).toBe('people.unknown')
      expect(refusal(await repositories.people.change(bram.id, { name: '' }))).toBe('people.nameRequired')
    })

    it('marks someone as left on their last day, and only someone active', async () => {
      const { repositories } = await fresh()
      const gijs = entry(await repositories.people.add({ name: 'Gijs Mulder' }))
      expect(refusal(await repositories.people.leave(gijs.id, '14 August'))).toBe('people.badDay')
      const left = entry(await repositories.people.leave(gijs.id, '2026-08-14'))
      expect(left).toMatchObject({ id: gijs.id, name: 'Gijs Mulder', state: 'left', leftOn: '2026-08-14' })
      expect(refusal(await repositories.people.leave(gijs.id, '2026-08-15'))).toBe('people.notActive')
    })

    it('forgets: the name and the address go, the pseudonym stays, and it cannot be corrected back', async () => {
      const { repositories } = await fresh()
      const gijs = entry(await repositories.people.add({ name: 'Gijs Mulder', email: 'gijs.mulder@acme.example' }))
      await repositories.people.leave(gijs.id, '2026-08-14')
      const forgotten = entry(await repositories.people.forget(gijs.id, '2026-11-12'))
      expect(forgotten).toEqual({
        id: gijs.id, pseudonym: gijs.pseudonym, kind: 'internal', state: 'forgotten', leftOn: '2026-08-14', forgottenOn: '2026-11-12',
      })
      expect(await repositories.people.read(gijs.id)).toEqual(forgotten)
      expect(JSON.stringify((await repositories.people.list()).people)).not.toMatch(/Gijs|Mulder|gijs\.mulder/)
      expect(refusal(await repositories.people.change(gijs.id, { name: 'Gijs Mulder' }))).toBe('people.forgotten')
      expect(refusal(await repositories.people.forget(gijs.id, '2026-11-13'))).toBe('people.forgotten')
    })

    it('forgets someone still active as having left that day: an erasure asked for is the same action', async () => {
      const { repositories } = await fresh()
      const ada = entry(await repositories.people.add({ name: 'Ada Verbeek' }))
      const forgotten = entry(await repositories.people.forget(ada.id, '2026-10-11'))
      expect(forgotten).toMatchObject({ state: 'forgotten', leftOn: '2026-10-11', forgottenOn: '2026-10-11' })
      expect(forgotten.name).toBeUndefined()
    })

    it('merges: one entry kept, the other a redirect into it with no name, final', async () => {
      const { repositories } = await fresh()
      const lind = entry(await repositories.people.add({ name: 'Eva Lind', email: 'eva.lind@acme.example' }))
      const lindt = entry(await repositories.people.add({ name: 'Eva Lindt', email: 'eva.lindt@acme.example' }))
      const kept = entry(await repositories.people.merge(lindt.id, lind.id))
      expect(kept).toEqual(lind)
      const redirect = await repositories.people.read(lindt.id)
      expect(redirect).toMatchObject({ id: lindt.id, mergedInto: lind.id })
      expect(redirect?.name).toBeUndefined()
      expect(redirect?.email).toBeUndefined()
      expect(refusal(await repositories.people.change(lindt.id, { name: 'Eva Lindt' }))).toBe('people.merged')
      expect(refusal(await repositories.people.merge(lindt.id, lind.id))).toBe('people.merged')
      expect(refusal(await repositories.people.merge(lind.id, lind.id))).toBe('people.badMerge')
    })

    it('keeps every redirect one step long: merging the kept entry on carries what pointed at it', async () => {
      const { repositories } = await fresh()
      const one = entry(await repositories.people.add({ name: 'Noor Haddad' }))
      const two = entry(await repositories.people.add({ name: 'Noor Hadad' }))
      const three = entry(await repositories.people.add({ name: 'N. Haddad' }))
      ok(await repositories.people.merge(two.id, one.id))
      ok(await repositories.people.merge(one.id, three.id))
      expect((await repositories.people.read(two.id))?.mergedInto).toBe(three.id)
      expect((await repositories.people.read(one.id))?.mergedInto).toBe(three.id)
    })

    it('does not merge into a forgotten entry', async () => {
      const { repositories } = await fresh()
      const kept = entry(await repositories.people.add({ name: 'Omar Benali' }))
      const other = entry(await repositories.people.add({ name: 'Omar Benalli' }))
      ok(await repositories.people.forget(kept.id, '2026-10-11'))
      expect(refusal(await repositories.people.merge(other.id, kept.id))).toBe('people.badMerge')
    })

    it('removes only a forgotten entry, and every redirect into it with it', async () => {
      const { repositories } = await fresh()
      const kept = entry(await repositories.people.add({ name: 'Lars Berg' }))
      const twin = entry(await repositories.people.add({ name: 'Lars Bergh' }))
      ok(await repositories.people.merge(twin.id, kept.id))
      expect(refusal(await repositories.people.remove(kept.id))).toBe('people.notForgotten')
      ok(await repositories.people.forget(kept.id, '2026-10-11'))
      const removed = ok(await repositories.people.remove(kept.id))
      expect([...removed.removed].sort()).toEqual([kept.id, twin.id].sort())
      expect(await repositories.people.read(kept.id)).toBeUndefined()
      expect(await repositories.people.read(twin.id)).toBeUndefined()
      expect((await repositories.people.list()).people).toEqual([])
      expect(refusal(await repositories.people.remove(kept.id))).toBe('people.unknown')
    })

    it('brings entries in by their ids, and adds what it did not hold', async () => {
      const { repositories } = await fresh()
      const carried: Person = { id: 'pe-0123456789abcdef', name: 'Sara Kaya', pseudonym: 'B7KQ', kind: 'internal', state: 'active' }
      const brought = await repositories.people.bringIn([carried])
      expect(brought.changed).toEqual([carried.id])
      expect(await repositories.people.read(carried.id)).toEqual(carried)
      expect((await repositories.people.bringIn([carried])).changed).toEqual([])
    })

    it('never gives a name back to an entry forgotten here, and never undoes a merge', async () => {
      const { repositories } = await fresh()
      const gijs = entry(await repositories.people.add({ name: 'Gijs Mulder' }))
      const eva = entry(await repositories.people.add({ name: 'Eva Lind' }))
      const evaToo = entry(await repositories.people.add({ name: 'Eva Lindt' }))
      ok(await repositories.people.forget(gijs.id, '2026-10-11'))
      ok(await repositories.people.merge(evaToo.id, eva.id))
      await repositories.people.bringIn([gijs, evaToo])
      expect((await repositories.people.read(gijs.id))?.name).toBeUndefined()
      expect((await repositories.people.read(gijs.id))?.state).toBe('forgotten')
      expect((await repositories.people.read(evaToo.id))?.mergedInto).toBe(eva.id)
      expect(JSON.stringify((await repositories.people.list()).people)).not.toMatch(/Gijs|Lindt/)
    })

    it('takes a forgetting carried in, and keeps the names a file made without names does not hold', async () => {
      const { repositories } = await fresh()
      const kees = entry(await repositories.people.add({ name: 'Kees Vos', email: 'kees.vos@acme.example' }))
      const lotte = entry(await repositories.people.add({ name: 'Lotte Jansen' }))
      const { name: _name, email: _email, ...nameless } = kees
      await repositories.people.bringIn([nameless, { ...lotte, name: undefined, state: 'forgotten', forgottenOn: '2026-10-01', leftOn: '2026-07-01' }])
      expect(await repositories.people.read(kees.id)).toEqual(kees)
      expect(await repositories.people.read(lotte.id)).toMatchObject({ state: 'forgotten', forgottenOn: '2026-10-01' })
      expect((await repositories.people.read(lotte.id))?.name).toBeUndefined()
    })

    it('answers one revision while nothing changes, another after each change, and the same after a refusal', async () => {
      const { repositories } = await fresh()
      const first = (await repositories.people.list()).revision
      expect((await repositories.people.list()).revision).toBe(first)
      const added = ok(await repositories.people.add({ name: 'Hanna Novak' }))
      expect(added.revision).not.toBe(first)
      expect((await repositories.people.list()).revision).toBe(added.revision)
      expect(refusal(await repositories.people.leave('pe-nobody', '2026-10-11'))).toBe('people.unknown')
      expect((await repositories.people.list()).revision).toBe(added.revision)
    })

    it('says nothing changed since the revision it answers now', async () => {
      const { repositories } = await fresh()
      await repositories.people.add({ name: 'Ruben Dekker' })
      const now = (await repositories.people.list()).revision
      expect(await repositories.people.since(now)).toEqual({ revision: now, changed: [], removed: [] })
    })

    it('names what changed and what went since a revision, as it is now, and not what nobody touched', async () => {
      const { repositories } = await fresh()
      const ivo = entry(await repositories.people.add({ name: 'Ivo Peters' }))
      const julia = entry(await repositories.people.add({ name: 'Julia Smit' }))
      const tim = entry(await repositories.people.add({ name: 'Tim de Boer' }))
      ok(await repositories.people.forget(tim.id, '2026-10-11'))
      const from = (await repositories.people.list()).revision
      const left = entry(await repositories.people.leave(julia.id, '2026-10-10'))
      ok(await repositories.people.remove(tim.id))
      const yara = entry(await repositories.people.add({ name: 'Yara Visser' }))
      const changes = await repositories.people.since(from)
      expect(changes?.revision).toBe((await repositories.people.list()).revision)
      expect([...(changes?.changed ?? [])].sort((a, b) => a.id.localeCompare(b.id))).toEqual([left, yara].sort((a, b) => a.id.localeCompare(b.id)))
      expect(changes?.changed.map((one) => one.id)).not.toContain(ivo.id)
      expect(changes?.removed).toEqual([tim.id])
    })

    it('answers nothing for a revision it never gave, rather than a change set that is short', async () => {
      const { repositories } = await fresh()
      await repositories.people.add({ name: 'Kim Bakker' })
      expect(await repositories.people.since('a revision nobody was given')).toBeUndefined()
    })

    it('is no step: a change to the register moves no scope, no tree and no history', async () => {
      const { repositories } = await fresh()
      const root = await repositories.root()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      await repositories.record()
      const before = {
        root: (await repositories.state(root)).revision,
        acme: (await repositories.state(acme)).revision,
        tree: (await repositories.scopes.tree()).revision,
        index: (await repositories.index.read()).revision,
        entries: (await repositories.history.entries({ scopes: [root, acme] })).entries.length,
      }
      const max = entry(await repositories.people.add({ name: 'Max Wolf' }))
      ok(await repositories.people.leave(max.id, '2026-10-11'))
      ok(await repositories.people.forget(max.id, '2026-10-11'))
      await repositories.record()
      expect({
        root: (await repositories.state(root)).revision,
        acme: (await repositories.state(acme)).revision,
        tree: (await repositories.scopes.tree()).revision,
        index: (await repositories.index.read()).revision,
        entries: (await repositories.history.entries({ scopes: [root, acme] })).entries.length,
      }).toEqual(before)
    })

    it('keeps the register when the repositories are made again', async () => {
      const { under, repositories } = await fresh()
      const iris = entry(await repositories.people.add({ name: 'Iris Maas', email: 'iris.maas@acme.example' }))
      const again = under.reopen ? await under.reopen() : under.repositories
      expect(await again.people.read(iris.id)).toEqual(iris)
      expect((await again.people.list()).people).toEqual([iris])
    })

    it('hands out entries nobody else holds: changing what it answered changes nothing it keeps', async () => {
      const { repositories } = await fresh()
      const roos = entry(await repositories.people.add({ name: 'Roos de Vries' }))
      const listed = (await repositories.people.list()).people as Person[]
      ;(listed[0] as { name?: string }).name = 'Someone else'
      ;(roos as { name?: string }).name = 'Someone else'
      expect((await repositories.people.read(roos.id))?.name).toBe('Roos de Vries')
    })
  })
}
