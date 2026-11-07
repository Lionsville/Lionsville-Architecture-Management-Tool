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

  // --- the kit's canvas parts: what they always say ---------------------------
  'kit.dock.label': 'Zoom and view',
  'kit.dock.zoomIn': 'Zoom in',
  'kit.dock.zoomOut': 'Zoom out',
  'kit.dock.value': 'Zoomed to {percent}%',
  'kit.dock.fit': 'Fit',
  'kit.dock.fitHint': 'Fit it to the window, down to 60%',
  'kit.dock.home': '100%',
  'kit.dock.homeHint': 'Back to 100%',
  'kit.dock.atFloor': 'Zoom stops at 60%. A larger canvas scrolls.',
  'kit.dock.atCeiling': 'Zoom stops at 200%.',
  'kit.dock.grid': 'Grid',
  'kit.dock.map': 'Map',
  'kit.dock.mapHint': 'A small map of the whole canvas',
  'kit.colour': 'Colour',
  'kit.colour.on': 'Colour: {question}',
  'kit.colour.none': 'None',
  'kit.key.label': 'Key',
  'kit.key.other': 'Other',
  'kit.key.keep': 'Keep with the view',
  'kit.day': 'Day',
  'kit.day.on': 'Day: {day}',
  'kit.day.today': 'Today',
  'kit.day.choose': 'Choose a day…',
  'kit.day.field': 'The day to look at',
  'kit.day.show': 'Show this day',
  'kit.day.outside': 'Nothing here has a date on this day',
  'kit.viewbar.label': 'View',
  'kit.card.agent': 'Changed by an agent, not yet reviewed',
  'kit.zone.fold': 'Fold {name}',
  'kit.zone.unfold': 'Unfold {name}',
  'kit.line.number': 'Line {number}',
  'kit.axis.today': 'Today',
  'kit.axis.todayHint': 'Back to three months before today',
  'kit.axis.fit': 'Fit',
  'kit.axis.fitHint': 'Show everything with a date',
  'kit.axis.scale': 'Time scale',
  'kit.axis.weeks': 'Weeks',
  'kit.axis.months': 'Months',
  'kit.axis.quarters': 'Quarters',
  'kit.axis.years': 'Years',
  'kit.axis.range': '{from} to {to}',
  'kit.axis.from': 'From',
  'kit.axis.to': 'To',
  'kit.axis.rangeRefused': 'The last day comes before the first.',
  'kit.axis.rangeLabel': 'The days shown',
  'kit.axis.ruler': 'Time ruler. The arrows scroll it.',
  'kit.axis.boardShows': 'Board shows {day}',
  'kit.axis.boardPinned': 'Board {day}',
  'kit.axis.dayHandle': 'The day the board shows',
  'kit.axis.dayBack': 'Scroll back to {day}',
  'kit.axis.runsBefore': '{name}, starts before this window',
  'kit.axis.runsAfter': '{name}, runs on past this window',
  'kit.axis.runsBoth': '{name}, runs on past both edges',
  'kit.axis.together': '{count} milestones',
} as const
