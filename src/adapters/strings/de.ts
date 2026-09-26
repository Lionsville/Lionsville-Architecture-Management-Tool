// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for what the outside world says when it cannot do as it is asked.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'shell.badScopePath': 'Dieser Bereich hat keine verwendbare Adresse ({path}) und kann daher nicht gespeichert werden.',
  'shell.folderUnavailable': 'Dieser Ordner ist nicht verfügbar. Wählen Sie ihn erneut aus, oder verbinden Sie das Laufwerk wieder, auf dem er liegt.',
  'shell.unreadableNotSaved': 'Dieser Bereich wurde nicht gespeichert: seine model.json konnte nicht gelesen werden, und Speichern hätte ein leeres Modell darübergeschrieben. Reparieren Sie die Datei oder holen Sie sie aus dem Verlauf zurück, und öffnen Sie den Bereich erneut.',
}
