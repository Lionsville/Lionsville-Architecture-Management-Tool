// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map's findings in words (ADR-0036 §7): what the map says under
 * it, and what the Checks page says of the same findings over the whole
 * organisation — one sentence each, wherever it is listed. Apart from the
 * page, so a list that only says them does not bring the map with it.
 */
import type { Translate } from '../../i18n'
import type { ConwayFinding } from '../../model/conway'
import { INTERACTION_MODE_LABEL } from '../../model/relations'
import { CHECK_LABEL } from '../../projects/checks'
import type { UnitViewsHere } from './unitViewsHere'

/** One finding, in words. */
export function findingText(finding: ConwayFinding, here: UnitViewsHere, t: Translate): string {
  switch (finding.kind) {
    case 'undeclared':
      return t('check.interfaceUndeclared', {
        source: here.name(finding.flow.sourceId), target: here.name(finding.flow.targetId), from: here.name(finding.from), to: here.name(finding.to),
      })
    case 'unused':
      return t('check.interactionUnused', {
        a: here.name(finding.interaction.sourceId), b: here.name(finding.interaction.targetId),
        mode: finding.interaction.mode ? t(INTERACTION_MODE_LABEL[finding.interaction.mode]) : t('conway.anInteraction'),
      })
    case 'unowned':
      return t('check.applicationUnowned', { name: here.name(finding.applicationId) })
    case 'overLimit': {
      const unit = here.at.organisation.units.find((one) => one.id === finding.unitId)
      const type = here.at.organisation.unitTypes.find((one) => one.id === unit?.unitTypeId)?.name ?? ''
      // One kind with the organisation's own over-limit, so said in its words (`check.unitOverLimit`).
      return t(CHECK_LABEL['check.unitOverLimit'], { name: here.name(finding.unitId), count: finding.owns, detail: type, limit: finding.limit })
    }
  }
}
