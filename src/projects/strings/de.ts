// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Diese Arbeitsdatei enthält keine Ansichten.',
  'git.andMore': ' und {count} weitere',

  'check.conflict': '{name} ist sowohl hier als auch in {scope} definiert — behalten Sie eine Definition und machen Sie die andere mit Verknüpfen… zu einem Platzhalter',
  'check.drift': 'Die Kopie von {name} hier stimmt nicht mehr mit {scope} überein — aktualisieren Sie sie, oder ändern Sie es dort',
  'check.dangling': '{name} steht für etwas, das nichts in der Organisation definiert — definieren Sie es hier, oder löschen Sie den Platzhalter',
  'check.danglingEnd': 'Eine Zeile an {name} endet an etwas, das dieser Bereich nicht hält — löschen Sie die Zeile, oder zeichnen Sie, worauf sie zeigt',
  'check.proposal': '{name} ist eine Fähigkeit, die diese Domäne vorschlägt und die Organisation nicht benannt hat — fügen Sie sie der Geschäftsarchitektur der Organisation hinzu, oder benennen Sie sie in eine vorhandene um',
  'check.ownedElsewhere': 'Dies wird in {scope} geführt — ändern Sie es dort',
  'check.unattributed': '{name} liegt außerhalb der Organisation, und niemand hat gesagt, wem es gehört — nennen Sie die Partei auf seiner Seite',
  'check.notDrawn': '{name} ist hier definiert und auf keiner Tafel gezeichnet — setzen Sie es auf eine Tafel, oder belassen Sie es als Datensatz',
  'check.unmapped': '{name} ist niemandem zugewiesen und von keiner Domäne übernommen — weisen Sie es zu, oder übergeben Sie es einer Domäne',
  'check.uncovered': 'Nichts und niemand erledigt {name} — verbinden Sie eine Anwendung, die es unterstützt, oder weisen Sie eine Person zu',
  'check.offeredNotShared': '{name} wird von {detail} genutzt, außerhalb des Teams, das es pflegt, und ist nicht als geteilt markiert — markieren Sie es als geteilt, oder verschieben Sie es',

  'check.short.conflict.one': '{count} Konflikt',
  'check.short.conflict.other': '{count} Konflikte',
  'check.short.drift.one': '{count} veraltet',
  'check.short.drift.other': '{count} veraltet',
  'check.short.dangling.one': '{count} undefiniert',
  'check.short.dangling.other': '{count} undefiniert',
  'check.short.danglingEnd.one': '{count} lose Zeile',
  'check.short.danglingEnd.other': '{count} lose Zeilen',
  'check.short.proposal.one': '{count} Vorschlag',
  'check.short.proposal.other': '{count} Vorschläge',
  'check.short.ownedElsewhere.one': '{count} anderswo verantwortet',
  'check.short.ownedElsewhere.other': '{count} anderswo verantwortet',
  'check.short.unattributed.one': '{count} ohne Eigentümer',
  'check.short.unattributed.other': '{count} ohne Eigentümer',
  'check.short.notDrawn.one': '{count} nirgends gezeichnet',
  'check.short.notDrawn.other': '{count} nirgends gezeichnet',
  'check.short.unmapped.one': '{count} nicht zugewiesen',
  'check.short.unmapped.other': '{count} nicht zugewiesen',
  'check.short.uncovered.one': '{count} nicht abgedeckt',
  'check.short.uncovered.other': '{count} nicht abgedeckt',
  'check.short.offeredNotShared.one': '{count} angeboten, nicht als geteilt markiert',
  'check.short.offeredNotShared.other': '{count} angeboten, nicht als geteilt markiert',

  'gesture.unknownId': 'Dieser Bereich hält diesen Datensatz nicht mehr.',
  'gesture.notADefinition': 'Dieser Datensatz verweist bereits auf eine Definition anderswo.',
  'gesture.notAMaster': '{scope} verantwortet dies. Verschieben Sie es von dort.',
  'gesture.noMaster': 'Nichts sonst in der Organisation definiert dies.',
  'gesture.notAnAncestor': 'Ein Datensatz kann nur in einen Bereich hochgezogen werden, unter dem dieser liegt.',
  'gesture.notADescendant': 'Ein Datensatz kann nur in einen Bereich abgegeben werden, der hierunter liegt.',
  'gesture.noSuchScope': 'Diesen Bereich gibt es nicht.',
  'gesture.wouldConflict': '{scope} verantwortet dies bereits.',
  'gesture.hasChildren': 'Was unter diesem Datensatz liegt, bliebe ohne ihn. Verschieben Sie das zuerst.',
  'gesture.barrier': 'Dieser Schritt hat zwei Bereiche geschrieben und kann hier nicht rückgängig gemacht werden. Verschieben Sie den Datensatz mit einer eigenen Geste zurück.',

  'library.unknownId': 'Das Register kennt diese Anwendung nicht mehr.',
  'library.alreadyDrawn': '{name} ist bereits auf diesem Board.',
  'library.notABoard': 'Eine Karte wird auf einer Landschaft oder einer Container-Ansicht gezeichnet.',

  'standIn.definedIn': 'Definiert in {scope} — die Details werden dort geführt.',
  'standIn.open': '{scope} öffnen',
  'standIn.from': 'aus {scope}',
  'shell.unknownFile': 'Diese Datei ist keine Arbeitsdatei.',
}
