// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every scope repository must do — written once, run by all of them.
 *
 * The interface pins the shapes; this pins the behaviour, and it is written
 * for the richest implementation: identities that survive a move, steps
 * that land once, several scopes changed together or not at all, a revision
 * that moves exactly when the state does. An implementation that keeps work
 * somewhere these are hard does the work to pass them; none of them is here
 * because one implementation found it easy.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../model/commands'
import type { ScopeNode } from './ScopeRepository'
import { emptyContent } from '../projects/scopeState'
import type { ScopeContent, ScopeId } from '../projects/scopeState'
import {
  addCrews, addDepot, addLandscape, element, held, ok, over, refusal, renameCrews, replayed, step,
} from './Repositories.contract'
import type { MakeRepositories, Over } from './Repositories.contract'

/** Every node of a tree, root first, depth first. */
function nodes(node: ScopeNode): ScopeNode[] {
  return [node, ...node.children.flatMap(nodes)]
}

async function addresses(repositories: Over): Promise<string[]> {
  return nodes((await repositories.scopes.tree()).root).map((node) => node.address)
}

async function nodeOf(repositories: Over, id: ScopeId): Promise<ScopeNode | undefined> {
  return nodes((await repositories.scopes.tree()).root).find((node) => node.id === id)
}

export function describeScopeRepository(name: string, make: MakeRepositories): void {
  describe(`ScopeRepository contract — ${name}`, () => {
    const fresh = async () => over(await make())

    it('names itself, so a message can say where it went wrong', async () => {
      const { scopes } = await fresh()
      expect(scopes.id).toMatch(/\S/)
    })

    describe('the tree', () => {
      it('has the organisation on an empty repository, with nothing under it and nothing in it', async () => {
        const repositories = await fresh()
        const tree = await repositories.scopes.tree()
        expect(tree.root.address).toBe('')
        expect(tree.root.parent).toBeUndefined()
        expect(tree.root.children).toEqual([])
        const root = await repositories.state(tree.root.id)
        expect(root.address).toBe('')
        expect(root.model.elements).toEqual([])
        expect(root.images).toEqual([])
      })

      it('creates a scope with an identity of its own, which is not its address', async () => {
        const repositories = await fresh()
        const created = ok(await repositories.create('acme', { name: 'Acme Logistics', kind: 'domain', client: 'Acme' }))
        expect(created.id).not.toBe('acme')
        const state = await repositories.state(created.id)
        expect(held(state)).toEqual({ id: created.id, address: 'acme', ...emptyContent('Acme Logistics', { kind: 'domain', client: 'Acme' }) })
        expect(state.revision).toBe(created.revision)
        const tree = await repositories.scopes.tree()
        expect(tree.root.children.map((node) => [node.id, node.address, node.name, node.kind, node.parent]))
          .toEqual([[created.id, 'acme', 'Acme Logistics', 'domain', tree.root.id]])
      })

      it('creates the scopes above a new one that are not there, each named after its address', async () => {
        const repositories = await fresh()
        const created = ok(await repositories.create('acme/rail/rolling-stock', { name: 'Rolling stock' }))
        expect(await addresses(repositories)).toEqual(['', 'acme', 'acme/rail', 'acme/rail/rolling-stock'])
        const rail = nodes((await repositories.scopes.tree()).root).find((node) => node.address === 'acme/rail')!
        expect(rail.name).toBe('rail')
        expect((await nodeOf(repositories, created.id))?.parent).toBe(rail.id)
      })

      it('keeps scopes under one parent, and one name under two parents, apart', async () => {
        const repositories = await fresh()
        const acmeRail = await repositories.scope('acme/rail', 'Rail')
        const acmeRoad = await repositories.scope('acme/road', 'Road')
        const globexRail = await repositories.scope('globex/rail', 'Rail')
        await repositories.steps(acmeRail, addCrews)
        expect((await repositories.state(acmeRail)).model.elements.map((one) => one.id)).toEqual(['crews'])
        expect((await repositories.state(acmeRoad)).model.elements).toEqual([])
        expect((await repositories.state(globexRail)).model.elements).toEqual([])
        expect(new Set([acmeRail, acmeRoad, globexRail]).size).toBe(3)
      })

      it('refuses to create a scope where one is, the organisation included, and changes nothing', async () => {
        const repositories = await fresh()
        await repositories.scope('acme', 'Acme Logistics')
        const before = await repositories.scopes.tree()
        expect(refusal(await repositories.create('acme', { name: 'Again' }))).toBe('shell.scopeTaken')
        expect(refusal(await repositories.create('', { name: 'Another organisation' }))).toBe('shell.scopeTaken')
        expect(await repositories.scopes.tree()).toEqual(before)
      })

      it('refuses an address no scope may have', async () => {
        const repositories = await fresh()
        for (const address of ['../escape', 'acme//rail', '/acme', 'acme/']) {
          expect(refusal(await repositories.create(address, { name: 'Nowhere' })), address).toBe('shell.badScopePath')
        }
        expect(await addresses(repositories)).toEqual([''])
      })

      it('carries a revision that stays while nothing changes and moves when a node does', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const first = (await repositories.scopes.tree()).revision
        expect((await repositories.scopes.tree()).revision).toBe(first)
        await repositories.steps(acme, { type: 'project.settings', patch: { name: 'Acme' } })
        const renamed = await repositories.scopes.tree()
        expect(renamed.revision).not.toBe(first)
        expect(renamed.root.children[0].name).toBe('Acme')
        await repositories.scope('globex', 'Globex')
        expect((await repositories.scopes.tree()).revision).not.toBe(renamed.revision)
      })

      it('says in the tree what a scope says about itself, and how many views it holds', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme,
          addLandscape,
          { type: 'project.settings', patch: { description: 'Freight and rail.' } },
          { type: 'scope.describe', patch: { kind: 'domain', client: 'Acme', links: [{ label: 'Wiki', url: 'https://example.org/acme' }] } })
        const node = (await nodeOf(repositories, acme))!
        expect([node.kind, node.client, node.description, node.links, node.diagrams])
          .toEqual(['domain', 'Acme', 'Freight and rail.', [{ label: 'Wiki', url: 'https://example.org/acme' }], 1])
      })
    })

    describe('steps', () => {
      it('applies steps in order, as the reducer does, and moves the revision', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const before = await repositories.state(acme)
        const revision = await repositories.steps(acme, addCrews, addDepot, renameCrews, addLandscape)
        const after = await repositories.state(acme)
        expect(after.model).toEqual(replayed(before.model, [addCrews, addDepot, renameCrews, addLandscape]))
        expect(after.revision).toBe(revision)
        expect(revision).not.toBe(before.revision)
      })

      it('answers the same revision for two reads with nothing between them', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        expect((await repositories.state(acme)).revision).toBe((await repositories.state(acme)).revision)
      })

      it('keeps what a step carries verbatim: a description, a decision, a plan, an observation', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const before = await repositories.state(acme)
        const commands: Command[] = [
          addCrews,
          {
            type: 'decision.add',
            decision: { id: 'adr-1', number: 1, title: 'Plan crews centrally', status: 'proposed', date: '2026-09-29', body: '## Context\n\nCrews are planned in three places.\n', subjectId: 'crews', signers: [] },
          },
          {
            type: 'transition.add',
            transition: { id: 'tr-1', number: 1, title: 'Centralise crew planning', status: 'draft', from: '2026-10-01', elements: [], decisions: ['adr-1'], milestones: [], body: '' },
          },
          {
            type: 'observation.add',
            observation: { id: 'ob-1', number: 1, title: 'Crews double-booked', date: '2026-09-28', impact: 'major', seen: 2, body: 'Twice on Monday.', history: [] },
          },
        ]
        await repositories.steps(acme, ...commands)
        expect((await repositories.state(acme)).model).toEqual(replayed(before.model, commands))
      })

      it('refuses a run the reducer refuses anywhere, applies none of it, and names the step', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const before = await repositories.state(acme)
        const bad = step({ type: 'element.update', id: 'nowhere', patch: { name: 'X' } })
        const answer = await repositories.apply([{ scope: acme, steps: [step(addCrews), bad] }])
        expect(answer).toEqual({ refused: 'command.gone', scope: acme, stepId: bad.stepId })
        expect(await repositories.state(acme)).toEqual(before)
      })

      it('refuses a create on an id the scope holds, as the reducer does', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step(addCrews)] }]))).toBe('command.taken')
      })

      it('leaves the revision where it was for a step that changes nothing', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const revision = await repositories.steps(acme, addCrews)
        expect(await repositories.steps(acme, { type: 'element.update', id: 'crews', patch: { name: 'Crews' } })).toBe(revision)
        expect((await repositories.state(acme)).revision).toBe(revision)
      })

      /**
       * A sender that did not hear the answer sends the same step again. It
       * lands once, and the answer is the state as it stands — a create sent
       * twice is not refused as taken, because nobody else took the id.
       */
      it('lands a step sent twice once', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const once = step(addCrews)
        const first = ok(await repositories.apply([{ scope: acme, steps: [once] }])).revisions[0]
        const again = ok(await repositories.apply([{ scope: acme, steps: [once] }])).revisions[0]
        expect(again).toBe(first)
        expect((await repositories.state(acme)).model.elements).toHaveLength(1)
      })

      /** The answer to the first was lost; the second is the same step again, and it is not new. */
      it('keeps a deleted element deleted when the step that created it is sent again', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const create = step(addCrews)
        ok(await repositories.apply([{ scope: acme, steps: [create] }]))
        await repositories.steps(acme, { type: 'element.delete', id: 'crews' })
        const now = (await repositories.state(acme)).revision
        expect(ok(await repositories.apply([{ scope: acme, steps: [create] }])).revisions).toEqual([now])
        expect((await repositories.state(acme)).model.elements).toEqual([])
      })

      it('answers a run sent again as it stands, whatever revision the run expected', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        const run = { scope: acme, steps: [step(addCrews)], expects: read }
        const landed = ok(await repositories.apply([run])).revisions[0]
        await repositories.steps(acme, addDepot)
        const now = (await repositories.state(acme)).revision
        expect(landed).not.toBe(read)
        expect(ok(await repositories.apply([run])).revisions).toEqual([now])
      })

      it('applies the new steps of a run that mixes them with one already landed, once each', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const first = step(addCrews)
        const revision = ok(await repositories.apply([{ scope: acme, steps: [first] }])).revisions[0]
        ok(await repositories.apply([{ scope: acme, steps: [first, step(addDepot), first], expects: revision }]))
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews', 'depot'])
      })

      /** A caller that sends one step object to two scopes is told, rather than told it landed. */
      it('refuses a step id applied on another scope, and applies nothing of the run', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const globex = await repositories.scope('globex', 'Globex')
        const once = step(addCrews)
        ok(await repositories.apply([{ scope: acme, steps: [once] }]))
        const before = await repositories.state(globex)
        expect(await repositories.apply([{ scope: globex, steps: [step(addDepot), once] }]))
          .toEqual({ refused: 'step.elsewhere', scope: globex, stepId: once.stepId })
        expect(await repositories.state(globex)).toEqual(before)
        expect(refusal(await repositories.apply([
          { scope: acme, steps: [step(renameCrews)] },
          { scope: globex, steps: [once] },
        ]))).toBe('step.elsewhere')
        expect((await repositories.state(acme)).model.elements.map((one) => one.name)).toEqual(['Crews'])
      })

      it('refuses one step id sent to two scopes in one apply', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const globex = await repositories.scope('globex', 'Globex')
        const twice = step(addCrews)
        expect(refusal(await repositories.apply([{ scope: acme, steps: [twice] }, { scope: globex, steps: [twice] }])))
          .toBe('step.elsewhere')
        expect((await repositories.state(acme)).model.elements).toEqual([])
      })

      it('applies a scope named twice in one apply as its runs one after the other', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        const answer = ok(await repositories.apply([
          { scope: acme, steps: [step(addCrews)], expects: read },
          { scope: acme, steps: [step(renameCrews)], expects: read },
        ]))
        const now = await repositories.state(acme)
        expect(now.model.elements.map((one) => one.name)).toEqual(['Crew planning'])
        expect(answer.revisions).toEqual([now.revision, now.revision])
      })

      it('leaves the revision where it was when a scope’s second run in one apply undoes its first', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        const answer = ok(await repositories.apply([
          { scope: acme, steps: [step(addCrews)] },
          { scope: acme, steps: [step({ type: 'element.delete', id: 'crews' })] },
        ]))
        expect(answer.revisions).toEqual([read, read])
        expect((await repositories.state(acme)).revision).toBe(read)
      })

      it('lands steps that expect the revision they were made against', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = await repositories.state(acme)
        ok(await repositories.apply([{ scope: acme, steps: [step(addCrews)], expects: read.revision }]))
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })

      it('refuses steps that expect a revision somebody has moved on from, and keeps theirs', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = await repositories.state(acme)
        await repositories.steps(acme, addDepot)
        const answer = await repositories.apply([{ scope: acme, steps: [step(addCrews)], expects: read.revision }])
        expect(answer).toEqual({ refused: 'shell.scopeMoved', scope: acme })
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['depot'])
      })

      it('refuses steps on a scope that is not there', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        ok(await repositories.remove(acme))
        expect(await repositories.apply([{ scope: acme, steps: [step(addCrews)] }])).toEqual({ refused: 'shell.scopeGone', scope: acme })
      })

      it('applies steps to several scopes together, and answers each one’s revision in order', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const globex = await repositories.scope('globex', 'Globex')
        const answer = ok(await repositories.apply([
          { scope: globex, steps: [step(addDepot)] },
          { scope: acme, steps: [step(addCrews)] },
        ]))
        expect(answer.revisions).toEqual([(await repositories.state(globex)).revision, (await repositories.state(acme)).revision])
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
        expect((await repositories.state(globex)).model.elements.map((one) => one.id)).toEqual(['depot'])
      })

      it('applies none of several scopes’ steps where one scope’s are refused', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const globex = await repositories.scope('globex', 'Globex')
        const stale = (await repositories.state(globex)).revision
        await repositories.steps(globex, addDepot)
        const before = [await repositories.state(acme), await repositories.state(globex)]
        expect(refusal(await repositories.apply([
          { scope: acme, steps: [step(addCrews)] },
          { scope: globex, steps: [step(renameCrews)] },
        ]))).toBe('command.gone')
        expect(refusal(await repositories.apply([
          { scope: acme, steps: [step(addCrews)] },
          { scope: globex, steps: [step(addCrews)], expects: stale },
        ]))).toBe('shell.scopeMoved')
        expect([await repositories.state(acme), await repositories.state(globex)]).toEqual(before)
      })

      it('counts no step of a refused apply as applied: the valid part, sent again, lands', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const globex = await repositories.scope('globex', 'Globex')
        const valid = step(addCrews)
        expect(refusal(await repositories.apply([
          { scope: acme, steps: [valid] },
          { scope: globex, steps: [step(renameCrews)] },
        ]))).toBe('command.gone')
        ok(await repositories.apply([{ scope: acme, steps: [valid] }]))
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })

      it('moves neither the tree’s revision nor the index’s for a refused apply', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const tree = (await repositories.scopes.tree()).revision
        const index = (await repositories.index.read()).revision
        expect(refusal(await repositories.apply([{ scope: acme, steps: [
          step({ type: 'project.settings', patch: { name: 'Acme' } }), step(renameCrews),
        ] }]))).toBe('command.gone')
        expect((await repositories.scopes.tree()).revision).toBe(tree)
        expect((await repositories.index.read()).revision).toBe(index)
      })

      it('moves no tree revision for a step that changes nothing a node says', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addLandscape)
        const tree = (await repositories.scopes.tree()).revision
        await repositories.steps(acme, addCrews, renameCrews)
        expect((await repositories.scopes.tree()).revision).toBe(tree)
      })

      it('keeps the image library and what a scope says about itself as steps change them', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const picture = {
          name: 'diagrams/context.png', mediaType: 'image/png', size: 3, width: 640, height: 480,
          contentAddress: 'sha256:039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
        }
        // Its bytes first, as a page adding a picture puts them: a library names no bytes that are not kept.
        ok(await repositories.images.put(acme, picture.name, new Uint8Array([1, 2, 3])))
        await repositories.steps(acme,
          { type: 'image.add', image: picture },
          { type: 'scope.describe', patch: { kind: 'landscape', activeDiagramId: 'l7' } })
        const state = await repositories.state(acme)
        expect(state.images).toEqual([picture])
        expect([state.kind, state.activeDiagramId]).toEqual(['landscape', 'l7'])
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'image.add', image: { ...picture, name: 'a b.png' } })] }])))
          .toBe('shell.imageBadName')
      })

      it('answers a state nobody else holds: changing what it answered changes nothing it keeps', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        const answered = await repositories.state(acme)
        answered.model.elements.push(element('stowaway', 'Stowaway'))
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })
    })

    /**
     * A content that arrives whole — a working file landed on a scope, a scope
     * built from an example — is one step (`scope.replace`), held to what any
     * step is held to.
     */
    describe('a content that arrives whole', () => {
      const arriving = () => ({
        ...emptyContent('Acme Logistics', { kind: 'domain' as const, activeDiagramId: 'l7' }),
        model: replayed(emptyContent('Acme Logistics').model, [addDepot, addLandscape]),
      })

      it('makes the scope hold exactly that content, what was there and is not in it gone', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews, { type: 'scope.describe', patch: { client: 'Acme' } })
        const read = await repositories.state(acme)
        ok(await repositories.apply([{ scope: acme, steps: [step({ type: 'scope.replace', content: arriving() })], expects: read.revision }]))
        const after = await repositories.state(acme)
        expect(held(after)).toEqual({ id: acme, address: 'acme', ...arriving() })
        expect(after.revision).not.toBe(read.revision)
      })

      it('is refused over a revision somebody has moved on from, and keeps theirs', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = await repositories.state(acme)
        await repositories.steps(acme, addCrews)
        const answer = await repositories.apply([{ scope: acme, steps: [step({ type: 'scope.replace', content: arriving() })], expects: read.revision }])
        expect(answer).toEqual({ refused: 'shell.scopeMoved', scope: acme })
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })

      it('lands once when it is sent twice', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const once = step({ type: 'scope.replace', content: arriving() })
        const first = ok(await repositories.apply([{ scope: acme, steps: [once] }])).revisions[0]
        await repositories.steps(acme, addCrews)
        const now = (await repositories.state(acme)).revision
        expect(ok(await repositories.apply([{ scope: acme, steps: [once] }])).revisions).toEqual([now])
        expect(now).not.toBe(first)
        expect((await repositories.state(acme)).model.elements.map((one) => one.id).sort()).toEqual(['crews', 'depot'])
      })

      it('changes no revision where the content is the one held', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, { type: 'scope.replace', content: arriving() })
        const read = (await repositories.state(acme)).revision
        await repositories.steps(acme, { type: 'scope.replace', content: arriving() })
        expect((await repositories.state(acme)).revision).toBe(read)
      })

      it('refuses a library entry no picture may have, and a description key there is not', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const bad = { name: 'a b.png', mediaType: 'image/png', size: 3, width: 1, height: 1, contentAddress: `sha256:${'0'.repeat(64)}` }
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'scope.replace', content: { ...arriving(), images: [bad] } })] }])))
          .toBe('shell.imageBadName')
        const odd = { ...arriving(), shelf: 'nowhere' } as ReturnType<typeof arriving>
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'scope.replace', content: odd })] }])))
          .toBe('command.notAField')
        expect((await repositories.state(acme)).model.elements).toEqual([])
      })
    })

    /**
     * A scope some part of which would not read (`ScopeState.unreadable`) is
     * looked at and not stepped on — but it is never stuck: a run that begins
     * by putting it back, which a person asked for, puts it back whole, and
     * what was there is kept first. One a later version wrote takes nothing.
     */
    describe('a scope that could not be read whole', () => {
      const whole = () => ({ ...emptyContent('Acme Logistics'), model: replayed(emptyContent('Acme Logistics').model, [addCrews]) })
      const putBack = (content: ScopeContent) => step({ type: 'scope.replace', content, putBack: { subject: 'As it stood' } })

      it('is there to be looked at, and refuses every step but a run that begins by putting it back', async (context) => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        if (!await repositories.spoil(acme, 'damaged')) return context.skip()
        const state = await repositories.state(acme)
        expect(state.unreadable?.length).toBeGreaterThan(0)
        expect(state.later).toBeUndefined()
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step(addDepot)] }]))).toBe('shell.unreadableNotSaved')
        // A replace nobody asked to put it back with — a landing, a copy, *keep mine* — is refused like any step.
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'scope.replace', content: whole() })] }])))
          .toBe('shell.unreadableNotSaved')
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step(addDepot), putBack(whole())] }])))
          .toBe('shell.unreadableNotSaved')
        const after = await repositories.state(acme)
        expect(after.model).toEqual(state.model)
        expect(after.revision).toBe(state.revision)
      })

      it('is put back whole by a run that begins by putting it back, keeps what was there first, and reads whole after', async (context) => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews, addLandscape)
        await repositories.record('before')
        if (!await repositories.spoil(acme, 'damaged')) return context.skip()
        const read = await repositories.state(acme)
        const entries = (await repositories.history.entries({ scopes: [acme] })).entries
        const content = { ...whole(), kind: 'domain' as const }
        const put = ok(await repositories.apply([{ scope: acme, steps: [putBack(content), step(addDepot)], expects: read.revision }]))
        const after = await repositories.state(acme)
        expect(after.unreadable).toBeUndefined()
        expect(after.revision).toBe(put.revisions[0])
        expect(held(after)).toEqual({ id: acme, address: 'acme', ...content, model: replayed(content.model, [addDepot]) })
        // Kept first: set aside and said, or an entry of the history as it stood.
        const [newest] = (await repositories.history.entries({ scopes: [acme] })).entries
        const kept = (put.setAside?.length ?? 0) > 0 || (newest.id !== entries[0].id && newest.subject === 'As it stood')
        expect(kept).toBe(true)
        await repositories.steps(acme, renameCrews)
        expect((await repositories.state(acme)).model.elements.find((one) => one.id === 'crews')?.name).toBe('Crew planning')
      })

      it('reads whole after it even where what is put back is what could be read', async (context) => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        if (!await repositories.spoil(acme, 'damaged')) return context.skip()
        const read = await repositories.state(acme)
        const { id: _id, address: _address, revision: _revision, updatedAt: _updatedAt, unreadable: _unreadable, later: _later, ...content } = read
        ok(await repositories.apply([{ scope: acme, steps: [putBack(content)], expects: read.revision }]))
        const after = await repositories.state(acme)
        expect(after.unreadable).toBeUndefined()
        expect(after.revision).not.toBe(read.revision)
        await repositories.steps(acme, addDepot)
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['depot'])
      })

      /**
       * What this version cannot read of a later version's scope is somebody's
       * newer work: it takes no step, a put back included. An implementation
       * that does not open such a scope at all answers for no scope there.
       */
      it('takes no step at all where a later version wrote it, a put back included', async (context) => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        if (!await repositories.spoil(acme, 'later')) return context.skip()
        const read = await repositories.scopes.state(acme)
        const expected = read ? 'shell.laterNotReplaced' : 'shell.scopeGone'
        if (read) expect([read.later, read.unreadable?.length ? 'unread' : 'read']).toEqual([true, 'unread'])
        expect(refusal(await repositories.apply([{ scope: acme, steps: [putBack(whole())] }]))).toBe(expected)
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step(addDepot)] }]))).toBe(expected)
        const after = await repositories.scopes.state(acme)
        expect(after?.revision).toBe(read?.revision)
        expect(after?.model).toEqual(read?.model)
      })
    })

    describe('moving a scope', () => {
      it('keeps its identity, its state and the identities of everything under it', async () => {
        const repositories = await fresh()
        const rail = await repositories.scope('acme/rail', 'Rail')
        const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
        await repositories.steps(stock, addCrews)
        const before = await repositories.state(stock)
        ok(await repositories.move(rail, 'globex/rail'))
        expect((await repositories.state(rail)).address).toBe('globex/rail')
        const after = await repositories.state(stock)
        expect(after.address).toBe('globex/rail/rolling-stock')
        expect(after.model).toEqual(before.model)
        expect(await addresses(repositories)).toEqual(['', 'acme', 'globex', 'globex/rail', 'globex/rail/rolling-stock'])
        expect((await nodeOf(repositories, stock))?.parent).toBe(rail)
      })

      it('leaves the old address free: a scope created there is another scope', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.steps(acme, addCrews)
        ok(await repositories.move(acme, 'globex'))
        const again = await repositories.scope('acme', 'Acme again')
        expect(again).not.toBe(acme)
        expect((await repositories.state(again)).model.elements).toEqual([])
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })

      it('answers the moved scope’s revision, which is the one its state now reads', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const moved = ok(await repositories.move(acme, 'globex'))
        expect((await repositories.state(acme)).revision).toBe(moved.revision)
      })

      it('moves the revision of the moved scope and of every scope under it, and of no other', async () => {
        const repositories = await fresh()
        const rail = await repositories.scope('acme/rail', 'Rail')
        const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
        const road = await repositories.scope('acme/road', 'Road')
        const before = await Promise.all([rail, stock, road].map(async (id) => (await repositories.state(id)).revision))
        ok(await repositories.move(rail, 'globex/rail'))
        const after = await Promise.all([rail, stock, road].map(async (id) => (await repositories.state(id)).revision))
        expect(after[0]).not.toBe(before[0])
        expect(after[1]).not.toBe(before[1])
        expect(after[2]).toBe(before[2])
        expect(refusal(await repositories.apply([{ scope: stock, steps: [step(addCrews)], expects: before[1] }])))
          .toBe('shell.scopeMoved')
      })

      it('refuses the organisation, an address under itself, and one that is taken or unusable', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        await repositories.scope('globex', 'Globex')
        const before = await repositories.scopes.tree()
        expect(refusal(await repositories.move(before.root.id, 'elsewhere'))).toBe('shell.badScopePath')
        expect(refusal(await repositories.move(acme, 'acme/inside'))).toBe('shell.scopeIntoItself')
        expect(refusal(await repositories.move(acme, 'globex'))).toBe('shell.scopeTaken')
        expect(refusal(await repositories.move(acme, '../escape'))).toBe('shell.badScopePath')
        expect(await repositories.scopes.tree()).toEqual(before)
      })

      it('refuses a move that expects a revision somebody has moved on from, and a scope that is gone', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        await repositories.steps(acme, addCrews)
        expect(refusal(await repositories.move(acme, 'globex', read))).toBe('shell.scopeMoved')
        expect((await repositories.state(acme)).address).toBe('acme')
        ok(await repositories.remove(acme))
        expect(refusal(await repositories.move(acme, 'globex'))).toBe('shell.scopeGone')
      })
    })

    describe('removing a scope', () => {
      it('removes it and everything under it, and nothing else', async () => {
        const repositories = await fresh()
        const rail = await repositories.scope('acme/rail', 'Rail')
        const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
        const road = await repositories.scope('acme/road', 'Road')
        const removed = ok(await repositories.remove(rail))
        expect([...removed.removed].sort()).toEqual([rail, stock].sort())
        expect(await repositories.scopes.state(rail)).toBeUndefined()
        expect(await repositories.scopes.state(stock)).toBeUndefined()
        expect((await repositories.state(road)).address).toBe('acme/road')
        expect(await addresses(repositories)).toEqual(['', 'acme', 'acme/road'])
      })

      it('starts a scope created where a removed one was empty, with an identity of its own — under it too', async () => {
        const repositories = await fresh()
        const rail = await repositories.scope('acme/rail', 'Rail')
        const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
        await repositories.steps(rail, addCrews, { type: 'scope.describe', patch: { kind: 'domain' } })
        await repositories.steps(stock, addDepot)
        ok(await repositories.remove(rail))
        const again = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock again')
        const above = await repositories.scopeAt('acme/rail')
        expect([again, above]).not.toContain(stock)
        expect([again, above]).not.toContain(rail)
        expect((await repositories.state(again)).model.elements).toEqual([])
        expect((await repositories.state(above)).model.elements).toEqual([])
        expect((await repositories.state(above)).kind).toBeUndefined()
      })

      it('refuses the organisation, and a removal that expects a revision somebody has moved on from', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        await repositories.steps(acme, addCrews)
        expect(refusal(await repositories.remove(await repositories.root()))).toBe('shell.badScopePath')
        expect(refusal(await repositories.remove(acme, read))).toBe('shell.scopeMoved')
        expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
      })

      it('removes nothing, and says so, for a scope that is gone already', async () => {
        const repositories = await fresh()
        const acme = await repositories.scope('acme', 'Acme Logistics')
        const read = (await repositories.state(acme)).revision
        ok(await repositories.remove(acme))
        expect(ok(await repositories.remove(acme, read))).toEqual({ removed: [] })
      })
    })
  })
}
