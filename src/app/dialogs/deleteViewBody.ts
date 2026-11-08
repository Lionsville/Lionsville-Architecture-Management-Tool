// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { StringKey } from '../../i18n'
import type { DesignDiagram } from '../../model'

/**
 * What the question before deleting a view says it takes with it, by the kind
 * of view: a container view carries its containers away, a landscape its
 * placements, and a view laid out from the records loses nothing but itself.
 * Every place that deletes a view asks this, so the workspace and a home say
 * the same sentence of the same view.
 */
export const DELETE_VIEW_BODY: { readonly [K in DesignDiagram['kind']]: StringKey } = {
  layer7: 'shell.deleteBody.layer7',
  container: 'shell.deleteBody.container',
  sheet: 'shell.deleteBody.sheet',
  map: 'shell.deleteBody.map',
  technology: 'shell.deleteBody.technology',
  drawing: 'shell.deleteBody.drawing',
  chart: 'shell.deleteBody.chart',
  conway: 'shell.deleteBody.conway',
}
