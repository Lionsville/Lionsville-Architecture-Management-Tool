// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope holds, by the kinds a person counts in; and whether two reads
 * of a scope hold the same, record by record: what a copy says it brought
 * and what it is held to (`copyScopes`).
 *
 * The same means the same when written down, where a place may leave out what
 * says nothing — a key with no value, an empty list, an empty object — and
 * keep records with ids in an order of its own, as a folder keeps a model's
 * sorted so a diff stays small. Nothing else is forgiven, the whitespace a
 * document ends in being the one exception, since a file's last line is the
 * file's business.
 */
import type { DesignDiagram } from '../model/types'
import { drawingPictureAddresses } from '../model/drawing'
import { snapshotOf } from './scopeAccess'
import type { ScopeState } from './scopeState'

/** The kinds a copy says it brought. `other` is the citations and the findings marked as intended. */
export const COPY_KINDS = [
  'scopes', 'elements', 'connections', 'boards', 'sheets', 'views', 'drawings', 'decisions', 'plans', 'observations', 'causes',
  'solutions', 'experiments', 'principles', 'evaluations', 'comments', 'assignments', 'operating', 'other', 'pictures', 'people',
] as const

export type CopyKind = (typeof COPY_KINDS)[number]
export type CopyCounts = Readonly<Record<CopyKind, number>>

export const EMPTY_COUNTS: CopyCounts = Object.fromEntries(COPY_KINDS.map((kind) => [kind, 0])) as CopyCounts

export function addCounts(one: CopyCounts, other: CopyCounts): CopyCounts {
  return Object.fromEntries(COPY_KINDS.map((kind) => [kind, one[kind] + other[kind]])) as CopyCounts
}

const VIEW_KIND: Partial<Record<DesignDiagram['kind'], CopyKind>> = {
  layer7: 'boards', container: 'boards', sheet: 'sheets', map: 'sheets', technology: 'views', chart: 'views', conway: 'views', drawing: 'drawings',
}

/** What one scope holds, by kind. */
export function copyCountsOf(state: ScopeState): CopyCounts {
  const { model } = state
  const views = { boards: 0, sheets: 0, views: 0, drawings: 0 } as Record<CopyKind, number>
  for (const diagram of model.diagrams) {
    const kind = VIEW_KIND[diagram.kind]
    if (kind) views[kind] += 1
  }
  return {
    ...EMPTY_COUNTS,
    ...views,
    scopes: 1,
    elements: model.elements.length,
    connections: model.relations.length,
    decisions: model.decisions?.length ?? 0,
    plans: model.transitions?.length ?? 0,
    observations: model.observations?.length ?? 0,
    causes: model.causes?.length ?? 0,
    solutions: model.solutions?.length ?? 0,
    experiments: model.experiments?.length ?? 0,
    principles: model.principles?.length ?? 0,
    evaluations: model.evaluations?.length ?? 0,
    comments: model.comments?.length ?? 0,
    assignments: model.assignments?.length ?? 0,
    operating: (model.unitTypes?.length ?? 0) + (model.roles?.length ?? 0) + (model.responsibilities?.length ?? 0) + (model.operatingRules?.length ?? 0),
    other: (model.citations?.length ?? 0) + (model.checkMarks?.length ?? 0),
    pictures: state.images.length + new Set(drawingPictureAddresses(model.diagrams)).size,
  }
}

const hasId = (value: unknown): value is { id: string } => typeof (value as { id?: unknown } | null)?.id === 'string'
const byId = (one: { id: string }, other: { id: string }) => (one.id < other.id ? -1 : one.id > other.id ? 1 : 0)

/** A value with what says nothing taken out, and its keys in order: two that mean the same are one text. */
function plain(value: unknown): unknown {
  if (typeof value === 'string') return value.trimEnd()
  if (Array.isArray(value)) return value.every(hasId) ? [...value].sort(byId).map(plain) : value.map(plain)
  if (!value || typeof value !== 'object') return value
  const kept: [string, unknown][] = []
  for (const key of Object.keys(value).sort()) {
    const held = plain((value as Record<string, unknown>)[key])
    const empty = held === undefined || held === null || (Array.isArray(held) && held.length === 0)
      || (typeof held === 'object' && held !== null && !Array.isArray(held) && Object.keys(held).length === 0)
    if (!empty) kept.push([key, held])
  }
  return Object.fromEntries(kept)
}

/** What a scope says, as a copy is held to it: everything but where it is, who it is, its revision and its pictures' entries' order. */
function said(state: ScopeState, ignoreName: boolean): Record<string, unknown> {
  const { model, activeDiagramId, logoLibrary, kind, unitTypeId, client, links, relevantTo } = snapshotOf(state)
  const { name, ...rest } = model
  return plain({
    ...rest,
    ...(ignoreName ? {} : { name }),
    activeDiagramId, logoLibrary, kind, unitTypeId, client, links, relevantTo,
    images: [...state.images].map((image) => `${image.name} ${image.contentAddress}`).sort(),
  }) as Record<string, unknown>
}

/** The lists and fields of a scope that differ between two reads of it, by the model's own names; none where they hold the same. */
export function differencesBetween(one: ScopeState, other: ScopeState, options: { ignoreName?: boolean } = {}): string[] {
  const here = said(one, options.ignoreName ?? false)
  const there = said(other, options.ignoreName ?? false)
  const keys = [...new Set([...Object.keys(here), ...Object.keys(there)])]
  return keys.filter((key) => JSON.stringify(here[key]) !== JSON.stringify(there[key]))
}
