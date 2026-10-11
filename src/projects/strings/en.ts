// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for what a project refuses to be.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  'shell.workingFileNoDiagrams': 'This working file has no diagrams.',
  'shell.unknownFile': 'This file is not a working file.',
  // --- what a repository refuses about a scope (ADR-0031 §1) ----------------
  'shell.scopeGone': 'That scope is not there any more: somebody removed it. Nothing was written.',
  'shell.scopeTaken': 'Another scope is already at that address, so nothing was written. Choose another name or place.',
  'shell.scopeIntoItself': 'A scope cannot be moved under itself, so nothing was moved.',
  'shell.imageBytesGone': 'This picture was not added: it is no longer kept here. Add the picture again from where you have it.',
  /**
   * The tail of a drafted commit subject, when there were more steps than a
   * subject line should name. The body below it lists every one.
   */
  'entry.andMore': ' and {count} more',

  // --- one identity across the organisation (ADR-0012 §2, §3, §9) ----------
  /**
   * The findings, keyed by the finding's own key: `checks.ts` produces
   * `check.conflict` and this is the sentence for it, so nothing has to keep a
   * second table mapping one to the other. `{name}` is what the thing is
   * called and `{scope}` the other scope the finding names — the organisation
   * itself where the path is the root's, which is the empty string.
   */
  'check.conflict': '{name} is defined both here and in {scope} — keep one definition and make the other a stand-in with Link…',
  'check.drift': 'The copy of {name} here no longer matches {scope} — refresh it, or change it there',
  'check.dangling': '{name} stands in for something nothing in the organisation defines — define it here, or delete the stand-in',
  'check.danglingEnd': 'A row on {name} ends on something this scope does not hold — delete the row, or draw what it points to',
  'check.proposal': '{name} is a capability this domain proposes and the organisation has not named — add it to the organisation\'s business architecture, or rename it to one that is there',
  'check.ownedElsewhere': 'This is kept in {scope} — change it there',
  'check.unattributed': '{name} is outside the organisation and nobody has said whose it is — name the party on its page',
  'check.notDrawn': '{name} is defined here and drawn on no board — add it to a board, or leave it as a record',
  'check.drawingLinkMissing': 'A shape on {name} points at {detail}, which this scope does not hold — point it at an element here, or remove the shape',
  'check.unmapped': '{name} is assigned to nobody and claimed by no domain — assign it, or hand it to a domain',
  'check.uncovered': 'Nothing and nobody does {name} — connect an application that supports it, or assign a person',
  'check.offeredNotShared': '{name} is used by {detail}, beyond the team that maintains it, and is not marked shared — mark it shared, or move it',
  'check.causeExplainsObservationBelow': '{name} explains an observation of {scope} directly — link {detail}, the cause there that explains it, instead',
  'check.causeExplainsObservationBelowBare': '{name} explains an observation of {scope} directly, and nothing there explains it yet — a cause there explains it, and this one explains that cause',
  'check.accountability': '{name}: {detail} are each accountable — exactly one role should be',
  'check.accountabilityNobody': '{name}: no role is accountable for it',
  'check.roleVacant': '{name} is short of {detail}: {count} hold the role, and its type asks for at least {limit}',
  'check.roleOverMax': '{name} has {count} in the role {detail}, and its type allows at most {limit}',
  'check.unitMisplaced': '{name} is a {detail} and may not sit where it is filed',
  'check.unitSpans': '{name} serves {count} domains, and a {detail} serves one',
  'check.unitOverLimit': '{name} owns {count} applications, and a {detail} owns at most {limit}',
  'check.assignmentEnded': 'Someone still holds {detail} in {name}, after the unit or the role has ended',
  'check.unitTypeEnded': '{name} is still a {detail}, a kind of unit that has ended: give it another type, or end it',
  'check.personOverloaded': '{name} holds {count}% across their roles',

  /**
   * What a stand-in says about itself, on the three surfaces that draw one: the
   * card on a board, the inspector beside it, and the sheet's own inspector.
   * The words live here because `projects/` is where a stand-in is defined —
   * every other module is handed the sentence rather than the key.
   */
  'check.short.conflict.one': '{count} conflict',
  'check.short.conflict.other': '{count} conflicts',
  'check.short.drift.one': '{count} drifting',
  'check.short.drift.other': '{count} drifting',
  'check.short.dangling.one': '{count} undefined',
  'check.short.dangling.other': '{count} undefined',
  'check.short.danglingEnd.one': '{count} loose row',
  'check.short.danglingEnd.other': '{count} loose rows',
  'check.short.proposal.one': '{count} proposal',
  'check.short.proposal.other': '{count} proposals',
  'check.short.ownedElsewhere.one': '{count} owned elsewhere',
  'check.short.ownedElsewhere.other': '{count} owned elsewhere',
  'check.short.unattributed.one': '{count} unattributed',
  'check.short.unattributed.other': '{count} unattributed',
  'check.short.notDrawn.one': '{count} on no board',
  'check.short.notDrawn.other': '{count} on no board',
  'check.short.drawingLinkMissing.one': '{count} missing link',
  'check.short.drawingLinkMissing.other': '{count} missing links',
  'check.short.unmapped.one': '{count} unmapped',
  'check.short.unmapped.other': '{count} unmapped',
  'check.short.uncovered.one': '{count} uncovered',
  'check.short.uncovered.other': '{count} uncovered',
  'check.short.offeredNotShared.one': '{count} offered, not marked shared',
  'check.short.offeredNotShared.other': '{count} offered, not marked shared',
  'check.short.causeExplainsObservationBelow.one': '{count} link to an observation below',
  'check.short.causeExplainsObservationBelow.other': '{count} links to observations below',
  'check.short.accountability.one': '{count} responsibility without one accountable role',
  'check.short.accountability.other': '{count} responsibilities without one accountable role',
  'check.short.roleVacant.one': '{count} role short of people',
  'check.short.roleVacant.other': '{count} roles short of people',
  'check.short.roleOverMax.one': '{count} role over its maximum',
  'check.short.roleOverMax.other': '{count} roles over their maximum',
  'check.short.unitMisplaced.one': '{count} unit where its type may not sit',
  'check.short.unitMisplaced.other': '{count} units where their type may not sit',
  'check.short.unitSpans.one': '{count} unit serving more domains than its type may',
  'check.short.unitSpans.other': '{count} units serving more domains than their type may',
  'check.short.unitOverLimit.one': '{count} unit over its limit',
  'check.short.unitOverLimit.other': '{count} units over their limit',
  'check.short.assignmentEnded.one': '{count} assignment past the end of its unit or role',
  'check.short.assignmentEnded.other': '{count} assignments past the end of their unit or role',
  'check.short.unitTypeEnded.one': '{count} unit of a type that has ended',
  'check.short.unitTypeEnded.other': '{count} units of a type that has ended',
  'check.short.personOverloaded.one': '{count} person over 100%',
  'check.short.personOverloaded.other': '{count} people over 100%',

  /**
   * Why a gesture that crosses scopes was declined (ADR-0012 §10).
   *
   * Keyed by the refusal's own key, the way the findings above are: `gestures.ts`
   * answers `gesture.wouldConflict` and this is the sentence for it, so nothing
   * has to keep a second table mapping one to the other. `{scope}` is the other
   * scope, where the refusal names one.
   */
  'gesture.unknownId': 'This scope no longer holds that record.',
  'gesture.notADefinition': 'This record already stands in for one somewhere else.',
  'gesture.notAMaster': '{scope} answers for this. Move it from there.',
  'gesture.noMaster': 'Nothing else in the organisation defines this.',
  'gesture.notAnAncestor': 'A record can only be promoted to a scope this one is filed under.',
  'gesture.notADescendant': 'A record can only be demoted to a scope filed under this one.',
  'gesture.noSuchScope': 'There is no such scope to move it to.',
  'gesture.wouldConflict': '{scope} already answers for this.',
  'gesture.hasChildren': 'What is filed under this record would be left without it. Move those first.',
  'gesture.barrier': 'That step wrote two scopes, so it cannot be taken back here. Move the record back with a gesture of its own.',

  /**
   * Why an application could not be drawn from the register (`library.ts`).
   * Keyed the same way, for the same reason.
   */
  'library.unknownId': 'The register no longer knows that application.',
  'library.alreadyDrawn': '{name} is on this board already.',
  'library.notABoard': 'A card is drawn on a landscape or a container view.',

  'standIn.definedIn': 'Defined in {scope} — its detail is kept there.',
  'standIn.open': 'Open {scope}',
  /** Under a stand-in's name on a card, small: where the thing really lives. */
  'standIn.from': 'from {scope}',
} as const
