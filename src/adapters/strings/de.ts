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
  'shell.unreadableNotSaved': 'Dieser Bereich wurde nicht gespeichert: eine seiner Dateien konnte nicht gelesen werden, und Speichern hätte sie überschrieben oder verloren, was sie enthält. Reparieren Sie die Datei oder holen Sie sie aus dem Verlauf zurück, und öffnen Sie den Bereich erneut.',
  'shell.scopeMoved': 'Jemand hat diesen Bereich geändert, während dies lief, deshalb wurde nichts geschrieben. Öffnen Sie es erneut und nehmen Sie die Änderung noch einmal vor.',
  'shell.historyMidway': 'Es wurde nichts festgehalten: der Verlauf dieses Ordners steckt mitten in einem Zusammenführen, einem Rebase oder einer anderen eigenen Änderung. Schließen Sie diese zuerst ab oder brechen Sie sie ab, und halten Sie dann erneut fest.',
  'shell.historyDetached': 'Es wurde nichts festgehalten: der Verlauf dieses Ordners steht auf keinem Zweig, eine jetzt festgehaltene Version gehörte also zu keinem. Wechseln Sie zuerst auf einen Zweig, und halten Sie dann erneut fest.',
  'shell.gitMissing': 'Der Verlauf braucht git auf diesem Rechner. Installieren Sie git und versuchen Sie es erneut.',
  'shell.gitTooOld': 'Der Verlauf braucht git 2.25 oder neuer auf diesem Rechner. Aktualisieren Sie git und versuchen Sie es erneut.',
  'shell.historyFailed': 'Der Verlauf dieses Ordners konnte nicht gelesen oder geschrieben werden. Die Diagnose nennt den Grund.',
  'shell.storageFull': 'Dieser Browser hat keinen Platz mehr für diese App, deshalb wurde nichts gespeichert. Speichern Sie eine Arbeitsdatei und geben Sie dann in den Einstellungen des Browsers Platz für diese Seite frei.',
  'shell.storageReload': 'Diese Seite kann in diesem Browser nicht mehr speichern: Die App wurde in einem anderen Tab aktualisiert, oder der Browser hat die gespeicherte Arbeit verloren. Laden Sie die Seite neu, um weiterzuarbeiten.',
  'shell.storageBlocked': 'In einem anderen Tab ist noch eine ältere Version dieser App geöffnet. Schließen Sie ihn oder laden Sie ihn neu, dann geht es hier weiter.',
}
