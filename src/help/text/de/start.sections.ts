// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { SectionTexts } from '../../types'

export const SECTIONS: SectionTexts = {
  'first.language': ['Die Sprache auf der ersten Seite wählen', 'Stellt die App auf English, Nederlands oder Deutsch, bevor etwas begonnen ist; dieselbe Wahl wie in den Voreinstellungen.',
    'Erste Seite, oben rechts; erster Bildschirm der Desktop-App, oben rechts',
    ['Wählen Sie eine Sprache in der Liste oben rechts'],
    'Wählen Sie "Deutsch", und die erste Seite lautet "Beginnen Sie mit Ihrer Organisation…".'],
  'first.example': ['Ein Beispiel ansehen', 'Öffnet die mitgelieferte Beispielorganisation als einen Ort, den Sie besuchen: Alles lässt sich ausprobieren, nichts wird aufbewahrt, und Ihre eigene Arbeit bleibt unberührt. Ein Streifen auf jedem Bildschirm sagt, dass Sie darin sind.',
    'Erste Seite: "Ein Beispiel ansehen"; auf der Startseite einer leeren Organisation: die Zeile "Ein Beispiel ansehen"',
    ['Klicken Sie auf "Beispiel öffnen"'],
    'Öffnen Sie das Beispiel, öffnen Sie Application landscape von Acme Logistics und verschieben Sie eine Karte: Nichts davon bleibt, sobald Sie gehen.'],
  'example.keep': ['Das Beispiel als Anfang behalten', 'Kopiert das Beispiel in Ihre eigene Arbeit. In eine leere Organisation ohne Namen wird es die Organisation; sonst wird es in einem eigenen Bereich abgelegt.',
    'Der Streifen oben, während Sie das Beispiel besuchen',
    ['Klicken Sie auf "Als eigene Organisation übernehmen"'],
    'Klicken Sie nach dem Ausprobieren auf "Als eigene Organisation übernehmen", um mit Acme Logistics als Ihrer eigenen Organisation weiterzuarbeiten.'],
  'example.leave': ['Das Beispiel verlassen', 'Kehrt zu Ihrer eigenen Arbeit zurück; was Sie im Beispiel ausprobiert haben, entfällt.',
    'Der Streifen oben, während Sie das Beispiel besuchen',
    ['Klicken Sie auf "Beispiel verlassen"'],
    'Klicken Sie auf "Beispiel verlassen", um zu Ihrer eigenen ersten Seite zurückzukehren.'],
  'first.carryOn': ['Mit vorhandener Arbeit weitermachen', 'Öffnet eine gespeicherte Kopie (.lvarch) oder, wo der Browser es kann, einen Ordner mit Arbeit, direkt von der ersten Seite. Ist noch nichts angelegt, öffnet sich eine Datei, ohne zu fragen, wohin sie soll.',
    'Erste Seite: "Mit vorhandener Arbeit weitermachen"',
    ['Klicken Sie auf "Eine Datei öffnen…", wählen Sie die .lvarch-Datei und geben Sie ihr Passwort ein', 'Oder klicken Sie auf "Einen Ordner öffnen…" und wählen Sie den Ordner'],
    'Öffnen Sie northline-freight.lvarch, die eine Kollegin geschickt hat, geben Sie das vereinbarte Passwort ein, und die Organisation öffnet sich.'],
  'first.name': ['Mit der eigenen Organisation beginnen', 'Gibt einer neuen, leeren Organisation einen Namen und geht von der ersten Seite zu ihrer Startseite, die dann das Erste zum Festhalten anbietet.',
    'Erste Seite einer Organisation, die noch niemand begonnen hat (Web: #/-/home, ohne aufbewahrte Arbeit)',
    ['Geben Sie den Namen der Organisation in "Name Ihrer Organisation" ein', 'Klicken Sie auf Beginnen, oder drücken Sie die Eingabetaste'],
    'Geben Sie "Northline Freight" ein und drücken Sie die Eingabetaste: Die Startseite von Northline Freight öffnet sich mit "Was möchten Sie zuerst festhalten?"'],
  'first.next': ['Einen ersten Schritt in einer neuen Organisation tun', 'Eine benannte Organisation, in der noch nichts liegt, bietet vier Anfänge: die Organisation gliedern (Neuer Bereich…), zeichnen, was läuft (Neue Ansicht…), festhalten, was Sie sehen (Eine Beobachtung festhalten…), und sagen, wer was tut (Das Betriebsmodell öffnen).',
    'Startseite einer benannten Organisation, die noch nichts enthält',
    ['Wählen Sie einen der vier Blöcke und klicken Sie auf seine Schaltfläche'],
    'Klicken Sie in Northline Freight auf "Neuer Bereich…", um eine Division "Road network" anzulegen.'],
  'first.desktopFolder': ['Wählen, wo Ihre Arbeit liegt (Desktop)', 'Auf dem Desktop fragt der erste Bildschirm nach einem Ordner, in dem die Arbeit als Dateien liegt, die Sie lesen, sichern, synchronisieren und committen können. Ein leerer Ordner ist in Ordnung, und der Ordner lässt sich später ändern. Zuletzt benutzte Ordner sind einen Druck entfernt.',
    'Desktop, erster Start, oder wenn kein Ordner gewählt ist',
    ['Klicken Sie auf "Einen Ordner öffnen…"', 'Wählen oder erstellen Sie einen Ordner im Fenster, das sich öffnet'],
    'Wählen Sie ~/Documents/architecture/northline: Die App bewahrt Northline Freight dort als Dateien auf.'],
}
