// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A dense organisation, for looking at a screen and timing it at the size a
 * large organisation in real use reaches: 67 scopes nested four deep with names
 * up to about 90 characters, many sharing their first letters; 63 units with 64
 * people in them, some roles left empty and 16 lines that depart from the
 * operating model; 112 observations, most of them in one team; 52 principles
 * in 10 groups; a business sheet of 188 functions in 17 areas whose places
 * were kept by something other than its poster; and a container diagram whose
 * planned application has nothing inside it yet.
 *
 * Shapes and sizes only. Every name is generated from the words in this file
 * or is the shipped fictional example's, so it names nothing that exists.
 * Deterministic: the same call gives the same organisation. Not shipped: it is
 * read by tests and by scripts that seed a preview build.
 */
import acme from '../format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from '../format/exampleFolder'
import type { ExampleFolder } from '../format/exampleFolder'
import type { HostModel } from '../../../model/hostModel'
import type { Assignment } from '../../../model/units'
import type { Cause, Observation } from '../../../model/observation'
import type { Principle, PrincipleGroup } from '../../../model/principle'
import type { DesignDiagram, DesignElement } from '../../../model/types'
import type { ScopeSnapshot } from '../../../projects/scope'
import type { Arriving } from '../../../projects/scopeAccess'
import { contentOf, placeTogether } from '../../../projects/scopeAccess'
import type { Repositories } from '../../../ports/Repositories'
import type { PersonId } from '../../../people/person'
import { mePatch } from '../../../people/me'
import { denseSheet } from '../../../model/testing/denseSheet'

export const DENSE = { scopes: 67, units: 63, people: 64, observations: 112, principles: 52, principleGroups: 10, exceptions: 16 } as const

/** The team that keeps most of the observations, and the container diagram. */
export const DENSE_TEAM = 'domain-1/area-1/team-1'

const WORDS = ['intake', 'planning', 'settlement', 'records', 'scheduling', 'review', 'support', 'routing', 'quality', 'reporting', 'archive', 'outreach', 'logistics', 'maintenance', 'licensing', 'inspection']
const GIVEN = ['Alex', 'Robin', 'Sam', 'Kim', 'Charlie', 'Jules', 'Noa', 'Lou', 'Ari', 'Dani', 'Evi', 'Fen', 'Gale', 'Hale', 'Ivo', 'Jo']
const FAMILY = ['Ashdown', 'Brookfield', 'Corran', 'Dunmere', 'Elsby', 'van Farrow', 'Glenholt', 'de Hartwell', 'Ivers', 'Juniper', 'Kestle', 'Lowmoor', 'Merrow', 'Northey', 'Orrin', 'Pellam']
const PREFIXES = ['Reg', 'Cen', 'Nor', 'Sou']

const cap = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`
const word = (at: number) => WORDS[at % WORDS.length] as string

/** The addresses, parents first, with the names a person would have given them. */
export function denseScopes(): { path: string; name: string }[] {
  const out = [{ path: '', name: 'Northbridge Regional Services' }]
  for (let domain = 1; domain <= 4; domain += 1) {
    const prefix = PREFIXES[domain - 1] as string
    out.push({ path: `domain-${domain}`, name: `${prefix} ${word(domain)}, ${word(domain + 3)} and the shared ${word(domain + 6)} services that keep the whole regional network running` })
    for (let area = 1; area <= 3; area += 1) {
      const path = `domain-${domain}/area-${area}`
      out.push({ path, name: `${prefix} ${cap(word(domain * 3 + area))} and ${word(area + 9)}` })
      for (let team = 1; team <= 4; team += 1) out.push({ path: `${path}/team-${team}`, name: `${prefix} ${cap(word(team + area))} ${team}` })
    }
  }
  out.push({ path: `${DENSE_TEAM}/deep-1`, name: `${PREFIXES[0]} ${cap(word(7))} cell` }, { path: `${DENSE_TEAM}/deep-2`, name: `${PREFIXES[0]} ${cap(word(8))} cell` })
  return out
}

const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

/** 8 departments of 6 or 7 teams: 63 units, kept at the organisation. */
function units(): DesignElement[] {
  const out: DesignElement[] = []
  const sizes = [7, 7, 7, 7, 7, 7, 7, 6]
  sizes.forEach((teams, d) => {
    const department = `dept-${d + 1}`
    out.push(element(department, `${cap(word(d))} and ${word(d + 4)}`, { kind: 'actor', unitTypeId: 'department', order: d + 1 } as Partial<DesignElement>))
    for (let t = 1; t <= teams; t += 1) {
      out.push(element(`${department}-team-${t}`, `${PREFIXES[d % 4]} ${cap(word(d + t))} ${t}`, { kind: 'actor', unitTypeId: 'team', parentId: department, order: t } as Partial<DesignElement>))
    }
  })
  return out
}

/**
 * Who holds what: a head for most departments, a lead for most teams and
 * members besides, so some slots stay short. Fifteen holders report to a
 * department other than their own, and one team keeps a dotted line of its
 * own: the sixteen exceptions.
 */
function assignments(all: readonly DesignElement[], people: readonly PersonId[]): Assignment[] {
  const out: Assignment[] = []
  let next = 0
  const person = () => ({ person: people[next++ % people.length] as string })
  const departments = all.filter((one) => one.unitTypeId === 'department')
  const teams = all.filter((one) => one.unitTypeId === 'team')
  departments.forEach((unit, at) => {
    if (at % 4 !== 3) out.push({ id: `as-head-${unit.id}`, unitId: unit.id, roleId: 'head', person: person(), from: '2025-01-01' })
  })
  teams.forEach((unit, at) => {
    if (at % 5 !== 4) {
      const exception = at % 4 === 1 && out.filter((one) => one.reportsTo).length < DENSE.exceptions - 1
      const elsewhere = departments[(at + 3) % departments.length] as DesignElement
      out.push({
        id: `as-lead-${unit.id}`, unitId: unit.id, roleId: 'lead', person: person(), from: '2025-02-01',
        ...(exception ? { reportsTo: [{ to: { scope: '', unit: elsewhere.id, role: 'head' }, kind: 'solid' as const }] } : {}),
      })
    }
    if (at % 3 === 0) out.push({ id: `as-member-${unit.id}`, unitId: unit.id, roleId: 'member', person: person(), from: '2025-03-01' })
  })
  return out
}

const DAY = (at: number) => `2026-${String(1 + (at % 9)).padStart(2, '0')}-${String(1 + (at % 27)).padStart(2, '0')}`

/** Observations numbered from 1 in their scope: some seen again, some noted, a few archived. */
function observations(count: number, salt: number): Observation[] {
  return Array.from({ length: count }, (_, at): Observation => ({
    id: `ob-${salt}-${at + 1}`,
    number: at + 1,
    title: `${cap(word(at + salt))} ${at % 3 === 0 ? `waits on ${word(at + 2)} before the ${word(at + 5)} can start` : `is done twice in ${word(at + 7)}`}`,
    date: DAY(at + salt),
    where: cap(word(at + 3)),
    impact: (['minor', 'major', 'critical'] as const)[at % 3] as Observation['impact'],
    seen: 1 + (at % 4),
    body: `What was seen in ${word(at)}.`,
    history: [{ date: DAY(at + salt), kind: 'recorded' }],
    ...(at % 9 === 4 ? { noted: true as const } : {}),
    ...(at % 13 === 7 ? { archived: true as const } : {}),
  }))
}

/** Causes numbered from 1 in their scope, so CA-0001 is in several scopes at once. */
function causes(count: number, salt: number, explained: readonly Observation[]): Cause[] {
  return Array.from({ length: count }, (_, at): Cause => ({
    id: `ca-${salt}-${at + 1}`,
    number: at + 1,
    title: `${cap(word(at + salt + 1))} is planned without ${word(at + 4)}`,
    state: at % 2 === 0 ? 'assumed' : 'verified',
    body: '',
    explains: explained.slice(at * 2, at * 2 + 2).map((one) => ({ id: one.id, strength: 'normal' as const })),
  }))
}

function principles(): { principles: Principle[]; principleGroups: PrincipleGroup[] } {
  const principleGroups = Array.from({ length: DENSE.principleGroups }, (_, at) => ({ id: `pg-${at + 1}`, name: `${cap(word(at))} and ${word(at + 5)}` }))
  return {
    principleGroups,
    principles: Array.from({ length: DENSE.principles }, (_, at): Principle => ({
      id: `pr-${at + 1}`, number: at + 1, title: `${cap(word(at))} before ${word(at + 3)}`, statement: `Prefer ${word(at)} to ${word(at + 1)}.`,
      aspects: [], lastAspect: 0, groups: [`pg-${(at % DENSE.principleGroups) + 1}`], regime: at % 4 === 0 ? 'fixed' : 'flexible', status: 'accepted', acceptedOn: '2026-01-15',
    })),
  }
}

/**
 * The sheet's places, as a board of cards would have kept them: a column off
 * the page's left edge, 1,700 apart. What a poster must not take for its own.
 */
function staleSheet(areas: readonly string[]): DesignDiagram {
  return {
    id: 'dense-sheet', kind: 'sheet', name: 'Capabilities', members: [], areas: [...areas], showActors: false,
    geometry: { nodes: areas.map((id, at) => ({ id, x: -280 + (at % 2) * 1700, y: Math.floor(at / 2) * 1700 })) },
  } as unknown as DesignDiagram
}

/** A planned application with its container diagram: nothing inside it yet, seventeen around it, the boundary at a card's size. */
function plannedContainers(model: HostModel): Partial<HostModel> {
  const around = Array.from({ length: 17 }, (_, at) => element(`around-${at + 1}`, `${cap(word(at))} ${at % 4 === 0 ? 'desk' : 'service'}`, at % 4 === 0 ? { kind: 'actor' } : {}))
  const planned = element('planned-app', `${cap(word(2))} platform`, { lifecycle: 'planned' })
  const diagram = {
    id: 'planned-containers', kind: 'container', name: `${planned.name} · containers`, applicationElementId: planned.id,
    members: [{ id: planned.id }, ...around.map((one) => ({ id: one.id }))],
    geometry: { nodes: [{ id: planned.id, x: 400, y: 300, width: 240, height: 120 }, ...around.map((one, at) => ({ id: one.id, x: (at % 6) * 200, y: at < 6 ? 0 : at < 12 ? 520 : 700 }))] },
  } as unknown as DesignDiagram
  return {
    elements: [...model.elements, planned, ...around],
    relations: [...model.relations, ...around.slice(0, 8).map((one, at) => ({ id: `pr-flow-${at}`, type: 'flow', sourceId: one.id, targetId: planned.id, isBidirectional: false }))] as HostModel['relations'],
    diagrams: [...model.diagrams, diagram],
  }
}

const LANDSCAPES = new Set(['domain-1', 'domain-2/area-1', 'domain-3/area-2/team-3'])
const PLATFORMS = new Set(['domain-4', 'domain-1/area-2'])

/** The organisation's scopes, ready to be placed together; `people` names the register's entries. */
export function denseArriving(people: readonly PersonId[]): Arriving[] {
  const shipped = exampleScopes(acme as unknown as ExampleFolder, '')
  const root = shipped.find((one) => one.path === '')!
  const landscape = shipped.find((one) => one.path === 'application-landscape')!
  const platforms = shipped.find((one) => one.path === 'platforms')!
  const below = observations(DENSE.observations, 0)
  // 22 at the organisation, 70 in one team, and 20 spread over ten scopes.
  const spread = new Map<string, Observation[]>([['', below.slice(0, 22)], [DENSE_TEAM, below.slice(22, 92)]])
  const scopes = denseScopes()
  scopes.slice(5, 15).forEach((one, at) => spread.set(one.path, observations(2, 100 + at)))
  return scopes.map(({ path, name }, at) => {
    // A few scopes hold a landscape or platforms, as a team's would; most hold nothing but what is given them below.
    const kept = LANDSCAPES.has(path) ? landscape : PLATFORMS.has(path) ? platforms : undefined
    const basis: ScopeSnapshot = path === '' ? root : kept ?? platforms
    // The example's own records give way to these, so the counts are the ones said above.
    let model = { ...basis.model, name, observations: [], causes: [], solutions: [] } as HostModel
    if (path !== '' && !kept) model = { ...model, elements: [], relations: [], diagrams: [], decisions: [], transitions: [] }
    if (path === '') {
      const sheet = denseSheet()
      const organisation = units()
      model = {
        ...model,
        // The example's own units give way to these, so the chart is the 63.
        elements: [...model.elements.filter((one) => !one.unitTypeId), ...sheet, ...organisation],
        diagrams: [...model.diagrams, staleSheet(sheet.filter((one) => !one.parentId).map((one) => one.id))],
        assignments: assignments(organisation, people),
        ...principles(),
      }
      // A team keeps a dotted line of its own to another department's head: the sixteenth exception.
      model.elements = model.elements.map((one) => (one.id === 'dept-2-team-1'
        ? { ...one, reportingLines: [{ kind: 'dotted', role: 'lead', to: { scope: '', unit: 'dept-5', role: 'head' } }] } as DesignElement
        : one))
    }
    if (path === DENSE_TEAM) model = { ...model, ...plannedContainers(model) }
    const held = spread.get(path)
    if (held) {
      const renumbered = held.map((one, n) => ({ ...one, number: n + 1 }))
      model = { ...model, observations: renumbered, causes: causes(Math.min(6, Math.floor(held.length / 4) || 1), at, renumbered) }
    }
    const activeDiagramId = path === '' ? 'dense-sheet' : path === DENSE_TEAM ? 'planned-containers' : kept?.activeDiagramId
    return {
      address: path,
      content: contentOf({ ...basis, path, model, logoLibrary: [], kind: basis.kind ?? 'domain', ...(activeDiagramId ? { activeDiagramId } : {}) }, []),
    }
  })
}

/** The organisation put into a place: the register first, since the records name its entries, then the scopes. */
export async function seedDenseOrganisation(repositories: Repositories): Promise<{ people: PersonId[] }> {
  const people: PersonId[] = []
  for (let at = 0; at < DENSE.people; at += 1) {
    const added = await repositories.people.add({ name: `${GIVEN[at % GIVEN.length]} ${FAMILY[Math.floor(at / 4) % FAMILY.length]}` })
    if ('refused' in added) throw new Error(added.refused)
    people.push(added.person.id)
  }
  await placeTogether(repositories, denseArriving(people))
  await repositories.settings.write({ of: 'person' }, mePatch(people[0] as string))
  return { people }
}
