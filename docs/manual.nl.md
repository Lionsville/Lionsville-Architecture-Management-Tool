# Gebruikershandleiding

Lionsville Architect tekent een applicatielandschap in Layer 7-banden en de
C4-containerdiagrammen eronder. Dit is de handleiding voor het gebruik. Wat het is en waarom het bestaat staat in de
[README](../README.md); deze handleiding is er ook in het
[Engels](manual.en.md) en het [Duits](manual.de.md).

## Beginnen

**Desktop.** Download de app voor je platform van
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download).
De app kijkt op de achtergrond of er een nieuwere versie is en vraagt eerst
voordat hij er iets mee doet — **Download and Install** haalt hem op
terwijl je doorwerkt, **Skip This Version** zegt deze niet, en het vinkje in
dat venster zet de automatische controle uit. Is de download klaar, dan vraagt
de app je opnieuw te starten; **Later** installeert hem de volgende keer dat je
de app afsluit. Waar de app zichzelf niet kan vervangen — rechtstreeks gestart
vanaf de schijfkopie, of vanuit Downloads zonder naar Programma's verplaatst te
zijn — zegt hij dat en opent hij in plaats daarvan de downloadpagina.
**Check for Updates…** in het Help-menu vraagt het op verzoek.

**De menu's** op de desktop zijn voorlopig Engels. **File** bevat de map, het
werkbestand, momentopnamen en geschiedenis; de items over het geopende
onderdeel — Save — is grijs zolang er niets open is; Open… en Save a Copy of
the Working File… gaan over de hele organisatie en werken vanaf elk scherm. **Edit** bevat Undo, Redo, Delete en Select All, die werken
op de eigen ongedaan-maak-stapel van de app en op het canvas, naast Cut, Copy
en Paste. **Help** bevat deze handleiding, in de taal van de app, de
sneltoetsen en de updatecontrole.

**Browser.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/)
is de nieuwste release, zonder iets te installeren. Je kunt hem ook draaien
vanuit een kloon van de repository: eenmalig `npm run setup`, daarna
`npm run dev`, en open <http://127.0.0.1:5200>. Waar de browser het aanbiedt
(Chromium doet dat), kan een tabblad net als de desktop in een map werken.
Anders wordt je werk in die browser bewaard; een privévenster houdt het maar
zo lang als de browser dat doet. *Waar je werk wordt bewaard* zegt meer.

In beide gevallen verlaat niets je computer. Er is geen account, geen backend
en geen telemetrie.

## Het organisatiescherm

De app opent op de **organisatie**: een onderdeel als elk ander, en het
onderdeel waaronder al het andere valt dat je bewaart. Een **onderdeel** is één document:
een naam, een landschap, de containerdiagrammen eronder, de besluiten, de
plannen, de bedrijfsarchitectuur en alles wat erop staat. Onderdelen
**nestelen**, en ze zijn allemaal hetzelfde document — de organisatie bovenaan,
een **domein** of een **team** eronder, een **landschapsscope** daar weer
onder, zo diep als je werk vraagt. Een landschapsscope is een onderdeel; een
landschap is ook een soort bord, en dat is een tekening binnen een onderdeel.

![Het organisatiescherm: de naam en koppelingen bovenaan, de eigen pagina's van de organisatie als kaarten, de scopes daarbinnen, en de voorbeelden onderaan](screenshot-organisation.png)

Het scherm is het thuis van de organisatie en geen lijst met documenten. Een
regel onder de naam zegt wat het is en waar alles staat: als bestanden in de
map, in deze browser, of nog nergens. Daarna bestaat het uit vijf delen.

**Wie het is**, bovenaan: de naam, de klant als de tekeningen voor iemand anders
gemaakt zijn, hoeveel scopes eronder vallen naar wat elk zegt te zijn
(*2 domeinen · 1 team*, in de woorden van de labels op hun regels), wanneer er voor
het laatst iets veranderde, de omschrijving en de koppelingen. Een organisatie
die nog geen naam heeft vraagt er hier om in plaats van een lege kop te tonen;
een map heet zoals de map zelf tot je haar een naam geeft.

**De eigen pagina's**, als kaarten. Elke kaart zegt in één zin wat er achter
**Openen** zit, en telt dan: **Bedrijfsarchitectuur** de klantreizen, gebieden,
functies en belanghebbenden die de organisatie zelf heeft, en hoeveel functies
nog aan geen enkel domein zijn toegewezen; **Besluiten** de vastleggingen per
status, met de nieuwste erbij; **Roadmap** de plannen, en het eerste waarover
hun datums het oneens zijn; **Register** elke applicatie in de hele map,
hoeveel er door een domein worden beheerd en hoeveel van iemand anders zijn;
**Technologie** elke platformdienst en elk platform, en hoeveel er gedeeld
zijn. Een onderdeel dat tekent heeft ook een kaart **Documentatie**. Elke kaart
opent wat hij telt; als je de pagina sluit ben je weer hier.

**Vraagt aandacht**, onder de kaarten, zodra er iets is om naar te kijken: één
zin per ding waarin de organisatie zichzelf tegenspreekt — een naam die twee
onderdelen allebei definiëren, een verouderde kopie, een applicatie waarvan
niemand heeft gezegd van wie ze is, een dienst die over een teamgrens wordt
gebruikt zonder als gedeeld gemarkeerd te zijn, een dienst die geen enkel
platform levert. Elke zin is een knop die het onderdeel opent waar het over
gaat, met het record geselecteerd, zodat de plek om het te herstellen één klik
verder is. De rest van *Eén naam in de hele organisatie* hieronder zegt wat
elk betekent.

**Scopes binnen** de organisatie, eronder: één regel per onderdeel, de
kinderen ingesprongen, met een pijltje om een domein dicht te klappen, en een
label met wat het onderdeel zegt te zijn. Een regel zegt hoeveel erin zit —
scopes met borden en diagrammen over de hele tak voor een domein, diagrammen
voor een onderdeel waar niets onder valt — en wanneer het laatst iets
veranderde.
**Volgorde** sorteert op naam of op wat je het laatst hebt gewijzigd. Een
organisatie waar nog niets bij is ondergebracht zegt dat in één zin. Een
onderdeel dat tekent toont boven de boom zijn **Borden**, één regel elk, en
**Nieuw bord…** biedt dezelfde soorten als het `+`-tabblad van de editor: een
landschap, een bedrijfsarchitectuur, een enterprisekaart of een
technologielandschap.

- **Openen** op een regel gaat naar het thuis van dat onderdeel: zijn eigen
  kaarten, zijn borden, en de scopes daarbinnen, elk met een eigen regel. Een
  bord open je vanaf zijn regel onder **Borden**.
- **Nieuw domein of team…**, één keer, bovenaan de sectie, vraagt om een naam
  en brengt het nieuwe onderdeel onder bij het onderdeel waarvan je het thuis
  ziet; **Valt onder** in de dialoog zet het ergens anders.
- **Instellingen…** op elke regel bevat de naam, wat het is (organisatie,
  domein, programma, team, landschapsscope — een woord voor het scherm, er
  gedraagt zich niets anders), een klant, een omschrijving, koppelingen en **Ondergebracht
  bij**, waarmee je het verplaatst.
- **Verwijderen** haalt het onderdeel weg, met alles wat eronder valt, en de
  bevestiging zegt dat ook: zijn map op schijf, of, in een browser zonder map,
  zijn records uit deze browser. Een werkbestand dat je elders hebt bewaard
  blijft staan. De organisatie zelf kun je niet verwijderen: daar valt al het
  andere onder.

Het label rechts in de balk zegt waar je werk wordt bewaard: de map waarin je
projecten als bestanden staan, **In deze browser**, of **Nergens bewaard**.
**Vanuit een andere map werken…** ernaast wijst de app naar een andere map, en
een browser zonder map biedt in plaats daarvan **Map kiezen…**.

**Voorbeelden**, als laatste. Een voorbeeld kopiëren in een organisatie die
leeg is en geen naam heeft, maakt het voorbeeld *de* organisatie. Een
organisatie die al iets is, zet het onder een eigen nieuw onderdeel. Dat geldt
voor alles met een naam, een onderdeel eronder, een bord of vastleggingen, en
voor elke map, die zoals de map zelf heet. Hoe dan ook is de kopie vanaf dat
moment van jou, en niets wat je doet raakt het voorbeeld zelf.

Hernoemen hernoemt alleen het label — waar iets staat is zijn adres, en
hernoemen is niet verplaatsen. Verplaatsen verandert het adres van het onderdeel
en van alles eronder, en laat de inhoud ongemoeid: elke verwijzing elders in de
map die naar iets in die tak wees, gaat in dezelfde stap mee naar het nieuwe
adres, zodat een verplaatsing geen spoor van verouderde kopieën achterlaat. Zo
ook elke oorzaak die een van zijn oorzaken verklaart, en elke waarneming die een
van zijn waarnemingen opnam: die noemen het bij zijn adres, en gaan mee. Bij
het starten opent de app het onderdeel dat je open had.

Zeven namen worden geweigerd, omdat de mappen van een onderdeel ze al gebruiken:
`diagrams`, `docs`, `decisions`, `transitions`, `observations`, `images` en `logos`.

## Eén naam in de hele organisatie

Een naam betekent overal in je map hetzelfde. Het magazijnsysteem is één
systeem, welk domein het ook tekent, en een capability die de organisatie
benoemt is diezelfde capability waar een landschap hem verfijnt — dus elk ding
wordt **één keer** vastgelegd, in één onderdeel, en elk ander onderdeel dat het
gebruikt wijst naar datzelfde ding.

**Het onderdeel dat het vastlegt, beheert het.** Daar zitten de details: in
welke fase het is en op welke data, wie het beheert, welke leverancier, waarop
het draait, hoe volwassen het is. Verander daar iets en overal waar het
getekend wordt staat het nieuwe.

**Overal elders staat een verwijzing** — een kaart die het ding tekent zonder
het te beheren. Zo'n kaart toont de naam met een klein **uit …** eronder dat
zegt waar het echt is vastgelegd, en het detailpaneel zegt hetzelfde met een
knop om daarheen te gaan. De naam en die regel zijn kopieën en staan dus
alleen-lezen, net als alles wat de beheerder beantwoordt. Wat een verwijzing
wél mag dragen is **haar eigen beschrijving** — wat het ERP voor het magazijn
betekent is een andere pagina dan wat het ERP ís, en allebei zijn ze het
opschrijven waard. Net zo de kleur, de vorm en het icoon die je hem geeft, en
waar je hem op je eigen borden zet.

Welk onderdeel een ding beheert, wordt bepaald door **diepte**: het diepste
onderdeel dat het vastlegt. Die ene regel werkt beide kanten op, en dat is het
punt. Capabilities worden bij de organisatie vastgelegd en naar beneden
verfijnd, dus de organisatie houdt ze. Applicaties worden vastgelegd in het
landschap dat ze draait, dus een domein houdt de zijne — en een organisatie die
een applicatie alvast bij naam noemt, noemt een plaatshouder die opzij gaat
zodra iemand dieper het echte record schrijft.

### Wat een bevinding betekent

De app weigert hierover nooit een save. Hij leest de hele map bij het openen —
en opnieuw zodra de map onder je verandert — en meldt wat hij vindt. Elke regel
van de boom op het organisatiescherm draagt zijn eigen zin.

- **Conflict** — twee onderdelen op hetzelfde niveau leggen dezelfde naam vast.
  Iemand is halverwege een migratie, of twee teams noemden hetzelfde ding op
  dezelfde middag. Beide regels zeggen het, want geen van beide is de foute.
  Maak er één een verwijzing naar de ander van.
- **Verouderd** — de kopie van de naam klopt niet meer met hoe het beherende
  onderdeel het noemt, of dat onderdeel is verplaatst. **Bijwerken** schrijft de
  kopieën in één stap terug, en dat kun je ongedaan maken als al het andere.
- **Ongedefinieerd** — een verwijzing naar iets dat niets in de map vastlegt. De
  kaart wordt getekend en de regel blijft staan; wat ontbreekt is ergens een
  record om naar te wijzen.
- **Een losse regel** — een lijn die eindigt op iets dat niets in de map heeft.
  Blijft staan en wordt als stomp getekend, en verdwijnt nooit bij een save.
- **Een voorstel** — een capability die een domein benoemde en geen onderdeel
  erboven. Geen fout: het is een gesprek met het niveau erboven.
- **Zonder eigenaar** — een systeem dat als andermans is gemarkeerd zonder dat
  iemand heeft gezegd van wie.

Eén ding op die lijst is **informatie en geen fout**: een record dat geen enkel
bord in zijn eigen onderdeel tekent. Iets kan echt, beheerd en beschreven zijn
zonder al op iemands plaat te staan, dus het wordt apart geteld en nooit als
bevinding gekleurd.

### Het register

**Register** op het organisatiescherm is elke applicatie in de hele map, op één
pagina. Niets schrijft hem: hij wordt telkens uit de onderdelen zelf afgeleid
wanneer de map gelezen wordt, dus hij kan niet afwijken van wat de mappen zeggen
en er is geen lijst die twee domeinen tegelijk bewerken.

Elke regel zegt hoe de applicatie heet, **welk onderdeel haar beheert**, of ze
van iemand anders is en van wie, **in hoeveel onderdelen ze getekend is** (houd
de muis op het aantal voor de namen), en de bevindingen erover als kleine chips.
Het filterveld doorzoekt de naam, de sleutel en het onderdeel; **Op naam** en
**Op niveau** zijn de twee volgordes. **Openen** gaat naar het onderdeel dat de
applicatie beheert, met de kaart geselecteerd — daar kunnen haar details worden
gewijzigd.

Een regel waar twee onderdelen dezelfde naam vastleggen biedt **Koppelen…**: dat
opent het onderdeel waarvan de vastlegging moet wijken en vraagt het dáár, want
een vastlegging wordt alleen gewijzigd door het onderdeel dat haar heeft.

### Een vastlegging naar een ander onderdeel verplaatsen

Waar iets is vastgelegd is een keuze die je achteraf kunt wijzigen. Kies de kaart
en druk op **Verplaatsen…** in de inspector; het venster biedt aan welke van de
vier van toepassing zijn.

- **Koppelen** — de eigen vastlegging opgeven en verwijzen naar die van een
  ander onderdeel. Dit lost een conflict op, en het is wat een kaart nodig heeft
  die getekend is voordat iemand de echte vastlegging schreef. Dit onderdeel
  houdt zijn eigen beschrijving, zijn kleuren en waar de kaart op zijn borden
  staat; het geeft de details op, waar het andere onderdeel vanaf dan voor
  instaat.
- **Omhoog** — de vastlegging naar een onderdeel hierboven verplaatsen en hier
  een verwijzing achterlaten. Dat is wat een applicatie in een landschap nodig
  heeft als het domein erboven degene hoort te zijn die haar beheert.
- **Omlaag** — het omgekeerde: naar een onderdeel hieronder.
- **Overdragen** — naar elk ander onderdeel. **Hier een verwijzing achterlaten**
  staat standaard aan; zet je het uit, dan tekent dit onderdeel het ding
  helemaal niet meer.

De laatste drie schrijven **twee onderdelen**, dus ze vragen het eerst. Het
onderdeel waar het naartoe gaat wordt geschreven vóór dit onderdeel verandert, en
dat is met opzet: gaat er halverwege iets mis, dan staat de vastlegging op
*beide* plaatsen — een conflict dat je ziet en met **Koppelen** oplost — en niet
op geen van beide.

Daarom **stopt ongedaan maken daar**. ⌘Z neemt alles terug wat je sindsdien deed
en weigert dan die stap, met een regel die zegt waarom: maar de helft ervan staat
op de stapel van dit venster, en de andere helft is een bestand in een onderdeel
waar hier niemand voor spreekt. Verplaats de vastlegging opnieuw, de andere kant
op, om het terug te zetten.

Een verplaatsing wordt geweigerd, met de reden, als het onderdeel waar het
naartoe zou gaan de naam al beheert, als een verplaatsing omhoog een onderdeel
noemt waar dit niet onder valt, en als het verwijderen van de vastlegging dingen
die eronder vallen zonder ouder zou achterlaten.

## Waar je werk wordt bewaard

Je werk staat op een van drie plekken, en de regel onder de naam op het thuis
van de organisatie zegt welke:

- **in een map**: die van de desktop, of van een browsertabblad waar de
  browser er een aanbiedt;
- **in deze browser**: een tabblad zonder map;
- **nergens**: een tabblad waarin de opslag van de browser niet opengaat.

Het werkbestand (zie *Bewaren, exporteren, delen*) brengt je hele organisatie
van elk van die plekken naar elke andere.

### Een map

De eerste keer dat de desktop-app start vraagt hij om een **map om in te
werken**, en alles wat je maakt staat daar als bestanden die je kunt lezen:

```
<jouw map>/
  scope.json                          de organisatie: naam, klant, koppelingen
  acme-logistics/                     een onderdeel eronder
    scope.json                        hetzelfde bestand, een niveau dieper
    warehouse-landscape/              en nog een keer
      scope.json                      hoe het heet, en wat erin zit
      model.json                      de elementen en de lijnen ertussen
      diagrams/landscape.json         wat een aanzicht is
      diagrams/landscape.geometry.json     waar de elementen staan
      docs/warehouse.md               de omschrijving van een element, als tekst
      decisions/0007-one-writer.md    een besluit
      images/floor-plan.png           een afbeelding die een omschrijving toont
      logos/own.svg                   een logo dat je hebt geüpload
```

Een map met een `scope.json` erin is een onderdeel, en de mappen daarbinnen die
er ook een hebben zijn de onderdelen eronder. Verplaats een map in je
bestandsbeheer en het onderdeel staat op zijn nieuwe adres. Een map die je nog
geen naam gaf, heet zoals de map zelf.

**Een map van een oudere versie opent gewoon.** De eerste keer dat deze versie
er een ziet, zet hij de hele boom om (`project.json` en `group.json` worden
`scope.json`). Op de desktop, waar de map een git-repository is, legt hij
eerst vast hoe de map eruitzag. Nog een keer draaien doet niets.

Er zit niets verstopt in de app. Zet de map in OneDrive, in Dropbox, op een
netwerkschijf of in een git-repository en hij gedraagt zich zoals alles daar.
**Vanuit een andere map werken…** op het organisatiescherm brengt je naar een
andere map; de mappen die je eerder gebruikte staan in **File ▸ Open Recent
Folder**, elk onder de naam die hun organisatie zichzelf geeft.

**Alles wordt geschreven zodra het verandert**: drie seconden nadat je stopt
met bewerken, als je het venster verlaat, en als je het sluit. Alleen de
bestanden die echt veranderden worden herschreven, dus één element verplaatsen
herschrijft één klein bestand en verder niets. Een venster sluiten met
wijzigingen die nog niet bewaard zijn, bewaart ze eerst, in elk venster; de
app vraagt alleen iets als dat bewaren niet lukte.

**Je werk uit de browser meenemen.** Bewaarde deze browser al werk voordat je
een map koos, dan vraagt het kiezen **Je werk meenemen naar deze map?**:
- **Mijn werk erin kopiëren** kopieert elk onderdeel dat de browser bewaarde
  naar de map. De dialoog blijft open tot het kopiëren klaar is. Dan zegt hij
  hoeveel onderdelen zijn gekopieerd, welke niet, en welke hij liet staan
  omdat iemand ze intussen veranderde. Onderdelen die niet geschreven konden
  worden, biedt hij opnieuw aan met **Opnieuw proberen**, en ook de volgende
  keer dat je die map kiest.
- **De map openen zoals hij is** laat allebei staan.

In geen van beide gevallen wordt iets verwijderd; de browser houdt zijn kopie.

**Een map met een remote.** Is de map een git-repository met een remote, dan
heeft *Voorkeuren* twee schakelaars voor deze map op deze machine: **Van de
remote ophalen als deze map wordt geopend** en **Na elke momentopname
pushen**. Zijn de map en haar remote allebei verder gegaan, dan biedt een
strook:
- **Die van de remote**: de versie van de remote blijft, en de onze wordt op
  een eigen branch bewaard;
- **Die van ons**: de onze blijft, vastgelegd als merge op de branch waarop
  je staat.

In beide gevallen wordt wat open staat eerst geschreven.

**De eigen git-instellingen van de map.** De app draait git met je eigen
git-configuratie. De `.git/config` van een map mag instellen wat een repository
nodig heeft, zoals haar remotes, haar branches en wie er commit. Een programma
dat ze noemt, zoals een editor, een pager, een ondertekenprogramma of een
filter, wordt vervangen door je eigen waarde of die van git, en instellingen
alleen voor commando's die de app nooit draait, zoals een merge- of difftool,
blijven staan. Een paar instellingen kunnen niet worden vervangen en worden
geweigerd: git's eigen proxycommando, de programma's voor upload-pack en
receive-pack, een pager voor één commando, een adresherschrijving en een
cookiebestand. In een map die er een instelt, worden een momentopname, een
label, ophalen en pushen geweigerd, en de melding noemt de instelling, in het
Engels aangehaald zoals git haar meldt, zoals in *De momentopname is niet
gelukt: git is in deze map niet uitgevoerd: its configuration sets
http.cookiefile, …*. Hetzelfde geldt voor git-lfs dat alleen voor die map is
ingesteld (`git lfs install` stelt het voor jou in, en dan draait het), en voor
een remote die een map binnen de werkmap is.

Een browsertabblad kan ook in een map werken, waar de browser dat aanbiedt
(Chromium doet dat). De toestemming overleeft een herstart zelden, en erom
vragen vereist een klik. Een tabblad pakt een onthouden map dus alleen weer op
als de toestemming nog geldt, en begint anders zonder iets te zeggen in deze
browser. De desktop is degene die moet kiezen.

### Deze browser

Een tabblad zonder map bewaart je werk in deze browser, voor deze site. Het
label op het thuis van de organisatie zegt **In deze browser**, en je werk
blijft daar na een herstart staan tot jij of de browser de gegevens van de
site wist. Na de eerste keer bewaren vraagt de app de browser om het ook bij
een opruimbeurt te houden; sommige browsers, Firefox bijvoorbeeld, leggen die
vraag aan jou voor. Browseropslag is klein, dus
de app zegt één keer dat hij voor ongeveer viervijfde vol zit: een browser
stopt zonder te vragen met bewaren. Heeft een ander tabblad nog een oudere
versie van de app open, of is de app in een ander tabblad bijgewerkt, dan zegt
een strook wat je moet sluiten of herladen voordat bewaren weer werkt.

**Werk dat een oudere versie bewaarde.** Eerdere versies bewaarden het werk
van een browser op een andere plek erin. Dat werk wordt bij elke start
overgenomen: gekopieerd, nooit verplaatst, en nooit over werk dat hier sinds
die tijd is gedaan. Is een onderdeel op beide plekken veranderd, dan vraagt een
strook naar dat onderdeel: **De oudere kopie overnemen** (wat hier staat gaat
eerst de geschiedenis in) of **Houden wat hier staat**.

**Een privévenster** houdt je werk maar zo lang als de browser dat doet. De
meeste browsers openen hun opslag daar ook, dus het label zegt **In deze
browser**, en alles verdwijnt als het venster sluit. De app kan niet zien dat
het venster privé is: bewaar een werkbestand om je werk te houden.

**Waar de opslag van de browser niet opengaat**, werkt de app vanuit het
geheugen en wordt niets wat je verandert bewaard. Een strook op elk scherm zegt
dat. Het label op het thuis van de organisatie zegt **Nergens bewaard**, in de
waarschuwingskleur. De regel onder de naam zegt *Alles hier wordt nog nergens
bewaard — bewaar een werkbestand om het te houden.*, en de eerste momentopname
zegt *Momentopnamen blijven bewaard zolang dit tabblad open is, en gaan ermee
weg.* Werk dat een oudere versie in deze browser bewaarde, wordt getoond. Bewaar
een werkbestand voordat je het tabblad sluit.

Heeft de opslag van de browser na een paar seconden nog niet geantwoord, dan
wordt de pagina toch getekend. Een strook zegt dat, en je werk verschijnt
zodra de opslag antwoordt.

### Als het elders is gewijzigd

Een onderdeel kan veranderen terwijl je het open hebt: de checkout van een
collega, een synchronisatiedienst, jijzelf op een andere machine of in een ander
tabblad.
De balk zegt dan **Elders gewijzigd**, of **Hier én elders gewijzigd** als er
hier ook wijzigingen openstaan. Een strook boven de plaat vraagt welke versie
blijft:
- **Die van elders** leest hun versie en zet die in beeld.
- **Die van mij** speelt jouw wijzigingen opnieuw af op hun versie, zodat hun
  wijzigingen aan wat jij niet aanraakte blijven staan. Alleen waar dat wordt
  geweigerd, schrijft het het hele onderdeel zoals het op je scherm staat over
  het hunne.
- **Kopie bewaren…**, met wijzigingen die hier openstaan, zet de jouwe eerst in
  een werkbestand en laat de keuze voor later.

Er wordt nooit iets ongevraagd overschreven.

### Als een onderdeel niet helemaal te lezen is

Is een deel van een onderdeel niet te lezen, omdat een bestand ervan beschadigd
is of met de hand is veranderd, dan opent het onderdeel om te bekijken en niet
om te wijzigen, en een melding noemt wat niet te lezen was. Waar je mag
schrijven waar het onderdeel bewaard wordt, biedt die **Een werkbestand
binnenhalen…**, en **Terugzetten uit de geschiedenis…** waar een geschiedenis
wordt bijgehouden; in een map zegt hij ook dat je het bestand kunt herstellen en
het onderdeel opnieuw kunt openen.
- **Terugzetten uit de geschiedenis…** opent de pagina Geschiedenis, waar **De
  hele scope terugzetten…** het hele onderdeel maakt wat het was bij de
  momentopname die je kiest. Wat niet te lezen was, wordt eerst bewaard, als
  een punt in de geschiedenis of apart gezet naast het onderdeel, en waar dat
  niet kan, wordt niets teruggezet.
- **Een werkbestand binnenhalen…**, of er een openen op het onderdeel, zet het
  op dezelfde manier terug uit het bestand, en de vraag vooraf zegt dat.

Een punt in de geschiedenis dat bewaarde wat niet te lezen was, biedt **Bewaar
wat niet gelezen kon worden…**, dat het als een bestand van jezelf bewaart. Een
onderdeel dat een latere versie van de app schreef, opent alleen om te
bekijken: de melding zegt dat je de app moet bijwerken, en niets hier zet het
terug.

## Geschiedenis

Elke plek houdt een geschiedenis van je werk bij. **Snapshot…** in het menu
File (op het web **Momentopname…** in het menu **⋯**) komt met een tekst die al geschreven
is uit wat je deed, zoals "Warehouse Management gewijzigd, 3 elementen
verplaatst", en die je kunt aanpassen voor hij wordt vastgelegd. De eerste
momentopname vraagt je om **Geschiedenis bijhouden**, en zegt waar die wordt
bewaard:
- in de map zelf, met git;
- in deze browser, voor de map van een tabblad (daarvoor wordt niets in de
  map geschreven) en voor een tabblad zonder map;
- zolang het tabblad open is, waar de opslag van de browser niet opengaat.

Er gaat niets van je machine af, tenzij je voor een map met een remote **Na elke
momentopname pushen** hebt aangezet. Op de desktop heeft de geschiedenis **git**
2.26 of nieuwer op de machine nodig: zonder git wordt een momentopname geweigerd
met een zin die dat zegt, en werkt de rest precies zoals eerst.

**Geschiedenis…** toont elke momentopname. Kies er een en je ziet wat er
sindsdien veranderde — applicaties erbij, weg en gewijzigd, koppelingen getekend
en doorgeknipt, besluiten genomen — met de geometrie als aantal in plaats van
als lijst, want een Tidy-ronde is één zin en vierhonderd gewijzigde regels. Een
verplaatsing is ook een punt, *Verplaatst van X naar Y*, in de geschiedenis van
elk onderdeel dat ze verplaatste.

**De geschiedenis van één ding.** De keuzelijst bovenaan de pagina beperkt haar
tot een aanzicht, een beschrijving of een besluit: de lijst wordt de
momentopnames die dat raakten, en de veranderingen de regels die erover gaan.
Dezelfde pagina opent al beperkt via **Geschiedenis…** in het menu van een
aanzicht-tab, op de documentatiepagina en op de pagina van een besluit.

Een beschrijving is het enige onderwerp dat niet van één onderdeel is: een naam
betekent overal in de organisatie hetzelfde, dus de pagina van een element staat
waar het is vastgelegd én overal waar een onderdeel het tekent en zegt wat het
daar betekent. De geschiedenis van dat element is de optelsom van die pagina's,
en een regel onder de keuzelijst noemt de onderdelen die gelezen worden.
Terugzetten blijft van dit onderdeel: het zet terug wat de pagina van dit
onderdeel zei, de andere horen bij die onderdelen.

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
dezelfde plek ziet; in de map van de desktop is het een git-tag, die elke
git-client toont. Twee labels met dezelfde naam worden geweigerd, overal in een
map en binnen één onderdeel in een browser; kies een ander woord.

**Momentopnamen die de app zelf maakt**, waar een geschiedenis wordt
bijgehouden: voordat een werkbestand vervangt wat hier staat, voordat een
onderdeel uit de geschiedenis wordt teruggezet, en, op de desktop, voordat een
map van haar remote wordt opgehaald en voordat een map van een oudere versie
wordt omgezet. Elk heet naar waar hij aan voorafging, zodat wat er stond kan
worden teruggezet.

## De werkruimte

Eén open project: een balk bovenin, de editor eronder.

| In de balk | Wat hij doet |
|---|---|
| **Het kruimelpad** | De organisatie, elk onderdeel ertussen, en het open onderdeel vet; elk is een weg naar het thuis van dat onderdeel, en de naam van de organisatie is de weg terug naar het eerste scherm |
| **Instellingen…** | Naam van dit onderdeel en waaronder het valt, en zijn standaarden: de auteur op een geëxporteerd diagram, en de operationele aspecten waar een nieuw landschap mee begint. Een onderdeel onder een ander zetten laat de inhoud met rust |
| **⋯** | In een browser het menu: **Map openen…** waar de browser er een aanbiedt, **Openen…**, **Bewaren**, **Kopie van het werkbestand bewaren…**, **Momentopname…**, **Geschiedenis…**, **Agent koppelen…**, het thema, **Voorkeuren…**, en onder Help **Handleiding**, **Sneltoetsen…** en **Desktop-app downloaden**. Op de desktop staan dezelfde onderdelen, op de laatste na, in de menubalk, met **Preferences…** als **Settings…** in het app-menu op macOS |
| **Activiteit** | Wat er sinds het openen aan dit project is veranderd — een lijst met benoemde stappen en het tijdstip van elke, en de verplaatsingen, *Verplaatst van X naar Y*, en wie het verplaatste, gelezen uit de geschiedenis, dus ook die van voor het openen. Hij blijft bij het onderdeel, waar het ook heen gaat. Alleen lezen: ⌘Z is hoe je teruggaat |
| **Bewaard · uu:mm** | Hoe het project ervoor staat: het tijdstip van de laatste schrijfactie, of **Nog niet bewaarde wijzigingen**, **Bezig met bewaren…**, **Elders gewijzigd**, **Hier én elders gewijzigd**, **Niet bewaard — opslag weigert** |

Alles wordt vanzelf bewaard terwijl je werkt: drie seconden nadat je stopt, als
je het venster verlaat en als je het sluit. Sluiten met openstaande
wijzigingen bewaart ze eerst: de desktop vraagt alleen iets als dat niet
lukte, en een browsertabblad vraagt voor het sluit. In een browser zonder map
zegt de app één keer dat de
opslag voor viervijfde vol zit. Dat is de enige waarschuwing die je krijgt,
want een browser stopt zonder te vragen met bewaren. Wordt bewaren geweigerd,
dan zegt de balk **Niet bewaard — opslag weigert** en werkt de editor gewoon
door. Waar de opslag van de browser niet opengaat, zegt een strook dat vanaf het
begin.
Bewaar
in beide gevallen een werkbestand, want anders is het werk weg als het tabblad
sluit. Elke melding (bewaard, geladen, mislukt) verschijnt in
die balk onderin.

**Taal.** De taalknop rechts in de werkbalk van de editor (hij toont de code
van de taal waarin je zit: NL, DE of EN) opent een menu met de drie:
Nederlands, Deutsch en English. Een keuze schakelt de hele interface om:
menu's, dialogen, tooltips, bandnamen, foutmeldingen en het titelblok van een
PNG-export. De eerste keer beslist de taal van de browser. Het ontwerp zelf
verandert niet; namen van elementen zijn inhoud, geen interface. Frysk werd
aangeboden tot 26 september 2026; wie het had gekozen, opent de app nu in het
Nederlands.

### Terug en Vooruit

**Terug gaat naar de plek waar je hiervoor was**, en Vooruit naar de plek
waarvandaan je terugkwam. Een plek is het thuis van een onderdeel en de pagina
daarop, of een open onderdeel op zijn weergave of op de pagina daarover: zijn
besluiten, zijn waarnemingen, zijn roadmap, een plan, het rapport van een
platform of een dienst. Elke stap naar een andere plek telt, of je hem zette
met de boom, een kruimel, een kaart, een zoekresultaat of een link op een
pagina, of dat een agent hem voor je zette. Heeft een agent een onderdeel
geopend, dan brengt Terug je naar waar je was. Wat geselecteerd is, de dag
waarop een bord wordt getoond, een filter en een open dialoog horen niet bij
een plek, en een ander record kiezen op de pagina met besluiten of
waarnemingen, of een ander tabblad van de waarnemingen, is ook geen stap: het
adres noemt het tabblad dat open is, dus herladen blijft daarop. Terug is geen ongedaan maken: het verplaatst
het scherm en verandert niets, en ⌘Z blijft hoe je een wijziging terugdraait.

**In een browser** doen de knoppen Terug en Vooruit van de browser dit, met
hun toetsen en gebaren. Het adres noemt de plek waar je bent, na een `#`, dus
herladen blijft daar, en een adres gekopieerd uit de balk opent dezelfde plek
voor iedereen die hem mag lezen. De rest van het adres blijft zoals het was.

**In de desktop-app** begint de balk met een knop **‹** en een knop **›** (op
macOS na de knoppen van het venster), grijs als er nergens heen te gaan is.
Dezelfde stappen staan in het menu **Go** als **Back** en **Forward**, op
**⌘[** en **⌘]** op macOS en **Alt+←** en **Alt+→** op Windows en Linux. De
terug- en vooruitknoppen van de muis werken ook, en vegen tussen pagina's op
een Mac-trackpad als dat op *Veeg met twee of drie vingers* staat
(Systeeminstellingen → Trackpad → Meer gebaren → Veeg tussen pagina's). Ze
werken allemaal vanaf het thuis van de organisatie en met een onderdeel open.
Zolang er een dialoog open is, liggen de knoppen erachter en doen de toetsen,
de menu-onderdelen en de muisknoppen niets. De geschiedenis hoort bij het
venster: ze is weg als het venster sluit.

**Terug sluit een dialoog** als de pagina waarop hij werd geopend wordt
verlaten, zoals wanneer je die pagina op een andere manier verlaat. Tekst die
erin getypt was, wordt niet bewaard.

**Een plek die er niet meer is** wordt vervangen door de dichtstbijzijnde die
er wel is: een verwijderde weergave opent zijn onderdeel op de eerste weergave
die over is, een verwijderd record opent zijn pagina zonder record, en een
verwijderd onderdeel opent het thuis van het dichtstbijzijnde onderdeel erboven.
De lijst Activiteit zegt wat er werd verwijderd.

## Tekenen

**Het landschap** heeft vijf banden: actoren, invoerkanalen, externe systemen,
het applicatielandschap en de beheerlaag. Sleep een element uit het palet links
in een band, of rechtsklik op de plaat en kies **Hier toevoegen**. Banden
vergroot je door aan hun rand te slepen.

**Domeingroepen** zetten de applicaties die bij elkaar horen in één vak. Voeg er
een toe uit het palet of het plaatmenu, geef hem een kleur, sleep applicaties
erin, leg hem apart netjes. Een groep weghalen laat zijn elementen staan.

**Containerdiagrammen.** Een applicatie kan een containerdiagram onder zich
hebben: de applicatie wordt de grens van dat diagram en haar componenten staan
erin. Je maakt er bewust een — rechtsklik de applicatie en kies
**Containeraanzicht maken**, of druk op de knop met die naam op het tabblad
Algemeen van de inspector — en het is een stap in Activiteit als elke andere,
dus ⌘Z neemt het terug. Een kaart die er een heeft draagt een klein merkteken;
dubbelklik de kaart om het te openen. Dubbelklikken maakt er nooit een. Een
landschapstabblad toont zijn containerdiagrammen onder een pijltje: rechtsklik
daar op een regel, of druk op het pijltje achter de naam zodra het diagram open
is, om het te hernoemen, de **diagraminstellingen** te openen of het te
verwijderen. Verwijderen neemt de componenten mee en laat de applicatie staan.
Rechtsklik een landschapstabblad voor hetzelfde menu, met dupliceren erbij.
**Terug naar het landschap** brengt je terug naar het aanzicht precies zoals je
het verliet.

Waar die containers draaien wordt eromheen getekend: gestippelde
**deploymentkaders**, één per platform, genest zoals de platformen genest zijn
— de namespace in het cluster in het account — met een container die nergens op
draait buiten elk kader. Ze worden uit de rijen afgeleid en zijn niet te
verplaatsen: een kader staat waar zijn leden staan. De knop **Deploymentkaders**
in de werkbalk haalt ze weg voor een lezer die de kale C4-plaat wil, en de
weergave onthoudt het.

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

Koppelingen en de namen van domeingroepen zitten in dezelfde rondgang, en Enter
selecteert ze ook; Shift+F10 opent het menu van wat geselecteerd is, en Enter op
het element dat al geselecteerd is opent de documentatie ervan. Een koppeling
trek je zonder muis met **Koppeling starten naar…** uit het menu van een
element: ga met Tab naar het andere eind en druk op Enter. Op een tab van een
landschap toont ↓ de containerdiagrammen en opent Shift+F10 het menu van de tab.
Een element, een baan of een groep groter of kleiner maken, een groep
verplaatsen en een koppeling een knik geven gaan nog met een aanwijzer.

## Elementen

Zeven soorten: applicatie, component, extern systeem, invoerkanaal,
beheertool, actor, en de domeingroep die ze bijeenhoudt — en, sinds de
fysieke weergave, een **platform**: een cluster, een broker, een bus, de
tooling, waar applicaties op draaien en wat ze gebruiken. Selecteer er een en
de **inspector** rechts toont zijn velden in drie tabbladen.

- **Algemeen.** Naam, categorie, leverancier, technologie, levenscyclus
  (gepland, live, uitfaserend, uitgefaseerd; als badge, uitgefaseerde
  elementen dimmen), of je het beheert, de omschrijving (zie *Documentatie*) en
  waar het staat.
- **Vormgeving.** Accentkleur, vorm, pictogram, pictogramgrootte.
- **Gegevens.** De **operationele aspecten** van een applicatie: per kolom van
  dit diagram beheerd, deels, geen of risico, met een notitie. De kolommen
  stel je per diagram in bij de diagraminstellingen.

**Pictogrammen.** Ruim honderd ingebouwde tekens, doorzoekbaar op naam,
categorie en trefwoord in beide talen, in twee maten: klein in de kop, groot
voorop de kaart voor een plaat die van een afstand gelezen wordt. **Upload a
logo** in de kiezer voegt een eigen SVG of PNG toe (tot 200 kB). Geüploade
logo's reizen mee in het werkbestand.

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
een technologie, een kleur en een lijnstijl. Dubbelklik het label om het ter
plekke te bewerken.

**Waar een koppelvlak landt.** Het landschap tekent één lijn per koppelvlak, en
waar het aankomt ligt een niveau lager. Open het containerdiagram van de
applicatie en pak het uiteinde van de lijn waar het de randbox raakt: laat het
op een container los en het koppelvlak landt daar, met zijn protocol mee. Pak
het opnieuw om het naar een andere container te verplaatsen, of laat het terug
op de randbox los om de landing weg te halen; **Landt op ▸** in het lijnmenu
doet hetzelfde zonder slepen. Een tweede landing is een tweede lijn — teken er
een van een contextbox naar een container, en het inspectiepaneel vraagt
bovenaan van welk koppelvlak hij deel is, met het koppelvlak dat die kant op
loopt al aangevinkt.

Zodra een koppelvlak is geland, toont het *Detail: 2 koppelvlakken op het
containerdiagram · REST, AMQP* in plaats van zijn eigen protocolveld, want de
protocollen zijn die van de landingen — en **Openen**, of een dubbelklik op de
lijn zelf, brengt je erheen. Containerlijnen die je tekent zonder te zeggen
waar ze bij horen zijn koppelvlakken op zichzelf; de bevindingen van de
roadmap bieden aan de applicatielijn ervoor te tekenen (zie *Waar de datums
elkaar tegenspreken*).

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
codeblok gemarkeerd als `mermaid` wordt op elke pagina als diagram getekend. Een blok
gemarkeerd als `bpmn` wordt als proces getekend: BPMN 2.0-XML zoals de gangbare
modelleerprogramma's het bewaren, met een eigen diagramsectie die zegt waar
alles staat — pools en banen, taken, gebeurtenissen, gateways, stromen en
berichten, alleen-lezen. De pagina van een proces-element is waar zo'n blok
hoort (zijn `realises`-lijn zegt van welke capability het de uitvoering is), en
een bestand zonder diagramsectie wordt als tekst getoond onder een regel die
zegt waarom.

**Afbeeldingen.** Plak of sleep een afbeelding in de tekst om haar toe te
voegen: PNG, JPEG, SVG of WebP. **Afbeeldingen** naast de bron toont elke
afbeelding die het onderdeel heeft, met **Invoegen** om er een op deze pagina te
zetten en **Afbeelding verwijderen** om er een weg te halen. De tekst noemt een
afbeelding bij haar naam, `![bijschrift](image:floor-plan.png)`, waar het
onderdeel ook wordt bewaard. Een pagina legt alle afbeeldingen meteen op hun
eigen formaat neer, en haalt er een pas op als die in beeld schuift. Een lange
pagina opent dus snel, en er verschuift niets als de afbeeldingen aankomen. Een
afbeelding die niet getoond kan worden, toont haar bijschrift. Alleen
afbeeldingen die bij het onderdeel bewaard zijn worden getekend: een webadres
toont als bijschrift, en de app haalt nooit iets op.

## Besluiten

**Besluiten** in de bovenbalk opent de architectuurbesluiten (ADR's): een boom
links, de besluiten van het gekozen knooppunt in het midden, en het besluit dat
u leest rechts.

De besluiten van dit onderdeel zijn **één lijst**. Een besluit hoort óf bij het
onderdeel als geheel, óf het gaat over één ding erin — een applicatie, een
capability, een stap in een klantreis — en de boom heeft een knooppunt voor elk
ding met besluiten, met elke applicatie erbij, of ze er nu al heeft of niet. Iets
dat uit het model is verdwenen houdt zijn besluiten onder *Verwijderde
applicaties*.

Daaronder komen de onderdelen **erboven**, elk als een eigen kopje: *Van Acme
Logistics*, *Van Retail*. Hun besluiten worden hier gelezen en **gewijzigd waar
ze thuishoren** — de lezer toont ze zonder knop om te bewerken en biedt aan dat
onderdeel te openen. De nummering is per onderdeel, dus ADR-0001 van het domein
en ADR-0001 van het landschap zijn twee besluiten, en dat waren ze altijd al.

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
toont de syntaxis, mermaid-diagrammen inbegrepen. Wijzigingen worden met dit
onderdeel bewaard.

## Waarnemingen

**Waarnemingen** in de bovenbalk opent wat het team in deze scope gezien
heeft — en, als team geanalyseerd, wat erachter zit. De pagina heeft drie
tabbladen. Het **register** is een tabel die uit de records gelezen wordt:
nummer, titel, de dag waarop het voor het eerst gezien is, waar, de impact,
hoe vaak het gezien is en de oorzaken waarnaar het geanalyseerd is; daaronder
de oorzaken, de oplossingen en de experimenten; het record dat je kiest opent
ernaast. De **analyse** is een tekening: de waarnemingen links, de oorzaken
waarnaar ze geanalyseerd zijn in de banen rechts ervan, dan de grondoorzaken,
en de oplossingen die ze aanpakken als laatste. Het derde tabblad,
**Oplossingen**, staat hieronder.

**Lokaal en globaal.** De waarnemingen, oorzaken, oplossingen en
experimenten van een scope zijn van die scope. Gelezen vanuit een scope zijn
die van de scopes eronder **lokaal** in die scopes; gelezen vanuit de
organisatie is wat van de organisatie zelf is de **globale** analyse. Er
wordt niets gedeeld om daar te komen: een scope leest de analyse van elke
scope eronder, en wie een scope mag lezen wordt beslist waar het werk
bewaard wordt, nooit op een record. **Lokaal tonen**, naast de andere
knoppen van de tekening, staat aan waar de scope scopes eronder heeft, en
uit — met de reden erbij — waar die er niet zijn. Aan tekent de tekening elke
scope eronder in een eigen kader links van de banen van deze scope, genest
zoals de boom genest is, en noemen het register, de oorzaken, de oplossingen
en de experimenten de records van elke scope eronder na die van deze scope,
onder *Lokaal in …*. De tellingen boven de tekening — waargenomen,
geanalyseerd, aangenomen, geverifieerd, grondoorzaken, open einden — tellen
wat de tekening toont, de scopes eronder meegerekend. Uit toont de pagina
alleen deze scope, en zegt ze hoeveel lokale records ze verbergt.

Een record van een scope eronder wordt **gewijzigd waar het woont**. De
lezer zegt dat in een strook — *Lokaal in Application landscape* — met
daaronder een knop die de pagina van die scope opent. Wat je er vanaf hier
aan toevoegt — opnieuw gezien, een oorzaak, een diepere oorzaak, een
koppeling tussen de eigen records, een van de oorzaken tot grondoorzaak
maken — wordt in die scope gemaakt en daar meteen opgeslagen, als wijziging van
die scope en niet van deze pagina: een melding zegt waar het heen ging, en ⌘Z
op deze pagina komt er niet bij — terugnemen is het terugzetten. Waar die
scope vanaf hier niet gewijzigd mag worden, of haar eigen regels de wijziging
weigeren, zegt de melding dat er niets gemaakt is. Een
oplossing of een experiment van een scope eronder wordt hier gelezen en niet
gewijzigd.

Een waarneming is een genummerd record (`OB-0007`) met een titel, een plaats,
wie het zag — vrije tekst: een naam, initialen, een team — de dag waarop het
voor het eerst gezien is, een impact — *klein*, *groot* of *kritiek* — en een
markdowntekst voor wat er gezien is, het bewijs en wie of wat het raakte.
**Opnieuw gezien** telt er één bij en schrijft de dag in de
**geschiedenis** van het record: het gedateerde overzicht onderaan elke
waarneming — vastgelegd, opnieuw gezien, samengevoegd, gearchiveerd. Op een
grote kaart is de impact een streep langs de linkerkant en staat de teller in
de hoek; op een kleine is de impact de grootte van de cirkel.

**Nieuwe waarneming** vraagt de vier feiten die er een waarneming van maken:
de titel, **waar het gezien is**, **waargenomen door** en **wanneer
gezien**. Wanneer gezien begint bij vandaag en mag niet in de toekomst
liggen; de impact begint bij klein. Onder elk veld staat een voorbeeld, en
een veld dat leeg blijft zegt op die plek wat er ontbreekt. De beschrijving
rechts is optioneel, begint met haar drie kopjes, en schakelt tussen
**Bewerken** en **Voorbeeld**. Onder de titel staan twee hints die je nooit
tegenhouden: **Al eerder gezien?** noemt waarnemingen van de gekozen scope
waarvan de titel woorden met de jouwe deelt, elk met **Opnieuw gezien**, dat
een waarneming bij die ene telt en niets nieuws vastlegt; en een titel met een
woord dat klinkt als een oorzaak, een oplossing of schuld — *omdat*, *moet*,
*oplossen*, *schuld* — krijgt de hint bij wat gezien is te blijven en het
waarom in een oorzaak te zetten. Met Lokaal tonen aan vraagt het formulier
eerst in welke scope de waarneming hoort; een scope eronder maakt haar daar
lokaal.

De **oorzaken** kunnen met de waarneming meegeschreven worden. **Nieuwe
oorzaak** opent de velden van een oorzaak in het formulier — de titel,
*waarom we dat denken*, of het een grondoorzaak is, en hoe sterk ze de
waarneming verklaart — met *Al opgeschreven?* over de oorzaken van de scope.
**Bestaande oorzaak** kiest er een die al opgeschreven is. Elke regel zegt of
hij nieuw of bestaand is en kan er weer af, en er wordt niets gemaakt tot je
vastlegt: de knop zegt wat hij gaat maken, *Waarneming vastleggen met 1
nieuwe oorzaak en 1 koppeling*, en het is één stap — ⌘Z neemt de waarneming,
de nieuwe oorzaken en de koppelingen samen terug. Een andere scope kiezen
haalt de koppelingen naar oorzaken van de eerder gekozen scope eraf, en zegt
dat.

Twee waarnemingen die hetzelfde blijken te zijn worden **samengevoegd**:
kies de waarneming waar het dezelfde van is, en de keren dat het gezien is
en de oorzaken gaan over. Beide records zeggen dat met de datum. Het
samengevoegde record blijft — daar staat de oorspronkelijke tekst — en wordt
als samengevoegd gelezen, niet verwijderd; *Samengevoegde tonen* haalt het
terug in het register. Een waarneming van een scope eronder kan worden
samengevoegd met een waarneming van deze scope; alleen het record van deze
scope wordt geschreven, en de scope eronder leest waar zijn waarneming heen
ging.

Een waarneming die is opgelost, aangepakt of er niet meer toe doet wordt
**gearchiveerd**: *Archiveren* vraagt, vrijblijvend, waarom, en schrijft de
dag en de toelichting in de geschiedenis. Het record blijft waar het is, voor
de geschiedenis, en verdwijnt uit de analyse — niet getekend, niet in de
wachtrij, niet als samenvoegdoel — tot *Terughalen* het terugbrengt.
*Gearchiveerde tonen* laat de gesloten zien. Om een waarneming te sluiten
wordt niets verwijderd; *Verwijderen* is voor een record dat er nooit een had
moeten zijn.

Een **oorzaak** (`CA-0003`) is wat het team zegt dat achter één of meer
waarnemingen zit, of achter andere oorzaken. Ze begint **aangenomen** en
wordt **geverifieerd** zodra ze gecontroleerd is. Een **grondoorzaak** is een
oorzaak waarvan het team zegt dat ze er een is, en ze heet **RC** op het
eigen nummer van de oorzaak: `CA-0004` tot grondoorzaak gemaakt is `RC-0004`,
en weer tot oorzaak gemaakt is ze opnieuw `CA-0004`. Een grondoorzaak sluit
de keten af: niets verklaart haar, en een oplossing pakt haar aan. Ze mag
oorzaken en waarnemingen verklaren. Een oorzaak die geen grondoorzaak is en
die door niets verklaard wordt is een **open einde** — daar is de analyse nog
niet af — met `?` gemarkeerd in de tekening en erboven geteld.

**Een analyse uit een eerdere versie** noemde geen grondoorzaken: een
grondoorzaak was toen elke oorzaak die door niets verklaard werd. Ze opent met
een grondoorzaak overal waar een oplossing die niet is laten vallen een oorzaak
aanpakt, en nergens anders, dus een oorzaak die alleen grondoorzaak was omdat
nog niets haar verklaarde, opent als open einde. Dat geldt waar het werk ook
bewaard wordt.

**Grond maken** en **Tot oorzaak maken** zijn stappen met een naam in de
Activiteit-lijst, en elk vraagt eerst. Grond maken wordt geweigerd zolang een
oorzaak deze verklaart: de lezer noemt elke oorzaak die dat doet, en zegt die
los te koppelen of die ene tot grondoorzaak te maken. Tot oorzaak maken wordt
geweigerd zolang een oplossing haar aanpakt: de lezer noemt elke oplossing,
en zegt die eerst naar een andere grondoorzaak te verplaatsen of los te
koppelen. Een nieuwe oorzaak kan bij het schrijven meteen grondoorzaak
worden.

**Elke actie in een lezer is een kleine knop** met een pictogram en een of
twee woorden, en er met de muis boven hangen, of er met Tab op komen, zegt
voluit wat hij doet en waarvoor hij geweigerd wordt. Een waarneming biedt
*Opnieuw gezien*, *Oorzaak*, *Bewerken*, *Samenvoegen*, *Archiveren* en
*Verwijderen*; een oorzaak *Diepere oorzaak*, *Grondoorzaak*, *Grond maken*
en *Verifiëren*; een grondoorzaak *Oplossing* en *Tot oorzaak maken*, en nooit
een diepere oorzaak. *Oorzaak*, *Diepere oorzaak* en *Grondoorzaak* openen
één dialoog met twee tabbladen: **Nieuwe oorzaak**, de eigen velden van de
oorzaak, en **Bestaande oorzaak**, dat alleen aanbiedt wat de regels
toestaan. Waar de lezer smal is, gaan *Samenvoegen*, *Archiveren* en
*Verwijderen* in `⋯`.

**Door de boom verklaart een oorzaak naar beneden en nooit naar boven.** Een
oorzaak mag een oorzaak van een scope onder de hare verklaren — een reden
voor de hele organisatie achter een oorzaak van een landschap — en de
koppeling staat op de oorzaak erboven, in de scope erboven. De oorzaak
eronder zegt in haar lezer wat haar verklaart, en de tekening trekt de lijn
gestreept over de grens. Op een oorzaak van deze scope koppelt **Lokale
oorzaak** een oorzaak van een scope eronder die ze verklaart; op een oorzaak
eronder koppelt **Org-oorzaak** een oorzaak van deze scope die haar
verklaart. Geweigerd: een oorzaak eronder die een oorzaak erboven verklaart,
een oorzaak die er een van een zusterscope verklaart, een oorzaak erboven die
een **waarneming** eronder verklaart — de scope eronder verklaart zijn eigen
waarnemingen — en alles wat een grondoorzaak verklaart: om te zeggen dat er
een reden voor de hele organisatie achter een lokale grondoorzaak zit, maak
je die grondoorzaak eerst weer oorzaak, in haar eigen scope.

**De filters.** *Filters* toont of verbergt een rij onder de knoppen van de
tekening en telt de filters die aan staan. **Scopes** is een lijst met een
vakje per scope, die een veld inkort. **Wrn** houdt de waarnemingen waarvan
de tekst past en de keten erachter — hun oorzaken, grondoorzaken en
oplossingen. **Oorzaak** en **RC** houden de oorzaken, of de grondoorzaken,
waarvan de tekst past, met alles wat ze verklaren en alles wat erachter zit.
**Alles doorzoeken** kijkt in elk record, oplossingen meegerekend, en houdt
wat gevonden is en wat eraan gekoppeld is. Filters beperken elkaar, en ze
beperken alle drie de tabbladen. Wat paste krijgt een rand en wat meekwam
wordt gewoon getekend; de telling zegt *12 van 40 getoond*, en × naast
*Filters* wist ze allemaal. **Bewaarde filters** bewaart de filters die aan
staan onder een korte naam die je zelf kiest: een die opnieuw onder dezelfde
naam bewaard wordt vervangt de oude, een bewaarde wordt vanuit de lijst weer
aangezet, en een wordt eruit verwijderd. Ze zijn van jou — bewaard bij je
voorkeuren en in elke scope aangeboden — en een bewaarde scope die er niet
meer is valt weg als je het filter terughaalt.

**De tekening bekijken.** **Groot** tekent elk record als een kaart met zijn
label en titel; **Klein** als een cirkel met het label eronder — een
waarneming zo groot als haar impact, een oorzaak hol, een grondoorzaak met
een dubbele ring, een oplossing als een vierkant. Gestreept is aangenomen en
doorgetrokken geverifieerd, in beide, en de legenda onder de tekening volgt
de grootte. De tekening begint **passend** in het venster, en past zich
opnieuw aan als wat ze toont verandert, tot je zoomt; de zoomknoppen, en ⌘ of
Ctrl met het scrollwiel, zoomen, en slepen over de achtergrond verschuift
haar. **Boven een record hangen** — of er met Tab op komen — volgt de keten
beide kanten op: alles wat eraan gekoppeld is blijft en de rest vervaagt, en
de volledige titel, het label en de scope staan eronder. Enter of een klik
leest het. Dezelfde records onder dezelfde filters komen elke keer op
dezelfde plek.

### Oplossingen

Het derde tabblad, **Oplossingen**, begint waar de analyse ophoudt: wat het
team aan een oorzaak doet, hoe een idee zich een besluit verdient, en of wat
er gebouwd is de waarnemingen heeft laten ophouden. De tekening heeft links de
oorzaken — de grondoorzaken, en elke andere oorzaak die een oplossing aanpakt
— dan de **richtingen** (ideeën die worden uitgewerkt of getest), de
**experimenten**, en de **structurele** oplossingen (bewezen, overgenomen,
ingevoerd). Een oplossing schuift naar rechts naarmate ze rijper wordt; haar
breedte is de baat die ze belooft en haar vulling hoe ver ze is. Is ze
structureel, dan houdt ze een vervaagd vak in de baan van de richtingen voor
de richting die ze was, zodat de lijn loopt van de oorzaak via dat vak en het
experiment dat haar bevestigde naar de oplossing. **Hele keten** zet de
waarnemingen en de hele analyse er links weer bij, zodat één tekening loopt
van wat gezien is tot wat gebouwd is. Een markering (!) zegt waar je moet
kijken: een grondoorzaak waar niemand aan werkt, of een oplossing met een
vraag.

**Oplossing** in de lezer van een grondoorzaak, of **Nieuwe oplossing** in de
balk, opent het formulier: een titel met een voorbeeld eronder, een
optionele tekst met **Bewerken** en **Voorbeeld**, en een tabel van de
grondoorzaken van deze scope die ze aanpakt, gekoppeld zodra je voorstelt —
de knop zegt *Oplossing voorstellen voor 1 grondoorzaak*. Het schrijft een
genummerd record (`SO-0003`) en verder niets. Een oplossing pakt alleen
grondoorzaken aan: een oorzaak die door iets diepers verklaard wordt is een
symptoom daarvan, dus haar lezer biedt geen *Oplossing* en wijst naar de
grondoorzaak, en een grondoorzaak die een oplossing aanpakt kan geen oorzaak
meer worden tot die oplossing verplaatst of losgekoppeld is. Voordat het als
**uitgewerkt** telt, heeft het nodig wat het team toch al zou vragen:
de verwachte baat en grove kosten, bij wie het getoetst is, en of iets
dergelijks eerder geprobeerd is — en zo ja, waarom het nu wel zou werken. De
lezer zet wat nog open staat onder *Om door te gaan naar…*, elke regel met
zijn invoer ernaast, en de knop blijft uitgeschakeld tot de lijst leeg is.
**Terug naar…** zet het op elk moment één stap terug.

Van uitgewerkt naar **wordt getest** is een **experiment** (`EX-0002`) nodig:
een hypothese, hoe het gemeten wordt, waar, door wie en wanneer. Een
experiment plannen vanuit de oplossing zet die in dezelfde stap op wordt
getest, en een experiment dat al bevestigd is telt ook. Zodra er een
**bevestigd** is, mag de oplossing naar **bewezen**. Sommige dingen zijn niet
uit te proberen; *Overslaan* vraagt dan een reden, en die reden blijft
bewaard. Een weerlegd experiment blijft staan, als het bewijs waar de volgende
om vraagt.

Over een bewezen oplossing wordt besloten op de pagina **Besluiten**. **Het
besluit voorstellen** schrijft een nieuw besluit waarvan de context noemt wat
de oplossing aanpakt en wat er verder is overwogen. Zodra dat besluit is
aanvaard, kan de oplossing naar **overgenomen**, en **Een plan starten**
schrijft het plan dat haar bouwt. Als dat plan **klaar** is, leest de
oplossing als **ingevoerd**, en **Heeft het gewerkt?** toont de waarnemingen
eronder: die zouden niet meer gezien moeten worden, en een die opnieuw gezien
wordt, wordt bij de oplossing gemarkeerd.

Twee vragen worden aan een oplossing gesteld zonder haar tegen te houden:
werkt ze alleen om een symptoom heen (ze is bewezen maar pakt geen
grondoorzaak aan), en ruimt haar plan iets op, of voegt het alleen toe? Een
oplossing die niet wordt doorgezet, wordt met reden **laten vallen** en
blijft staan als overwogen alternatief: ze staat bij elke andere oplossing
voor dezelfde oorzaken. Beide records zijn markdownbestanden, onder
`observations/solutions/` en `observations/experiments/`.

De lezer van een oplossing heeft dezelfde kleine knoppen als de analyse:
*Grondoorzaak* om er nog een aan te pakken zolang ze een idee of uitgewerkt
is, *Experiment* om er een te plannen zolang ze uitgewerkt is of getest
wordt, *Bewerken*, en *Laten vallen* en *Verwijderen*, die in `⋯` gaan waar
de lezer smal is. Een oplossing van een scope eronder, met Lokaal tonen aan
in haar kader getekend, wordt hier gelezen en in haar eigen scope bewerkt.

**Rechtsklik** op iets in de analyse of de tekening van de oplossingen voor
wat je ermee kunt — dezelfde acties als in de lezer, Bewerken daaronder — en
op een lijn — de verbanden van de analyse, de oorzaken van een oplossing, de
lijnen naar en vanuit een experiment — voor hoe sterk het verband is, of om
het los te maken. **Bewerken** geeft het record de hele breedte: de tekst
links, hoe het eruit komt te zien rechts, en de tekening terug zodra je naar
Lezen gaat.

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
dag verkeert, en een lijn met een venster verschijnt alleen daarbinnen. Een dag
kiezen verandert alleen wat uw venster toont: er wordt niets opgeslagen, niemand
anders ziet het, en een gestippelde rand om de knop zegt dat. Wilt u dat het bord
voor iedereen op die dag opent, kies dan **Opslaan** onder de datum — dat is wel
een bewerking, één regel in Activiteit, en ⌘Z draait hem terug. **Toon vandaag**
en dan **Opslaan** zet een gedateerd bord weer op de kalender.

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
dag die het bord achter de pagina toont. Relaties met een eigen venster staan onder de applicaties,
dichtgevouwen met een aantal op de kop, omdat een plan dat elke interface
verplaatst elke lijn een datum geeft.

De schuifbalk bovenaan verplaatst dat bord. Sleep hem en het canvas erachter
volgt, zodat de tekening en de as het niet oneens kunnen zijn over welke dag
wordt besproken. Net als de datumknop kijkt hij alleen: **Opslaan** op de balk van
het bord bewaart een dag.

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

**Initiatieven.** Een plan hoort bij het niveau dat het schrijft, en de roadmap
van een domein is die van het domein. Is een plan ook een zaak van de
organisatie — een migratie die het hele bedrijf volgt — zet dan **Initiatief**
aan op zijn pagina. Het verschijnt dan op de roadmap van elk niveau erboven,
onder *Initiatieven uit de niveaus eronder*, met het niveau waar het bij hoort
op een chip; daar wordt het gelezen en het wordt bewerkt waar het staat, en de
chip opent het daar. De roadmapkaart op het organisatiescherm telt ze mee. De
schakelaar is er niet op de organisatie zelf, die geen roadmap boven zich heeft.

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
geldig is nadat een van haar uiteinden is uitgefaseerd, een applicatie die nog
op een uitgefaseerd platform staat, en een plan dat over zijn einddatum heen is.

Eén regel is geen tegenstrijdigheid maar een ontbrekende plaat: koppelvlakken op
containerniveau tussen twee applicaties waar niemand een applicatiekoppelvlak
voor heeft getekend. **Overnemen** tekent het en laat elk van die lijnen erop
landen, in één stap — of laat het staan, en er gebeurt niets.

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
- **+ groepering** en **+ capability** binnen een gebied, en **+ capability**
  binnen een groepering. Een capability die rechtstreeks in een gebied gemaakt
  wordt is een kaartje in de kolom, en wordt een groepering zodra er iets in
  gezet wordt.
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
belanghebbenden, en het vergrootglas ernaast vindt alles op de pagina op naam —
kies een treffer, of druk op Enter voor de eerste, en de pagina scrolt ernaartoe,
selecteert het en omcirkelt het even.

Een applicatie openen vanuit de invulling van een capability brengt u naar een
bord dat hem ook echt tekent — desnoods een ander dan waar u stond — en naar de
eigen pagina van de applicatie als geen enkel bord hem tekent.

### De bedrijfskaart

**+** in de diagramtabs, dan **Bedrijfskaart**, maakt de tweede uitgelegde
weergave — of **Kaart** op de kaart *Bedrijfsarchitectuur* van het
organisatiescherm opent die van de wortel. Het is dezelfde laag, andersom
gelezen: elke functie onder elkaar, in de volgorde waarin het blad ze tekent en
ingesprongen naar diepte; een kolom per applicatie die de rijen noemen; een
markering waar de een de ander ondersteunt. Op een sectie — een gebied, een
groep — is de markering hol en betekent *iets hieronder*: het optelsel, zodat de
kop van een gebied zegt waar het hele gebied op leunt voordat u de capabilities
leest. Applicaties die een ander niveau bezit staan bovenaan gegroepeerd onder
de naam van dat niveau, want de systemen die de capabilities van de organisatie
ondersteunen zijn meestal die van een landschap, en een kolom die niet zegt van
wie hij is heeft de helft gezegd.

Twee kolommen komen laatst. **Mensen** is gemarkeerd waar iemand toegewezen is
— één kolom en niet één per belanghebbende, want "met de hand gedaan" is één
antwoord. **Dekking** is het gat: *ongedekt* bij een capability die niets en
niemand dekt, *mensen* bij een die met de hand gedaan wordt zonder systeem, en
bij een sectie hoeveel capabilities eronder ongedekt zijn. De bovenbalk telt de
drie op. Een kaart met een *per*-dag telt de rijen die op die dag gelden, dus
een systeem dat in maart iets gaat ondersteunen is op de kaart van februari een
gat.

Kies een rij en hij opent rechts, zoals op het blad — *Ondersteund door…*
inbegrepen, zodat een gat gedicht kan worden vanaf de pagina die het toont.
Kies een kolomkop om de applicatie te openen, waar dit niveau hem heeft.

### Technologie

Waar de applicaties op staan is een **platform** — een cluster, een namespace,
een broker, een cloudaccount, een firewall — en wat een platformteam aanbiedt
is een **platformdienst**: *Containerplatform*, *Berichtenverkeer*, *Beheerde
database*, *Identiteit*. Het zijn twee verschillende dingen op dezelfde laag.
Een dienst is wat een team vraagt en waar een platformteam voor
verantwoordelijk is; een platform is wat die dit jaar levert, en kan volgend
jaar vervangen worden zonder dat de dienst van naam verandert. Een platform
komt uit de onderste rij van het palet en landt als chip in de beheerlaag; een
dienst maak je op het technologielandschap, waar de laag getekend wordt, en
een bord tekent haar als chip met een eigen merkteken zodat de twee in één
oogopslag uit elkaar te houden zijn. Een platform zegt in het inspectiepaneel wat het is — een *plek* waar
iets in draait, een *dienst* die iets gebruikt, of een *netwerk*; een dienst
als niets gezegd is — en waar het **onderdeel van** is, wat maakt dat een
namespace in de app onder zijn cluster kan; een platform **realiseert** de
diensten die het levert. Een gedeeld platform of gedeelde dienst wordt meestal
in een eigen scope gedefinieerd en elders als stand-in getekend, zodat het
team dat het draait het record bezit.

**Een applicatie zegt één ding per vraag.** Waar een container draait is
*Draait op*, op het record van de component, en een applicatie krijgt te
horen wat haar containers zeggen: *Draait op: OpenShift (3 containers)*. Wat
een applicatie gebruikt is **Gebruikt**, en dat noemt de dienst, niet het
product: een team vraagt om berichtenverkeer, en welke broker dat levert is de
zaak van het platformteam, één keer gezegd als *Realiseert*. Van welke
platforms een applicatie werkelijk afhangt wordt uit die twee afgeleid — de
regel *Maakt gebruik van* op het record leest *Containerplatform (OpenShift),
Berichtenverkeer (Event broker)* zonder dat er iets op de applicatie getypt
is. Een platform rechtstreeks gebruiken mag nog steeds, voor het team dat
zich echt aan één exemplaar bindt; het inspectiepaneel biedt eerst diensten
aan.

**Gedeeld** op een dienst zegt dat hij wordt aangeboden voor gebruik buiten
het team dat hem onderhoudt — *Onderhouden door* noemt dat team. Organisaties
trekken die lijn verschillend, dus het vinkje is van jou; en waar niemand het
gezet heeft, zeggen de rijen het alsnog. Een dienst die door het ene team
wordt onderhouden en gebruikt wordt door een applicatie van een ander team
wordt aangeboden, of iemand dat nu gezegd heeft of niet, en de roadmap en het
technologieregister tonen dat als bevinding met de gebruikers erbij — een
gesprek om te voeren, nooit een vinkje dat het gereedschap voor je zet. Een
gedeelde dienst die nog niemand buiten het eigen team gebruikt is gewoon, en
geen bevinding.

**Het technologieregister**, een kaart op het organisatiescherm naast het
register van applicaties, is elke dienst en elk platform in de hele boom: wie
elk onderhoudt, welke gedeeld zijn, hoeveel applicaties ze gebruiken en uit
hoeveel scopes, wat elk realiseert — niets dat een dienst realiseert is een
echt gat, en zo wordt het getoond — en, voor een platform, wat het host met
alles wat eronder valt. Elke keer uit de mappen afgeleid, dus het kan er niet
mee in tegenspraak zijn.

**Twee rapporten, van elke kant één.** Dubbelklik op de chip van een
platform, of kies **Platformrapport** in het menu, voor wat er zou overblijven
als het wegviel: waar het in zit, wat eronder zit, wat erop of eronder draait
— elke container genoemd naast zijn applicatie en de namespace waar hij in
zit — wat het gebruikt, en de koppelvlakken op containerniveau die eroverheen
lopen, elk met het applicatiekoppelvlak waar het deel van is. Dubbelklik op de
chip van een dienst, of kies **Dienstrapport**, voor wat er zou stranden als
hij werd ingetrokken: wie hem onderhoudt, wat hem realiseert, wie erop leunt
en uit welke scopes, en welke gebruikers er nog op zouden zitten op de dag dat
hij verdwijnt. Geen van beide wordt getekend of gemaakt; beide worden elke
keer dat je ze opent uit de rijen afgeleid.

**Het technologielandschap** is het plaatje van dat alles: wie wat gebruikt,
wat wordt aangeboden en wat het levert, in drie banden op één pagina.
*Landschap* op de technologiekaart maakt er een in de scope waarvan het de
diensten en platformen moet tekenen — meestal de platformscope — en het staat
tussen de tabbladen zoals het blad en de kaart, en tussen de borden op de
home van die scope. Het tabblad kiezen toont het op de plek van het canvas,
zoals elk ander tabblad; een platformscope heeft geen bord nodig. Er wordt
**op gewerkt**: het palet ernaast biedt een platform en een platformdienst,
een `+` op een van beide banden voegt er een toe, een `+` in een groep zet
hem onder die groep, en de inspector rechts bewerkt wat je kiest — naam,
beschrijving, levenscyclus, *gedeeld*, wat het is, waar het deel van is, wat
het realiseert, wie het onderhoudt. De bovenste band is elke
applicatie die de regels aan die diensten en platformen verbinden, uit elk
landschap in de organisatie, in een vak per domein; de middelste band zijn de
diensten, genest waar ze nesten; de onderste band zijn de platformen, genest
waar de boom nest, een buitenstaander gestippeld. Niets wordt getekend of
gesleept: elke kaart en elke lijn wordt elke keer uit de regels gelezen. **In
rust zijn er geen lijnen** — de kaarten dragen de aantallen — en over een
kaart zweven toont haar lijnen, klikken zet ze vast, dempt alles wat ze niet
raken en opent het record rechts, van waaruit de rapporten openen. *Diensten
verbergen* vouwt de middelste band tot een strook en tekent waar elke
applicatie werkelijk op steunt rechtstreeks naar de platformen, zoals de
regel *Steunt op* op het record het leest; *Alle lijnen* is de nooduitgang.
Boven de veertig applicaties beginnen de domeinen dichtgevouwen tot één vak
elk met een aantal, en filteren op naam opent de treffers; een domeintitel
vouwt met de hand open en dicht.

**Gehost op een platform dat een andere scope definieert.** *Draait op*
toont, onder *Elders in de organisatie*, elk platform dat de rest van de
boom definieert, plekken eerst en elk met zijn scope; er een kiezen
schrijft de stand-in voor je, in dezelfde stap als de regel. De bibliotheek
naast het palet toont de platformen en diensten van de boom na de
applicaties. En **hosting impliceert de dienst**: een container op Azure
Cloud steunt op de clouddienst die Azure Cloud realiseert, of iemand nu een
*Gebruikt*-regel schreef of niet — het record zegt *(impliciet door
hosting)*, het technologielandschap tekent het gestippeld en telt het mee,
en een later geschreven *Gebruikt*-regel is hetzelfde feit hardop gezegd.

**Vastleggen wat een applicatie gebruikt.** Het record van een applicatie
heeft naast *Draait op* een kiezer **Gebruikt**: de regels die het heeft als
labels, en een doorzoekbare lijst met eerst de diensten en dienstplatforms
van deze scope en dan — onder *Elders in de organisatie* — elke dienst die
een andere scope gedeeld noemt en elk dienstplatform dat de boom kent, elk
met zijn scope. Vink er meerdere aan en sluit: één stap, één ongedaan
maken, en een vinkje bij iets van elders schrijft de stand-in mee met de
regel. Hetzelfde paneel staat naast het technologielandschap, en het
landschap heeft één gebaar van zichzelf: **sleep een applicatiekaart op een
kaart in de onderste banden**. Een plek neemt *Draait op*, een
dienstplatform of een dienst neemt *Gebruikt*, een gedeelde dienst brengt
haar stand-in mee; zolang een applicatie geselecteerd is tonen de doelen
dezelfde twee werkwoorden als kleine knoppen. Hostinglijnen worden nu
getekend, want in een scope zonder diensten is dat de enige lijn die een
applicatie heeft; *Hosting samenvouwen met dienstlijnen* verbergt er een
waar een gebruik hetzelfde platform al bereikt. Een rij **Gedeeld in de
organisatie** binnen de dienstenband toont elke dienst die andere scopes
gedeeld noemen, gedimd tot iets hier er een gebruikt; een scope zonder
diensten toont de band als een strook en de platforms schuiven omhoog.
Onder *Steunt op* op het record van een bord opent *Toon op
technologielandschap* het landschap op die kaart. Het bord zelf tekent nog
altijd alleen stromen.

**Kleuren op** in de werkbalk van het landschap kleurt de kaarten op platform
— het cluster, niet de namespace — of op levenscyclus van de techniek, zodat
de kaarten die op iets staan dat uitgefaseerd wordt amber worden, de hele
keten meegerekend — of op **één platform of dienst**: elke applicatie die
het gebruikt, erop gehost is of erop steunt wordt gekleurd en de rest
vervaagt, de omgekeerde vraag: wie staat hierop. De badge **platform** leest af waar de containers op staan
als niemand hem heeft gezet, en de bevindingen van de roadmap melden een
applicatie die nog op een platform staat nadat dat, of iets erboven, is
uitgefaseerd, met het platform erbij dat werkelijk verdwijnt.

**Wat een platformteam ermee doet.** Definieer de diensten die je aanbiedt in
een eigen scope, elk toegewezen aan je team en gemarkeerd als gedeeld; zet de
clusters, brokers en accounts die ze leveren met *Onderdeel van* onder elkaar
en zeg wat elk realiseert. Elk landschap tekent je diensten dan als stand-in
en zijn applicaties zeggen welke ze gebruiken; het register vertelt je wie op
wat leunt, het dienstrapport wie er zou stranden vóór je er een intrekt, en de
bevinding welke dingen van je eigen team andere teams stilletjes zijn gaan
gebruiken.

## Zoeken

**Zoeken** in de bovenbalk, of ⌘K, doorzoekt alles in één keer: elementen op
naam, categorie, leverancier, technologie en eigenaar; documentatie op wat erin
geschreven staat; aanzichten op naam; relaties op label, protocol en
technologie; besluiten, plannen en hun mijlpalen; en waarnemingen, oorzaken,
oplossingen en experimenten op hun titel en wat erin staat. Het leest de scope
waarin u werkt, de besluiten van de scopes erboven, en wat de rest van de
organisatie vastlegt aan elementen, relaties, plannen en waarnemingen. Elke
treffer zegt wat hij is — een kop per soort, en de soort van het element of de
status van de vastlegging ernaast — en in welke scope hij staat. Een element
kiezen selecteert het en schuift ernaartoe, een documentatietreffer opent de
pagina van dat element, een relatie opent het blok waar ze vertrekt, en een
vastlegging opent op haar eigen pagina; een treffer uit een andere scope opent
die scope daar, alleen-lezen waar uw bron dat is. ⌘F in de editor blijft de snelle zoeker als u alleen een blok op
het canvas zoekt.

## Diagraminstellingen

Rechtsklik een diagramtabblad, **Diagraminstellingen…**.

- **Op de tekening.** Auteur, opdrachtgever en datum voor het titelblok van een
  PNG-export — leeg gelaten vallen ze terug op de standaard van het project of
  de dag van export — en of het titelblok überhaupt getekend wordt.
- **Operationele aspecten.** De aspectkolommen die applicaties op dit diagram
  dragen: voeg een standaardkolom toe (platform, CI/CD, DR, beveiliging,
  monitoring, back-up, compliance, kosten), voeg een eigen kolom toe, hernoem,
  herschik, of zet de badges helemaal uit. Een kolom hernoemen bewaart elke
  status die er al tegen is vastgelegd.

## Bewaren, exporteren, delen

Twee uitgangen, voor twee doelen.

- **Het werkbestand** (`.lvarch`) is alles, en is wat je aan iemand geeft die
  verder gaat bewerken. Het is je **hele organisatie** in één bestand, **verzegeld
  met een wachtwoord**: je wordt erom gevraagd als je de kopie bewaart — twee
  keer, want een verloren wachtwoord is niet terug te halen — en wie het
  bestand opent wordt er opnieuw om gevraagd. Zonder wachtwoord is niets van
  de inhoud te lezen. Het bevat elke scope, op welk scherm je ook staat als
  je exporteert — het startscherm van de organisatie, dat van een scope of een
  geopend bord: een landschap op zichzelf verwijst naar applicaties die een
  niveau hoger gedefinieerd zijn, en een bestand met alleen dat landschap
  erin zou op andermans machine opengaan vol namen die nergens heen wijzen.
  Het bestand heet naar je organisatie. Werkbestanden van eerdere versies
  openen gewoon, verzegeld of niet, en een bestand met één scope erin opent
  nog steeds als die scope. Het is ook hoe werk **tussen plekken** verhuist:
  een bestand dat uit de map van de desktop is bewaard, opent in deze browser,
  of andersom, byte voor byte hetzelfde, met afbeeldingen en al. **Bij het
  openen wordt gevraagd waar het heen moet**:
  - **Een nieuwe map…**, waar een map gekozen kan worden, maakt er een eigen
    werkmap van en brengt je daarheen; wat je open had blijft onaangeroerd.
    Een map die al iets bevat wordt pas na een tweede ja overschreven.
  - **… hier vervangen** schrijft het over de scope waar je staat en alles
    eronder heen, en zegt dat vooraf. Waar een geschiedenis wordt
    bijgehouden, wordt eerst een momentopname gemaakt, zodat wat er stond
    kan worden teruggezet. Waar er geen wordt bijgehouden, is het weg.

  Elke scope in het bestand komt aan, of geen enkele. Is het aangekomen, dan
  controleert de app wat er aankwam tegen wat het bestand zegt te bevatten,
  en zegt dat.
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

## Werken met een agent

Uw codeeragent — Claude Code, Codex, Cursor of een andere MCP-client — kan
verbinding maken met de desktop-app (*Een agent koppelen…* op de balk, of
het symbool naast het menu) en in de organisatie werken terwijl u meekijkt.
De agent leest elke scope en kan de app bewegen zoals u dat doet: een scope
openen, naar een bord of een blad gaan, de besluiten of de roadmap openen,
de waarnemingen openen op het tabblad Register, Analyse of Oplossingen, een
rapport bekijken. Hij kan een bord, een blad, een kaart of een
technologielandschap openen met één ding daarop geselecteerd, als die
weergave het tekent. U hoeft er niets voor open te zetten, en een weergave
openen maakt er nooit een: heeft een scope geen weergave van de soort die de
agent vraagt, dan krijgt de agent dat te horen en blijft het scherm waar het
is — er een maken is een wijziging als elke andere. Wat hij opent, ziet u
ook, dus de pagina van een record die over het bord open stond, gaat dicht.

Zolang de agent de app beweegt of het model wijzigt, zegt een strook onder
in het venster dat, met de naam van de agent en — als die dat heeft gezegd —
waar hij mee bezig is. Wat u ondertussen aanklikt, kan veranderen wat de
agent daarna ziet; daarom staat de strook er, zodat u het weet voordat u
klikt. **Stoppen** op die strook beëindigt de sessie van de agent: de strook
verdwijnt, de agent hoort het bij zijn volgende aanroep en wordt geacht te
melden hoe ver hij was in plaats van door te gaan. Hij kan vragen om verder
te mogen; zegt u dat, dan begint een nieuwe sessie en is de strook terug.

Alles wat een agent wijzigt, staat in Activiteit onder zijn naam en wordt
ongedaan gemaakt met ⌘Z, zoals altijd.

## Voorkeuren

Raster, uitlijnen op raster, levenscyclusbadges, ingeklapte panelen en hun
breedte, het overzichtskaartje, de Tidy-instellingen, de taal en het thema
worden per browser of per desktopinstallatie onthouden. Ze zijn van jou, niet
van het project: ze reizen niet mee in een bestand. Hetzelfde geldt voor wat
deze machine met een map doet — ophalen bij openen, pushen na een
momentopname: de desktop bewaart dat bij de installatie en schrijft niets van
zichzelf in je map.

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
| ⌘[ ⌘] op macOS, elders Alt+← Alt+→ | Terug, Vooruit, in de desktop-app; in een browser die van de browser |

Op Windows en Linux lees je Ctrl voor ⌘.
