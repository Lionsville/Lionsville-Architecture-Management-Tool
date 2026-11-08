// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { GettingStartedText } from '../../types'

/** Erste Schritte: womit die Hilfe öffnet, in zwei Minuten gelesen. */
export const START: GettingStartedText = {
  title: 'Erste Schritte',
  intro: 'Sechs Schritte, zwei Minuten. Jeder sagt, was zu drücken ist; die Kapitel danach sagen den Rest, wenn Sie ihn brauchen.',
  steps: [
    {
      title: 'Wofür es da ist',
      text: 'Lionsville Architect hält die Architektur Ihrer Organisation an einem Ort: die Anwendungen und die Linien zwischen ihnen, das Geschäft, dem sie dienen, die Einheiten und Menschen, die für sie stehen, und die Entscheidungen, Beobachtungen und Pläne zu alledem. Gearbeitet wird in **Bereichen**: der Organisation und den Domänen und Teams darunter.',
      picture: 'Die Startseite eines Bereichs: sein Name, die Ansichten darin und was dort geführt wird.',
    },
    {
      title: 'Der Rahmen',
      text: 'Jeder Bildschirm steht im selben Rahmen. **Zeile eins** sagt, wo Sie sind, findet alles ({key:Mod+K}), macht rückgängig und sagt, ob Ihre Arbeit sicher ist. **Zeile zwei** enthält die Orte dieses Bereichs: Start, seine Ansichten, Entscheidungen, Beobachtungen, Roadmap. Der **Baum** der Bereiche steht links; das **Panel** rechts zeigt, was Sie auswählen.',
      picture: 'Der Rahmen: Zeile eins, Zeile zwei mit den Orten des Bereichs, links der Baum und rechts das Panel.',
    },
    {
      title: 'Einen Bereich und eine Ansicht öffnen',
      text: 'Klicken Sie auf einen Bereich im Baum, um seine Startseite zu lesen. Klicken Sie unter **Ansichten hier** auf eine Ansicht — die Anwendungslandschaft, die Geschäftsarchitektur, das Organigramm — und sie öffnet sich mit einem Reiter in Zeile zwei. **‹** in Zeile eins geht dorthin zurück, wo Sie waren.',
      picture: 'Die Startseite eines Bereichs mit seinen Ansichten unter Ansichten hier.',
    },
    {
      title: 'Hinzufügen und verbinden',
      text: 'Klicken Sie auf einem Board **Hinzufügen** in der Leiste, oder doppelt auf eine leere Stelle, und tippen Sie einen Namen. Um zwei Karten zu verbinden, zeigen Sie auf eine und ziehen vom Punkt an ihrem Rand zur anderen. Wählen Sie etwas aus, um es im Panel zu lesen und zu ändern. {key:Mod+Z} nimmt jeden Schritt zurück.',
      picture: 'Ein Board mit zwei Karten und der Linie zwischen ihnen, und das Panel der ausgewählten Karte.',
    },
    {
      title: 'Eine Beobachtung festhalten',
      text: 'Etwas bemerkt — zwei Systeme mit verschiedenen Preisen, eine langsame Übergabe? Öffnen Sie **Beobachtungen** in Zeile zwei und klicken Sie auf **Neue Beobachtung**. Sagen Sie in wenigen Worten, was Sie gesehen haben. Klicken Sie später auf **Warum fragen**, um die Ursache zu finden, und schlagen Sie eine Lösung für die Grundursache vor.',
      picture: 'Die Beobachtungsseite: was gesehen wurde, die Ursachen dahinter und die vorgeschlagene Lösung.',
    },
    {
      title: 'Wie es weitergeht',
      text: 'Klicken Sie auf jedem Bildschirm auf das **?** in Zeile eins, oder drücken Sie F1: Die Hilfe öffnet sich bei diesem Bildschirm. Drücken Sie außerhalb eines Textfelds **?** auf der Tastatur für die Tastenkürzel. Jedes Panel hat ebenfalls ein **?** im Kopf. Lesen Sie weiter bei *Sich zurechtfinden* und *Landschaftsboards und Containerdiagramme*.',
      picture: 'Zeile eins mit dem ?, das die Hilfe bei diesem Bildschirm öffnet, und Hilfe daneben.',
    },
  ],
}
