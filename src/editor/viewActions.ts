// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What can be done to a view, said once, in one order.
 *
 * A view is acted on from three places: its tab's ⌄ (and a right-click on the
 * tab), the ⋯ at the end of its own bar, and the ⋯ on its row on the scope's
 * home. Each used to keep its own list, so a technology landscape had no tab
 * menu, a home row had no Rename, and a board's ⋯ had only the sheet of keys.
 * Every place asks this list with what its host can do there, and draws what
 * comes back; a kind of view is never asked about, so every kind is offered
 * the same actions.
 */
import type { Translate } from '../i18n/strings'

export type ViewActionId = 'open' | 'rename' | 'settings' | 'duplicate' | 'duplicateAsOf' | 'history' | 'delete'

/** What the place asking can do, each absent or false where it cannot. */
export type ViewActionFacts = {
  readonly canOpen?: boolean
  readonly canRename?: boolean
  readonly canConfigure?: boolean
  readonly canDuplicate?: boolean
  /** A dated copy, beside the plain one (ADR-0009). Offered only where a plain one is. */
  readonly canDuplicateAsOf?: boolean
  /** The host keeps a history and can show this view's (ADR-0008). */
  readonly canHistory?: boolean
  readonly canDelete?: boolean
}

export type ViewAction = {
  readonly id: ViewActionId
  readonly label: string
  /** Deleting: drawn as the destructive one, after a rule. */
  readonly danger?: true
}

/** The actions in the order every place draws them; delete last, after a rule the caller draws. */
export function viewActions(facts: ViewActionFacts, t: Translate): ViewAction[] {
  const actions: ViewAction[] = []
  if (facts.canOpen) actions.push({ id: 'open', label: t('menu.openView') })
  if (facts.canRename) actions.push({ id: 'rename', label: t('menu.renameDiagram') })
  if (facts.canConfigure) actions.push({ id: 'settings', label: t('menu.diagramSettings') })
  if (facts.canDuplicate) actions.push({ id: 'duplicate', label: t('menu.duplicateDiagram') })
  if (facts.canDuplicate && facts.canDuplicateAsOf) actions.push({ id: 'duplicateAsOf', label: t('menu.duplicateDiagramAsOf') })
  if (facts.canHistory) actions.push({ id: 'history', label: t('common.history') })
  if (facts.canDelete) actions.push({ id: 'delete', label: t('menu.deleteDiagram'), danger: true })
  return actions
}
