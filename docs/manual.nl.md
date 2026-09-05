<!--
  BEWAARD ALS BRONMATERIAAL — dit was README.md tot 5 september 2026.

  De gebruikershandleiding verhuist naar de tool zelf:
  in de taal van de lezer, met de taalknop mee. Tot dat zover is staat de
  Nederlandse tekst hier, zodat hij niet verloren gaat. Hij is op onderdelen
  verouderd — `src/main.tsx` is een compositiewortel van 137 regels, het
  "meegeleverde document" bestaat niet meer, en het werkbestand heet vanaf
  fase 5 `.lvarch`. De ontwikkelaarsdocumentatie staat in README.md, in het
  Engels.
-->

# Editor

De Lionsville solution-design editor als op zichzelf staande app: het Layer
7-applicatielandschap en de C4 containerdiagrammen, volledig te bewerken,
zonder backend en zonder verwijzingen buiten deze map. Het editorpakket zelf
ligt in `vendor/solution-design`.

Licentie: zie `LICENTIE.md` — gebruiksrecht voor NS voor de duur van het
programma, het intellectueel eigendom blijft bij Lionsville Group BV.

## Draaien

Nodig: Node 20 of nieuwer. Eenmalig is er internet nodig voor `npm install`;
daarna draait alles lokaal.

```
npm install
npm run dev
```

en open http://127.0.0.1:5200.

## Hoe het werkt

Het model leeft in de browser en wordt automatisch bewaard (localStorage).
De balk bovenin:

| Knop | Wat hij doet |
|---|---|
| **Bewaren…** | Eén menu met de twee bewaarvormen. **Werkbestand** staat bovenaan: alles inclusief geometrie, opmaak en eigen logo's, om later verder te werken. **Interchange-document** eronder, met erbij wat het niet draagt: topologie en semantiek, zonder geometrie en opmaak — de vorm voor review en versiebeheer |
| **Openen…** | Laadt een interchange-document of een werkbestand. Een interchange-document wordt opnieuw gelegd, een werkbestand komt terug zoals het was |
| **Meegeleverd document** | Terug naar `src/ns-design.json` |
| **☀ / ☾ / ◑** | Licht, donker of *systeem* — de knop gaat rond langs de drie. *Systeem* volgt de instelling van je computer en schakelt dus vanzelf mee |

Rechts van de knoppen staat **Bewaard · hh:mm**: het moment waarop de browser
dit ontwerp voor het laatst aannam. Weigert de opslag — vol, of geblokkeerd in
privémodus — dan zegt de balk onderin dat één keer, en blijft de editor gewoon
werken; bewaar dan een werkbestand, want zonder browseropslag is het bij het
sluiten van het tabblad weg. Alle meldingen (bewaard, geladen, mislukt) komen
in die balk onderin en niet meer als grijze tekst in de kop.

**Voorkeuren blijven staan.** Raster, uitlijnen op raster, levenscyclusbadges,
ingeklapte panelen, de breedte van beide panelen, het overzichtskaartje, de
Tidy-instellingen, de taal en het thema worden in deze browser bewaard onder één
eigen sleutel. Ze horen bij jou en niet bij het document: ze reizen niet mee in
een bestand en ze verdwijnen niet met *Meegeleverd document*.

**Taalkeuze.** De hele editor spreekt Nederlands én Engels. De knop **NL/EN**
rechts in de werkbalk van de editor wisselt; de eerste keer kiest de browsertaal
(begint die met `nl`, dan Nederlands, anders Engels). De keuze geldt voor alles:
menu's, dialogen, tooltips, de bandnamen op de plaat, de foutmeldingen én het
titelblok van de PNG-export. Het document zelf verandert niet — namen van
elementen zijn inhoud, geen interface.

**Donker thema.** De themaknop in de balk bovenin schakelt tussen licht, donker
en systeem. De plaat, de panelen en de schil volgen alle drie; de PNG-export
houdt bewust zijn vaste zwart-op-wit titelblok, want die plaat belandt in een
document.

**Zoeken (⌘F / Ctrl+F).** Typ een naam, categorie, leverancier of technologie:
de lijst toont wat past, Enter of een klik selecteert het element en de plaat
schuift ernaartoe — staat het op een ander aanzicht, dan gaat de editor daar
eerst heen. Het palet links heeft zijn eigen zoekveld, dat zowel op de
Nederlandse als op de Engelse woorden zoekt.

**Panelen op maat.** Tussen elk paneel en de plaat zit een sleeprand: sleep hem
om het paneel breder of smaller te maken, dubbelklik om terug te gaan naar de
standaardbreedte. Met het toetsenbord kan het ook — tab naar de rand en gebruik
de pijltjes (Shift maakt de stap groter). De chevrons klappen een paneel nog
steeds helemaal in.

**Overzichtskaartje.** De knop met het kaartje in de werkbalk zet het
minimap-hoekje aan of uit; het staat standaard uit, want op een plaat die het
scherm al vult is het vooral verloren ruimte.

**Toetsenbord.** Tab loopt langs de elementen op de plaat met een duidelijke
focusring (een andere kleur dan de selectie), Enter selecteert het element onder
de focus en Shift+Enter voegt het toe aan de selectie. De pijltjes verplaatsen
de selectie met een rasterstap (Shift: één pixel). Sneltoetsen werken nu overal
in de editor — ook met de cursor op een knop in het paneel rechts; alleen in een
tekstveld houdt het typen zijn eigen toetsen. `?` toont de volledige lijst.

In de editor zelf: slepen vanuit het palet links, detail in het paneel
rechts, dubbelklik op een applicatie opent (of maakt) haar containerdiagram,
de knop Tidy legt de plaat opnieuw, en de PNG-knop exporteert de plaat met
titelblok. Dubbelklik op een koppelvlak legt een routepunt neer.

**Lijnen.** Elke geselecteerde lijn toont handvatten: vierkantjes op de
knikpunten en pilletjes midden op elk been. Sleep een pil om dat been te
verschuiven (de lijn blijft haaks), sleep een vierkant om een knik te
verplaatsen. De eerste handbewerking maakt de route *handgetekend*; de router
laat hem dan met rust tot je hem in het paneel rechts (sectie Route) of in het
rechtermuismenu weer op automatisch zet. **Aanhechtzijde:** kies per uiteinde
aan welke kant van het element de lijn vertrekt of aankomt — *Leaves from* /
*Arrives at* in het paneel, of **Attach at ▸** in het lijnmenu — of houd Alt
(Option) ingedrukt terwijl je een verbinding vanaf een specifiek zijhandvat
sleept. De router respecteert die keuze bij elke nieuwe legging; *Automatic*
geeft hem de vrije keuze terug. Een gekozen zijde alleen maakt een route niet
handgetekend.

**Meerdere tegelijk.** Selecteer meer dan één element en het paneel rechts
krijgt onder *Op alles toepassen* vier knoppen: levenscyclus, accentkleur,
pictogram en domeingroep. Elke wijziging is één stap in Ongedaan maken over de
hele selectie. De velden staan er leeg bij en tonen geen huidige waarde: bij een
gemengde selectie ís er geen huidige waarde, en een veld dat er een liet zien
zou lezen als een formulier in plaats van een schakelaar.

**Soort wijzigen.** Rechtsklik een element → **Soort wijzigen ▸** en kies wat het
had moeten zijn; de koppelingen, de omschrijving en de plaats blijven. Twee
gevallen worden geweigerd, met de reden erbij: een applicatie waar een
containeraanzicht over gaat (verwijder dat aanzicht eerst) en een component dat
nog aan een applicatie hangt (maak het eerst los). Het element verhuist zo nodig
naar de band die bij de nieuwe soort hoort en een handmatig gezette maat wordt
bijgeknipt tot wat daar past.

**Rechtermuismenu.** Rechtsklikken werkt overal: op een element, een lijn of
een knikpunt, de lege plaat, een selectie van meerdere elementen, een
domeingroep en een diagramtabblad. Shift+F10 opent het menu voor de huidige
selectie.

**Verwijderen vraagt na.** Een lijn weghalen en een selectie van meerdere
dingen weghalen gingen zonder een woord; nu komt er eerst een venster dat zegt
hoeveel er weggaat — inclusief de lijnen die niemand selecteerde maar die met
een element meegaan. Eén element houdt zijn eigen, betere vraag (*uit dit
aanzicht* of *uit het model*), en een groepsvak weghalen vraagt niets: de
elementen erin blijven. Undo werkt in alle gevallen.

**Aanzichten.** Rechtsklik een tabblad om een landschap te hernoemen, te
dupliceren of te verwijderen. Haal je een applicatie uit het model, dan gaat
haar containeraanzicht mee — een tab met de naam van iets dat niet meer bestaat
is erger dan geen tab — en de balk onderin zegt dat.

## De twee bewaarvormen

Het interchange-document draagt bewust geen geometrie en geen opmaak: **het
document draagt de topologie en de semantiek, het gereedschap bezit de
geometrie.** Kleuren, lijnstijlen, eigen logo's en de ligging van de plaat
reizen alleen mee in het werkbestand. Eén uitzondering: de keuze van een
*ingebouwd* icoon gaat wel mee, als `iconType` — zie hieronder. Wie een plaat met de hand heeft geschikt en dat
zo wil houden, bewaart dus het werkbestand; wie de inhoud wil reviewen of
versioneren, bewaart het interchange-document.

Nieuwe elementen krijgen bij de eerste bewerking een blijvende, leesbare
sleutel op basis van hun naam; die sleutel verandert daarna niet meer, ook
niet bij hernoemen. Wat het brondocument droeg komt bij een export ongewijzigd
terug — beschrijving, adrLinks, en welke elementen hun levenscyclus expliciet
noemden — al kan de eerste export de veldvolgorde binnen een element een keer
normaliseren.

## Delen

`./inpakken.sh` maakt `../NS-solution-design-editor.zip` met alleen de bron:
zonder `node_modules/`, `dist/` en `public/` (samen ruim 100 MB
build-artefacten die de ontvanger met `npm install` zelf en passend bij het
eigen platform terugkrijgt).

## Iconen

Elk element kan een icoon dragen. De kiezer zit op drie plekken — het paneel
links (voordat je plaatst), de inspector rechts (tabblad Vormgeving) en het
rechtermuismenu op een element (**Icoon…**) — en het is overal dezelfde
zoekbare rasterkiezer. Zoeken gaat op naam, op categorie en op trefwoorden, ook
de Nederlandse: *materieel*, *perron*, *dienstregeling*, *sein*, *wissel*,
*meldkamer*, *reisinformatie*, *ov-chipkaart*. Twee maten: klein (in de kop,
zoals altijd) en groot (28 px, voorop in de kaart) voor een plaat die van een
afstand gelezen wordt.

Het pakket levert ruim honderd ingebouwde tekens: eigen, algemene
categorietekens (data, integratie, applicaties, platform, beveiliging en
beheer), een spoorset, en echte merktekens uit het CC0-pakket `simple-icons`.
Ze zijn allemaal eenkleurig en nemen de kleur van het element over, dus ze
werken in beide thema's.

**Eigen logo's** kun je toevoegen via de tegel **Upload a logo** in de kiezer:
SVG of PNG, maximaal 200 kB. Ze worden als data-URL bewaard in deze browser en
in het werkbestand — niet in het interchange-document (zie hieronder) — en ze
komen in volle kleur op de plaat, met op een donker thema een licht plaatje
eronder zodat een donker merkteken niet wegvalt.

## Interchange: iconType

Een element mag in het interchange-document een `iconType` dragen: de sleutel
van een **ingebouwd** icoon (`"database"`, `"vendor-sap"`, `"rail-train"`, …).
Optioneel; afwezig betekent geen icoon.

- **Lezen** is ruim: een sleutel die dit gereedschap niet kent blijft staan en
  komt bij een export terug, zodat een document uit een ander of nieuwer
  gereedschap zijn iconen niet kwijt is. Het element valt ondertussen terug op
  de glief van zijn soort.
- **Schrijven** is streng: een ingebouwde sleutel gaat erin, een sleutel die de
  bron droeg gaat erin, en een geüploade (`lib:`) sleutel nooit. Een data-URL in
  iemands browser is geen topologie en geen semantiek, en een reviewer van het
  document kan hem niet oplossen. Eigen logo's reizen daarom mee in het
  werkbestand.
- Een document dat geen iconen gebruikt blijft na een export woordelijk gelijk.

Het werkbestand staat sinds deze wijziging op `version: 2`, met één veld erbij:
`logoLibrary`. Een v1-bestand laadt onveranderd en komt terug zonder eigen
logo's.

## Wat hier bewust niet in zit

- **De parameter- en kostenkant** van het model (parameters, kostenchips)
  staat uit; dit landschap gebruikt haar niet.
- **Koppelingen naar andere systemen**: de editor is host-agnostisch en deze
  schil levert er geen. De logo-bibliotheek is er wél — die zit in deze schil
  (`src/logoLibrary.ts`) en niet in een backend.

## Bestanden

| Bestand | Wat het is |
|---|---|
| `vendor/solution-design/` | Het editorpakket, broncode en tests |
| `src/main.tsx` | De schil: model in de browser, bewaren, openen |
| `src/hostModel.ts` | Het rekenwerk van de schil: een batch her-sleutelen en toepassen |
| `src/fromInterchange.ts` | interchange-document → editormodel |
| `src/toInterchange.ts` | editormodel → interchange-document |
| `src/ns-design.json` | Het meegeleverde document |
| `src/keys.ts` | Sleutelregels, gedeeld door schil en export |
| `src/logoLibrary.ts` | Eigen logo's inlezen: formaat, grens, sleutel |
| `src/preferences.ts` | De voorkeuren van de editor in de browseropslag |
| `bijwerken.sh` | Genereert `src/ns-design.json` uit de bron — alleen zinvol in de werkmap |
| `inpakken.sh` | Maakt de deelbare zip, zonder build-artefacten |
| `LICENTIE.md` | Het gebruiksrecht |

`npm test` draait beide testsuites: eerst die van de schil (`src/*.test.ts`,
Vitest met `vitest.config.ts`), daarna die van het pakket via
`npm run test:package` (installeert eenmalig de testafhankelijkheden van het
pakket zelf).
