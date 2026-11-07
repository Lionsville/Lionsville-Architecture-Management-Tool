// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation's numeric scales, and a function rated on one (ADR-0046):
 * one command each, under the agent's name.
 *
 * A rating is held to its scale here, because the reducer cannot be: the scale
 * is the organisation's and the function may be kept anywhere under it.
 */
import { aspectScale, onScale, scaleOf } from '../../model/aspectScale'
import type { AspectScale } from '../../model/aspectScale'
import { toArrays } from '../../model/normalised'
import { json, refused } from '../tools'
import type { Handler, WriteView } from './shared'

const ORGANISATION = ''

/** The organisation's scales: its own session's where it is open, the tree's otherwise. */
function scalesKnown(view: WriteView): readonly AspectScale[] {
  return view.scopePath === ORGANISATION
    ? toArrays(view.model).aspectScales ?? []
    : view.tree?.operatingModel?.().aspectScales ?? []
}

export const rateElement: Handler = (args, view) => {
  const id = args.id as string
  const aspect = args.aspect as string
  const held = view.model.elements[id]
  if (!held) return refused('agent.unknownId', `element ${id}`)
  if (held.kind !== 'function') return refused('agent.badArguments', `${held.name} is a ${held.kind}: only a function is rated`)
  const owned = view.ownedElsewhere?.(id, { ratings: {} })
  if (owned) return refused('check.ownedElsewhere', owned.owner ?? '')
  const scale = scaleOf(scalesKnown(view), aspect)
  if (!scale) return refused('agent.badArguments', `the organisation keeps no scale for ${aspect}: see aspectScales.list`)
  const value = args.value as number | null
  if (value !== null && !onScale(scale, value)) return refused('agent.badArguments', `${aspect} runs from ${scale.min} to ${scale.max}`)
  return {
    command: { type: 'element.rate', id, aspect, ...(value !== null ? { value } : {}), origin: 'agent' },
    answer: json({ id, aspect, value, scale }),
  }
}

/** The scales as they will be, or the refusal for a scope that is not the organisation. */
function atOrganisation(view: WriteView) {
  return view.scopePath === ORGANISATION
    ? undefined
    : refused('agent.scopeNotOpen', 'the organisation, where the scales are kept: app.open with scope "" first')
}

export const setAspectScale: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const scales = scalesKnown(view)
  const held = scaleOf(scales, args.key as string)
  const scale = aspectScale(args.key as string, args.label as string, {
    min: (args.min as number | undefined) ?? held?.min,
    max: (args.max as number | undefined) ?? held?.max,
    code: (args.code as string | undefined) ?? held?.code,
  })
  const next = held ? scales.map((one) => (one === held ? scale : one)) : [...scales, scale]
  return {
    command: { type: 'project.settings', patch: { aspectScales: next }, origin: 'agent' },
    answer: json({ scale }),
  }
}

export const removeAspectScale: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const scales = scalesKnown(view)
  const key = args.key as string
  if (!scaleOf(scales, key)) return refused('agent.unknownId', `aspect scale ${key}`)
  const next = scales.filter((one) => one.key !== key)
  return {
    command: { type: 'project.settings', patch: { aspectScales: next.length > 0 ? next : undefined }, origin: 'agent' },
    answer: json({ removed: key }),
  }
}
