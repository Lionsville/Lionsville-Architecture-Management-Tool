// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for the words more than one module says.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  // --- shared vocabulary ---------------------------------------------------
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.none': 'None',
  'common.name': 'Name',
  'common.language': 'Language',
  'common.languageNl': 'Nederlands',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Nothing written yet.',
  /** Three pages offer it — a diagram, a description, a decision — and it is the same word (ADR-0008). */
  'common.history': 'History…',
  /** What a page or a dialog says while its script is on the way (`widgets/Arriving`). */
  'common.arriving': 'Loading…',
  'common.copyLink': 'Copy link',
  /**
   * What to call the root scope where a path is what is being shown
   * (ADR-0012 §1). The root's path is the EMPTY STRING, so every screen that
   * prints one — a card's "from …", a finding, a change in the history — would
   * otherwise print a sentence with a hole in it. Three modules say it, which
   * is what `common.` is for.
   */
  'common.organisation': 'the organisation',
  /** Where a part of the app that arrives later would not load (`widgets/lazyPart`): offline, or a network that dropped it. */
  'common.partNotLoaded': 'This could not be loaded.',
  'common.tryAgain': 'Try again',
  'common.resizeColumn': 'Drag to give this column more or less room; double-click to put it back',
  'common.backToReading': 'Back to reading',

  // --- said by the shell and by the pages composed below it (ADR-0049) ------
  // A view made and deleted, a scope's four pages, and what a picker says of a
  // choice: words the shell, a scope's home and the organisation's screens all
  // say, so they are nobody's but everybody's.
  'common.deleted': '“{name}” deleted.',
  'common.newDiagram': 'New landscape',
  'common.newChart': 'Organisation chart',
  'common.newConway': 'Conway map',
  'common.deleteDiagramTitle': 'Delete view “{name}”?',
  /** What deleting a view takes with it, said of its own kind: a laid-out view loses nothing but itself. */
  'common.deleteBody.layer7':
    'The placements, groups and routes of this landscape are lost. The elements themselves stay in the model, and container views remain.',
  'common.deleteBody.container':
    'The containers on this view go with it, and the interfaces they carried move up to the application. The application itself stays on the landscape.',
  'common.deleteBody.sheet':
    'The sheet goes, with where its blocks were placed on its poster. The functions, steps and stakeholders on it stay in the model.',
  'common.deleteBody.map':
    'The map goes. It is laid out from the functions and the rows, which all stay in the model.',
  'common.deleteBody.technology':
    'The technology landscape goes. It is read from the records, so every application, service and platform on it stays in the model.',
  'common.deleteBody.drawing':
    'The drawing goes, with everything drawn on it. What it points at stays in the model.',
  'common.deleteBody.chart':
    'The organisation chart goes. It is laid out from the units, so every unit, role and assignment on it stays.',
  'common.deleteBody.conway':
    'The Conway map goes. It is read from the units and the applications they own, which all stay in the model.',
  'common.scopeCreated': '\u201c{name}\u201d created.',
  'common.documentation': 'Documentation',
  'common.decisions': 'Decisions',
  'common.observations': 'Observations',
  'common.roadmap': 'Roadmap',
  /** What a picker over units, scopes and functions says: where a choice is kept, why it is not offered, what it found. */
  'common.pick.filedIn': 'filed in {scope}',
  'common.pick.in': 'in {name}',
  'common.pick.otherUnits': 'Of a type the model does not hold',
  'common.pick.otherActors': 'Others in this scope',
  'common.pick.servesOne': 'a {type} serves one domain',
  'common.pick.readOnly': 'kept where you may only read',
  'common.pick.notWritten': 'Nothing was written.',
  'common.pick.findUnit': 'Find a unit',
  'common.pick.noUnit': 'No unit by that name',
  'common.pick.findScope': 'Find a scope',
  'common.pick.noScope': 'No scope by that name',
  'common.pick.findFunction': 'Find an area, grouping or capability',
  'common.pick.noFunction': 'Nothing by that name',
} as const
