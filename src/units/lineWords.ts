// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A reporting line refused, said for a person (ADR-0039 §5): the chain of a
 * loop as `Role (Unit) → Role (Unit)`, by the names the organisation gives
 * them, and the day it would close on; one to itself in a word.
 */
import type { Translate } from '../../i18n'
import type { LineRefusal } from '../../model/reporting'
import type { LinePosition, Organisation } from '../../model/units'

/** A chain of roles in units, by name. */
export function chainWords(chain: readonly LinePosition[], organisation: Pick<Organisation, 'units' | 'roles'>): string {
  const role = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unit = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  return chain.map((at) => `${role(at.roleId)} (${unit(at.unitId)})`).join(' → ')
}

/** The sentence a refused line is said with, under what was being written. */
export function refusalWords(refusal: LineRefusal, organisation: Pick<Organisation, 'units' | 'roles'>, t: Translate): string {
  return refusal.refusal === 'reportingLine.self'
    ? t('unit.lineSelf')
    : t('operating.lineLoop', { chain: chainWords(refusal.chain, organisation), day: refusal.day })
}
