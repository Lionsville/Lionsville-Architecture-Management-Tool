/**
 * English, for what a project refuses to be.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  'shell.workingFileNoDiagrams': 'This working file has no diagrams.',
  'shell.interchangeNoDiagrams': 'This document has no diagrams.',
  'shell.unknownFile': 'This file is neither an interchange document nor a working file.',
  /**
   * The tail of a drafted commit subject, when there were more steps than a
   * subject line should name. The body below it lists every one.
   */
  'git.andMore': ' and {count} more',

  // --- one identity across the organisation (ADR-0012 §2, §3, §9) ----------
  /**
   * The findings, keyed by the finding's own key: `checks.ts` produces
   * `check.conflict` and this is the sentence for it, so nothing has to keep a
   * second table mapping one to the other. `{name}` is what the thing is
   * called and `{scope}` the other scope the finding names — the organisation
   * itself where the path is the root's, which is the empty string.
   */
  'check.conflict': '{name} is also defined in {scope}',
  'check.drift': 'The name here is not what {scope} calls it any more',
  'check.dangling': 'Nothing in this organisation defines {name}',
  'check.danglingEnd': 'A row on {name} ends on something nothing holds',
  'check.proposal': '{name} is not a capability the organisation has named',
  'check.ownedElsewhere': '{scope} answers for this',
  'check.unattributed': 'Nobody has said whose {name} is',
  'check.notDrawn': '{name} is on no board in this scope',
  'check.unmapped': '{name} is assigned to nobody and claimed by nobody',
  'check.uncovered': 'Nothing and nobody does {name}',

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
  'check.short.unmapped.one': '{count} unmapped',
  'check.short.unmapped.other': '{count} unmapped',
  'check.short.uncovered.one': '{count} uncovered',
  'check.short.uncovered.other': '{count} uncovered',

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

  'standIn.definedIn': 'Defined in {scope} — its detail is answered for there.',
  'standIn.open': 'Open {scope}',
  /** Under a stand-in's name on a card, small: where the thing really lives. */
  'standIn.from': 'from {scope}',
} as const
