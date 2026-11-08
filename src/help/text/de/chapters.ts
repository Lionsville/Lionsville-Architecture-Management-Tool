// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ChapterText } from '../../types'

/** Der Titel jedes Kapitels, worum es geht, sein durchgespieltes Beispiel und was sein Bild zeigt. */
export const CHAPTERS: Readonly<Record<string, ChapterText>> = {
  start: {
    title: 'Die erste Seite',
    intro: 'Die erste Seite bietet drei Wege: mit der eigenen Organisation beginnen, ein Beispiel ansehen oder mit vorhandener Arbeit weitermachen.',
    picture: 'Die erste Seite: ein Name zum Beginnen, das Beispiel zum Ansehen und die Wege, vorhandene Arbeit zu öffnen.',
    worked: {
      title: 'Sich erst umsehen',
      steps: [
        'Drücken Sie auf der ersten Seite **Beispiel öffnen**. Ein Band auf jedem Bildschirm sagt, dass Sie es besuchen.',
        'Öffnen Sie **Application landscape** unter Ansichten hier, verschieben Sie eine Karte und benennen Sie sie um: Probieren Sie alles.',
        'Drücken Sie **Beispiel verlassen** im Band. Nichts von dem, was Sie probiert haben, bleibt.',
        'Tippen Sie den Namen Ihrer eigenen Organisation, etwa *Acme Logistics*, und drücken Sie **Beginnen**.',
      ],
    },
  },
  frame: {
    title: 'Sich zurechtfinden',
    intro: 'Zwei Zeilen stehen über jedem Bildschirm: Die erste sagt, wo Sie sind und ob Ihre Arbeit sicher ist, die zweite nennt die Orte des Bereichs, in dem Sie sind. Der Baum der Bereiche steht neben jeder Startseite.',
    picture: 'Der Rahmen: die erste Zeile mit Zurück und Vorwärts, dem Pfad, Suchen, Rückgängig und dem Statuswort; die zweite Zeile mit Start und den Orten; links der Baum der Bereiche und daneben die Startseite eines Bereichs.',
    worked: {
      title: 'Von der Organisation zu einem Board und zurück',
      steps: [
        'Drücken Sie auf der Startseite der Organisation **Warehouse** im Baum links.',
        'Drücken Sie unter **Ansichten hier** **Application landscape**: Das Board öffnet sich, und die zweite Zeile zeigt seinen Reiter.',
        'Drücken Sie **Acme Logistics** im Pfad der ersten Zeile, um zur Startseite der Organisation zu gehen.',
        'Drücken Sie **‹** (oder ⌘[ auf dem Desktop), um zum Board zurückzukehren, genau wie Sie es verlassen haben.',
        'Drücken Sie ⌘K, tippen Sie *Fahrplan* und drücken Sie die Eingabetaste, um von überall den Fahrplan zu öffnen.',
      ],
    },
  },
  work: {
    title: 'Ihre Arbeit, Dateien und Einstellungen',
    intro: 'Ihre Arbeit wird beim Arbeiten aufbewahrt, in einem Ordner oder in diesem Browser. Das Statuswort in der ersten Zeile sagt wo und ob sie sicher ist; von dort und aus den Menüs öffnen, kopieren, teilen und blicken Sie zurück.',
    picture: 'Ihre Arbeit: das Statuswort in der ersten Zeile, gedrückt, um das Panel zu öffnen, das sagt, wo die Arbeit liegt und was sie bewegen kann.',
    worked: {
      title: 'Ihre Organisation auf einen anderen Computer mitnehmen',
      steps: [
        'Drücken Sie das Statuswort in der ersten Zeile, um **Ihre Arbeit** zu öffnen.',
        'Drücken Sie **Kopie speichern…** und geben Sie zweimal ein Passwort ein.',
        'Bringen Sie die `.lvarch`-Datei auf den anderen Computer, öffnen Sie dort die App und wählen Sie **Eine Datei öffnen…**.',
        'Geben Sie das Passwort ein und wählen Sie, wohin sie kommt: in einen neuen Ordner oder anstelle dessen, was dort offen ist.',
      ],
    },
  },
  board: {
    title: 'Landschafts-Boards und Container-Diagramme',
    intro: 'Ein Landschafts-Board zeichnet die Anwendungen in Bändern, mit den Linien zwischen ihnen; ein Container-Diagramm öffnet sich unter einer Anwendung und zeichnet, woraus sie besteht. Das Modell ist eines, und ein Board ist eine Ansicht davon.',
    picture: 'Ein Landschafts-Board: die Bänder, Anwendungskarten mit ihrem Status, eine Linie mit ihrer Beschriftung und das Panel der gewählten Karte.',
    worked: {
      title: 'Eine neue Anwendung zeichnen und verbinden',
      steps: [
        'Öffnen Sie **Application landscape** und doppelklicken Sie auf eine leere Stelle im Anwendungsband.',
        'Tippen Sie *Route Optimiser* und drücken Sie die Eingabetaste: Die Karte wird gezeichnet und gewählt.',
        'Zeigen Sie auf die Karte und ziehen Sie vom Knubbel an ihrem Rand zu **Order Management**.',
        'Geben Sie der Linie im Panel die Beschriftung *routes* und das Protokoll *REST*.',
        'Drücken Sie ⌘Z, wenn es nicht gemeint war: erst geht die Linie, dann die Karte.',
      ],
    },
  },
  panel: {
    title: 'Das Panel und die Eintragsseite',
    intro: 'Was gewählt ist, lesen und ändern Sie im Panel neben der Arbeit. Seine Eintragsseite zeigt dieselben Zeilen mit jedem Feld, den Text darüber und alles, womit es verbunden ist.',
    picture: 'Das Panel: der Name, eine Zeile Fakten, Reiter, Zeilen aus Beschriftung und Wert und die ersten Zeilen des Textes.',
    worked: {
      title: 'Festhalten, wem eine Anwendung gehört',
      steps: [
        'Wählen Sie **Warehouse Management** auf dem Board.',
        'Drücken Sie im Panel **+ Eigentümer, Anbieter…** und wählen Sie **Eigentümer**.',
        'Wählen Sie **Warehouse team** aus den Einheiten oder tippen Sie einen Namen.',
        'Drücken Sie **Eintrag ›** neben dem Namen, um den ganzen Eintrag mit Text und Linien zu lesen.',
      ],
    },
  },
  technology: {
    title: 'Die Technologielandschaft',
    intro: 'Worauf die Anwendungen stehen: die Dienste, die ein Plattformteam anbietet, und die Plattformen, die sie liefern, in drei Spalten von links nach rechts. Nichts wird von Hand gezeichnet; jede Zeile und Linie wird aus den Einträgen gelesen.',
    picture: 'Die Technologielandschaft: Anwendungen, Dienste und Plattformen in drei Spalten, mit den Linien der gewählten Zeile.',
    worked: {
      title: 'Herausfinden, wer auf einer Plattform steht',
      steps: [
        'Öffnen Sie die Ansicht **Technologielandschaft** der Organisation.',
        'Drücken Sie **OpenShift** in der Spalte Plattformen: Ihre Linien werden gezeichnet und der Leser öffnet sich.',
        'Lesen Sie die Zahl auf ihrer Zeile: jede Anwendung, die auf ihr oder auf etwas darunter steht.',
        'Drücken Sie **Wenn sie ginge…** für den Bericht der Plattform: was stehen bliebe.',
      ],
    },
  },
  sheet: {
    title: 'Das Geschäftsblatt und die Unternehmenskarte',
    intro: 'Ein Blatt sagt, was die Organisation tut, für wen und wie viel davon Software abdeckt: eine Kundenreise oben, die Gebiete mit ihren Fähigkeiten darunter, die Beteiligten am Rand. Die Unternehmenskarte liest dieselbe Schicht als Tabelle von Funktionen gegen Anwendungen.',
    picture: 'Ein Geschäftsblatt: die Phasen der Kundenreise oben, die Gebiete mit ihren Fähigkeiten, jede mit dem, was sie abdeckt.',
    worked: {
      title: 'Sagen, welche Anwendung eine Fähigkeit abdeckt',
      steps: [
        'Öffnen Sie das Blatt **Geschäftsarchitektur** der Organisation.',
        'Wählen Sie die Fähigkeit **Invoicing**.',
        'Kreuzen Sie im Panel unter **Abgedeckt durch** **Billing** an.',
        'Die Fähigkeit liest sich jetzt als von einem System abgedeckt, und die Zahlen der Karte folgen.',
      ],
    },
  },
  poster: {
    title: 'Das Poster',
    intro: 'Das Poster zeichnet ein Blatt als eine Seite fester Größe: jedes Gebiet ein Block, jede Fähigkeit eine Kachel. Lesen Sie es aus jeder Entfernung; in Gestalten platzieren Sie die Blöcke von Hand und ziehen Teams und Anwendungen auf die Kacheln.',
    picture: 'Das Poster: die Kundenreise oben, Gebiete als Blöcke mit Fähigkeitskacheln und der Schalter Lesen und Gestalten.',
    worked: {
      title: 'Auf dem Poster ein Team auf eine Fähigkeit setzen',
      steps: [
        'Öffnen Sie das Blatt und wählen Sie **Poster**, dann **Gestalten**.',
        'Öffnen Sie das Fach und suchen Sie **Warehouse team**.',
        'Ziehen Sie es auf die Kachel **Slotting and replenishment**: Das Team antwortet jetzt dafür.',
        'Wählen Sie wieder **Lesen**; die Beschriftung bleibt auf der Kachel.',
      ],
    },
  },
  chart: {
    title: 'Das Organigramm und die Conway-Karte',
    intro: 'Das Organigramm wird aus den Einheiten und den Personen in ihren Rollen angeordnet, an einem Tag; die Conway-Karte fragt, ob die Teams und die Systeme, die ihnen gehören, zusammenpassen.',
    picture: 'Das Organigramm: Einheiten in Kästen mit ihren Rollen und Inhabern, eine offene Rolle und die Gliederung daneben.',
    worked: {
      title: 'Eine offene Rolle besetzen',
      steps: [
        'Öffnen Sie die Ansicht **Organigramm**.',
        'Suchen Sie **Warehouse team** in der Gliederung und drücken Sie es.',
        'Drücken Sie **offen** neben der Rolle, die niemand hält.',
        'Wählen Sie die Person, ihren Anteil und den ersten Tag und drücken Sie **Zuordnen**.',
      ],
    },
  },
  drawing: {
    title: 'Zeichnungen',
    intro: 'Eine Zeichnung ist die eine Ansicht, die Sie zeichnen und nicht das Modell. Ihre Formen können auf Elemente zeigen, sodass das Bild mit dem verbunden bleibt, was es zeigt.',
    picture: 'Eine Zeichnung: ihre Leiste, das Bild mit den auf Elemente zeigenden Formen umrandet, und wie viele Links sie hat.',
    worked: {
      title: 'Eine Skizze eines Lagerablaufs zeichnen',
      steps: [
        'Drücken Sie **+** in der zweiten Zeile und wählen Sie **Zeichnung** unter *Diese zeichnen Sie*.',
        'Nennen Sie sie *Dock flow* und wählen Sie **Warehouse Management** als das, worum es geht.',
        'Drücken Sie **Zeichnung bearbeiten**, ziehen Sie **Warehouse Management** aus der Palette auf die Seite und zeichnen Sie darum herum.',
        'Drücken Sie **Speichern** und **Fertig**: Die Form ist auf dem Bild umrandet und öffnet ihr Element.',
      ],
    },
  },
  decisions: {
    title: 'Entscheidungen, Verlauf und ein anderer Tag',
    intro: 'Entscheidungen sagen, was entschieden wurde und warum, in einem Ablauf, der in einem Eintrag endet, den niemand umschreiben kann. Der Verlauf hält Snapshots der Arbeit fest; ein Board lässt sich an einem anderen Tag ansehen, ohne etwas zu ändern.',
    picture: 'Entscheidungen: die Liste unter Noch offen, In Kraft und Beendet und ein Eintrag mit seinem Stand in einer Zeile oben.',
    worked: {
      title: 'Eine Entscheidung festhalten und annehmen',
      steps: [
        'Öffnen Sie **Entscheidungen** in der zweiten Zeile und drücken Sie **Neue Entscheidung**.',
        'Geben Sie ihr den Titel *Ein Schreiber je Bereich* und sagen Sie, worum es geht.',
        'Schreiben Sie Kontext und Optionen in **Text bearbeiten** und drücken Sie **Fertig**.',
        'Senden Sie sie zur Prüfung, und wenn die Prüfenden unterschrieben haben, drücken Sie **Annehmen**.',
      ],
    },
  },
  observations: {
    title: 'Beobachtungen, Ursachen und Lösungen',
    intro: 'Was das Team gesehen hat, warum es geschieht und was dagegen getan wird: Beobachtungen werden in Ursachen und Grundursachen zerlegt, und eine Lösung verdient sich ihren Weg von der Idee zu etwas Gebautem, mit Experimenten getestet und an den Sichtungen geprüft.',
    picture: 'Die Analyse: links die Beobachtungen, rechts davon ihre Ursachen und Grundursachen und zuletzt die Lösungen, die sie angehen.',
    worked: {
      title: 'Von einer Sichtung zu ihrer Grundursache',
      steps: [
        'Öffnen Sie **Beobachtungen** und drücken Sie **Neue Beobachtung**.',
        'Schreiben Sie *Kommissionierer warten auf Nachschub* mit wo, wer es sah und wann, und halten Sie sie fest.',
        'Drücken Sie **Ursache** in ihrem Leser und schreiben Sie *Die Lagerplatzvergabe läuft einmal pro Nacht*.',
        'Drücken Sie bei dieser Ursache **Zur Grundursache machen**, dann **Lösung**, um vorzuschlagen, was zu tun ist.',
      ],
    },
  },
  roadmap: {
    title: 'Der Fahrplan und Pläne',
    intro: 'Der Fahrplan legt die Landschaft auf eine Zeitachse: Alles mit einem Datum bekommt eine Zeile. Ein Plan hält eine Änderung der Landschaft fest, mit Fenster, Meilensteinen und dem, was er einführt und ablöst.',
    picture: 'Der Fahrplan: das Lineal mit markiertem Heute, Pläne als Bänder mit Meilensteinen und Anwendungen als Folgen von Phasen.',
    worked: {
      title: 'Die Ablösung einer Anwendung planen',
      steps: [
        'Öffnen Sie **Fahrplan** und drücken Sie **Neuer Plan**.',
        'Nennen Sie ihn *Alten Tarifrechner ablösen*, mit einem Fenster von März bis Juni.',
        'Fügen Sie unter dem, was er ändert, **Rating (legacy)** als abgelöst und **Tariff Engine** als eingeführt hinzu.',
        'Lesen Sie **Worin sich die Daten widersprechen** unter der Achse: Eine Linie, die nach ihrem Ende noch aktiv ist, steht dort.',
      ],
    },
  },
  registers: {
    title: 'Register und Prüfungen',
    intro: 'Das Register listet jede Anwendung, jeden Dienst und jede Plattform der Organisation, aus den Bereichen selbst gelesen. Die Seite Prüfungen listet, was die Organisation sich selbst widerspricht, nach Gewicht, mit wie man jedes behebt.',
    picture: 'Das Register: eine Zeile je Anwendung mit dem Bereich, der dafür antwortet, und ihren Befunden, und die Prüfungen nach Gewicht gezählt.',
    worked: {
      title: 'Einen Namen klären, den zwei Bereiche festhalten',
      steps: [
        'Öffnen Sie **Prüfungen** von der Startseite der Organisation und wählen Sie die Prüfung zu einem doppelt festgehaltenen Namen.',
        'Lesen Sie **Warum es wichtig ist** und **So beheben Sie es**.',
        'Drücken Sie den Befund, um den Eintrag in dem Bereich zu öffnen, der weichen soll.',
        'Wählen Sie **Verknüpfen…**: Dieser Bereich vertritt jetzt den Eintrag des anderen, und der Befund verschwindet.',
      ],
    },
  },
  operating: {
    title: 'Das Betriebsmodell und RACI',
    intro: 'Der eigene Entwurf der Organisation, wie sie aufgestellt ist: die Arten von Einheiten, die Rollen, die jede hält, und wofür jede Rolle verantwortlich ist. Es wird bei der Organisation geführt, und jede Änderung ist ein Schritt.',
    picture: 'Verantwortungen: links die Gruppen und ein Raster aus Rollen gegen Verantwortungen mit R, A, C und I.',
    worked: {
      title: 'Mit einer Bibliothek beginnen',
      steps: [
        'Öffnen Sie **Betriebsmodell** von der Startseite der Organisation und drücken Sie **Mit einer Bibliothek beginnen**.',
        'Wählen Sie **Team Topologies** und kreuzen Sie die Einheitstypen an, die Sie wollen.',
        'Benennen Sie unter **Was hereinkommt** *Stream-aligned team* in das Wort um, das Sie verwenden.',
        'Drücken Sie **Hereinholen**: ein Schritt, den ⌘Z zurücknimmt.',
      ],
    },
  },
  people: {
    title: 'Personen',
    intro: 'Das Personenregister der Organisation: ein Eintrag je Person, außerhalb des Verlaufs geführt, damit ein Name vergessen werden kann. Jeder Bildschirm fragt das Register nach dem Namen, wenn er einen zeigt.',
    picture: 'Personen: eine Zeile je Person mit ihrer Art und den Rollen, die sie heute hält.',
    worked: {
      title: 'Eine Kollegin ohne Doppelung hinzufügen',
      steps: [
        'Öffnen Sie **Personen** und drücken Sie **Person hinzufügen**.',
        'Tippen Sie *Pia Schulz* und ihre Arbeitsadresse.',
        'Steht *Pia Schultz* schon im Register, sagt es das: Drücken Sie **Diese verwenden** oder **Trotzdem hinzufügen**.',
        'Drücken Sie **Das bin ich** auf Ihrem eigenen Eintrag, damit die App Sie überall markiert, wo Sie vorkommen.',
      ],
    },
  },
  guidance: {
    title: 'Prinzipien, Themen und Bausteine',
    intro: 'Was die Arbeit leiten soll: Prinzipien, die in einem Bereich und darunter gelten, Themen, die sich durch die Organisation ziehen, und Bausteine, die viele Lösungen wiederverwenden, jeder dort bewertet, wo er genutzt wird.',
    picture: 'Leitlinien: ein Eingang mit je einem Reiter für Prinzipien, Themen und Bausteine, eine Liste mit einer Zeile je Element.',
    worked: {
      title: 'Ein Prinzip schreiben und zitieren',
      steps: [
        'Öffnen Sie **Leitlinien** und drücken Sie auf **Prinzipien** **Neues Prinzip**.',
        'Schreiben Sie *Kaufen vor Bauen*, flexibel, und nehmen Sie es an.',
        'Öffnen Sie eine Entscheidung und sagen Sie unter **Prinzipien**, dass sie *Kaufen vor Bauen* folgt.',
      ],
    },
  },
  agent: {
    title: 'Mit einem Agenten arbeiten',
    intro: 'Ein mit der Desktop-App verbundener Coding-Agent liest die Organisation, bewegt die App, wie Sie es tun, und macht Änderungen, die Sie sehen und rückgängig machen können. Während er arbeitet, sagt ein Band es, mit Stopp.',
    picture: 'Ein Agent bei der Arbeit: das Band mit dem Namen des Agenten und dem, was er tut, mit Stopp, und seine Änderungen in Aktivität.',
    worked: {
      title: 'Einen Agenten ein Board aufräumen lassen, während Sie zusehen',
      steps: [
        'Wählen Sie auf dem Desktop **Einen Agenten verbinden…** und kopieren Sie die Einstellungen in Ihren Agenten.',
        'Bitten Sie ihn, *Application landscape* zu öffnen und aufzuräumen.',
        'Beobachten Sie das Band unten; drücken Sie **Stopp**, wenn er irgendwohin geht, wo Sie nicht hinwollten.',
        'Lesen Sie seine Schritte in **Aktivität** und drücken Sie ⌘Z, um zurückzunehmen, was Sie nicht wollen.',
      ],
    },
  },
}
