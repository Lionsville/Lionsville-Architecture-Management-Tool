// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'kit.menu.more': 'Mehr',
  'kit.toast.undo': 'Rückgängig',
  'kit.toast.putBack': 'Zurücksetzen',
  'kit.focused.cancel': 'Abbrechen',
  'kit.focused.askTitle': 'Ohne Speichern verlassen?',
  'kit.focused.askBody': 'Was Sie hier geändert haben, ist nicht gespeichert und geht beim Verlassen verloren.',
  'kit.focused.keepEditing': 'Weiter bearbeiten',
  'kit.focused.discard': 'Verlassen und Änderungen verwerfen',
  'kit.property.edit': '{label} bearbeiten: {value}',
  'kit.property.editEmpty': '{label} bearbeiten',
  'kit.property.mixed': 'Gemischt, {count} Werte',
  'kit.property.fromAbove': '{value}, von oben',
  'kit.property.from': '{value}, von {source}',
  'kit.property.showAll': 'Alles anzeigen',
  'kit.property.showLess': 'Weniger anzeigen',
  'kit.picker.add': '„{query}“ hinzufügen',
  'kit.picker.recent': 'Zuletzt',
  'kit.picker.didYouMean': 'Meinten Sie',
  'kit.picker.nothing': 'Nichts unter diesem Namen.',
  'kit.picker.typeToSearch': 'Tippen Sie, um zu suchen.',
  'kit.picker.more': 'Noch {count}. Tippen Sie weiter, um einzugrenzen.',
}
