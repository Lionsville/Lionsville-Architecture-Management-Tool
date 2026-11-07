// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'kit.menu.more': 'Meer',
  'kit.toast.undo': 'Ongedaan maken',
  'kit.toast.putBack': 'Terugzetten',
  'kit.focused.cancel': 'Annuleren',
  'kit.focused.askTitle': 'Weggaan zonder op te slaan?',
  'kit.focused.askBody': 'Wat je hier hebt gewijzigd is niet opgeslagen en gaat verloren als je weggaat.',
  'kit.focused.keepEditing': 'Verder bewerken',
  'kit.focused.discard': 'Weggaan en wijzigingen laten vervallen',
  'kit.property.edit': '{label} bewerken: {value}',
  'kit.property.editEmpty': '{label} bewerken',
  'kit.property.mixed': 'Gemengd, {count} waarden',
  'kit.property.fromAbove': '{value}, van hierboven',
  'kit.property.from': '{value}, van {source}',
  'kit.property.showAll': 'Alles tonen',
  'kit.property.showLess': 'Minder tonen',
  'kit.picker.add': '“{query}” toevoegen',
  'kit.picker.recent': 'Recent',
  'kit.picker.didYouMean': 'Bedoel je',
  'kit.picker.nothing': 'Niets met die naam.',
  'kit.picker.typeToSearch': 'Typ om te zoeken.',
  'kit.picker.more': 'Nog {count}. Typ verder om het te beperken.',
}
