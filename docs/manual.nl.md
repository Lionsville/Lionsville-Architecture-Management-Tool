# Gebruikershandleiding

De Lionsville Architecture Management Tool tekent een applicatielandschap in
Layer 7-banden en de C4-containerdiagrammen eronder. Dit is de handleiding
voor het gebruik. Wat het is en waarom het bestaat staat in de
[README](../README.md); de Engelse versie van deze handleiding is
[manual.en.md](manual.en.md).

## Beginnen

**Desktop.** Download het installatiebestand voor je platform van de
[releasepagina](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
De app kijkt op de achtergrond of daar een nieuwere versie staat en zegt het als
die er is — **Download…** opent het installatiebestand in je browser, **Skip
This Version** zegt deze niet, en het vinkje in dat venster zet de automatische
controle uit. Er installeert zichzelf niets. **Check for Updates…** in het
appmenu vraagt het op verzoek.

**Browser.** Vanuit een kloon van de repository eenmalig `npm run setup`, daarna
`npm run dev`; open <http://127.0.0.1:5200>. Waar de browser het aanbiedt —
Chromium doet dat — kan een tabblad net als de desktop in een map werken. Waar
dat niet kan, leeft alles wat je maakt in de opslag van die browser tot je een
bestand bewaart.

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
- **Verwijderen** haalt het project weg: op de desktop de map, in de browser het
  record. Een werkbestand dat je elders hebt bewaard blijft staan.

De **instellingen** van een groep bevatten haar naam, een klant, een
omschrijving en koppelingen: een wiki, een ticketwachtrij, een dashboard. De
klant is voor wie een geëxporteerd aanzicht getekend is, als dat niet gewoon de
groepsnaam is; leeg gelaten geldt de groepsnaam. Een groep hernoemen
hernoemt het label van elk project erin. Bij het starten opent de app het
project dat je open had.

## Je projectenmap (desktop)

De eerste keer dat de desktop-app start vraagt hij om een **map om in te
werken**, en alles wat je maakt staat daar als bestanden die je kunt lezen:

```
<jouw map>/
  acme-logistics/                     de groep
    group.json                        naam, klant, omschrijving en koppelingen
    warehouse-landscape/              het project
      project.json                    hoe het heet, en wat erin zit
      model.json                      de elementen en de lijnen ertussen
      diagrams/landscape.json         wat een aanzicht is
      diagrams/landscape.geometry.json     waar de elementen staan
      docs/warehouse.md               de omschrijving van een element, als tekst
      decisions/0007-one-writer.md    een besluit
      logos/own.svg                   een logo dat je hebt geüpload
```

Er zit niets verstopt in de app. Zet de map in OneDrive, in Dropbox, op een
netwerkschijf of in een git-repository en hij gedraagt zich zoals alles daar.
**Wijzigen…** op de projectlijst brengt je naar een andere map; de mappen die je
eerder gebruikte staan in **File ▸ Open Recent Folder**.

Dat je werk bestanden zijn heeft twee gevolgen.

- **Iemand anders kan ze wijzigen.** Verandert een bestand onder je handen — een
  collega, een synchronisatiedienst, jijzelf op een andere machine — dan
  verschijnt een strook boven de plaat. Staat er niets open, dan biedt hij hun
  versie aan; staan er wijzigingen open, dan zegt hij dat beide kanten zijn
  veranderd en vraagt welke blijft. Hun versie wordt nooit ongevraagd
  overschreven.
- **Alles wordt geschreven zodra het verandert.** Drie seconden nadat je stopt
  met bewerken, als je het venster verlaat, en als je het sluit. Alleen de
  bestanden die echt veranderden worden herschreven, dus één element verplaatsen
  herschrijft één klein bestand en verder niets.

Een browsertabblad kan ook in een map werken, waar de browser dat aanbiedt —
maar de toestemming overleeft een herstart zelden en erom vragen vereist een
klik, dus een tabblad pakt een onthouden map alleen weer op als de toestemming
nog geldt en begint anders zonder iets te zeggen in de browseropslag. De desktop
is degene die moet kiezen.

## Geschiedenis (desktop)

Staat er **git** op de machine, dan kan de app een geschiedenis van je map
bijhouden. **Bewaren… ▸ Momentopname…** komt met een tekst die al geschreven is
uit wat je deed — "Warehouse Management gewijzigd, 3 elementen verplaatst" — en
die je kunt aanpassen voor hij wordt vastgelegd. De eerste keer vraagt hij of
je überhaupt geschiedenis wilt bijhouden; er gaat in geen van beide gevallen
iets van je machine af.

**Bewaren… ▸ Geschiedenis…** toont elke momentopname. Kies er een en je ziet wat
er sindsdien veranderde — applicaties erbij, weg en gewijzigd, koppelingen
getekend en doorgeknipt, besluiten genomen — met de geometrie als aantal in
plaats van als lijst, want een Tidy-ronde is één zin en vierhonderd gewijzigde
regels.

**De geschiedenis van één ding.** De keuzelijst bovenaan de pagina beperkt
haar tot een aanzicht, een beschrijving of een besluit: de lijst wordt de
momentopnames die dat raakten, en de veranderingen de regels die erover gaan.
Dezelfde pagina opent al beperkt via **Geschiedenis…** in het menu van een
aanzicht-tab, op de documentatiepagina en op de pagina van een besluit.

**Terugzetten.** Met een momentopname gekozen maakt **Deze versie
terugzetten…** het aanzicht, de beschrijving of het besluit weer wat het toen
was; met het hele project in beeld doet **Het hele project terugzetten…**
hetzelfde voor alles. Terugzetten is een nieuwe wijziging bovenop alles wat
sindsdien gebeurde, geen stap terug: de geschiedenis blijft groeien, de
activiteitenlijst zegt *Aanzicht Warehouse teruggezet naar 3 sep*, ⌘Z maakt
het ongedaan, en de volgende momentopname legt het vast. De app biedt die
momentopname meteen aan. Een besluit dat aanvaard, afgewezen of vervangen is
blijft zoals het is — schrijf een nieuw besluit dat het vervangt — en een
teruggezet aanzicht laat elementen weg die niet meer bestaan, en zegt hoeveel.

**Labels.** **Label…** bij een gekozen momentopname geeft haar een eigen woord
— "Aan de directie getoond" — naast haar boodschap, nooit in plaats ervan. Een
label reist mee met de geschiedenis, zodat een collega hetzelfde merkteken op
dezelfde plek ziet, in deze app of in elke git-client. Twee labels met dezelfde
naam in één map worden geweigerd; kies een ander woord.

Zonder git biedt de app dit alles eenvoudigweg niet aan, en werkt de rest
precies zoals eerst.

## De werkruimte

Eén open project: een balk bovenin, de editor eronder.

| In de balk | Wat hij doet |
|---|---|
| **Projecten…** | Terug naar de projectlijst |
| **Instellingen…** | Naam en groep van dit project, en zijn standaarden: de auteur op een geëxporteerd diagram, en de volwassenheidskolommen waar een nieuw landschap mee begint. Een project naar een andere groep verplaatsen laat de inhoud met rust |
| **Bewaren…** | **Werkbestand** (`.lvarch`) is alles: geometrie, opmaak, eigen logo's, vastgezette routes — je projectmap in één bestand. **Interchange-document** is alleen topologie en semantiek, de vorm voor review en versiebeheer. Op de desktop biedt het menu ook **Momentopname…** en **Geschiedenis…** |
| **Openen…** | Laadt allebei, en herkent aan de inhoud van het bestand welke van de twee het is — niet aan de naam |
| **Activiteit** | Wat er sinds het openen aan dit project is veranderd — een lijst met benoemde stappen en het tijdstip van elke. Alleen lezen: ⌘Z is hoe je teruggaat |
| **Thema** | Licht, donker of systeem. Systeem volgt je computer en schakelt mee |
| **Bewaard · uu:mm** | Hoe het project ervoor staat: het tijdstip van de laatste schrijfactie, of **Nog niet bewaarde wijzigingen**, **Bezig met bewaren…**, **Gewijzigd op schijf**, **Hier én op schijf gewijzigd** |

Alles wordt vanzelf bewaard terwijl je werkt: drie seconden nadat je stopt, als
je het venster verlaat en als je het sluit — en sluiten met openstaande
wijzigingen vraagt eerst. In een browser zonder map zegt de app één keer dat de
opslag voor viervijfde vol zit — dat is de enige waarschuwing die je krijgt,
want een browser stopt zonder te vragen met bewaren. Weigert de opslag helemaal
(vol, of geblokkeerd in een privévenster) dan zegt de balk onderin dat één keer
en werkt de editor gewoon door; bewaar dan een werkbestand, want zonder opslag
is het project weg als het tabblad sluit. Elke melding (bewaard, geladen, mislukt) verschijnt in
die balk onderin.

**Taal.** De taalknop rechts in de werkbalk van de editor (hij toont de code
van de taal waarin je zit: NL, FY, DE of EN) opent een menu met de vier:
Nederlands, Frysk, Deutsch en English. Een keuze schakelt de hele interface om:
menu's, dialogen, tooltips, bandnamen, foutmeldingen en het titelblok van een
PNG-export. De eerste keer beslist de taal van de browser. Het ontwerp zelf
verandert niet; namen van elementen zijn inhoud, geen interface.

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

Op een heel druk bord — meer dan ongeveer honderdvijftig lijnen die om dezelfde
ruimte strijden — slaat het automatisch leggen over in plaats van er minuten
aan te besteden, en zegt dat in de balk onderin. Er gaat niets verloren: de
lijnen houden de routes die ze hadden, en alles wat je met de hand tekende
blijft precies zoals je het achterliet.

## Lay-out

**Tidy** legt het diagram automatisch, met een richting (dwars, omlaag, of
groepen dwars en hun applicaties omlaag), een dichtheid, en pinnen voor wat je
met de hand hebt neergezet. **Verbindingen leggen** tekent alleen de lijnen
opnieuw en laat elk element staan; **Alles opnieuw leggen** negeert pinnen.
Een domeingroep leg je apart netjes vanuit zijn menu.

Tidy werkt naast de app in plaats van erin, dus het venster blijft reageren
terwijl het loopt en de Tidy-knop is intussen een **Annuleren**. Op een diagram
van meer dan vierhonderd blokken slaat het over en zegt dat, in plaats van er
minuten over te doen: verdeel het bord over meerdere diagrammen, of leg één
domeingroep tegelijk netjes.

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

**Documentatie** in de bovenbalk opent de pagina van het geselecteerde element,
of van het eerste element op het diagram als niets geselecteerd is. Een
codeblok gemarkeerd als `mermaid` wordt op elke pagina als diagram getekend.

## Besluiten

**Besluiten** in de bovenbalk opent de architectuurbesluiten (ADR's): een boom
links, de besluiten van het gekozen knooppunt in het midden, en het besluit dat
u leest rechts. Er zijn drie niveaus. De besluiten van de **groep** gelden voor
elk project dat eronder valt en worden bij de groep bewaard. De besluiten van
de **landschappen** horen bij het project als geheel. Elke **applicatie** heeft
een eigen lijst. Een applicatie die uit het model is verdwenen houdt haar
besluiten onder *Verwijderde applicaties*.

Een besluit volgt het MADR-formaat: context en probleemstelling,
beslisfactoren, de overwogen opties, de uitkomst en haar gevolgen, de voor- en
nadelen van elke optie, meer informatie. **Nieuw besluit** vraagt de titel en
begint de tekst vanuit dat sjabloon. Titel, status, datum en besluitnemers zijn
velden boven de tekst; de tabel **beoordelaars en ondertekening** onderaan
noemt aan wie het besluit is voorgelegd, elk met een oordeel en de dag waarop
het gegeven is.

De status is een werkstroom, geen etiket. Een besluit begint als
**voorgesteld**, gaat naar **in beoordeling** en wordt dan **aanvaard** of
**afgewezen**. Die twee zijn het eindpunt: daarna kan het besluit niet meer
worden bewerkt of verwijderd, want een besluit dat achteraf herschreven kan
worden is geen vastlegging. Een aanvaard besluit kan later **vervangen**
worden; dat vraagt welk besluit het vervangt en toont de verwijzing in beide
richtingen. Een beoordeling kan terug naar voorgesteld.

Het zoekveld boven de lijst doorzoekt alle besluiten in de boom tegelijk —
titel, tekst en beoordelaars. De tekst is markdown, met dezelfde
`[[Naam]]`-verwijzingen als documentatie; **Hulp bij opmaak** naast de bron
toont de syntaxis, mermaid-diagrammen inbegrepen. Wijzigingen worden met het
project bewaard, of met de groep voor de besluiten van de groep.

## Tijd, en de dag die een bord toont

Elke applicatie kan **levenscyclusdatums** dragen naast haar levenscyclus: de dag
dat zij live gaat, de dag dat het uitfaseren begint, de dag dat zij weg is. Alle
drie zijn optioneel, en een applicatie zonder datums gedraagt zich precies zoals
altijd. Waar een datum verstreken is wint die van de opgeslagen levenscyclus: een
landschap dat drie jaar na de livegang nog "gepland" zegt, is een landschap dat
niemand heeft bijgewerkt.

Een koppeling kan een eigen **venster** dragen, *geldig vanaf* en *geldig tot*.
Vrijwel geen enkele heeft er een nodig: een lijn zonder venster bestaat zolang
beide uiteinden bestaan. De lijnen die er wél een nodig hebben zijn de tijdelijke
— een sync, een routeringsfaçade, een dubbele schrijfactie — en dat is precies de
hybride fase van een vervanging.

**Toont** op de diagrambalk zegt welke dag het bord tekent. Er staat *Vandaag*
tot u een dag kiest; daarna staat die dag er, opgelicht, zodat een bord met 2028
er niet uitziet als een bord van nu. Elke kaart tekent de fase waarin zij op die
dag verkeert, en een lijn met een venster verschijnt alleen daarbinnen. De dag
wijzigen is een gewone bewerking: één regel in Activiteit, en ⌘Z draait hem terug.

Zo maakt u een toekomstig diagram. Klik met rechts op een tab, kies **Dupliceren
per datum…**, kies een dag, en u heeft een tweede bord van hetzelfde landschap
zoals het er dan bij staat. Er is maar één model, dus de twee kunnen niet uit
elkaar lopen. Een geëxporteerde PNG van een gedateerd bord noemt de dag in de
titel.

**Vervangen door** benoemt de opvolger van een applicatie, en **Eigenaar** zegt
wie ervoor tekent. Eigenaar was een regel in het documentatiesjabloon; het is nu
een veld, zodat de controles van de roadmap een persoon kunnen noemen.

## De roadmap

**Roadmap** in de bovenbalk opent het landschap op een tijdas. Alleen wat een
datum heeft krijgt een regel, dus een landschap van vierduizend applicaties met
negen datums is een roadmap van een paar regels — de rest staat op het canvas,
waar het thuishoort. Elke regel is een reeks gekleurde stukken: gepland, live,
uitfaserend, weg. Een streep door elke regel markeert vandaag, en een tweede de
dag die het bord achter de pagina toont.

De schuifbalk bovenaan verplaatst dat bord. Sleep hem en het canvas erachter
volgt, zodat de tekening en de as het niet oneens kunnen zijn over welke dag
wordt besproken.

### Plannen

Een **plan** is hoe een verandering van het landschap wordt vastgelegd: een titel,
een status, het venster waarin het loopt, wie het bezit, de applicaties die het
invoert, uitfaseert of wijzigt, de besluiten waarop het steunt, de mijlpalen, en
een tekst in markdown. Plannen verschijnen als banden onder de applicaties op de
as, met een teken per mijlpaal. Kies er een en hij opent rechts.

Een plan loopt **concept → akkoord → loopt → gereed**, en kan vanuit elk daarvan
worden gestaakt. Anders dan bij een besluit kan elke stap terug, en een afgerond
plan blijft bewerkbaar: een besluit legt een moment vast, een plan beschrijft
werk. Wat het plan vorige maand zei staat in de historie van de map.

**Verschuiven…** verplaatst een plan met een aantal dagen — het venster, elke
mijlpaal, en de levenscyclusdatums van de applicaties die het invoert en
uitfaseert — in één stap, want een plan dat uitloopt is één ding dat gebeurde.

Elk plan is één markdownbestand in `transitions/` in uw projectmap, genummerd
vanaf `TR-0001`.

### De business case

De tekst van een plan kan een **business case** bevatten: een blok waarvan de
invoer een leesbare kasstroomtabel is, met de uitkomsten eronder uitgerekend.

````markdown
```business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
```
````

Een negatief getal is geld eruit, een positief geld erin, en een lege cel is nul.
Daaronder berekent de app de netto en cumulatieve kasstroom, de netto contante
waarde bij het opgegeven percentage, de interne rentabiliteit, de terugverdientijd
in perioden, het rendement op de investering en de baten-kostenverhouding. Uw
tabel wordt nooit herschreven.

Een tweede tabel, `Criterion | Weight | Score`, geeft een gewogen score voor het
deel dat geen geld is — beoordeeld van één tot vijf, van een maximum dat de app
zelf afleidt in plaats van dat u het intypt. Alles daarbuiten hoort in een
besluit, met de afwegingen en de opties die u tegen elkaar hebt gezet.

**Business case toevoegen** in het bewerkvenster zet een leeg blok bij de cursor.

### Waarover de datums het oneens zijn

Onder de as staat een lijst met tegenstrijdigheden: een applicatie die uitfaseert
terwijl er nog koppelingen live zijn, een opvolger die pas komt nadat wat hij
vervangt weg is, een uitfasering zonder benoemde opvolger, een koppeling die nog
geldig is nadat een van haar uiteinden is uitgefaseerd, en een plan dat over zijn
einddatum heen is.

Het toont waar de datums elkaar tegenspreken. Het kan niet zien of een landschap
verouderd is — dat kan niets — en de pagina zegt dat onder de lijst.

## De bedrijfsarchitectuur

**+** bij de diagramtabs, dan **Bedrijfsarchitectuur**, maakt een **blad**: de
laag boven de applicaties, op één pagina. Een landschap zegt wat er draait en wat
met wat praat. Een blad zegt wat de organisatie doet, voor wie ze het doet, en
hoeveel ervan door software wordt ingevuld.

Een blad wordt *gelegd*, niet getekend. Er valt niets te slepen en er is geen
router: wat het toont zijn vier bomen — een klantreis, de gebieden eronder, de
capabilities daarbinnen, en de belanghebbenden langs de zijkant — en de pagina
wordt berekend uit hun volgorde en hun diepte. Het krijgt een tab naast de
borden, en het openen laat het canvas staan waar het stond, zodat de tekening
waaraan u werkte er nog is als u terugkomt.

![Het bedrijfsarchitectuurblad: belanghebbenden in de kantlijn, de klantreis bovenaan met een rij per baan, en de gebieden met hun capabilities en hoe elk wordt ondersteund](screenshot-sheet.png)

### De klantreis, en de paden erdoorheen

Bovenaan loopt één **klantreis**: wat de organisatie doet, van begin tot eind. De
fasen zijn de kolommen, van links naar rechts te lezen, en onder elke fase staan
de stappen die erin gezet worden.

Eén klantreis is zelden één pad. Een stap kan een **rijstrook** noemen — de
belanghebbende wiens eigen pad het is — en het blad tekent een rij per strook
onder dezelfde fasen, het gemeenschappelijke pad eerst. Waar een strook aftakt en
waar hij weer aansluit staat nergens vastgelegd: het is de eerste en de laatste
fase waarin de strook een eigen stap heeft. Een fase binnen dat bereik waarin hij
er geen heeft wordt getekend als *zoals de rij hierboven*; daarbuiten wordt de
strook helemaal niet getekend. Niets kan het oneens zijn over waar een pad
weggaat en terugkomt, omdat niets anders dan de stappen het zegt.

Een stap die iemand buiten de organisatie zet — een partner die een order
afhandelt — wordt gemarkeerd als buiten de organisatie gedaan, zodat de pagina
kan zeggen dat een fase door niemand binnen wordt gedekt.

### Gebieden, en wat ze invult

Onder de klantreis staan de **gebieden**, elk met hun groeperingen en de
capabilities daarbinnen. De diepte is wat getekend wordt, en het model kent de
woorden niet: een item bovenaan is een gebied, een item daarin een groepering, en
een item daarin weer een capability.

Elke capability zegt wie hem invult:

- **een applicatie**, of meerdere — wat hem ondersteunt. Een capability met er
  twee waarvan er één uitfaseert is een migratie die u kunt zien.
- **mensen** — niemands software, iemands werk. Een volledig antwoord en geen
  gat: een pagina die dit als probleem tekende zou u aanraden software te kopen
  voor wat u met de hand doet.
- **nog niets** — geen van beide, en dát is het gat waarvoor je de pagina tekent.

Die staan in het model en niet op het kaartje: een capability is ingevuld omdat
iets in het landschap hem ondersteunt. **Ondersteund door…** in het paneel is
hoe die regel geschreven wordt, en zo'n ondersteuning kan een venster dragen
zoals alles met een datum, dus een capability die vanaf maart is ingevuld is
vanaf maart ingevuld.

Onderaan staat een band voor wat **nog niet aan een domein is toegewezen** — de
gebieden die nog aan niemand zijn gegeven. Dat is een bevinding, geen fout: een
lijst van wat de organisatie gezegd heeft te doen en nog niet gezegd heeft wie
het doet.

### Er een maken

Een blad op een project met niets boven de applicaties is leeg, en die lege
pagina biedt de twee plekken om te beginnen: **Nieuwe klantreis** en **Nieuw
gebied**. De rest is telkens een **+** op de plek waar het ding komt, en ze
werken allemaal hetzelfde — wat u maakt verschijnt, is gekozen, en de cursor
staat in de naam, dus u typt over wat het heette en drukt op Enter.

- **Nieuwe klantreis** maakt de klantreis én de eerste fase, *Begin*, en laat
  dit blad hem tekenen; een band die een kop is met niets eronder is niet wat u
  vroeg.
- **+ fase**, aan het eind van de faserij, zet er een kolom achteraan.
- **+ stap**, in elke cel, zet een stap in die fase op het pad van die rij.
- **+ baan…**, onder de laatste rij, vraagt wiens pad het is — een
  belanghebbende die u al hebt, of een naam die u typt, met de aantekening
  buiten de organisatie als dat zo is — en bij welke fase hij splitst, want een
  baan wordt getekend waar zijn stappen staan en een baan zonder stappen wordt
  niet getekend.
- **+ gebied**, na het laatste gebied, maakt er een en tekent hem vanaf dat
  moment op dit blad.
- **+ groep** en **+ capability** binnen een gebied, en **+ capability** binnen
  een groep. Een capability die rechtstreeks in een gebied gemaakt wordt is een
  kaartje in de kolom, en wordt een groep zodra er iets in gezet wordt.
- **+ belanghebbende**, naast een regel op de rail, zet er een onder; **+
  groep**, onderaan de rail, begint een eigen tak.

**Ondersteund door…** en **Gedaan door…** in het paneel zijn hoe een capability
ingevuld raakt: vink een applicatie aan en die ondersteunt hem, vink een team
aan en het is van hen. Elk vinkje is een eigen stap, en de regel onder de naam
van de capability verandert mee.

**Verwijderen**, onderaan het paneel, haalt weg wat gekozen is en elke regel die
erop uitkwam. Het wordt geweigerd zolang er iets in zit, met hoeveel erbij: er
cascadeert niets, dus een gebied dat u verwijdert is een gebied dat u eerst
leeggemaakt hebt.

**Wat dit blad tekent**, de schuifjes in de bovenbalk, gaat over het blad en
niet over het model — welke klantreis bovenaan loopt (een project met twee
klantreizen begint met geen van beide), welke gebieden getekend worden en in
welke volgorde, de volgorde van de banen, en of de rail er staat.

### Er een bewerken

Kies iets op de pagina en het opent rechts: de naam, de beschrijving, waar het
onder valt, waar het tussen zijn buren staat, wiens pad een stap is, of een
belanghebbende van buiten de organisatie is, en de levenscyclus van een
capability — een capability die gebouwd wordt is in dezelfde fase als een
applicatie die gebouwd wordt. Iets onder iets anders hangen wordt geweigerd als
het daarmee in zichzelf zou komen te zitten; die weigering staat in de lijst en
wordt er niet uit weggelaten. Het oog in de bovenbalk verbergt de
belanghebbenden.

Een applicatie openen vanuit de invulling van een capability brengt u naar een
bord dat hem ook echt tekent — desnoods een ander dan waar u stond — en naar de
eigen pagina van de applicatie als geen enkel bord hem tekent.

## Zoeken

**Zoeken** in de bovenbalk, of ⌘K, doorzoekt het hele project in één keer:
elementen op naam, categorie, leverancier en technologie; documentatie op wat
erin geschreven staat; en besluiten op alle drie de niveaus, die van de groep
inbegrepen. Een element kiezen selecteert het en schuift ernaartoe, een
documentatietreffer opent de pagina van dat element, en een besluit opent de
vastlegging. ⌘F in de editor blijft de snelle zoeker als u alleen een blok op
het canvas zoekt.

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

- **Het werkbestand** (`.lvarch`) is alles, en is wat je aan iemand geeft die
  verder gaat bewerken. Het is je projectmap in één bestand — een zip — zodat
  iedereen het kan uitpakken en lezen zonder deze tool. Werkbestanden van
  eerdere versies openen gewoon.
- **Het interchange-document** draagt topologie en semantiek en geen geometrie
  of opmaak: een diff ervan laat zien wat er aan de architectuur veranderde,
  niet wat er op de plaat verschoof. Een ingebouwd pictogram reist mee als
  `iconType`; een geüpload logo niet. Wat deze tool in een document niet kent
  overleeft een rondreis ongewijzigd, en een document zonder pictogrammen komt
  woordelijk gelijk terug.
- **PNG-export** (de downloadknop) opent een dialoog met een voorbeeld van de
  plaat zoals die vertrekt: in het lichte of het donkere thema, los van wat er
  op het scherm staat, met elk lijnlabel of alleen de kale lijnen, met of
  zonder het titelblok onderaan — klant, auteur en datum — en met of zonder de
  legenda eronder, die zegt wat de badge- en levenscycluskleuren betekenen. De
  export van een containerdiagram draagt zijn C4-hoek in de strook: het niveau,
  de applicatie, een zin en de datum. Levenscyclusbadges kun je eerst uitzetten
  voor een schone plaat. Kon een logo niet worden ingebed, dan zegt de balk
  onderin welk. Een heel groot bord is tientallen megapixels en kost tijd om te
  tekenen, dus de dialoog zegt hoe groot de afbeelding wordt en de knop vraagt
  het eerst.

## Voorkeuren

Raster, uitlijnen op raster, levenscyclusbadges, ingeklapte panelen en hun
breedte, het overzichtskaartje, de Tidy-instellingen, de taal en het thema
worden per browser of per desktopinstallatie onthouden. Ze zijn van jou, niet
van het project: ze reizen niet mee in een bestand.

## Ongedaan maken

**⌘Z** dekt alles, in de volgorde waarin je het deed: een blok verplaatst, een
diagram hernoemd, een besluit aanvaard, een projectinstelling gewist. Een naam
typen is één stap in plaats van één per letter, en een sleep met de lijnen die
erna opnieuw worden gelegd is één stap — dus één keer terug geeft je wat je had,
niet wat je een toetsaanslag geleden had.

**Activiteit** in de bovenbalk toont die stappen met hun naam en tijd. Het is
een verslag, geen weg terug: naar een regel springen roept een vraag op ("en
alles daarna?") die ⌘Z al beantwoordt.

## Sneltoetsen om te kennen

| Toetsen | Doet |
|---|---|
| `?` | Alle sneltoetsen |
| ⌘F / Ctrl+F | Element zoeken |
| Enter | Documentatie van het geselecteerde element openen |
| F2 | Selectie hernoemen |
| Delete | Selectie weghalen, na navraag |
| ⌘Z, ⌘⇧Z | Ongedaan maken, opnieuw — één stapel over alles |
| ⌘C ⌘X ⌘V, ⌘D | Kopiëren, knippen, plakken, dupliceren |
| Pijltjes, ⇧Pijltjes | Verplaatsen per rasterstap, per pixel |
| Shift+1, Shift+2, `=`, `-` | Passend maken, 100 %, inzoomen, uitzoomen |
| Shift+F10 | Het menu voor de selectie |
| ⌘S / Ctrl+S | Nu bewaren |

Op Windows en Linux lees je Ctrl voor ⌘.
