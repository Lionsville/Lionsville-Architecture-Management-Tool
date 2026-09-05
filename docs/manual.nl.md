# Gebruikershandleiding

De Lionsville Architecture Management Tool tekent een applicatielandschap in
Layer 7-banden en de C4-containerdiagrammen eronder. Dit is de handleiding
voor het gebruik. Wat het is en waarom het bestaat staat in de
[README](../README.md); de Engelse versie van deze handleiding is
[manual.en.md](manual.en.md).

## Beginnen

**Desktop.** Download het installatiebestand voor je platform van de
[releasepagina](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
De app kijkt op de achtergrond of daar een nieuwere versie staat en
installeert die bij het afsluiten; **Check for Updates…** in het appmenu doet het
op verzoek.

**Browser.** Vanuit een kloon van de repository eenmalig `npm run setup`, daarna
`npm run dev`; open <http://127.0.0.1:5200>. Alles wat je maakt leeft in de
opslag van die browser tot je een bestand bewaart.

In beide gevallen verlaat niets je computer. Er is geen account, geen backend
en geen telemetrie.

## Projecten en groepen

De app opent op de **projectlijst**. Een project is één ontwerp: een landschap,
de containerdiagrammen eronder en alles wat erop staat. Elk project staat onder
een **groep**: een klant, een afdeling, een programma, hoe de naamruimte bij jou
ook heet.

- **Voorbeelden** komen met de app mee. Een voorbeeld openen **kopieert** het
  naar een eigen project; niets wat je doet raakt het voorbeeld zelf.
- **Nieuwe groep** vraagt de groep en haar eerste project in één keer. Een groep
  bestaat alleen door de projecten eronder, dus een lege groep is er niet.
- **Nieuw project** biedt de groepen die er zijn. Elke groepskop heeft ook een
  eigen **Project toevoegen**, en dat is de weg die voorkomt dat `Acme` en
  `Acme Logistics` twee groepen worden.
- **Volgorde** sorteert op naam, of op wat je het laatst hebt gewijzigd.
- **Verwijderen** haalt een project uit deze browser of deze desktop-app. Een
  werkbestand dat je elders hebt bewaard blijft staan.

De **instellingen** van een groep bevatten haar naam, een omschrijving en
koppelingen: een wiki, een ticketwachtrij, een dashboard. Een groep hernoemen
hernoemt het label van elk project erin. Bij het starten opent de app het
project dat je open had.

## De werkruimte

Eén open project: een balk bovenin, de editor eronder.

| In de balk | Wat hij doet |
|---|---|
| **Projecten…** | Terug naar de projectlijst |
| **Instellingen…** | Naam en groep van dit project, en zijn standaarden: de auteur op een geëxporteerd diagram, en de volwassenheidskolommen waar een nieuw landschap mee begint. Een project naar een andere groep verplaatsen laat de inhoud met rust |
| **Bewaren…** | Eén menu, twee vormen. **Werkbestand** (`.lvarch`) is alles: geometrie, opmaak, eigen logo's, vastgezette routes. **Interchange-document** is alleen topologie en semantiek, de vorm voor review en versiebeheer |
| **Openen…** | Laadt allebei. Een interchange-document wordt opnieuw gelegd, een werkbestand komt terug zoals het was. Bestanden van onder de vorige naam van de tool blijven openen |
| **Thema** | Licht, donker of systeem. Systeem volgt je computer en schakelt mee |
| **Bewaard · uu:mm** | Wanneer deze browser of desktop-app het project voor het laatst aannam |

Alles wordt vanzelf bewaard terwijl je werkt. Weigert de opslag — vol, of
geblokkeerd in een privévenster — dan zegt de balk onderin dat één keer en
werkt de editor gewoon door; bewaar dan een werkbestand, want zonder opslag is
het project weg als het tabblad sluit. Elke melding (bewaard, geladen, mislukt)
verschijnt in die balk onderin.

**Taal.** De knop **NL/EN** rechts in de werkbalk van de editor schakelt de
hele interface om: menu's, dialogen, tooltips, bandnamen, foutmeldingen en het
titelblok van een PNG-export. De eerste keer beslist de taal van de browser. Het
ontwerp zelf verandert niet; namen van elementen zijn inhoud, geen interface.

## Tekenen

**Het landschap** heeft vijf banden: actoren, invoerkanalen, externe systemen,
het applicatielandschap en de beheerlaag. Sleep een element uit het palet links
in een band, of rechtsklik op de plaat en kies **Hier toevoegen**. Banden
vergroot je door aan hun rand te slepen.

**Domeingroepen** zetten de applicaties die bij elkaar horen in één vak. Voeg er
een toe uit het palet of het plaatmenu, geef hem een kleur, sleep applicaties
erin, leg hem apart netjes. Een groep weghalen laat zijn elementen staan.

**Containerdiagrammen.** Dubbelklik op een applicatie om het containerdiagram
eronder te openen, of er een te maken. De applicatie wordt de grens van dat
diagram en haar componenten staan erin. De tabbladen bovenin tonen het
landschap en de containerdiagrammen eronder; rechtsklik een tabblad om te
hernoemen, te dupliceren, te verwijderen of de **diagraminstellingen** te
openen.

**Zoeken.** ⌘F / Ctrl+F opent de zoeker: typ een naam, categorie, leverancier
of technologie, Enter of een klik selecteert het element en de plaat schuift
ernaartoe, zo nodig eerst naar een ander diagram. Het palet heeft zijn eigen
zoekveld, in beide talen.

**Panelen.** Sleep de rand tussen een paneel en de plaat om het te verbreden of
te versmallen, dubbelklik de rand voor de standaardbreedte, klap een paneel
met de chevrons in tot een rail. De minimapknop in de werkbalk toont of
verbergt het overzichtskaartje.

**Toetsenbord.** Tab loopt langs de elementen op de plaat, Enter selecteert het
element onder de focus en Shift+Enter voegt het toe aan de selectie. De pijltjes
verplaatsen de selectie een rasterstap, met Shift één pixel. `?` toont alle
sneltoetsen.

## Elementen

Zeven soorten: applicatie, component, extern systeem, invoerkanaal,
beheertool, actor, en de domeingroep die ze bijeenhoudt. Selecteer er een en de
**inspector** rechts toont zijn velden in drie tabbladen.

- **Algemeen.** Naam, categorie, leverancier, technologie, levenscyclus
  (gepland, live, uitfaserend, uitgefaseerd; als badge, uitgefaseerde
  elementen dimmen), of je het beheert, de omschrijving (zie *Documentatie*) en
  waar het staat.
- **Vormgeving.** Accentkleur, vorm, pictogram, pictogramgrootte.
- **Gegevens.** De **volwassenheidsaspecten** van een applicatie: per kolom van
  dit diagram beheerd, deels, geen of risico, met een notitie. De kolommen
  stel je per diagram in bij de diagraminstellingen.

**Pictogrammen.** Ruim honderd ingebouwde tekens, doorzoekbaar op naam,
categorie en trefwoord in beide talen, in twee maten: klein in de kop, groot
voorop de kaart voor een plaat die van een afstand gelezen wordt. **Upload a
logo** in de kiezer voegt een eigen SVG of PNG toe (tot 200 kB). Geüploade
logo's reizen mee in het werkbestand, nooit in het interchange-document.

**Meer tegelijk.** Selecteer meerdere elementen en de inspector biedt
levenscyclus, kleur, pictogram en domeingroep voor allemaal, elk één stap in
Ongedaan maken.

**Soort wijzigen.** Rechtsklik een element, **Soort wijzigen ▸**, en kies wat
het had moeten zijn; koppelingen, omschrijving en plaats blijven. Twee gevallen
worden geweigerd, met de reden erbij: een applicatie met een containerdiagram,
en een component dat nog aan een applicatie hangt.

Elementen horen bij het model, niet bij een diagram: één element kan op
meerdere diagrammen staan, en **Uit dit aanzicht halen** is iets anders dan
**Uit het model verwijderen**. Verwijderen vraagt eerst, en zegt hoeveel
koppelingen meegaan.

## Koppelingen

Sleep van het handvat van een element naar een ander, of rechtsklik en kies
**Verbinding starten naar…**. Een koppeling heeft een label, een protocol (wat
je maar typt: REST, EDI, Kafka), een richting die de pijlpunten bepaalt, een
kleur en een lijnstijl. Dubbelklik het label om het ter plekke te bewerken.

Lijnen worden door een echte router om elementen heen gelegd en opnieuw gelegd
als er iets verschuift. Als automatisch niet is wat je wilt:

- Sleep een **pil** midden op een been om dat been te verschuiven, sleep een
  **vierkant** om een knik te verplaatsen; de route wordt handgetekend en de
  router laat hem met rust.
- **Knik toevoegen**, **Knik verwijderen**, **Terug naar automatische route**
  in het lijnmenu.
- **Route vastzetten** houdt een lijn precies zoals hij is, ook zonder knikken.
- **Aanhechten aan ▸** kiest aan welke kant van een element elk uiteinde
  vertrekt of aankomt, of houd Alt ingedrukt terwijl je een verbinding vanaf
  een specifiek zijhandvat sleept. Een gekozen zijde is een randvoorwaarde die
  de router respecteert, geen handgetekende route.
- Sleep het label van zijn standaardplek; **Labelpositie herstellen** zet het
  terug.

## Lay-out

**Tidy** legt het diagram automatisch, met een richting (dwars, omlaag, of
groepen dwars en hun applicaties omlaag), een dichtheid, en pinnen voor wat je
met de hand hebt neergezet. **Verbindingen leggen** tekent alleen de lijnen
opnieuw en laat elk element staan; **Alles opnieuw leggen** negeert pinnen.
Een domeingroep leg je apart netjes vanuit zijn menu.

Met de hand: **uitlijnen** en **verdelen** van een selectie via de zwevende
werkbalk of het selectiemenu, een **raster** met optioneel uitlijnen, verplaatsen
met de pijltjes, **passend maken** (Shift+1) en 100 % (Shift+2).

## Documentatie

Elk element heeft een omschrijving in markdown, en die kan een hele pagina zijn.
Open hem als pagina met **Documentatie openen** in het elementmenu, de
uitklapknop naast het omschrijvingsveld in de inspector, Enter op het
geselecteerde element, of een dubbelklik op alles wat geen applicatie is.

De pagina opent om te **lezen**: het document met een inhoudsopgave, links de
andere elementen van het diagram om tussen te wisselen (een paginateken toont
wie al documentatie heeft), rechts de velden van het element zelf.
**Bewerken** zet de bron links en het resultaat ernaast, en maakt ook de velden
rechts bewerkbaar. ⌘B en ⌘I omhullen de selectie; Escape gaat eerst uit
Bewerken en dan uit de pagina. Wijzigingen worden bewaard na een korte pauze en
bij het verlaten, één stap in Ongedaan maken per pauze.

Een lege pagina kan **beginnen met het sjabloon**: een koptabel en de
gebruikelijke secties. De regel **Korte omschrijving** in die tabel is wat het
element op de plaat laat zien; zonder die regel is dat de eerste alinea.
`[[Naam]]` in de tekst wordt een koppeling naar dat element. Gewone koppelingen
openen buiten de app.

## Diagraminstellingen

Rechtsklik een diagramtabblad, **Diagraminstellingen…**.

- **Op de tekening.** Auteur, opdrachtgever en datum voor het titelblok van een
  PNG-export — leeg gelaten vallen ze terug op de standaard van het project of
  de dag van export — en of het titelblok überhaupt getekend wordt.
- **Volwassenheidskolommen.** De aspectkolommen die applicaties op dit diagram
  dragen: voeg een standaardkolom toe (platform, CI/CD, DR, beveiliging,
  monitoring, back-up, compliance, kosten), voeg een eigen kolom toe, hernoem,
  herschik, of zet de badges helemaal uit. Een kolom hernoemen bewaart elke
  status die er al tegen is vastgelegd.

## Bewaren, exporteren, delen

Drie uitgangen, voor drie doelen.

- **Het werkbestand** (`.lvarch`) is alles, en is wat je bewaart en aan iemand
  geeft die verder gaat bewerken.
- **Het interchange-document** draagt topologie en semantiek en geen geometrie
  of opmaak: een diff ervan laat zien wat er aan de architectuur veranderde,
  niet wat er op de plaat verschoof. Een ingebouwd pictogram reist mee als
  `iconType`; een geüpload logo niet. Wat deze tool in een document niet kent
  overleeft een rondreis ongewijzigd, en een document zonder pictogrammen komt
  woordelijk gelijk terug.
- **PNG-export** (de downloadknop) tekent het huidige diagram op drukformaat met
  het titelblok en de aspectlegenda. Levenscyclusbadges kun je eerst uitzetten
  voor een schone plaat. Kon een logo niet worden ingebed, dan zegt de balk
  onderin welk.

## Voorkeuren

Raster, uitlijnen op raster, levenscyclusbadges, ingeklapte panelen en hun
breedte, het overzichtskaartje, de Tidy-instellingen, de taal en het thema
worden per browser of per desktopinstallatie onthouden. Ze zijn van jou, niet
van het project: ze reizen niet mee in een bestand.

## Sneltoetsen om te kennen

| Toetsen | Doet |
|---|---|
| `?` | Alle sneltoetsen |
| ⌘F / Ctrl+F | Element zoeken |
| Enter | Documentatie van het geselecteerde element openen |
| F2 | Selectie hernoemen |
| Delete | Selectie weghalen, na navraag |
| ⌘Z, ⌘⇧Z | Ongedaan maken, opnieuw |
| ⌘C ⌘X ⌘V, ⌘D | Kopiëren, knippen, plakken, dupliceren |
| Pijltjes, ⇧Pijltjes | Verplaatsen per rasterstap, per pixel |
| Shift+1, Shift+2, `=`, `-` | Passend maken, 100 %, inzoomen, uitzoomen |
| Shift+F10 | Het menu voor de selectie |
| ⌘S / Ctrl+S | Nu bewaren |

Op Windows en Linux lees je Ctrl voor ⌘.
