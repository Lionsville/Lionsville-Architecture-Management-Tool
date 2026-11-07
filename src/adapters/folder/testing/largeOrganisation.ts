// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A large organisation of every kind of record, for the suites that move work
 * from one place to another: 67 scopes, nested four deep, holding what a tree
 * in real use holds. Made of the shipped fictional example and of words from
 * this file, so it names nothing that exists.
 *
 * Deterministic: the same call gives the same scopes.
 */
import acme from '../format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from '../format/exampleFolder'
import type { ExampleFolder } from '../format/exampleFolder'
import type { HostModel } from '../../../model/hostModel'
import { contentAddressOf } from '../../../model/imageName'
import type { DesignDiagram, DesignElement } from '../../../model/types'
import type { ScopeSnapshot } from '../../../projects/scope'
import type { Arriving } from '../../../projects/scopeAccess'
import { contentOf, placeTogether, stepOf, landed } from '../../../projects/scopeAccess'
import type { Repositories } from '../../../ports/Repositories'
import type { PersonId } from '../../../people/person'
import { policyPatch } from '../../../people/policy'
import { mePatch } from '../../../people/me'

/** The smallest PNG a browser and this repository both take for a picture. */
export const SMALL_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
), (char) => char.charCodeAt(0))

const DRAWING_SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')

const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

/** The addresses: the organisation, four domains, three under each, four under those, and two a level deeper. */
export function largeAddresses(): string[] {
  const addresses = ['']
  for (let domain = 1; domain <= 4; domain += 1) {
    addresses.push(`domain-${domain}`)
    for (let area = 1; area <= 3; area += 1) {
      addresses.push(`domain-${domain}/area-${area}`)
      for (let team = 1; team <= 4; team += 1) addresses.push(`domain-${domain}/area-${area}/team-${team}`)
    }
  }
  addresses.push('domain-1/area-1/team-1/deep-1', 'domain-1/area-1/team-1/deep-2')
  return addresses
}

/** The lists every scope of the tree adds to what the example holds, so no kind depends on where it sits. */
function recordsOfEveryKind(at: number, model: HostModel, people: readonly PersonId[], picture: string): Partial<HostModel> {
  const person = { person: people[at % people.length] }
  const first = model.elements[0]?.id ?? `unit-${at}`
  const unit = element(`unit-${at}`, `Unit ${at}`, { kind: 'actor', unitTypeId: 'team' } as Partial<DesignElement>)
  const drawing: DesignDiagram = {
    id: `drawing-${at}`, kind: 'drawing', name: `Drawing ${at}`, members: [],
    drawing: { xml: `<mxfile><diagram name="Page"><mxGraphModel><root><mxCell id="0"/><mxCell id="n${at}" value="Box ${at}" vertex="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`, links: [], picture },
  } as DesignDiagram
  return {
    elements: [...model.elements, unit],
    diagrams: [...model.diagrams, drawing],
    assignments: [{ id: `as-${at}`, unitId: unit.id, roleId: 'role-a', person, from: '2026-01-01' }],
    comments: [
      { id: `cm-${at}`, about: { kind: 'element', id: first }, by: person, at: '2026-02-01T09:00:00.000Z', body: `Comment ${at}` },
      { id: `cr-${at}`, about: { kind: 'element', id: first }, by: person, at: '2026-02-02T09:00:00.000Z', body: `Reply ${at}`, replyTo: `cm-${at}` },
    ],
    checkMarks: [{ check: 'check.applicationOwnerNamed', key: `app-${at}`, reason: 'Known', on: '2026-03-01' }],
    citations: [{ id: `ct-${at}`, about: { kind: 'element', id: first }, principle: { scope: '', id: model.principles?.[0]?.id ?? 'pr-1' }, stance: 'supports', on: '2026-03-02' }],
  } as Partial<HostModel>
}

/** The operating model and the organisation's own lists, which only the root's are read of. */
function organisationLists(model: HostModel): Partial<HostModel> {
  const extra = Array.from({ length: 183 - model.elements.length - 1 }, (_, at) => element(`fn-${at}`, `Function ${at}`, { kind: 'function' }))
  return {
    elements: [...model.elements, ...extra],
    roles: [...model.roles ?? [], { id: 'role-a', name: 'Lead', duties: [] }],
    responsibilities: [{ id: 'resp-a', name: 'Keep the landscape true', group: 'Architecture' }],
    operatingRules: [{ id: 'applicationOwner', role: 'role-a' }],
    aspectScales: [{ key: 'maturity', label: 'Maturity', min: 1, max: 5 }],
  } as Partial<HostModel>
}

export type LargeOrganisation = { people: PersonId[]; addresses: string[] }

/**
 * The organisation put into a place: its register first, since the records
 * name its entries, then the scopes with their pictures, then what is kept
 * beside them — the settings, a history with a label.
 */
export async function seedLargeOrganisation(repositories: Repositories): Promise<LargeOrganisation> {
  const people: PersonId[] = []
  for (let at = 0; at < 24; at += 1) {
    const added = await repositories.people.add({ name: `Person ${at}` })
    if ('refused' in added) throw new Error(added.refused)
    people.push(added.person.id)
  }
  const shipped = exampleScopes(acme as unknown as ExampleFolder, '')
  const root = shipped.find((one) => one.path === '')!
  const landscape = shipped.find((one) => one.path === 'application-landscape')!
  const platforms = shipped.find((one) => one.path === 'platforms')!
  const picture = await contentAddressOf(DRAWING_SVG)
  const addresses = largeAddresses()
  const arriving: Arriving[] = addresses.map((address, at) => {
    const basis: ScopeSnapshot = address === '' ? root : at % 3 === 0 ? landscape : platforms
    const named = { ...basis.model, name: address === '' ? 'Northwind Holdings' : `Scope ${at}` }
    const organisation = address === '' ? { ...named, ...organisationLists(named) } : named
    const model = { ...organisation, ...recordsOfEveryKind(at, organisation, people, picture) } as HostModel
    return {
      address,
      content: contentOf({ ...basis, path: address, model, logoLibrary: at % 5 === 0 ? [{ key: `lib:${at}`, label: `Logo ${at}`, url: 'data:image/svg+xml;base64,PHN2Zy8+' }] : [], kind: basis.kind ?? 'domain' }, []),
      pictures: [{ name: `figure-${at}.png`, bytes: SMALL_PNG }],
      drawings: [DRAWING_SVG],
    }
  })
  await placeTogether(repositories, arriving)
  await repositories.settings.write({ of: 'organisation' }, policyPatch({ keepNameDays: 45 }))
  await repositories.settings.write({ of: 'person' }, mePatch(people[0]))
  // A history worth saying something about: a step and a named version on the organisation.
  const tree = await repositories.scopes.tree()
  landed(await repositories.scopes.apply([{ scope: tree.root.id, steps: [stepOf({ type: 'project.settings', patch: { description: 'The whole of it.' } })] }]))
  const [entry] = await repositories.history.record({ scopes: [tree.root.id], subject: 'First version' })
  if (entry) await repositories.history.label(tree.root.id, entry.id, 'first')
  return { people, addresses }
}
