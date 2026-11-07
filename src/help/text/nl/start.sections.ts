// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { SectionTexts } from '../../types'

export const SECTIONS: SectionTexts = {
  'first.language': ['De taal kiezen op de eerste pagina', 'Zet de app op English, Nederlands of Deutsch voordat er iets is begonnen; dezelfde keuze als in Voorkeuren.',
    'Eerste pagina, rechtsboven; eerste scherm van de desktop, rechtsboven',
    ['Kies een taal in de lijst rechtsboven'],
    'Kies "Deutsch" en de eerste pagina leest "Beginnen Sie mit Ihrer Organisation…".'],
  'first.example': ['Een voorbeeld bekijken', 'Opent de meegeleverde voorbeeldorganisatie als een plek die je bezoekt: alles kan worden geprobeerd, niets wordt bewaard en je eigen werk blijft onaangeroerd. Een strook op elk scherm zegt dat je erin bent.',
    'Eerste pagina: "Een voorbeeld bekijken"; op het thuis van een lege organisatie: de regel "Een voorbeeld bekijken"',
    ['Druk op "Voorbeeld openen"'],
    'Open het voorbeeld, open Application landscape van Acme Logistics en verplaats een kaart: er blijft niets van over zodra je weggaat.'],
  'example.keep': ['Het voorbeeld als begin houden', 'Kopieert het voorbeeld naar je eigen werk. In een lege organisatie zonder naam wordt het de organisatie; anders komt het in een eigen scope.',
    'De strook bovenaan terwijl je het voorbeeld bezoekt',
    ['Druk op "Dit als mijn begin houden"'],
    'Druk na het proberen op "Dit als mijn begin houden" om verder te werken met Acme Logistics als je eigen organisatie.'],
  'example.leave': ['Het voorbeeld verlaten', 'Gaat terug naar je eigen werk; wat je in het voorbeeld probeerde, vervalt.',
    'De strook bovenaan terwijl je het voorbeeld bezoekt',
    ['Druk op "Voorbeeld verlaten"'],
    'Druk op "Voorbeeld verlaten" om terug te gaan naar je eigen eerste pagina.'],
  'first.carryOn': ['Verder met werk dat je hebt', 'Opent een bewaarde kopie (.lvarch) of, waar de browser het kan, een map met werk, direct vanaf de eerste pagina. Is er nog niets gemaakt, dan opent een bestand zonder te vragen waar het moet komen.',
    'Eerste pagina: "Verder met werk dat je hebt"',
    ['Druk op "Een bestand openen…", kies het .lvarch-bestand en typ het wachtwoord', 'Of druk op "Een map openen…" en kies de map'],
    'Open northline-freight.lvarch dat een collega stuurde, typ het afgesproken wachtwoord en de organisatie opent.'],
  'first.name': ['Je eigen organisatie beginnen', 'Geeft een nieuwe, lege organisatie een naam en gaat van de eerste pagina naar het thuis ervan, dat dan de eerste dingen aanbiedt om vast te leggen.',
    'Eerste pagina van een organisatie waar nog niemand aan begon (web: #/-/home zonder bewaard werk)',
    ['Typ de naam van de organisatie in "Naam van je organisatie"', 'Druk op Beginnen, of Enter'],
    'Typ "Northline Freight" en druk op Enter: het thuis van Northline Freight opent met "Wat wil je als eerste vastleggen?"'],
  'first.next': ['Een eerste stap zetten in een nieuwe organisatie', 'Een organisatie met een naam en nog niets erin biedt vier begins: de organisatie indelen (Nieuwe scope…), tekenen wat er draait (Nieuwe weergave…), vastleggen wat je ziet (Een waarneming vastleggen…) en zeggen wie wat doet (Het besturingsmodel openen).',
    'Het thuis van een organisatie met een naam die nog niets bevat',
    ['Kies een van de vier blokken en druk op de knop ervan'],
    'Druk in Northline Freight op "Nieuwe scope…" om een divisie "Road network" aan te maken.'],
  'first.desktopFolder': ['Kiezen waar je werk staat (desktop)', 'Op de desktop vraagt het eerste scherm om een map om werk in te bewaren als bestanden die je kunt lezen, back-uppen, synchroniseren en committen. Een lege map is prima, en de map kan later worden gewijzigd. Recent gebruikte mappen zijn één druk ver.',
    'Desktop, eerste start, of zonder gekozen map',
    ['Druk op "Een map kiezen…"', 'Kies of maak een map in het venster dat opent'],
    'Kies ~/Documents/architecture/northline: de app bewaart Northline Freight daar als bestanden.'],
}
