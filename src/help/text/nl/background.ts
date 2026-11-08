// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the manual said that the sections do not: how things work, by topic,
 * carried into the help when the manual went (4.0.0). Markdown, read by
 * `help/markdown.ts`; each topic is headed by the manual's own heading.
 */
import type { Backgrounds } from '../../types'

export const BACKGROUND: Backgrounds = {
  start: [
    { title: `Beginnen`, text: `**Desktop.** Download de app voor je platform van
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download).
De app kijkt op de achtergrond of er een nieuwere versie is en vraagt eerst
voordat hij er iets mee doet — **Download and Install** haalt hem op
terwijl je doorwerkt, **Skip This Version** zegt deze niet, en het vinkje in
dat venster zet de automatische controle uit. Is de download klaar, dan vraagt
de app je opnieuw te starten; **Later** installeert hem de volgende keer dat je
de app afsluit. Waar de app zichzelf niet kan vervangen — rechtstreeks gestart
vanaf de schijfkopie, of vanuit Downloads zonder naar Programma's verplaatst te
zijn — zegt hij dat en opent hij in plaats daarvan de downloadpagina.
**Zoeken naar updates…** in het Help-menu vraagt het op verzoek.

**Browser.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/)
is de nieuwste release, zonder iets te installeren. Je kunt hem ook draaien
vanuit een kloon van de repository: eenmalig \`npm run setup\`, daarna
\`npm run dev\`, en open <http://127.0.0.1:5200>. Waar de browser het aanbiedt
(Chromium doet dat), kan een tabblad net als de desktop in een map werken.
Anders wordt je werk in die browser bewaard; een privévenster houdt het maar
zo lang als de browser dat doet. *Waar je werk wordt bewaard* zegt meer.

In beide gevallen verlaat niets je computer. Er is geen account, geen backend
en geen telemetrie.` },
    { title: `Het organisatiescherm`, text: `**Het voorbeeld.** Een organisatie waar nog niemand aan begon, opent op een eerste pagina: geef de jouwe een naam, kijk rond in het voorbeeld, of ga verder met een bestand of map die je hebt. **Voorbeeld openen** is een plek om te bezoeken: een band op elk scherm zegt dat je erin bent, je kunt alles proberen, er wordt niets bewaard en je eigen werk blijft onaangeroerd. **Voorbeeld overnemen** maakt wat je ziet tot je organisatie (onder een eigen scope als de jouwe intussen iets is geworden); **Voorbeeld verlaten** gaat terug zonder dat er iets veranderd is.` },
  ],
  frame: [
    { title: `Het organisatiescherm`, text: `De app opent op de **organisatie**: een scope als elke andere, en de
scope waaronder al het andere valt dat je bewaart. Een **scope** is één document:
een naam, een landschap, de containerdiagrammen eronder, de besluiten, de
plannen, de bedrijfsarchitectuur en alles wat erop staat. Scopes
**nestelen**, en ze zijn allemaal hetzelfde document — de organisatie bovenaan,
een **domein** of een **team** eronder, een **landschapsscope** daar weer
onder, zo diep als je werk vraagt. Een landschapsscope is een scope; een
landschap is ook een soort bord, en dat is een tekening binnen een scope.

**Bediend door**, onder de kaarten, overal waar de organisatie eenheden heeft
— maar niet op de eigen startpagina van de organisatie, want de organisatie
is geen domein en geen eenheid bedient haar: de eenheden die deze scope
bedienen, in de volgorde van hun types, elk met wie
vandaag haar aansturende rol vervult en waar ze is ingedeeld als dat ergens
anders is. Een eenheid bedient de domeinen die haar **Bedient** noemt, of de
scope waarin ze is ingedeeld als ze er geen noemt — tenzij dat de organisatie
is: daar bedient een eenheid niets tot ze een domein krijgt — en een eenheid onder een
die een scope bedient, bedient die via haar — die worden geteld in plaats van
opgesomd. **+ Eenheid** kiest er een uit de hele organisatie: de lijst is
gegroepeerd per eenheidstype, zegt waar elke eenheid is ingedeeld en wordt
korter terwijl je typt; een eenheid waarvan het type één domein bedient, of
die wordt bijgehouden waar je alleen mag lezen, staat erin en zegt waarom je
haar niet kunt kiezen. Een eenheid toevoegen, of **✕** ernaast, verandert wat
die eenheid bedient: één stap in de scope die de eenheid bijhoudt, en daarom
alleen aan jou waar je die scope mag wijzigen — een rol die mensen aanstuurt
reikt daar niet. Onder de eenheden de **domeineigenaar**: wie de rol vervult
die de regel *domeineigenaar* van de organisatie noemt, in de bedienende
eenheid die het hoogst in deze scope is ingedeeld. Die wordt op de dag
uitgerekend en nooit bewaard. Een klik op de naam van een eenheid opent haar
waar ze wordt bijgehouden — op het organogram van die scope, gekozen, waar die
er een heeft — en haar paneel zegt hetzelfde van de andere kant, waar elk
domein weer de startpagina van dat domein opent.

**Het type volgt de eenheid.** Een eenheid aan een scope koppelen — **+
Eenheid** hier of in de instellingen, **Bediend door** in de dialoog voor een
nieuwe scope, **+ Domein** in de inspector van een eenheid op het
organogram, de domeinen van een nieuwe eenheid, of de assistent — geeft de
scope in dezelfde wijziging het type van die eenheid, tenzij het type dat ze
al heeft nog dat van een eenheid is die haar bedient: een scope die door een
divisie wordt bediend blijft *Divisie* zeggen als er een team onder wordt
toegevoegd. Een eenheid loskoppelen laat het type staan, en de koppeling
ongedaan maken ook. Onder **Bediend door** zegt een regel hoe de twee zich
verhouden: *Type Divisie, zoals een eenheid die haar bedient*; in de
waarschuwingskleur *Type Team, terwijl de eenheden die haar bedienen van
type Divisie zijn*; *Type Team; nog geen eenheid bedient haar*; of, waar de
scope geen type uit het besturingsmodel zegt, welke eenheden van welke
types haar bedienen, zodat het type gezet kan worden. De badge op de regel
van de scope in de boom waarschuwt op dezelfde manier, en de controles
noemen de drie gevallen die niet kloppen (*De pagina Controles*).

Hernoemen hernoemt alleen het label — waar iets staat is zijn adres, en
hernoemen is niet verplaatsen. Verplaatsen verandert het adres van de scope
en van alles eronder, en laat de inhoud ongemoeid: elke verwijzing elders in de
map die naar iets in die tak wees, gaat in dezelfde stap mee naar het nieuwe
adres, zodat een verplaatsing geen spoor van verouderde kopieën achterlaat. Zo
ook elke oorzaak die een van zijn oorzaken verklaart, en elke waarneming die een
van zijn waarnemingen opnam: die noemen het bij zijn adres, en gaan mee. Zonder
adres opent de app op de startpagina van de organisatie, met **Verdergaan**.

Zeven namen worden geweigerd, omdat de mappen van een scope ze al gebruiken:
\`diagrams\`, \`docs\`, \`decisions\`, \`transitions\`, \`observations\`, \`images\` en \`logos\`.` },
    { title: `Terug en Vooruit`, text: `**Terug gaat naar de plek waar je hiervoor was**, en Vooruit naar de plek
waarvandaan je terugkwam. Een plek is de startpagina van een scope en de pagina
daarop, of een open scope op zijn weergave of op de pagina daarover: zijn
besluiten, zijn waarnemingen, zijn roadmap, een plan, het rapport van een
platform of een dienst. Elke stap naar een andere plek telt, of je hem zette
met de boom, een kruimel, een kaart, een zoekresultaat of een link op een
pagina, of dat een agent hem voor je zette. Heeft een agent een scope
geopend, dan brengt Terug je naar waar je was. Wat geselecteerd is, de dag
waarop een bord wordt getoond, een filter en een open dialoog horen niet bij
een plek, en een ander record kiezen op de pagina met besluiten of
waarnemingen, of een ander tabblad van de waarnemingen, is ook geen stap: het
adres noemt het tabblad dat open is, dus herladen blijft daarop. Terug is geen ongedaan maken: het verplaatst
het scherm en verandert niets, en {key:Mod+Z} blijft hoe je een wijziging terugdraait.

**In een browser** doen de knoppen Terug en Vooruit van de browser dit, met
hun toetsen en gebaren. Het adres noemt de plek waar je bent, na een \`#\`, dus
herladen blijft daar, en een adres gekopieerd uit de balk opent dezelfde plek
voor iedereen die hem mag lezen. De rest van het adres blijft zoals het was.

**In de desktop-app** begint de balk met een knop **‹** en een knop **›** (op
macOS na de knoppen van het venster), grijs als er nergens heen te gaan is.
Dezelfde stappen staan in het menu **Ga** als **Terug** en **Vooruit**, op
**{key:Cmd+[|Alt+Left}** en **{key:Cmd+]|Alt+Right}**. De
terug- en vooruitknoppen van de muis werken ook, en vegen tussen pagina's op
een Mac-trackpad als dat op *Veeg met twee of drie vingers* staat
(Systeeminstellingen → Trackpad → Meer gebaren → Veeg tussen pagina's). Ze
werken allemaal vanaf de startpagina van de organisatie en met een scope open.
Zolang er een dialoog open is, liggen de knoppen erachter en doen de toetsen,
de menu-onderdelen en de muisknoppen niets. De geschiedenis hoort bij het
venster: ze is weg als het venster sluit.

**Terug sluit een dialoog** als de pagina waarop hij werd geopend wordt
verlaten, zoals wanneer je die pagina op een andere manier verlaat. Tekst die
erin getypt was, wordt niet bewaard.

**Een plek die er niet meer is** wordt vervangen door de dichtstbijzijnde die
er wel is: een verwijderde weergave opent zijn scope op de eerste weergave
die over is, een verwijderd record opent zijn pagina zonder record, en een
verwijderde scope opent de startpagina van de dichtstbijzijnde scope erboven.
De lijst Activiteit zegt wat er werd verwijderd.` },
    { title: `Delen met een link`, text: `**Wat een link zegt.** Na de \`#\` komt het pad van de scope, een \`-\` die
het afsluit, en dan de pagina en het record: \`#/acme/rail/-/board/landscape\`
is het bord *landscape* van de scope *acme/rail*, \`#/acme/-/document/billing\`
de pagina van het element *billing* in *acme*, en \`#/-/home\` de startpagina van de
organisatie. Een tabblad of een selectie volgt als \`?tab=analysis\` of
\`?select=billing\`. Een link van vóór versie 3.7.0, die met \`#place?\` begint,
opent nog steeds dezelfde plek, en het adres wordt daarna in de nieuwe vorm
geschreven. Een link die je in de adresbalk plakt van een venster dat al open
is, gaat daar ook heen.

**Een link naar de pagina van een element opent die altijd**, waar het element
ook bewaard wordt: een element dat geen weergave tekent, een eenheid van een
scope die niets tekent, en een element van een andere scope, dat opent
in de scope die het bewaart. Sluit je de pagina in een scope die niets
tekent, dan kom je op de startpagina van die scope. Een link naar een element
dat er niet meer is, opent de scope en zegt dat.

**Op een weergave selecteert de link wat jij geselecteerd had.** Deel je vanaf
een bord, een blad, een ondernemingskaart, het technologielandschap of een
organogram met één element of eenheid geselecteerd, dan opent de link die
weergave met dat weer geselecteerd — op een organogram de eenheid waar je
naartoe ging, waar die ook bewaard wordt; op een blad en een kaart wordt het ook even omlijnd. Een record waarop een link
opent — een besluit, een waarneming, een oorzaak, een oplossing of een
experiment — wordt op dezelfde manier in beeld gebracht en omlijnd, in de lijst
of in het plaatje.

**Een link heeft een adres nodig dat een ander kan bereiken.** Werk in een map,
in deze browser of nergens heeft dat niet; dan zegt het venster waarom er geen
link is, en wordt er niets gekopieerd. Het menu-onderdeel werkt vanaf elk
scherm, ook vanaf de startpagina van de organisatie.` },
    { title: `Zoeken`, text: `**Zoeken** in de bovenbalk, of {key:Mod+K}, doorzoekt alles in één keer: elementen op
naam, categorie, leverancier, technologie en eigenaar; documentatie op wat erin
geschreven staat; weergaven op naam; relaties op label, protocol en
technologie; besluiten, plannen en hun mijlpalen; en waarnemingen, oorzaken,
oplossingen en experimenten op hun titel en wat erin staat. Het leest de scope
waarin je werkt, de besluiten van de scopes erboven, en wat de rest van de
organisatie vastlegt aan elementen, relaties, plannen en waarnemingen. Elke
treffer zegt wat hij is — een kop per soort, en de soort van het element of de
status van de vastlegging ernaast — en in welke scope hij staat. Een element
kiezen selecteert het en schuift ernaartoe, een documentatietreffer opent de
pagina van dat element, een relatie opent het blok waar ze vertrekt, en een
vastlegging opent op haar eigen pagina; een treffer uit een andere scope opent
die scope daar, alleen-lezen waar je bron dat is. {key:Mod+F} in de editor blijft de snelle zoeker als je alleen een blok op
het canvas zoekt.

De startpagina van de organisatie en die van elk domein hebben dezelfde
**Zoeken** in hun balk, en {key:Mod+K} werkt daar ook, zonder dat er iets open is: het
leest eerst de scope van die startpagina en dan de rest van de organisatie, en
een treffer opent de scope die hem bevat, op dezelfde pagina als een treffer van
binnen de scope.` },
    { title: `Ongedaan maken`, text: `**{key:Mod+Z}** dekt alles, in de volgorde waarin je het deed: een blok verplaatst, een
diagram hernoemd, een besluit aanvaard, een projectinstelling gewist. Een naam
typen is één stap in plaats van één per letter, en een sleep met de lijnen die
erna opnieuw worden gelegd is één stap — dus één keer terug geeft je wat je had,
niet wat je een toetsaanslag geleden had.

**Activiteit** in de bovenbalk toont die stappen met hun naam en tijd. Het is
een verslag, geen weg terug: naar een regel springen roept een vraag op ("en
alles daarna?") die {key:Mod+Z} al beantwoordt.` },
    { title: `Sneltoetsen om te kennen`, text: `| Toetsen | Doet |
|---|---|
| \`?\` | Alle sneltoetsen |
| F1 | De help, bij het scherm waar je bent |
| {key:Mod+F} | Element zoeken |
| {key:Enter} | Gegevenspagina openen |
| F2 | Selectie hernoemen |
| {key:Delete} | Selectie weghalen, na navraag |
| {key:Mod+Z}, {key:Mod+Shift+Z} | Ongedaan maken, opnieuw — één stapel over alles |
| {key:Mod+C} {key:Mod+X} {key:Mod+V}, {key:Mod+D} | Kopiëren, knippen, plakken, dupliceren |
| Pijltjes, {key:Shift} Pijltjes | Verplaatsen per rasterstap, per pixel |
| {key:Shift+1}, {key:Shift+2}, \`=\`, \`-\` | Passend maken, 100 %, inzoomen, uitzoomen |
| {key:Shift+F10} | Het menu voor de selectie |
| {key:Mod+S} | Nu bewaren |
| {key:Cmd+[|Alt+Left} {key:Cmd+]|Alt+Right} | Terug, Vooruit, in de desktop-app; in een browser die van de browser |` },
  ],
  work: [
    { title: `Waar je werk wordt bewaard`, text: `Je werk staat op een van drie plekken, en de regel onder de naam op de startpagina
van de organisatie zegt welke:

- **in een map**: die van de desktop, of van een browsertabblad waar de
  browser er een aanbiedt;
- **in deze browser**: een tabblad zonder map;
- **nergens**: een tabblad waarin de opslag van de browser niet opengaat.

De bewaarde kopie (zie *Bewaren, exporteren, delen*) brengt je hele organisatie
van elk van die plekken naar elke andere.` },
    { title: `Een map`, text: `De eerste keer dat de desktop-app start vraagt hij om een **map om in te
werken**, en alles wat je maakt staat daar als bestanden die je kunt lezen:

\`\`\`
<jouw map>/
  scope.json                          de organisatie: naam, klant, koppelingen
  acme-logistics/                     een scope eronder
    scope.json                        hetzelfde bestand, een niveau dieper
    warehouse-landscape/              en nog een keer
      scope.json                      hoe het heet, en wat erin zit
      model.json                      de elementen en de lijnen ertussen
      diagrams/landscape.json         wat een weergave is
      diagrams/landscape.geometry.json     waar de elementen staan
      docs/warehouse.md               de omschrijving van een element, als tekst
      decisions/0007-one-writer.md    een besluit
      images/floor-plan.png           een afbeelding die een omschrijving toont
      logos/own.svg                   een logo dat je hebt geüpload
\`\`\`

Een map met een \`scope.json\` erin is een scope, en de mappen daarbinnen die
er ook een hebben zijn de scopes eronder. Verplaats een map in je
bestandsbeheer en de scope staat op zijn nieuwe adres. Een map die je nog
geen naam gaf, heet zoals de map zelf.

**Een map van een oudere versie opent gewoon.** De eerste keer dat deze versie
er een ziet, zet hij de hele boom om (\`project.json\` en \`group.json\` worden
\`scope.json\`). Op de desktop, waar de map een git-repository is, legt hij
eerst vast hoe de map eruitzag. Nog een keer draaien doet niets.

Er zit niets verstopt in de app. Zet de map in OneDrive, in Dropbox, op een
netwerkschijf of in een git-repository en hij gedraagt zich zoals alles daar.
**Vanuit een andere map werken…** op het organisatiescherm brengt je naar een
andere map; de mappen die je eerder gebruikte staan in **Bestand ▸ Recente map openen**,
elk onder de naam die hun organisatie zichzelf geeft.

**Alles wordt geschreven zodra het verandert**: drie seconden nadat je stopt
met bewerken, als je het venster verlaat, en als je het sluit. Alleen de
bestanden die echt veranderden worden herschreven, dus één element verplaatsen
herschrijft één klein bestand en verder niets. Een venster sluiten met
wijzigingen die nog niet bewaard zijn, bewaart ze eerst, in elk venster; de
app vraagt alleen iets als dat bewaren niet lukte.

**Je werk uit de browser meenemen.** Bewaarde deze browser al werk voordat je
een map koos, dan vraagt het kiezen **Je werk meenemen naar deze map?**:
- **Mijn werk erin kopiëren** kopieert elke scope die de browser bewaarde naar de
  map, met het personenregister, de instellingen van de organisatie en elke
  afbeelding, en leest daarna alles terug om het te vergelijken. Het venster laat
  zien hoe ver het is, en **Stoppen** stopt het tussen twee scopes. Daarna staat er
  wat de map bevat, per soort, en met naam alles wat niet is meegekomen, met de
  reden: scopes die niet konden worden geschreven, scopes die met rust zijn gelaten
  omdat de map daar ander werk bevat of omdat iemand ze intussen wijzigde.
  **Opnieuw proberen** gaat vanaf daar verder, en dat doet ook het opnieuw kiezen
  van de map: wat er al staat, wordt gelijk bevonden en met rust gelaten. Een map
  die al ander werk bevat, zegt dat voordat je antwoordt, en dat werk wordt nooit
  overschreven. De wijzigingsgeschiedenis en de benoemde versies blijven in de browser.
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
git-configuratie. De \`.git/config\` van een map mag instellen wat een repository
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
ingesteld (\`git lfs install\` stelt het voor jou in, en dan draait het), en voor
een remote die een map binnen de werkmap is.

Een browsertabblad kan ook in een map werken, waar de browser dat aanbiedt
(Chromium doet dat). De toestemming overleeft een herstart zelden, en erom
vragen vereist een klik. Een tabblad pakt een onthouden map dus alleen weer op
als de toestemming nog geldt, en begint anders zonder iets te zeggen in deze
browser. De desktop is degene die moet kiezen.` },
    { title: `Deze browser`, text: `Een tabblad zonder map bewaart je werk in deze browser, voor deze site. Het
label op de startpagina van de organisatie zegt **In deze browser**, en je werk
blijft daar na een herstart staan tot jij of de browser de gegevens van de
site wist. Na de eerste keer bewaren vraagt de app de browser om het ook te
bewaren als hij opslag opruimt; sommige browsers, Firefox bijvoorbeeld, leggen die
vraag aan jou voor. Browseropslag is klein, dus
de app zegt één keer dat hij voor ongeveer viervijfde vol zit: een browser
stopt zonder te vragen met bewaren. Heeft een ander tabblad nog een oudere
versie van de app open, of is de app in een ander tabblad bijgewerkt, dan zegt
een strook wat je moet sluiten of herladen voordat bewaren weer werkt.

**Werk dat een oudere versie bewaarde.** Eerdere versies bewaarden het werk
van een browser op een andere plek erin. Dat werk wordt bij elke start
overgenomen: gekopieerd, nooit verplaatst, en nooit over werk dat hier sinds
die tijd is gedaan. Is een scope op beide plekken veranderd, dan vraagt een
strook naar die scope: **De oudere kopie overnemen** (wat hier staat gaat
eerst de geschiedenis in) of **Houden wat hier staat**.

**Een privévenster** houdt je werk maar zo lang als de browser dat doet. De
meeste browsers openen hun opslag daar ook, dus het label zegt **In deze
browser**, en alles verdwijnt als het venster sluit. De app kan niet zien dat
het venster privé is: bewaar een bewaarde kopie om je werk te houden.

**Waar de opslag van de browser niet opengaat**, werkt de app vanuit het
geheugen en wordt niets wat je verandert bewaard. Een strook op elk scherm zegt
dat. Het label op de startpagina van de organisatie zegt **Nergens bewaard**, in de
waarschuwingskleur. De regel onder de naam zegt *Alles hier wordt nog nergens
bewaard — bewaar een bewaarde kopie om het te houden.*, en de eerste momentopname
zegt *Momentopnamen blijven bewaard zolang dit tabblad open is, en gaan ermee
weg.* Werk dat een oudere versie in deze browser bewaarde, wordt getoond. Bewaar
een bewaarde kopie voordat je het tabblad sluit.

Heeft de opslag van de browser na een paar seconden nog niet geantwoord, dan
wordt de pagina toch getekend. Een strook zegt dat, en je werk verschijnt
zodra de opslag antwoordt.` },
    { title: `Als het elders is gewijzigd`, text: `Een scope kan veranderen terwijl je hem open hebt: de checkout van een
collega, een synchronisatiedienst, jijzelf op een andere machine of in een ander
tabblad.
De balk zegt dan **Elders gewijzigd**, of **Hier én elders gewijzigd** als er
hier ook wijzigingen openstaan. Een strook boven de plaat vraagt welke versie
blijft:
- **Die van elders** leest hun versie en zet die in beeld.
- **Die van mij** speelt jouw wijzigingen opnieuw af op hun versie, zodat hun
  wijzigingen aan wat jij niet aanraakte blijven staan. Alleen waar dat wordt
  geweigerd, schrijft het de hele scope zoals het op je scherm staat over
  het hunne.
- **Kopie bewaren…**, met wijzigingen die hier openstaan, zet de jouwe eerst in
  een bewaarde kopie en laat de keuze voor later.

Er wordt nooit iets ongevraagd overschreven.` },
    { title: `Als een scope niet helemaal te lezen is`, text: `Is een deel van een scope niet te lezen, omdat een bestand ervan beschadigd
is of met de hand is veranderd, dan opent de scope om te bekijken en niet
om te wijzigen, en een melding noemt wat niet te lezen was. Waar je mag
schrijven waar de scope bewaard wordt, biedt die **Een bewaard bestand
binnenhalen…**, en **Terugzetten uit de geschiedenis…** waar een geschiedenis
wordt bijgehouden; in een map zegt hij ook dat je het bestand kunt herstellen en
de scope opnieuw kunt openen.
- **Terugzetten uit de geschiedenis…** opent de pagina Geschiedenis, waar **De
  hele scope terugzetten…** de hele scope maakt wat het was bij de
  momentopname die je kiest. Wat niet te lezen was, wordt eerst bewaard, als
  een punt in de geschiedenis of apart gezet naast de scope, en waar dat
  niet kan, wordt niets teruggezet.
- **Een bewaard bestand binnenhalen…**, of er een openen op de scope, zet het
  op dezelfde manier terug uit het bestand, en de vraag vooraf zegt dat.

Een punt in de geschiedenis dat bewaarde wat niet te lezen was, biedt **Bewaar
wat niet gelezen kon worden…**, dat het als een bestand van jezelf bewaart. Een
scope die een latere versie van de app schreef, opent alleen om te
bekijken: de melding zegt dat je de app moet bijwerken, en niets hier zet het
terug.` },
    { title: `De werkruimte`, text: `Alles wordt vanzelf bewaard terwijl je werkt: drie seconden nadat je stopt, als
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
in beide gevallen een bewaarde kopie, want anders is het werk weg als het tabblad
sluit. Elke melding (bewaard, geladen, mislukt) verschijnt in
die balk onderin.` },
    { title: `Bewaren, exporteren, delen`, text: `Twee uitgangen, voor twee doelen.

- **De bewaarde kopie** (\`.lvarch\`) is alles, en is wat je aan iemand geeft die
  verder gaat bewerken. Het is je **hele organisatie** in één bestand, **met een wachtwoord**: je wordt erom gevraagd als je de kopie bewaart — twee
  keer, want een verloren wachtwoord is niet terug te halen — en wie het
  bestand opent wordt er opnieuw om gevraagd. Zonder wachtwoord is niets van
  de inhoud te lezen. Het bevat elke scope, op welk scherm je ook staat als
  je exporteert — het startscherm van de organisatie, dat van een scope of een
  geopend bord: een landschap op zichzelf verwijst naar applicaties die een
  niveau hoger gedefinieerd zijn, en een bestand met alleen dat landschap
  erin zou op andermans machine opengaan vol namen die nergens heen wijzen.
  Het bestand heet naar je organisatie. Bewaarde kopieën van eerdere versies
  openen gewoon, met of zonder wachtwoord, en een bestand met één scope erin opent
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

  Het bestand neemt ook het **personenregister** mee. Vink **Zonder namen**
  aan als je het wachtwoord kiest, en iedereen gaat als pseudoniem mee in de
  kopie, zonder adres, een getekend besluit zonder de namen waarmee het
  getekend is, en een waarneming zonder de naam van wie haar vastlegde — voor
  een kopie die de organisatie verlaat. Een bestand
  openen geeft nooit een naam terug aan iemand die hier vergeten is, brengt
  nooit iemand terug die hier verwijderd is, en een bestand zonder namen
  neemt geen naam weg. Wie vergeten of verwijderd is waar het bestand gemaakt
  werd, is dat hier ook: vergeten reist met het werk mee.
- **PNG-export** (de downloadknop) opent een dialoog met een voorbeeld van de
  plaat zoals die vertrekt: in het lichte of het donkere thema, los van wat er
  op het scherm staat, met elk lijnlabel of alleen de kale lijnen, met of
  zonder het titelblok onderaan — klant, auteur en datum — en met of zonder de
  legenda eronder, die zegt wat de badge- en levenscycluskleuren betekenen. De
  export van een containerdiagram draagt zijn titel in de strook, de applicatie,
  een zin en de datum, altijd zijn legenda, en op verzoek elke lijn in woorden. Levenscyclusbadges kun je eerst uitzetten
  voor een schone plaat. Kon een logo niet worden ingebed, dan zegt de balk
  onderin welk. Een heel groot bord is tientallen megapixels en kost tijd om te
  tekenen, dus de dialoog zegt hoe groot de afbeelding wordt en de knop vraagt
  het eerst.` },
    { title: `Voorkeuren`, text: `Raster, uitlijnen op raster, levenscyclusbadges, ingeklapte panelen en hun
breedte, de minikaart, de instellingen van Ordenen, de taal en het thema
worden per browser of per desktopinstallatie onthouden. Ze zijn van jou, niet
van het project: ze reizen niet mee in een bestand. Hetzelfde geldt voor wat
deze machine met een map doet — ophalen bij openen, pushen na een
momentopname: de desktop bewaart dat bij de installatie en schrijft niets van
zichzelf in je map.` },
  ],
  board: [
    { title: `Tekenen`, text: `**Domeingroepen** zetten de applicaties die bij elkaar horen in één vak. Voeg er
een toe uit **Toevoegen** of het plaatmenu, geef hem een kleur, sleep applicaties
erin, leg hem apart netjes. Een groep weghalen laat zijn elementen staan.

**Containerdiagrammen.** Een applicatie kan een containerdiagram onder zich
hebben: de applicatie wordt de grens van dat diagram en haar componenten staan
erin. Je maakt er bewust een — rechtsklik de applicatie en kies
**Containerdiagram maken**, of klik op **Maken** naast *Containerdiagram* in
het paneel — en het is een stap in Activiteit als elke andere,
dus {key:Mod+Z} neemt het terug. Een kaart die er een heeft draagt een klein merkteken;
dubbelklik de kaart om het te openen. Dubbelklikken maakt er nooit een. Een
landschapstabblad toont zijn containerdiagrammen onder een pijltje: rechtsklik
daar op een regel, of klik op het pijltje achter de naam zodra het diagram open
is, om het te hernoemen, de **weergave-instellingen** te openen of het te
verwijderen. Verwijderen neemt de componenten mee en laat de applicatie staan.
Rechtsklik een landschapstabblad voor hetzelfde menu, met dupliceren erbij.
**‹** met de naam van het bord waar je vandaan kwam, of {key:Mod+Up}, brengt je
daar terug op zijn dag, met zijn zoom en wat geselecteerd was; een diagram dat
je opende vanaf een bord op een andere dag opent op die dag. {key:Mod+Down} op
een applicatie gaat erin, net als een dubbelklik of **Containerdiagram openen**
in haar paneel; haar kaart zegt hoeveel containers ze bevat.

**Waar het draait** op de balk tekent gestippelde kaders om de containers,
één per platform, genest zoals de platformen genest zijn
— de namespace in het cluster in het account — met een container die nergens op
draait buiten elk kader. Ze worden uit de rijen afgeleid en zijn niet te
verplaatsen: een kader staat waar zijn leden staan. Ze staan uit tot iemand erom vraagt, want
de kale C4-plaat blijft op één niveau, en de weergave onthoudt het.

**Toetsenbord.** {key:Tab} loopt langs de elementen op de plaat, {key:Enter} selecteert het
element onder de focus en {key:Shift+Enter} voegt het toe aan de selectie. De pijltjes
verplaatsen de selectie een rasterstap, met {key:Shift} één pixel. \`?\` toont alle
sneltoetsen.

Koppelingen en de namen van domeingroepen zitten in dezelfde rondgang, en {key:Enter}
selecteert ze ook; {key:Shift+F10} opent het menu van wat geselecteerd is, en {key:Enter} op
het element dat al geselecteerd is opent de documentatie ervan. Een koppeling
trek je zonder muis met **Koppeling starten naar…** uit het menu van een
element: ga met {key:Tab} naar het andere eind en druk op {key:Enter}. Op een tab van een
landschap toont ↓ de containerdiagrammen en opent {key:Shift+F10} het menu van de tab.
Een element, een baan of een groep groter of kleiner maken, een groep
verplaatsen en een koppeling een knik geven gaan nog met een aanwijzer.` },
    { title: `Elementen`, text: `Zeven soorten: applicatie, component, extern systeem, invoerkanaal,
beheertool, actor, en de domeingroep die ze bijeenhoudt — en, sinds de
fysieke weergave, een **platform**: een cluster, een broker, een bus, de
tooling, waar applicaties op draaien en wat ze gebruiken. Selecteer er een en
het **paneel** rechts toont het: zijn soort, een naam die afbreekt, één regel
feiten en drie tabbladen. Met niets geselecteerd is er geen paneel en heeft het
bord de breedte; klik op de naam van de weergave die open staat voor
**Deze weergave**, wat ze is en bevat en hoe ze wordt geordend. Elk feit is een rij van label en
waarde, en een klik maakt van de waarde een veld: {key:Enter} of verlaten bewaart,
{key:Escape} zet terug, en de voet zegt waar het veld voor is. Een veld zonder inhoud
blijft uit het paneel tot **+ Eigenaar, leverancier…** het toevoegt. De pagina van
het element, zijn **gegevenspagina**, toont dezelfde rijen met elk veld, een leeg
veld als streepje: beide komen uit één lijst, dus ze kunnen niet uit elkaar
groeien.

**Eigenaar.** De eigenaar van een applicatie is één veld: kies de eenheid die
ervoor verantwoordelijk is, of typ een naam, die gemarkeerd wordt als geen eenheid.
Het ene kiezen wist het andere.

**Zekerheid.** Een element of een lijn kan zeggen dat het **bevestigd** of
**aangenomen** is, als woord op de rij. Een aangenomen kaart wordt gestreept
getekend. Niets zeggen is dat niemand het heeft gezegd.

**Pictogrammen.** Ruim honderd ingebouwde tekens, doorzoekbaar op naam,
categorie en trefwoord in beide talen, in twee maten: klein in de kop, groot
voorop de kaart voor een plaat die van een afstand gelezen wordt.
**Een logo uploaden** in de kiezer voegt een eigen SVG of PNG toe (tot 200 kB). Geüploade
logo's reizen mee in de bewaarde kopie.

**Meer dan één tegelijk.** Selecteer er meerdere en het paneel noemt ze en zegt wat elk veld bevat, *Live, alle 3* of *Gemengd*. Levenscyclus, kleur, pictogram en domeingroep voor elementen, en protocol, technologie, periode, richting, kleur en lijnstijl voor lijnen, één stap in Ongedaan maken per wijziging. Bij beide soorten staat boven elk deel wat het wijzigt. **Ordenen** en **Weghalen** staan er ook.

**Soort wijzigen.** Rechtsklik een element, **Soort wijzigen ▸**, en kies wat
het had moeten zijn; koppelingen, omschrijving en plaats blijven. Twee gevallen
worden geweigerd, met de reden erbij: een applicatie met een containerdiagram,
en een component dat nog aan een applicatie hangt.

Elementen horen bij het model, niet bij een diagram: één element kan op
meerdere diagrammen staan, en **Uit deze weergave halen** is iets anders dan
**Uit het model verwijderen**. Verwijderen vraagt eerst, en zegt hoeveel
koppelingen meegaan. Een eenheid verwijderen neemt elke toewijzing erin mee,
ook beëindigde, alsof ze nooit gemaakt zijn: de vraag noemt wie wat niet
langer is — *Ada Lovelace is niet langer Product owner in Webshop.* — en één
keer ongedaan maken zet de eenheid en haar mensen terug. Wil je bewaren wie
wat vervulde, beëindig de eenheid dan op een dag: met haar levenscyclus, of
een plan (*Verandering in de tijd*).

De vraag over een eenheid begint daar: *Meestal is beëindigen bedoeld*, met
**Beëindigen op een dag…**, dat om haar laatste dag vraagt en haar beëindigt
zonder iets te verwijderen. Onder **Verwijderen** staat in korte regels wat
meegaat. **Erin** noemt de eenheden die eronder vallen, hier of in een andere
scope, en waar ze heen gaan: een niveau hoger, in haar ouder, waar hun type
daar mag staan, met **Andere keuzes** ingeklapt eronder; waar dat niet mag,
in een andere eenheid van haar type, gekozen uit een lijst, met **Ze een
niveau hoger zetten** gemarkeerd als *misplaatst* en **Ze ook verwijderen**,
dat alles eronder en de toewijzingen van hun mensen ook meeneemt. Applicaties
die haar als team noemen worden leeggemaakt en tonen als van niemand, en haar
koppelingen met de domeinen die ze bedient en de capabilities waarvoor ze
verantwoordelijk is gaan mee, waar ze ook bijgehouden worden. Het is één
wijziging: waar ook een andere scope verandert, is het deel van die scope
haar eigen stap, en kan de stap hier niet ongedaan worden gemaakt. Een actor
verwijderen zet wat erin zit een niveau hoger, in zijn ouder.` },
    { title: `Koppelingen`, text: `Sleep van het handvat van een element naar een ander, of rechtsklik en kies
**Koppeling starten naar…**. Een koppeling heeft een label, een protocol (wat
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
- **Hier een knikpunt toevoegen**, **Knikpunt weghalen**, **Terug naar automatische route**
  in het lijnmenu.
- **Route vastzetten** houdt een lijn precies zoals hij is, ook zonder knikken.
- **Aanhechten aan ▸** kiest aan welke kant van een element elk uiteinde
  vertrekt of aankomt, of houd {key:Alt} ingedrukt terwijl je een verbinding vanaf
  een specifiek zijhandvat sleept. Een gekozen zijde is een randvoorwaarde die
  de router respecteert, geen handgetekende route.
- Sleep het label van zijn standaardplek; **Labelpositie herstellen** zet het
  terug.

Op een heel druk bord — meer dan ongeveer honderdvijftig lijnen die om dezelfde
ruimte strijden — slaat het automatisch leggen over in plaats van er minuten
aan te besteden, en zegt dat in de balk onderin. Er gaat niets verloren: de
lijnen houden de routes die ze hadden, en alles wat je met de hand tekende
blijft precies zoals je het achterliet.` },
    { title: `Lay-out`, text: `**Ordenen** in de balk bevat het allemaal. **Bord ordenen** legt het diagram
automatisch, met een leesrichting (dwars, omlaag, of groepen dwars en hun
applicaties omlaag), de ruimte, en wat het moet laten staan. **Lijnen routeren**
tekent alleen de lijnen opnieuw en laat elk element staan;
**Alle lijnen opnieuw routeren** negeert wat je vastzette; **Routeren na elke verplaatsing** houdt ze
gerouteerd. Een domeingroep orden je apart vanuit zijn menu.

Ordenen werkt naast de app in plaats van erin, dus het venster blijft reageren
terwijl het loopt, en **Ordenen** is intussen een **Annuleren**. Op een diagram
van meer dan vierhonderd blokken slaat het over en zegt dat, in plaats van er
minuten over te doen: verdeel het bord over meerdere diagrammen, of orden één
domeingroep tegelijk.

Met de hand: **uitlijnen** en **verdelen** van een selectie via het paneel
of het rechtsklikmenu, een **raster** met optioneel uitlijnen, verplaatsen
met de pijltjes, **passend maken** ({key:Shift+1}) en 100 % ({key:Shift+2}).` },
    { title: `Weergave-instellingen`, text: `Klik rechts op het tabblad van een weergave, **Weergave-instellingen…**.

- **Op de tekening.** Auteur, opdrachtgever en datum voor het titelblok van een
  PNG-export — leeg gelaten vallen ze terug op de standaard van het project of
  de dag van export — en of het titelblok überhaupt getekend wordt.
- **Operationele aspecten.** De aspectkolommen die applicaties op dit diagram
  dragen: voeg een standaardkolom toe (platform, CI/CD, DR, beveiliging,
  monitoring, back-up, compliance, kosten), voeg een eigen kolom toe, hernoem,
  herschik, of zet de badges helemaal uit. Een kolom hernoemen bewaart elke
  status die er al tegen is vastgelegd.` },
    { title: `Tijd, en de dag die een bord toont`, text: `Elke applicatie kan **levenscyclusdatums** dragen naast haar levenscyclus: de dag
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

**Dag** op de balk van de weergave zegt welke dag het bord tekent. Op vandaag zegt het
niets bijzonders, en het biedt de dagen die de moeite waard zijn: wat een plan op een dag
heeft, wanneer iets live gaat of verdwijnt, op welke dag een bord is bewaard, en elke andere
via *Kies een dag…*. Een dag wordt getekend uit het model van vandaag met zijn datums: elke
kaart tekent de fase waarin hij op die dag is, en een lijn met een venster verschijnt
alleen daarbinnen. Open **Geschiedenis…** om te zien wat er op een dag echt is bewaard.

Naar een andere dag kijken is een toestand van het hele venster: een band noemt de dag, er
loopt een rand om het canvas, en het bord is alleen-lezen: het palet en de velden zijn
weggeborgen en ongedaan maken staat uit. Het is alleen op jouw scherm, niemand anders ziet
het, en het adres draagt het (\`?day=2027-06-01\`), dus een koppeling opent dezelfde blik.
**Terug naar vandaag**, of **Terug naar** de eigen dag van het bord, is één klik. **Maak dit
de dag van de weergave** in de band is de bewuste stap: één bewerking, één regel in
Activiteit, en {key:Mod+Z} neemt hem terug. Het werkt ook voor vandaag, wat een gedateerd bord terug
op de kalender zet. Een bord dat op zijn dag is bewaard, zegt die dag op zijn tabblad en
blijft daarop bewerkbaar, en wie een rol heeft, kan nog worden gewijzigd op de dag waar je
naar kijkt. Een containerdiagram dat vanaf een bord wordt geopend, neemt de dag van dat
bord mee, en de weg terug gaat naar dat bord.

Zo maak je een toekomstig diagram. Klik met rechts op een tab, kies **Dupliceren
per datum…**, kies een dag, en je hebt een tweede bord van hetzelfde landschap
zoals het er dan bij staat. Er is maar één model, dus de twee kunnen niet uit
elkaar lopen. Een geëxporteerde PNG van een gedateerd bord noemt de dag in de
titel.

**Vervangen door** benoemt de opvolger van een applicatie, en **Eigenaar** zegt
wie ervoor tekent. Eigenaar was een regel in het documentatiesjabloon; het is nu
een veld, zodat de controles van de roadmap een persoon kunnen noemen.` },
  ],
  panel: [
    { title: `Elementen`, text: `- **Eigenschappen.** Levenscyclus (gepland, live, uitfaserend, uitgefaseerd; als
  badge, uitgefaseerde elementen dimmen) en categorie, de eerste regels van de
  omschrijving (zie *Documentatie*), waar het draait, de ingevulde gegevenspagina, de
  **operationele aspecten** van een applicatie, een rij per stuk met een notitie op
  een klik, en wat erin zit. De kolommen stel je per diagram in bij de
  weergave-instellingen.
- **Vormgeving.** Accentkleur, vorm, pictogram, pictogramgrootte, en waar het in
  deze weergave staat.
- **Reacties.** De draad, met het aantal op het tabblad.

**⋯** naast de naam bevat **Verplaatsen…**, **Soort wijzigen** en
**Uit de weergave halen of uit het model verwijderen…**.` },
    { title: `Documentatie`, text: `Elk element heeft een omschrijving in markdown, en die kan een hele pagina zijn.
De eerste regels staan in het paneel; een klik schrijft ze daar met dezelfde
editor, en **De pagina openen** opent dezelfde tekst op de **gegevenspagina** van het
element. Dat doen ook de link naast de naam, **Gegevenspagina openen** in het
elementmenu, {key:Enter} op het geselecteerde element, en een dubbelklik op alles wat
geen applicatie is.

De pagina leest als één geheel: de tekst met haar inhoud, dan dezelfde rijen als
in het paneel met elk veld getoond, in elke stand klikken om te bewerken, en waar
het mee verbonden is: zijn plannen, elke lijn erin en eruit, de weergaven die het
tekenen, wat erin zit, de principes die het volgt, zijn wijzigingen en zijn
reacties. Links staan de andere elementen van de weergave, met een filter (een
teken toont wie al een pagina heeft). *Vormgeving* blijft naast het bord, waar de
kaart is.

**Bewerken** opent een venster met niets dan de bron en het resultaat ernaast;
**Velden** haalt de rijen erbij. {key:Mod+B} en {key:Mod+I} omhullen de selectie. De tekst wordt
bewaard na een korte pauze, één stap in Ongedaan maken voor het geheel. **Klaar**
beëindigt het schrijven, en **Annuleren**, of {key:Escape}, zet haar terug op wat ze was,
en vraagt het eerst als er iets is veranderd.

Een lege pagina kan **beginnen met het sjabloon**: een koptabel en de
gebruikelijke secties. De regel **Korte omschrijving** in die tabel is wat het
element op de plaat laat zien; zonder die regel is dat de eerste alinea.
\`[[Naam]]\` in de tekst wordt een koppeling naar dat element. Gewone koppelingen
openen buiten de app.

**Documentatie** in de bovenbalk opent de pagina van het geselecteerde element,
of van het eerste element op het diagram als niets geselecteerd is. Een
codeblok gemarkeerd als \`mermaid\` wordt op elke pagina als diagram getekend. Een blok
gemarkeerd als \`bpmn\` wordt als proces getekend: BPMN 2.0-XML zoals de gangbare
modelleerprogramma's het bewaren, met een eigen diagramsectie die zegt waar
alles staat — pools en banen, taken, gebeurtenissen, gateways, stromen en
berichten, alleen-lezen. De pagina van een proces-element is waar zo'n blok
hoort (zijn \`realises\`-lijn zegt van welke capability het de uitvoering is), en
een bestand zonder diagramsectie wordt als tekst getoond onder een regel die
zegt waarom.

**Afbeeldingen.** Plak of sleep een afbeelding in de tekst om haar toe te
voegen: PNG, JPEG, SVG of WebP. **Afbeeldingen** naast de bron toont elke
afbeelding die de scope heeft, met **Invoegen** om er een op deze pagina te
zetten en **Afbeelding verwijderen** om er een weg te halen. De tekst noemt een
afbeelding bij haar naam, \`![bijschrift](image:floor-plan.png)\`, waar de
scope ook wordt bewaard. Een pagina legt alle afbeeldingen meteen op hun
eigen formaat neer, en haalt er een pas op als die in beeld schuift. Een lange
pagina opent dus snel, en er verschuift niets als de afbeeldingen aankomen. Een
afbeelding die niet getoond kan worden, toont haar bijschrift. Alleen
afbeeldingen die bij de scope bewaard zijn worden getekend: een webadres
toont als bijschrift, en de app haalt nooit iets op.` },
    { title: `Verwijzingen in een document`, text: `Een document kan tonen waar het over gaat in plaats van het over te nemen.
Typ \`[[\` of een losse \`@\` waar je schrijft, of kies een soort bij
**Invoegen ▾**, en kies een principe, de eisen van een bouwsteen, de
beoordeling van een scope, een besluit, een waarneming, een weergave of een
element. Het document bewaart een verwijzing, en bij het lezen wordt het
getekend zoals het nu is: een principe als citaat, de eisen en de beoordeling
als hun raster, een besluit of een waarneming als een regel die het opent, en
een weergave live en alleen-lezen op zijn eigen grootte, met zijn naam eronder
die hem opent. Een beoordeling kan worden vastgezet op hoe ze was toen ernaar
verwezen werd; ze zegt dan wanneer ze sindsdien veranderd is. Wat er niet
meer is, zegt dat.` },
    { title: `Reacties`, text: `Een record zegt wat het zegt; een **reactie** is wat iemand *erover* zegt —
een vraag, een twijfel, een verwijzing naar meer bewijs — zonder het te
veranderen. Elke waarneming, oorzaak, oplossing en elk experiment, elk element
(ook eenheden), elk besluit en elk plan eindigt in zijn **Reacties**: de draad
over dat record, de oudste eerst, elk antwoord onder de reactie waarop het
antwoordt. Een kop zegt hoeveel het er zijn, en de rij van een waarneming in
het register toont het aantal naast de titel.

- **Reageren.** Schrijf in het veld onder de draad en klik op **Reageren**
  ({key:Mod+Enter} doet hetzelfde). De tekst neemt de Markdown die een beschrijving
  neemt.
- **Antwoorden.** Klik op **Antwoorden** onder een reactie. Een draad is één
  niveau diep: een antwoord op een antwoord antwoordt op de reactie waaronder
  het staat.
- **Bewerken.** Alleen je eigen reacties. Een bewerkte reactie zegt
  *bewerkt*.
- **Verwijderen.** Je eigen reacties, of die van iedereen waar je de scope mag
  wijzigen. Een verwijderde reactie leest *Reactie verwijderd* op de plek waar
  ze stond, zodat de antwoorden eronder hun plek houden. Haar woorden blijven
  in de geschiedenis, zoals bij elke bewerking.

**Wie het schreef** is een persoon uit het register, nooit een getypte naam.
De eerste keer dat je reageert en niemand op deze installatie *Dit ben ik* is,
vraagt de draad één keer wie er schrijft — kies jezelf, of voeg jezelf toe met
**Nieuwe persoon…** — en onthoudt het antwoord als *Dit ben ik*. Iemand
vergeten op de pagina Mensen bereikt elke reactie die die persoon schreef, die
dan als pseudoniem leest.

Elke reactie, bewerking en verwijdering is één stap: ze staat in de lijst
**Activiteit** (*Gereageerd op Webshop*), in de geschiedenis en in de export,
en {key:Mod+Z} maakt haar ongedaan. Een reactie verandert haar record nooit, dus de
geschiedenis van het record blijft van het record. Waar een scope hier alleen
gelezen wordt, kan niet worden gereageerd — tenzij de plek waar je werk wordt
bewaard een lezer laat reageren.

**Wat met een record meereist.** Een record verwijderen neemt de draad mee, en
ongedaan maken brengt beide terug. Waarnemingen of oorzaken samenvoegen
verplaatst de reacties van elk opgenomen record naar het overblijvende record,
elk met het record waarmee ze meekwam; het samenvoegscherm zegt hoeveel. Een
waarneming die naar een andere scope verplaatst, neemt haar draad mee, elke
reactie met de scope waar ze vandaan kwam; het verplaatsscherm zegt hoeveel.
Een samengevoegd of gearchiveerd record houdt zijn eigen reacties.

Reacties worden bij de scope bewaard, in \`_comments/\`, één bestand per record
waarop is gereageerd. **Zoeken** vindt wat een reactie zegt in de scope waarin
je werkt, opent het record waar ze over gaat en markeert de reactie in haar
draad. Een record dat vanuit een andere scope wordt getoond zegt dat de
reacties daar worden bewaard, met een link naar die scope.

Een agent reageert zoals jij (\`comments.list\`, \`comment.add\`, \`comment.update\`,
\`comment.remove\`): zijn reacties zijn door *jou* ondertekend, zeggen welke agent
ze schreef, en worden volgens dezelfde regels bewerkt en verwijderd.` },
  ],
  technology: [
    { title: `Technologie`, text: `Waar de applicaties op staan is een **platform** — een cluster, een namespace,
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

**Het technologielandschap** beantwoordt één vraag: wat staat waarop, en wat valt
er om als een stuk wegvalt. *Landschap* op de technologiekaart maakt er een in de
scope waarvan het de diensten en platforms moet tonen, en het staat tussen de
tabbladen. Het zijn drie kolommen met regels die je van links naar rechts leest:
elke applicatie die de gegevens aan die diensten en platforms koppelen, uit elk
landschap in de organisatie; de diensten; en de platforms, genest zoals de boom
nest, een extern platform gestippeld. Niets wordt getekend of geplaatst: elke regel
en lijn wordt uit de gegevens gelezen. **In rust zijn er geen lijnen.** Met de muis
op een regel zie je de lijnen, een klik zet ze vast, en er verschuift niets.
**Matrix** toont dezelfde regels als tabel, een gevuld teken voor gebruik en een hol
voor wat met de hosting meekomt; een klik selecteert, Spatie wijzigt een teken, en
een kop zegt wie erop staat. **Tonen** bevat de rest: de diensten, alle lijnen
tegelijk, verbergen wat de keuze niet raakt, hosting opvouwen in dienstlijnen, de
gedeelde rij, een regel per scope, en applicaties groeperen op scope of categorie.
Boven de veertig applicaties beginnen de groepen opgevouwen, en *Zoek op naam*
opent wat past. **Kleur** stelt één vraag tegelijk (waar het op staat, de eigen
levenscyclus, de categorie, wie verantwoordelijk is), met een legenda van wat er
staat, en schrijft niets tot *Bewaren bij de weergave*. **Dag** leest de hele pagina
op een andere dag: wat weg is staat er niet, en de pagina is alleen-lezen tot je
teruggaat. De lezer rechts zegt wat een regel is. *Als het wegviel…* opent het rapport,
net als een dubbele klik, en *Gegevens bewerken* opent het record in dezelfde kolom.
Het getal op de regel van een platform is het getal in het rapport: elke applicatie
die erop staat of op iets eronder, elk één keer.

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

**Vastleggen wat een applicatie gebruikt.** Het record van een applicatie heeft een
keuzelijst **Gebruikt** naast *Gehost op*, en de lezer van het landschap heeft dezelfde
twee: *Draait op*, en *Gebruikt* met een ✕ bij elk en
*Een dienst of platform toevoegen…*, met eerst wat deze scope heeft en dan wat de rest van de organisatie
aanbiedt; kies je iets van elders, dan wordt de stand-in meegeschreven.
**Gebruik bewerken** zet een vinkje op elke regel, een vakje voor gebruik, een rond teken voor
waar het draait en een holle ring voor wat de hosting al meebrengt, en een klik schrijft
of neemt terug, per keer één stap. Je kunt ook **een applicatieregel op een regel in een
andere kolom slepen**, en de pagina zegt het werkwoord voor je loslaat: een plaats krijgt
waar het draait, de rest krijgt gebruik. Een wijziging gaat naar de scope die de
applicatie bijhoudt, de lezer zegt welke, en ze staat in de Activiteit daarvan. De \`+\` op
een kolom vraagt een naam of biedt aan wat elders in de organisatie staat; het pictogram
en de rest staan in het record. *Toon op technologielandschap* op het record van een
bord opent het landschap dat de applicatie toont op die regel, in de scope die het bewaart —
vaak die van het platform waarop ze draait. Tonen er meer, dan noemt een klein menu elk met
zijn scope; toont geen het, dan is er geen link. Het bord zelf tekent nog steeds alleen stromen.

Wat je kiest is van jou en schrijft niets; **Bewaren bij de weergave**, in hetzelfde menu, maakt het tot wat iedereen opent.

**Kleuren op** in de werkbalk van het landschap kleurt de kaarten op platform
— het cluster, niet de namespace — of op levenscyclus van de techniek, zodat
de kaarten die op iets staan dat uitgefaseerd wordt amber worden, de hele
keten meegerekend — of op **één platform of dienst**: elke applicatie die
het gebruikt, erop gehost is of erop steunt wordt gekleurd en de rest
vervaagt, de omgekeerde vraag: wie staat hierop. Sinds 3.7.0 kleurt het ook
op **wat de gegevenspagina zegt** — de eigen levenscyclus van de kaart, haar
categorie, eigenaar, leverancier of technologie — en op de status in **één
operationeel aspect**, zodat *welke hiervan heeft geen eigenaar* en *welke
staan nog bij de oude leverancier* door kijken beantwoord worden. Elke kaart
in een band draagt de kleur van de band als waas, als balk langs haar
linkerrand en als **nummer**; de **legenda** in de hoek van het bord noemt
elke band met dat nummer en hoeveel kaarten erin staan, en blijft staan
terwijl je leest. Het nummer is de kern: twee kleuren zijn niet voor elk oog
verschillend, een nummer wel. De knop op de werkbalk zegt waarop het bord
gekleurd is, en ✕ op de legenda zet de kleuring uit. Een lezer mag elk
hiervan kiezen zonder te schrijven; de keuze wordt op de weergave bewaard
waar de sessie mag schrijven. De badge **platform** leest af waar de containers op staan
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
gebruiken.` },
  ],
  sheet: [
    { title: `De bedrijfsarchitectuur`, text: `Een blad wordt *gelegd*, niet getekend. Er valt niets te slepen en er is geen
router: wat het toont zijn vier bomen — een klantreis, de gebieden eronder, de
capabilities daarbinnen, en de belanghebbenden langs de zijkant — en de pagina
wordt berekend uit hun volgorde en hun diepte. Het krijgt een tab naast de
borden, en het openen laat het canvas staan waar het stond, zodat de tekening
waaraan je werkte er nog is als je terugkomt.` },
    { title: `De klantreis, en de paden erdoorheen`, text: `Bovenaan loopt één **klantreis**: wat de organisatie doet, van begin tot eind. De
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
kan zeggen dat een fase door niemand binnen wordt gedekt.` },
    { title: `Gebieden, en wat ze invult`, text: `Onder de klantreis staan de **gebieden**, elk met hun groeperingen en de
capabilities daarbinnen. De diepte is wat getekend wordt, en het model kent de
woorden niet: een item bovenaan is een gebied, een item daarin een groepering, en
een item daarin weer een capability.

Elke capability zegt wie hem invult:

- **een applicatie**, of meerdere — wat hem ondersteunt. Een capability met er
  twee waarvan er één uitfaseert is een migratie die je kunt zien.
- **mensen** — niemands software, iemands werk. Een volledig antwoord en geen
  gat: een pagina die dit als probleem tekende zou je aanraden software te kopen
  voor wat je met de hand doet.
- **nog niets** — geen van beide, en dát is het gat waarvoor je de pagina tekent.

Die staan in het model en niet op het kaartje: een capability is ingevuld omdat
iets in het landschap hem ondersteunt. **Ondersteund door…** in het paneel is
hoe die regel geschreven wordt, en zo'n ondersteuning kan een venster dragen
zoals alles met een datum, dus een capability die vanaf maart is ingevuld is
vanaf maart ingevuld.

**Domeinen**, in het paneel van een gebied, een groepering of een capability,
zegt aan welke domeinen het is toegewezen: een chip per domein, weg te halen
met het ×, en **+ Domein**, dat de scopes aanbiedt onder de scope van wie het
blad is, op hun pad en hun type. Elk domein erbij of eraf is één stap, terug te
draaien met {key:Mod+Z}. Daaronder noemt **Opgepakt door** elke scope eronder die het
heeft opgepakt, elk een weg naar de startpagina van die scope: een scope die
het oppakte zonder dat het was toegewezen staat in de waarschuwingskleur, en
een domein dat het kreeg en het nog niet oppakte zegt *nog niet opgepakt*. Een
capability waarvan het gebied is toegewezen zegt dat onder haar chips — *Met
Financiën: Retail* — en een domein dat de capability oppakte kreeg haar met het
gebied mee. Een pad dat geen scope meer heeft staat er als *geen bestaande
scope*. Een functie die een andere scope definieert laat zich hier niet
wijzigen: haar domeinen worden gezegd waar ze gedefinieerd is.

Een domein pakt een functie op vanaf zijn eigen blad: **Van boven…**, naast
**+ gebied**, toont de gebieden, groeperingen en capabilities van elk blad
erboven, gegroepeerd naar de scope die ze definieert en met waar elk in zit.
Kies er een en het blad van het domein houdt hem als stand-in — onder
zijn gebied waar het domein dat gebied heeft, anders als een eigen gebied — één
stap, terug te draaien met {key:Mod+Z}, en in de scope erboven wordt niets geschreven.
Een gebied dat wordt opgepakt na een van zijn capabilities neemt die capability
in dezelfde stap onder zich. Een keuze die niets oplevert — al opgepakt, of niet
meer van boven — zegt dat. Wat het domein eronder zet is zijn eigen verfijning. Een functie toewijzen en
haar oppakken zijn twee uitspraken van twee scopes, samen gelezen: geen van
beide schrijft de andere.

Onderaan staat een band voor wat **nog niet aan een domein is toegewezen** — de
gebieden die niet aan een domein zijn toegewezen en door geen domein zijn
opgepakt, met wat eronder staat meegeteld: een gebied waarvan één capability is
toegewezen, of eronder is opgepakt, telt als toegewezen. Dat is een bevinding,
geen fout: een lijst van wat de organisatie gezegd heeft te doen en nog niet
gezegd heeft wie het doet. Het getal op de kaart bedrijfsarchitectuur van de
organisatie leest hetzelfde.` },
    { title: `De belanghebbenden, en de eenheden`, text: `Langs de zijkant staan de **belanghebbenden**: de partijen waar de organisatie
mee te maken heeft, in hun eigen boom, die van buiten gemarkeerd. Een eenheid —
een actor met een eenheidstype, de eigen structuur van de organisatie — staat
daar alleen waar dit blad haar gebruikt, onder **Eenheden op dit blad**: een
eenheid die verantwoordelijk is voor iets dat het blad tekent (een gebied, een
groepering, een capability of een stap), of een met een baan in de klantreis.
Elk zegt in een regel onder de naam waarom. Een partij die in een eenheid is
ondergebracht houdt haar plek, met die eenheid als haar groep.

De andere eenheden van de scope worden onder de lijst geteld — *Hier staan nog 8
eenheden* — en **Alle eenheden** tekent ze erbij, onder
**Alle andere eenheden**. Dat is van jou en geldt zolang de app open is, per blad; in het model
verandert er niets. Eenheden maak en ordent je in het organogram, niet hier.

Een belanghebbende die je een eenheidstype geeft terwijl het blad open is,
blijft de rest van de sessie staan waar hij stond, en een melding zegt dat hij
nu in het organogram staat.` },
    { title: `Er een maken`, text: `Een blad op een project met niets boven de applicaties is leeg, en die lege
pagina biedt de twee plekken om te beginnen: **Nieuwe klantreis** en
**Nieuw gebied**. De rest is telkens een **+** op de plek waar het ding komt, en ze
werken allemaal hetzelfde — wat je maakt verschijnt, is gekozen, en de cursor
staat in de naam, dus je typt over wat het heette en drukt op {key:Enter}.

- **Nieuwe klantreis** maakt de klantreis én de eerste fase, *Begin*, en laat
  dit blad hem tekenen; een band die een kop is met niets eronder is niet wat je
  vroeg.
- **+ fase**, aan het eind van de faserij, zet er een kolom achteraan.
- **+ stap**, in elke cel, zet een stap in die fase op het pad van die rij.
- **+ baan…**, onder de laatste rij, vraagt wiens pad het is — een
  belanghebbende die je al hebt, of een naam die je typt, met de aantekening
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

**Ondersteund door…** en **Toegewezen aan** in het paneel zijn hoe een
capability ingevuld raakt: vink een applicatie aan en die ondersteunt hem;
**+ Eenheid** onder **Toegewezen aan** maakt een eenheid er verantwoordelijk
voor, gekozen uit de hele organisatie zoals **Bediend door** van een scope er
een kiest, met de andere actoren van deze scope na de eenheden. Elk is een
eigen stap, en de regel onder de naam van de capability verandert mee. De
toewijzing wordt hier bijgehouden; een eenheid die in een andere scope is
ingedeeld is het verre eind ervan, en wordt daarvoor hier op geen bord
getekend. Een eenheid die dit domein niet bedient en ook niet onder een
eenheid valt die dat wel doet, is gemarkeerd, en is een controle (hieronder).
**✕** op een label haalt een toewijzing die hier wordt bijgehouden weer weg.

**De verantwoordelijke eenheid** staat op elk gebied, elke groep en elke
capability die aan een eenheid is toegewezen, altijd: een klein label naast
de naam, of op de dekkingsregel van een capability, met **+1**, **+2** waar
meer eenheden zijn, en elke naam in de tooltip. Een eenheid buiten het domein
staat er als waarschuwing. Het label is een knop: het opent de startpagina
van het domein dat de eenheid bedient, een menu van domeinen waar ze er
meerdere bedient of meerdere eenheden zijn toegewezen, en de eenheid waar ze
wordt bijgehouden — op het organogram van die scope — waar ze er geen bedient.
Erop klikken kiest de kaart niet.

**Toon wie verantwoordelijk is**, in de bovenbalk, voegt de andere actoren toe
waaraan het is toegewezen en die geen eenheid zijn, en markeert die waaraan
niemand is toegewezen. Het staat uit tot je het aanzet, en alleen zolang de
pagina open is.

**Verwijderen**, onderaan het paneel, haalt weg wat gekozen is en elke regel die
erop uitkwam. Het wordt geweigerd zolang er iets in zit, met hoeveel erbij: er
cascadeert niets, dus een gebied dat je verwijdert is een gebied dat je eerst
leeggemaakt hebt. Een actor die een eenheid is vraagt eerst, dezelfde vraag
als op een bord (*Elementen*): beëindigen eerst aangeboden, wie wat niet
langer is, en waar de eenheden erin heen gaan — die het verwijderen dus niet
tegenhouden.

**Wat dit blad tekent**, de schuifjes in de bovenbalk, gaat over het blad en
niet over het model — welke klantreis bovenaan loopt (een project met twee
klantreizen begint met geen van beide), welke gebieden getekend worden en in
welke volgorde, de volgorde van de banen, en of de rail er staat.` },
    { title: `Er een bewerken`, text: `Kies iets op de pagina en het opent rechts: de naam, de beschrijving, waar het
onder valt, waar het tussen zijn buren staat, wiens pad een stap is, of een
belanghebbende van buiten de organisatie is, en de levenscyclus van een
capability — een capability die gebouwd wordt is in dezelfde fase als een
applicatie die gebouwd wordt. Iets onder iets anders hangen wordt geweigerd als
het daarmee in zichzelf zou komen te zitten; die weigering staat in de lijst en
wordt er niet uit weggelaten. Het oog in de bovenbalk verbergt de
belanghebbenden, en het vergrootglas ernaast vindt alles op de pagina op naam —
kies een treffer, of druk op {key:Enter} voor de eerste, en de pagina scrolt ernaartoe,
selecteert het en omcirkelt het even.

Een applicatie openen vanuit de invulling van een capability brengt je naar een
bord dat hem ook echt tekent — desnoods een ander dan waar je stond — en naar de
eigen pagina van de applicatie als geen enkel bord hem tekent.` },
    { title: `Dekking`, text: `**Dekking**, op de schakelaar naast **Poster** en **Namen**, is dezelfde laag
andersom gelezen, in het tabblad van het blad zelf: elke functie aan de zijkant, een
kolom per applicatie die de regels noemen, en een teken waar de een de ander
ondersteunt. De eerste klik maakt de kaart als de scope er geen heeft en je mag
schrijven; ook **+** in de tabbladen maakt er een, en **Nieuwe kaart in deze scope**
onder **⋯** een tweede, die naast de schakelaar staat. Ze houdt haar eigen adres, en
een agent bereikt haar daar.

Ze opent op twee niveaus, met **1 2 3** voor meer. Naast elke naam staat waar die op
uitkomt: **Gedekt**, in woorden (*2 systemen*, *door mensen*, *niets*, en *3 van 4* op
een sectie), en **Mensen**, waar iemand is toegewezen. Op een sectie zegt een getal
hoeveel capabilities eronder elke applicatie ondersteunt. Applicaties van een andere
scope staan onder de naam van die scope, die ze ook inklapt. **Alle**, **Gaten** en
**Overlappen** maken van de pagina een gewone lijst, en **Zoeken** doet dat voor een
naam. **Dag** telt de regels die op de gekozen dag gelden, en terwijl je naar een
andere dag kijkt kan niets worden gewijzigd. **Exporteren** bewaart de hele tabel als
afbeelding, met titelblok. **Wat het tekent…** onder **⋯** kiest de gebieden.

Een klik selecteert, dus lezen verandert niets: een regel opent zijn paneel, en een
kolomkop toont wat die applicatie ondersteunt, waar zij de enige is, en de weg
erheen waar ze ook staat. **Spatie** op een cel koppelt of ontkoppelt, als één stap
met **Ongedaan maken**; een koppeling in een andere scope wordt als zodanig genoemd en
daar gewijzigd.` },
  ],
  poster: [
    { title: `De poster`, text: `**Poster**, eerste op de schakelaar, tekent het blad als één pagina van vaste grootte: de
klantreis, de stakeholders en elk gebied als blok, elke capability als tegel. Het is de eerste
lezing waar het blad een gebied heeft en het venster minstens 900 pixels breed is. Hij opent op
het grootste van Passend en 90%, zodat een naam leesbaar is, vanaf linksboven waar de rest
schuiven is; daarna opent hij waar je gebleven was. **Passend** in het dock toont het geheel.
Onder 70% verdwijnen de namen en is elke capability een vierkant onder de kleur die aanstaat,
wat Overzicht vroeger was; boven 120% zegt elke tegel ook wat haar dekt en wie ervoor staat.
De toetsen zijn die van de andere canvassen: {key:Mod} met + − 0, het wiel, knijpen, {key:Shift+1}. Een
adres dat nog \`tab=overview\` zegt, komt hier uit.

Kleur en Dag zijn die van het blad, en er beweegt niets voor: een functie die er op die dag
nog niet is, is gestippeld, een die weg is doorgestreept. {key:Tab} gaat per blok, de pijltjes van
tegel naar tegel over blokken heen terwijl de pagina meeloopt, {key:Enter} opent het paneel en {key:Escape}
komt terug op de tegel. **{key:Mod+F}** zoekt, en licht op wat het vindt.

**Lezen** en **Ontwerpen** zijn twee houdingen. Bij Lezen schuift een sleep, en beweegt er niets
op de pagina. Bij **Ontwerpen** (\`tab=design\`) kun je:

- een blok aan de titel slepen of aan de hoek trekken; het klikt op een raster van 8 en op de
  randen van de buren, {key:Alt} laat los. De eerste beweging schrijft elk blok, zodat de pagina de
  eerste indeling niet meer volgt. Spatie pakt een blok op voor het toetsenbord, pijltjes
  verplaatsen, {key:Shift} verandert de grootte, {key:Alt} stapt per eenheid, spatie zet neer en {key:Escape} zet terug;
- een tegel binnen zijn blok naar een cel slepen, en de andere stromen eromheen; of op een ander
  gebied of andere groepering, wat haar in het model verplaatst, op elke weergave, zoals
  *Verplaatsen naar…* in het paneel. Wat een andere scope bewaart, wordt geweigerd in de woorden van het paneel;
- een team, applicatie of subscope uit de lade op een tegel, groepering of gebied slepen. Ze
  schrijven wat het paneel schrijft. Een team toont ook als label op deze poster; het label
  weghalen laat de toewijzing staan. Een getypte naam is een actor gemarkeerd als geen eenheid.
  Een applicatie hoort op een tegel, niet op een blok. Selecteer meerdere met {key:Shift} of een getekend
  vak met {key:Shift}, en één keer neerzetten of indrukken in de lade neemt ze allemaal in één stap. **L**
  en **A** op een tegel openen daar dezelfde lijsten;
- een **notitie** of **afbeelding** toevoegen, die alleen bij deze weergave horen, meedrukken en door
  Zoeken gevonden worden. Dubbelklik op een notitie om te schrijven;
- een stap of stakeholder een **pictogram** of logo geven, vanuit het paneel of de ◇ erop.

**Eerste indeling** gooit de plaatsen weg als één keer ongedaan maken, **Tegels terugzetten** laat
elke tegel stromen, **Indelen voor dit papier** plaatst alles in de vorm van papier. Overlappen
mag en staat in de strook; een gebied dat aan een geplaatste pagina wordt toegevoegd, krijgt de
eerste vrije plek, of wacht onder de pagina en wordt daar geteld. Er kan niets geplaatst worden
terwijl je naar een andere dag kijkt. De tegelgrootte en de rijen van de klantreis staan bij
**Wat dit blad tekent**: een klantreis die te smal is voor hele woorden krijgt twee rijen tot jij één zegt.

**Exporteren…** onder ⋯ zet hem op één pagina, A4 tot A0, met een titel, een voet en de
legenda, in een drukuiterlijk dat het thema negeert. Het zegt hoe groot een naam wordt en hoeveel
namen deze pagina afkapt, met een manier om ze te selecteren. Een PDF op de desktop wordt direct
opgeslagen; in een browser is het de afdrukdialoog van de browser, waar je **Opslaan als PDF**
kiest. PNG kan op beide.` },
  ],
  chart: [
    { title: `Het organogram`, text: `Een **organogram** is een weergave: **+** in de tabbladen, dan **Organogram**,
maakt er een, met een eigen tabblad. Het is een boom opgemaakt uit de eenheden —
niets erop wordt met de hand geplaatst: de organisatie bovenaan, haar eenheden
ernaast, en eenheden met niets eronder in een kolom onder hun ouder, met een dunne
verbindingslijn die laat zien waar elke eenheid op de dag van het organogram zit, de
verplaatsingen van een plan meegerekend. Het bevat de eenheden die in deze scope en
eronder zijn ingedeeld en de eenheden die haar van bovenaf bedienen, en bij de
organisatie elke eenheid die er is. Eenheden naast elkaar staan in de volgorde van
hun typen en dan in hun eigen volgorde waar die is gezet, anders op naam; elke lijst
van eenheden houdt die volgorde aan.

**De balk** zegt van links naar rechts: **Niveaus** 1, 2, 3 of **Alle**, hoe diep
het hele organogram opent; **Mensen**, wie er staat: de leidinggevenden, de vereiste
rollen of alle rollen; **Lijnen**, welke rapportagelijnen er staan; **+ Eenheid**; en
de **Dag**. De eerste keer opent een organogram op twee niveaus. Een pijltje op een
vak klapt alleen die eenheid in, en een ingeklapte eenheid zegt op één regel wat ze
verbergt, *3 eenheden · 3 vacant*; een klik op die regel klapt haar open. **−**,
**+**, **Passend** en **100%** staan in de hoek van het canvas, met {key:Mod} en
+ − 0 en het wiel, en Passend stopt bij 60%, waar een vak zijn naam zegt en wat het
verbergt en niets meer. Niets hiervan wordt ooit bewaard.

**Focus** op een gekozen vak tekent die eenheid en wat eronder valt, in een raster
waar het er meer zijn, met de weg omhoog op één regel erboven en
**Terug naar het hele organogram**. Een focus heeft een adres (\`?focus=\` het id van een eenheid, zoals
\`?lines=\` het menu Lijnen vasthoudt), dus een link en een agent komen er ook, en
Terug komt eruit.

**Het overzicht** naast het organogram toont dezelfde eenheden als boom, en leidt
het organogram. Een eenheid daar kiezen, of openklappen met haar pijltje, klapt haar
ook op het organogram open, met elke eenheid erboven, scrollt ernaartoe en kiest
haar. Inklappen in het overzicht klapt alleen het overzicht in. De pijltoetsen lopen
erdoorheen, rechts opent en links sluit. De breedte is van jou: sleep de naad rechts
ervan, of geef de naad de focus en gebruik de pijltoetsen. Onderaan verplaatsen
**Omhoog** en **Omlaag** de gekozen eenheid onder de eenheden van haar type in
dezelfde eenheid: één stap in elke scope die er een bewaart. Waar ze allemaal in
deze scope staan, neemt ongedaan maken de verplaatsing terug; waar sommige in andere
scopes staan, wordt elke scope op zichzelf teruggezet.

**Zoeken.** Het vak boven het overzicht neemt eenheden en mensen, met resultaten
terwijl je typt, en {key:Mod+F} komt ernaartoe. Bij een gevonden persoon gaat het organogram
naar de eenheid en opent de toewijzing. **Ik** gaat naar de eenheid waar jij een rol
hebt; zeg eerst wie je bent, met **Dit ben ik** op de pagina Mensen. Op het organogram
lopen de pijlen door de vakken, {key:Enter} kiest en gaat omlaag, {key:Shift} en {key:Enter} gaat
omhoog, M verplaatst de eenheid en F zet de focus erop.

**Een vak** zegt het type en de naam van de eenheid en één regel per rol: *Hoofd:
Anna de Vries*, met het aandeel waar dat niet alle tijd is, *waarnemend*, *ext* voor
iemand van buiten de organisatie en *jij*, of **vacature** in woorden, waarmee een klik
toewijst in een eenheid die deze scope bewaart. Iemand boven al zijn tijd heeft *200%
van hun tijd* in woorden op de regel; iemand in een rol buiten die van de eenheid
heeft een eigen rij met *buiten haar rollen*. Het een staat nooit in de plaats van
het ander. Een regel onder de naam noemt de domeinen die een eenheid bedient waar dat
er meer dan één zijn, en de dag waarop ze begint of eindigt, met het plan dat dat
doet. Een rol die het type niet vereist en die niemand vervult, staat alleen onder
**Mensen: Alle rollen**, en de inspector van de eenheid noemt altijd elke rol.

**Lijnen** tekent rapportagelijnen op vier manieren: **Uit**; **Gekozen persoon**, de
lijnen die gelden voor de persoon die je indrukt en de lijnen naar die persoon toe;
**Stippellijnen**, elke functionele lijn op het organogram; en **Uitzonderingen**, elke afwijking van het model, ook in een paneel, waar elke regel naar zijn eenheid
gaat. Het opent op Gekozen persoon waar de organisatie lijnen heeft. Een pijlpunt zegt
altijd welke kant een lijn opgaat: de accentkleur loopt omhoog naar wie iemand aan
rapporteert, neutrale inkt komt binnen van wie aan hem rapporteert, en een uitzondering
is magenta met haar woorden op de lijn. Doorgetrokken is een lijn van de lijnmanager
en gestippeld een functionele. Een lijn naar een rol die niemand vervult, die deel is
van een lus of eindigt in een ingeklapte eenheid, zegt dat op de lijn, en de legenda
staat altijd in haar hoek, zodat een nieuwe lijn niets verschuift.

**Een eenheid naar een andere plek verplaatsen.** Een eenheid op de verkeerde plek
verhuist zonder opnieuw te koppelen: **Verplaatsen…** op het gekozen vak, onderaan
het overzicht, **Valt onder** in haar inspector, M, of door haar op een andere te
slepen. Er opent een paneel naast het organogram, dat in beeld blijft met zijn plekken
opgelicht: elke eenheid in de organisatie, welke scope haar ook bewaart, te kiezen door
erop te klikken op het organogram of in de lijst, of **Bovenaan**. De plekken waar haar
type mag zitten komen eerst; de andere volgen onder een eigen kop, en een verplaatsing
daarheen mag maar laat de eenheid als misplaatst staan in de controles. De eenheid zelf
en de eenheden erin worden niet aangeboden, en een plek die door een latere verplaatsing
van een plan een lus zou worden, wordt geweigerd, met de reden. **Deze ook verplaatsen**
noemt de eenheden ernaast onder dezelfde ouder, geen aangevinkt. Voordat iets wordt
geschreven, zegt **Wie haar aanstuurt** wie elke eenheid van bovenaf aanstuurt, vandaag en na
de verplaatsing, en wordt een verplaatsing door een plan met haar dag genoemd. Niets
wordt geschreven tot **Verplaatsen**, en {key:Escape} laat het. De eenheid houdt haar id, dus
haar mensen, rapportagelijnen, bediende scopes en reacties blijven bij haar, en de
eenheden erin gaan mee. Het is één stap in elke scope die een verplaatste eenheid
bewaart, allemaal of geen; waar dat alleen deze scope is, neemt {key:Mod+Z} het terug, en waar
ook andere scopes zijn geschreven, wordt elke op zichzelf teruggezet. Een verplaatsing
is een correctie, zonder dag: een verplaatsing vanaf een dag is van een plan. Een
organogram dat alleen wordt gelezen, biedt niets hiervan.

**Een eenheid maken op het organogram.** **+ Eenheid** op de balk maakt er een in de
gekozen eenheid, of bovenaan als er geen is gekozen; **+ Eenheid hierin** staat op het
gekozen vak, en een leeg organogram biedt **+ Eenheid bovenaan**. Een kleine dialoog
vraagt vier dingen. **Type** biedt alleen de typen die daar mogen zitten. **Naam**.
**Bedient**, alleen bovenaan of voor een type dat meerdere domeinen bedient.
**Ingedeeld in**, de scope die haar bewaart: standaard die van de eenheid waarin ze zit, en bovenaan
het domein dat ze bedient, anders de scope van dit organogram. **Maken** is één stap in
die scope. De nieuwe eenheid wordt gekozen en haar vereiste rollen staan als **vacature**,
dus toewijzen volgt meteen. Waar geen type mag zitten, zegt het dat en leidt het naar
het **Besturingsmodel**; zonder unittypen naar **Begin met een bibliotheek**. Een
organogram dat alleen wordt gelezen, biedt niets hiervan.

**Toewijzen** opent een popover naast de vacature, met het organogram nog in beeld: de
rol, met elke andere rol van de organisatie aangeboden als uitzondering en zo genoemd;
elke persoon met het aandeel nu; **Nieuwe persoon…**; en het aandeel, de eerste dag en
*waarnemend*. Waar de keuze iemand boven al zijn tijd brengt, zegt het dat vóór
**Toewijzen**, met **Stel een aandeel in**.

Het organogram wordt op een dag getekend, zoals een bord: **Dag** op de balk kijkt naar
elke andere dag, en **Dit organogram altijd op deze dag openen** bewaart die bij het
organogram. Een band zegt dat zolang een andere dag staat, met de weg terug naar vandaag.
Op een latere dag staan de eenheden die een plan brengt er, en een eenheid die is
geëindigd staat er nog — gestippeld, en dat zeggend — zolang iemand eraan is toegewezen,
zodat de mensen die een reorganisatie achterliet te zien zijn waar ze zijn achtergelaten.

**De regel onder het organogram opent de samenvatting
ervan**: wiens organogram en op welke dag, hoeveel eenheden en mensen erop
staan en hoeveel plaatsen vacant zijn; dan **Bevindingen**, wat de
organisatie over deze eenheden en de mensen erin tegenspreekt, in de lijst
met bevindingen — **Open de eenheid** gaat naar de eenheid waarover ze gaat,
en **Openen in Mensen** naar iemand boven al zijn tijd; en **Zo lees je het** — een gestreepte **+
vacature** is een rol die het type van de eenheid vraagt en die niemand vervult,
een rode rand is iemand boven al zijn tijd, *stuurt aan* markeert een rol
waarvan wie hem vervult de mensen van de eenheid aanstuurt, en een gestreept
vak is een eenheid die is opgeheven terwijl er nog mensen in zitten.

Een klik kiest en een dubbelklik opent, zoals op een bord. Een klik op een
eenheid die deze scope bijhoudt opent haar in de inspector naast het
organogram — haar mensen, haar rollen, wie haar aanstuurt en de eenheden
waarmee ze samenwerkt. Een klik op een eenheid die een andere scope bijhoudt
gaat naar haar op dit organogram; dubbelklik om haar daar te openen, op het
organogram van die scope, gekozen, met dezelfde inspector ernaast — of op
haar record waar die scope geen organogram heeft. **Vind mij** gaat naar de
eenheid waar jij een rol vervult; zeg eerst wie je bent, met **Dit ben ik** op
de pagina Mensen.

Een klik op een persoon opent in plaats daarvan diens toewijzing in de
inspector: wie haar heeft, de rol en de eenheid, de eerste en laatste dag, het
deel van de tijd dat ze vraagt, en een melding waar iemand op de dag van het
organogram meer dan al zijn tijd heeft. **Beëindigen op deze dag** beëindigt
haar, als één stap, op de laatste dag die je kiest — de dag vóór de dag van het
organogram als je vooruitkijkt, anders vandaag, en nooit vóór de eerste dag.
Een beëindigde toewijzing blijft: het is wat de persoon had. **Corrigeren…**
opent het venster van de eenheid voor al het andere, en **Openen in Mensen**
gaat naar de pagina Mensen met die persoon gekozen.` },
    { title: `De Conway-kaart`, text: `Een **Conway-kaart** is ook een weergave: **+**, dan **Conway-kaart**. Hij vraagt
of je teams en je systemen op elkaar aansluiten, en zegt het antwoord in een zin
boven de kaart, met één som die klopt: van de koppelvlakken die over een eenheid
heen gaan, hoeveel te beoordelen zijn en hoeveel niet, omdat een kant geen
eigenaar heeft. Een applicatie hoort bij de eenheid die ze als eigenaar noemt.
Waar de helft van de applicaties of meer er geen heeft, zegt de kaart dat hij nog
geen antwoord kan geven en vraagt het paneel ernaast om eigenaren:
**Kies een eenheid** bij elk, één stap per stuk.

**Raster**, de eerste lezing, toont elke twee eenheden één keer. Een driehoek in
een gemarkeerde cel is **systemen verbonden, niets gezegd**, met het aantal van
die koppelvlakken; een vinkje is **beide kloppen**; een ring is **gezegd, maar geen
systeem verbindt**, met de letter van hoe ze zeiden te werken; een streepje is
**niet te beoordelen, geen eigenaar**, in de rij met applicaties zonder eigenaar;
en een punt is **gemarkeerd als bedoeld**. **Lijnen**, de tweede lezing, tekent
elke eenheid als kolom in de volgorde van het organogram met haar applicaties
eronder, en de koppelvlakken in de goten en boven de kolommen, zodat geen naam wordt
doorgestreept: zwaar en gestreept waar niets is gezegd, dun waar beide kloppen.
**Toon** laat weg wat klopt, en **Toon hun lijnen** voegt die naar applicaties
zonder eigenaar toe. **Groepeer op** rolt de kolommen op naar een eenheidstype
boven de eigenaren, en zegt het waar er niets op te rollen valt. De lezing, de
groepering en het paar staan in het adres.

Het paneel naast de kaart zegt **Waar je naar kijkt**, per check: de paren waarover
niets is gezegd, applicaties zonder eigenaar, een eenheid die meer bezit dan haar
type toestaat, en achter **Toon notities** wat is gezegd zonder systeem ertussen,
en een eigenaar die een naam is en geen eenheid. **Geaccepteerd** somt op wat als
bedoeld is gemarkeerd. Niets op de pagina verandert iets tot je een knop in dit
paneel indrukt. Een klik op een cel, lijn of rij leest dat paar, en tekent de twee
eenheden en hun koppelvlakken onder het raster. Het zegt waarom het ertoe doet en
biedt de antwoorden: **Zeg hoe ze samenwerken…**, **Ze horen niet van elkaar af te
hangen: plan het weg…**, dat de applicaties op een plan van deze scope of een
nieuw plan zet, en **Prima zo: markeer als bedoeld…**. Waar twee eenheden niet
kunnen zeggen hoe ze samenwerken zegt het waarom: een partij die nog geen eenheid
is krijgt ter plekke een type met **Maak er eenheden van**, een partij buiten de
organisatie kun je alleen markeren of wegplannen, en twee eenheden die een andere
scope bijhoudt beantwoord je daar. Een paar dat zei hoe het werkt zonder systeem
ertussen kan **Verwijder wat is gezegd** of **Teken het ontbrekende koppelvlak…**.
Een klik op de naam van een eenheid leest wat ze bezit, met wie ze werkt en haar
open paren, met **Open op het organogram** voor de rest; een klik op een applicatie
leest haar eigenaar en koppelvlakken. **Vind mij** gaat naar je eenheid, en zegt
waarom niet waar je geen rol hebt in een eenheid op de kaart. Net als het organogram
is hij getekend op een dag. Een applicatie staat op de kaart zolang ze op de dag van
de kaart live is of uitfaseert: een die nog niet live of al weg is wordt niet
getekend, en haar koppelvlakken en wat de kaart erover zou vinden ook niet; de limiet
van een eenheid telt wat ze die dag bezit.` },
    { title: `Wie met wie samenwerkt`, text: `De inspector van een eenheid heeft **Werkt samen met**: elke eenheid waarmee
ze heeft vastgelegd samen te werken, op een van drie manieren —
**Zij aan zij** (een tijd aan één ding), **Als dienst** (de een
levert wat de ander gebruikt, met weinig af te spreken per keer) en
**Helpend** (de een helpt de ander iets te leren of op te pakken) — en de
dagen waarop dat geldt, waar die bekend zijn.
**+ Zeg hoe je met een eenheid werkt…** voegt er een toe, met niets gekozen tot jij kiest, een klik erop corrigeert of verwijdert haar,
elk als één stap in de scope die de eenheid bijhoudt. Een samenwerking die een
andere scope bijhoudt wordt genoemd met waar ze wordt bijgehouden. Een
draw.io-vak dat naar een eenheid wijst opent haar op het organogram van de
scope, waar dat er is.` },
  ],
  drawing: [
    { title: `Een tekening`, text: `Een **tekening** is de ene weergave die jij tekent en het model niet. **+** in de
diagramtabbladen vraagt welk soort weergave je wilt, gesplitst naar wie het
tekent: onder **Deze teken je zelf** vraagt **Tekening** om een naam en, als je
wilt, het element waarover hij gaat. De startpagina van een scope biedt hetzelfde.
Hij heeft een eigen tabblad, zoals een landschap of een sheet.

Een tekening wordt getoond als zijn afbeelding, met één balk zoals elke weergave:
wat het is, hoeveel vormen naar het model wijzen, en wat je ermee kunt. Een latere
pagina van een bestand wordt in de editor getekend en niet afgebeeld; de balk zegt
dat. Zonder afbeelding zegt hij waarom: **Nog niet getekend**, met
**Beginnen met tekenen**; **Geschreven, maar nog geen afbeelding** voor een tekening die een agent
schreef, met waar hij naar wijst; of, waar geen editor is, waarom niet en waar je
er een haalt.

Op de afbeelding krijgt elke vorm die naar een element wijst bij aanwijzen of focus
een lijn en een naam. Erop klikken opent het element in het paneel naast de
afbeelding, met **Pagina openen**; de afbeelding beweegt niet. **n koppelingen**
markeert ze allemaal en somt ze op: welke in de pas lopen, welke **om na te kijken**
zijn (het element staat niet meer in deze scope, of de afbeelding zegt nog een oude
naam), en welke vormen alleen getekend zijn. Een vorm die wijst naar een element
dat deze scope niet heeft is ook een bevinding in Controles. **Passend**, de zoom en
**Exporteren…**, als SVG of PNG uit de bewaarde afbeelding, zijn er voor iedere lezer.

**Tekening bewerken** opent de editor, in de taal van de app; het adres zegt
\`?edit\`, dus een link of een agent kan hem ook openen. Het palet bevat de elementen
van de scope op naam, gegroepeerd naar soort, elk een vorm die naar dat element
wijst, en de C4-vormen. Bij het openen krijgt elke zulke vorm de naam van het
element zoals die nu is. De balk erboven is van de app: wat er bewerkt wordt,
**Bewaren** en **Klaar**. Het statuswoord zegt **Nog niet bewaard**, **Bewaren**, **Bewaard**
met de tijd, of **Bewaren niet gelukt**, en een mislukte bewaring blijft daar staan
met **Opnieuw bewaren**. Bewaren houdt de tekening als één geheel: de XML, de
afbeelding en de koppelingen die de vormen maken. Bewaart iemand anders dezelfde
tekening terwijl de editor open is, dan wordt dat samengevoegd met wat open is, en
de balk zegt dat één keer.

Een vorm selecteren zegt onder het canvas waar hij naar wijst, met **Pagina
openen**, **Naar een ander wijzen…** en **Ontkoppelen**. De adresvorm blijft eronder
voor een agent en voor bestanden.

Weggaan met onbewaard werk vraagt eerst, welke weg je ook neemt: een tabblad, een
pagina, de boom, Terug of het venster. **Bewaren en weggaan** houdt het, **Blijven**
gaat terug, **Weggaan zonder bewaren** laat het vallen. De editor is een aparte
dienst; heeft die 15 seconden niet geantwoord, dan zegt de pagina dat, met
**Nu proberen** en **Terug naar de afbeelding**, en **Klaar** is er altijd.

**Diagram › Exporteren als** in de editor maakt een bestand van de tekening: PNG,
JPEG, WebP, een animatie als GIF, SVG, XML of JSON. Het is genoemd naar de tekening,
en de app zegt het zodra het bewaard is. De desktop vraagt waar; een browser zet het
bij de downloads. Exporteren verandert niets aan de tekening, en het is geen bewaren.

De editor en de afbeelding volgen het thema van de app: licht, donker, of dat van
het systeem. Het wijzigen terwijl de editor open is houdt wat getekend wordt.

Een weergave die niet gewijzigd mag worden biedt geen **Tekening bewerken**, en zegt
dat één keer. Een element verwijderen houdt de tekeningen die eraan verankerd zijn,
zonder het anker; ongedaan maken zet het terug.

Een tekening kan aan een element verankerd zijn. Het menu van het element
biedt **Tekening maken** naast **Containerdiagram maken** of
**Containerdiagram openen**, en de inspector heeft dezelfde knop. Maken is
één stap, en ongedaan maken haalt haar weg. Een dubbelklik op het element
biedt de tekeningen die eraan verankerd zijn, naast het containerdiagram als
het er een heeft. Een dubbelklik maakt nooit een tekening.

De pagina van het element noemt die tekeningen. Eén kiezen opent haar.

In een document toont \`![bijschrift](view:id)\` de weergave met die id uit
deze scope. Een tekening wordt getoond als haar afbeelding, met een
doorzichtige knop per vorm die naar een element wijst; de knop kiezen opent
dat element. Een weergave van een andere soort toont het bijschrift en **Nog
geen afbeelding**. Een weergave die niet in deze scope staat toont het
bijschrift en zegt dat de weergave ontbreekt.` },
  ],
  decisions: [
    { title: `Besluiten`, text: `De besluiten van dit bereik zijn **één lijst**. Een besluit hoort bij het bereik als
geheel, of gaat over één ding erin: een applicatie, een capability, een stap in een
klantreis. **Filter** versmalt de lijst op waar een besluit over gaat: dit bereik als
geheel, de applicaties met besluiten, elke andere applicatie, en onder *Verwijderde
applicaties* wat uit het model is verdwenen en zijn besluiten houdt.

Onderaan de lijst staan de bereiken **boven** dit bereik, elk ingevouwen: *Van Acme
Logistics*, *Van Retail*. Hun besluiten worden hier gelezen en **gewijzigd waar ze
wonen**: het besluit biedt geen manier om het te schrijven, en biedt aan dat bereik te
openen. Nummers gelden per bereik, dus ADR-0001 van het domein en ADR-0001 van het
landschap zijn twee besluiten.

Een besluit volgt het MADR-formaat: context en probleemstelling, beslisfactoren, de
overwogen opties, de uitkomst en de gevolgen, de voor- en nadelen per optie, meer
informatie. **Nieuw besluit** vraagt de titel en waar het over gaat, begint de tekst
met dat sjabloon en opent klaar om te schrijven. **Bewerken** is een volledig
venster: een vak per sectie, met markdown erin en de hulp eronder, en **Bron** voor de
hele tekst tegelijk, waar je een kop wijzigt en die het venster vult. Naast de tekst
staan wat aanvaarding nog nodig heeft, wie het voorstelde, wat het vervangt en de
**beoordelaars en handtekeningen**, elk met een oordeel en de dag waarop dat is
gegeven; in een smal venster staan ze eronder en vouwt **Details** ze weg. **Klaar** bewaart het als één stap, en **Annuleren** vraagt
eerst als er iets is veranderd. Secties die nog niemand schreef, blijven weg als het
besluit wordt gelezen.

De status is een werkwijze en geen label, en het besluit laat bovenaan zien waar het
staat, met één zin onder de titel. Een besluit begint **voorgesteld** en wordt ter
beoordeling gestuurd; **in beoordeling** wordt het aanvaard of afgewezen. Daar houdt
het op: daarna kan het besluit niet meer worden bewerkt of verwijderd, want een besluit
dat achteraf kan worden herschreven is er geen verslag van. Een aanvaard besluit kan
later onder ⋯ **als vervangen worden gemarkeerd**, wat vraagt welk besluit het vervangt
en de koppeling beide kanten op toont. Een beoordeling kan terug naar voorgesteld en
een voorstel kan worden ingetrokken, ook allebei onder ⋯.

**Wat aanvaarding vraagt** staat vanaf het eerste ontwerp naast het besluit, met
uitgeschreven waar elke regel naar kijkt. Een open regel gaat naar de plek die hem
beantwoordt, en de knop zegt hoeveel er nog open staan.

Het zoekveld boven de lijst doorzoekt alle besluiten tegelijk: titel, tekst en
beoordelaars, van dit bereik en die erboven. De tekst is markdown, met dezelfde
\`[[Naam]]\`-koppelingen als de documentatie, en mermaid-diagrammen. Wijzigingen worden
met dit bereik bewaard.` },
    { title: `Geschiedenis`, text: `Elke plek houdt een geschiedenis van je werk bij. **Momentopname…** in het menu
Bestand (op het web in het menu **⋯**) komt met een tekst die al geschreven
is uit wat je deed, zoals "Warehouse Management gewijzigd, 3 elementen
verplaatst", en die je kunt aanpassen voor hij wordt vastgelegd. De eerste
momentopname vraagt je om **Geschiedenis bijhouden**, en zegt waar die wordt
bewaard:
- in de map zelf, met git;
- in deze browser, voor de map van een tabblad (daarvoor wordt niets in de
  map geschreven) en voor een tabblad zonder map;
- zolang het tabblad open is, waar de opslag van de browser niet opengaat.

Er gaat niets van je machine af, tenzij je voor een map met een remote
**Na elke momentopname pushen** hebt aangezet. Op de desktop heeft de geschiedenis **git**
2.26 of nieuwer op de machine nodig: zonder git wordt een momentopname geweigerd
met een zin die dat zegt, en werkt de rest precies zoals eerst.

**Geschiedenis…** toont elke momentopname. Kies er een en je ziet wat er
sindsdien veranderde — applicaties erbij, weg en gewijzigd, koppelingen getekend
en doorgeknipt, besluiten genomen — met de geometrie als aantal in plaats van
als lijst, want een ronde Ordenen is één zin en vierhonderd gewijzigde regels. Een
verplaatsing is ook een punt, *Verplaatst van X naar Y*, in de geschiedenis van
elke scope die ze verplaatste.

**De geschiedenis van één ding.** De keuzelijst bovenaan de pagina beperkt haar
tot een weergave, een beschrijving of een besluit: de lijst wordt de
momentopnames die dat raakten, en de veranderingen de regels die erover gaan.
Dezelfde pagina opent al beperkt via **Geschiedenis…** in het menu van een
weergavetab, op de documentatiepagina en op de pagina van een besluit.

Een beschrijving is het enige onderwerp dat niet van één scope is: een naam
betekent overal in de organisatie hetzelfde, dus de pagina van een element staat
waar het is vastgelegd én overal waar een scope het tekent en zegt wat het
daar betekent. De geschiedenis van dat element is de optelsom van die pagina's,
en een regel onder de keuzelijst noemt de scopes die gelezen worden.
Terugzetten blijft van deze scope: het zet terug wat de pagina van deze
scope zei, de andere horen bij die scopes.

**Terugzetten.** Met een momentopname gekozen maakt
**Deze versie terugzetten…** de weergave, de beschrijving of het besluit weer wat het toen
was; met de hele scope in beeld doet **De hele scope terugzetten…**
hetzelfde voor alles. Terugzetten is een nieuwe wijziging bovenop alles wat
sindsdien gebeurde, geen stap terug: de geschiedenis blijft groeien, de
activiteitenlijst zegt *Weergave Warehouse teruggezet naar 3 sep*, {key:Mod+Z} maakt
het ongedaan, en de volgende momentopname legt het vast. De app biedt die
momentopname meteen aan. Een besluit dat aanvaard, afgewezen of vervangen is
blijft zoals het is — schrijf een nieuw besluit dat het vervangt — en een
teruggezette weergave laat elementen weg die niet meer bestaan, en zegt hoeveel.

**Labels.** **Label…** bij een gekozen momentopname geeft haar een eigen woord
— "Aan de directie getoond" — naast haar boodschap, nooit in plaats ervan. Een
label reist mee met de geschiedenis, zodat een collega hetzelfde merkteken op
dezelfde plek ziet; in de map van de desktop is het een git-tag, die elke
git-client toont. Twee labels met dezelfde naam worden geweigerd, overal in een
map en binnen één scope in een browser; kies een ander woord.

**Momentopnamen die de app zelf maakt**, waar een geschiedenis wordt
bijgehouden: voordat een bewaarde kopie vervangt wat hier staat, voordat een
scope uit de geschiedenis wordt teruggezet, en, op de desktop, voordat een
map van haar remote wordt opgehaald en voordat een map van een oudere versie
wordt omgezet. Elk heet naar waar hij aan voorafging, zodat wat er stond kan
worden teruggezet.` },
  ],
  observations: [
    { title: `Waarnemingen`, text: `**Lokaal en globaal.** De waarnemingen, oorzaken, oplossingen en
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
die scope en niet van deze pagina: een melding zegt waar het heen ging, en {key:Mod+Z}
op deze pagina komt er niet bij — terugnemen is het terugzetten. Waar die
scope vanaf hier niet gewijzigd mag worden, of haar eigen regels de wijziging
weigeren, zegt de melding dat er niets gemaakt is. Een
oplossing of een experiment van een scope eronder wordt hier gelezen en niet
gewijzigd.

Een waarneming is een genummerd record (\`OB-0007\`) met een titel, een plaats,
wie het zag — vrije tekst: een naam, initialen, een team — de dag waarop het
voor het eerst gezien is, een impact — *klein*, *groot* of *kritiek* — en een
markdowntekst voor wat er gezien is, het bewijs en wie of wat het raakte.
**Opnieuw gezien** telt er één bij en schrijft de dag in de
**geschiedenis** van het record: het gedateerde overzicht onderaan elke
waarneming — vastgelegd, opnieuw gezien, samengevoegd, gearchiveerd. Op een
grote kaart is de impact een streep langs de linkerkant en staat de teller in
de hoek; op een kleine is de impact de grootte van de cirkel.

**Lichtpunten.** Niet alles wat het begrijpen waard is gaat mis: een team dat
nooit een release mist, is ook de vraag waarom waard. Een waarneming is een
**probleem** of een **lichtpunt** — iets dat werkt — en *Nieuwe waarneming*
vraagt eerst welke, met probleem gekozen; *Bewerken* in de lezer verandert
het later. Een lichtpunt wordt geanalyseerd zoals een probleem: de oorzaken
zijn wat het laat werken, het team zegt welke de grondoorzaak is, en een
oplossing op die grondoorzaak **verspreidt** het, met dezelfde vragen om te
beantwoorden en hetzelfde experiment voordat ze bewezen is. Een lichtpunt
heeft een eigen label in het register en in de lezer, en wordt groen
getekend in de tekening, met de lijnen van de keten die alleen achter
lichtpunten ligt. De tellingen boven de tekening en op de startpagina van de
scope tellen lichtpunten apart. Een probleem en een lichtpunt worden nooit
samengevoegd: het samenvoegscherm biedt alleen records van de soort van het
record dat blijft. En een lichtpunt dat opnieuw gezien wordt nadat een
oplossing gebouwd is, is die oplossing die werkt, en wordt er dus niet tegen
gemeld.

**Nieuwe waarneming** — in de bovenbalk, en in een register waar nog niets in
staat — vraagt de vier feiten die er een waarneming van maken:
de titel, **waar gezien**, **waargenomen door** en **datum gezien** — dezelfde
woorden als bij het bewerken. Datum gezien begint bij vandaag en mag niet in de toekomst
liggen; de impact begint bij klein. Rechts stelt de beschrijving haar drie
vragen, een veld per vraag — **wat we zagen**, **bewijs** en **wie of wat het
raakte** — en de laatste is ook verplicht: een waarneming zegt altijd wie of
wat ze raakte. Vastgelegd zijn de drie één markdowntekst onder die kopjes.
**Voorbeeld** toont haar zoals ze zal lezen, en **Bewerken** gaat terug naar
de velden. **Bewerken** op een vastgelegde waarneming opent haar in het hele
venster als het document dat ze is: de titel, elk kopje met zijn tekst eronder,
één werkbalk boven alles, en de feiten ernaast. **Voorbeeld** toont daar dat
document zoals het gelezen wordt, op dezelfde plek, en op een breed venster toont
**Naast elkaar** beide, zoals het op de breedste opent. Onder elk veld staat een voorbeeld, en een veld dat leeg blijft
zegt op die plek wat er ontbreekt, en naast de knop hoeveel. Elke dialoog op
de pagina houdt vast wat erin staat: een klik ernaast sluit hem niet, {key:Escape}
niet meer zodra er iets geschreven is, en {key:Enter} in een veld van één regel doet
wat de knop doet. Onder de titel staan twee hints die je nooit
tegenhouden: **Al eerder gezien?** noemt waarnemingen van de gekozen scope
waarvan de titel woorden met de jouwe deelt, elk met **Opnieuw gezien**, dat
net als in de lezer de dag en een notitie vraagt, en een waarneming bij die
ene telt en niets nieuws vastlegt — Annuleren gaat terug naar het formulier
zoals je het liet; en een titel met een
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
nieuwe oorzaak en 1 koppeling*, en het is één stap — {key:Mod+Z} neemt de waarneming,
de nieuwe oorzaken en de koppelingen samen terug. Een andere scope kiezen
haalt de koppelingen naar oorzaken van de eerder gekozen scope eraf, en zegt
dat.

Waarnemingen die hetzelfde blijken te zijn worden **samengevoegd**, en
oorzaken die twee keer zijn opgeschreven ook. **Samenvoegen…** op een
waarneming of een oorzaak — in de lezer, met een rechtsklik, of op een van een
scope eronder — opent het **samenvoegscherm** over de pagina, met dat record
gekozen. Het heeft drie delen:

- **Wat samengevoegd wordt.** Zoeken in de levende waarnemingen, of de
  oorzaken die niet zijn samengevoegd, van deze scope; vink
  **Over scopes heen** aan om in elke scope te zoeken die je kunt lezen, de dichtstbijzijnde
  eerst, met bij elke treffer de scope. Vink er zoveel aan als hetzelfde zijn.
  Een van de gekozen **blijft staan**; dat is het record waarmee je begon tot
  je een ander kiest. Een record van een scope die je mag lezen en niet
  wijzigen staat in de lijst, kan niet worden aangevinkt, en zegt waarom.
- **Wat het blijvende record zegt.** Een rij per waarde — voor een waarneming
  de titel, waar, waargenomen door, de impact en de dag van eerst gezien, die
  begint bij de vroegste van de gekozen; voor een oorzaak de titel,
  aangenomen of geverifieerd, en of het een grondoorzaak is. Ernaast is de
  waarde van elk gekozen record een knop die haar in het veld zet, of typ je
  eigen. De keren gezien worden opgeteld, niet gekozen. De beschrijving is die
  van het blijvende record, te bewerken; **De beschrijvingen van de andere
  toevoegen** zet die van elk eronder, onder *Samengevoegd uit OB-0007* (met
  de scope waar dat een andere is). De andere houden hoe dan ook hun eigen
  beschrijving.
- **Wat meegaat.** Elke koppeling die een record noemt dat wordt
  samengevoegd, een rij elk, aangevinkt waar ze naar het blijvende record mag.
  Vink er een uit om haar te laten waar ze is. Een koppeling die de boom niet
  toestaat — een kringloop, een koppeling omhoog of opzij, een oorzaak die een
  waarneming van een andere scope verklaart, een oplossing en een oorzaak die
  geen grondoorzaak wordt — kan niet worden aangevinkt, en zegt waarom. Waar
  beide records dezelfde koppeling hadden, kies je de sterkte; de sterkste
  wordt aangeboden.

**Samenvoegen** zegt wat het maakt — *2 waarnemingen samenvoegen in OB-0002* —
of, grijs, waarom het niet kan. Een samenvoeging binnen deze scope is één
stap, en {key:Mod+Z} neemt haar terug. Een die een andere scope wijzigt — een record
ervan samengevoegd, of een koppeling die daar staat verplaatst — schrijft elke
scope die ze wijzigt als stap van die scope, alles of niets, en een melding
zegt welke scopes ze wijzigde; {key:Mod+Z} neemt dat hier niet terug, verander het dus
terug. Het scherm sluit op het blijvende record. Elk samengevoegd record
blijft — daar staat de oorspronkelijke tekst — en wordt als samengevoegd
gelezen, niet verwijderd, met waar het heen ging, ook als dat een andere scope
is; *Samengevoegde tonen* haalt samengevoegde waarnemingen en oorzaken terug in
het register.

**Een waarneming verhuist naar de scope waar ze thuishoort.** Haar scope
bestond nog niet toen ze werd opgeschreven, de boom is anders ingedeeld, of de
analyse laat zien dat ze over een ander deel van de organisatie gaat:
**Naar scope verplaatsen…**, bij de minder gebruikte acties van de lezer van een
waarneming van deze scope, opent het **verplaatsscherm** over de pagina. Het
heeft drie delen:

- **Wat verplaatst.** De waarneming, hoe vaak ze gezien is, en hoeveel
  reacties meegaan.
- **Waarheen.** Elke andere scope die je mag lezen, de dichtstbijzijnde
  eerst, elk met haar pad vanaf de organisatie; typ een deel van een pad om er
  een te vinden. Een scope die je mag lezen maar niet wijzigen, staat in de
  lijst en kan niet gekozen worden, en zegt waarom. Zodra er een gekozen is,
  zegt het scherm wat de waarneming daar wordt: het volgende nummer van die
  scope, *Ze wordt OB-0012 in Platforms › Camera's*.
- **Doorgeknipte koppelingen.** Een oorzaak verklaart alleen waarnemingen van
  haar eigen scope, dus elke oorzaak die deze verklaart, verliest die
  koppeling. Elke staat in de lijst, met de oplossingen op een grondoorzaak
  waar de koppeling naartoe leidt, voordat er iets geschreven wordt. De
  koppelingen blijven als geschiedenis op hun oorzaak staan, en de analyse
  begint opnieuw in de scope waar ze heen gaat.

**OB-0007 naar <scope> verplaatsen** verplaatst haar als één wijziging over
beide scopes, alles of niets. Ze houdt haar titel, plek, waarnemer, impact,
dag, beschrijving, keren gezien, geschiedenis en reacties, en haar
geschiedenis zegt waar ze vandaan kwam. Waar ze stond, blijft ze als
geschiedenis: gelezen zoals een samengevoegd record, buiten het register, het
beeld en de tellingen, en onder *Samengevoegde tonen* getoond als *Verplaatst
naar OB-0012 in <scope>*, dat erheen gaat — zo leidt een link ernaar nog
ergens heen. Het scherm sluit op de waarneming waar ze heen ging. {key:Mod+Z} neemt een
verplaatsing niet terug: verplaats haar terug, en waar haar oude plek haar nog
heeft, komt ze terug onder haar oude nummer en verklaren de koppelingen die
doorgeknipt werden toen ze vertrok haar weer. Een gearchiveerde waarneming
wordt eerst teruggehaald, en een samengevoegde verplaatst niet. Een agent
verplaatst er een op dezelfde manier: \`move.plan\` zegt wat het zou
doorknippen, en \`observation.move\` verplaatst haar.

Een waarneming die is opgelost, aangepakt of er niet meer toe doet wordt
**gearchiveerd**: *Archiveren* vraagt, vrijblijvend, waarom, en schrijft de
dag en de toelichting in de geschiedenis. Het record blijft waar het is, voor
de geschiedenis, en verdwijnt uit de analyse — niet getekend, niet in de
wachtrij, niet als samenvoegdoel — tot *Terughalen* het terugbrengt.
*Gearchiveerde tonen* laat de gesloten zien. Om een waarneming te sluiten
wordt niets verwijderd; *Verwijderen* is voor een record dat er nooit een had
moeten zijn.

Een **oorzaak** (\`CA-0003\`) is wat het team zegt dat achter één of meer
waarnemingen zit, of achter andere oorzaken. Ze begint **aangenomen** en
wordt **geverifieerd** zodra ze gecontroleerd is. Een **grondoorzaak** is een
oorzaak waarvan het team zegt dat ze er een is, en ze heet **RC** op het
eigen nummer van de oorzaak: \`CA-0004\` tot grondoorzaak gemaakt is \`RC-0004\`,
en weer tot oorzaak gemaakt is ze opnieuw \`CA-0004\`. Een grondoorzaak sluit
de keten af: niets verklaart haar, en een oplossing pakt haar aan. Ze mag
oorzaken en waarnemingen verklaren. Een oorzaak die geen grondoorzaak is en
die door niets verklaard wordt is een **open einde** — daar is de analyse nog
niet af — met \`?\` gemarkeerd in de tekening en erboven geteld.

**Een analyse uit een eerdere versie** noemde geen grondoorzaken: een
grondoorzaak was toen elke oorzaak die door niets verklaard werd. Ze opent met
een grondoorzaak overal waar een oplossing die niet is laten vallen een oorzaak
aanpakt, en nergens anders, dus een oorzaak die alleen grondoorzaak was omdat
nog niets haar verklaarde, opent als open einde. Dat geldt waar het werk ook
bewaard wordt.

**Tot grondoorzaak maken** en **Tot oorzaak maken** zijn stappen met een naam
in de Activiteit-lijst, en elk vraagt eerst, in de lezer — ook wanneer hij met
een rechtsklik gekozen is. Tot grondoorzaak maken wordt geweigerd zolang een
oorzaak deze verklaart: de lezer noemt elke oorzaak die dat doet, en zegt die
los te koppelen of die ene tot grondoorzaak te maken. Tot oorzaak maken wordt
geweigerd zolang een oplossing haar aanpakt: de lezer noemt elke oplossing,
en zegt die eerst naar een andere grondoorzaak te verplaatsen of los te
koppelen. Een nieuwe oorzaak kan bij het schrijven meteen grondoorzaak
worden.

**Elke actie in een lezer is een kleine knop** met een pictogram en een of
twee woorden, en er met de muis boven hangen, of er met {key:Tab} op komen, zegt
voluit wat hij doet en waarvoor hij geweigerd wordt. Een waarneming biedt
*Opnieuw gezien*, *Oorzaak*, *Bewerken*, *Samenvoegen*, *Naar scope
verplaatsen*, *Archiveren* en *Verwijderen*; een oorzaak *Diepere oorzaak*, *Grondoorzaak*, *Tot
grondoorzaak maken*, *Verifiëren* — *Verificatie intrekken* zodra ze
geverifieerd is — en *Samenvoegen*; een grondoorzaak *Oplossing* en *Tot oorzaak maken*, en nooit
een diepere oorzaak. *Oorzaak*, *Diepere oorzaak* en *Grondoorzaak* openen
één dialoog met twee tabbladen: **Nieuwe oorzaak**, de eigen velden van de
oorzaak, en **Bestaande oorzaak**, dat alleen aanbiedt wat de regels
toestaan. *Deze gebruiken* naast een oorzaak die al opgeschreven is, kiest
haar onder Bestaande oorzaak, waar de sterkte gekozen wordt vóór
**Koppelen**. Waar de lezer smal is, gaan *Samenvoegen*, *Naar scope
verplaatsen*, *Archiveren* en *Verwijderen* in \`⋯\`.

**Door de boom verklaart een oorzaak naar beneden en nooit naar boven.** Een
oorzaak mag een oorzaak van een scope onder de hare verklaren — een reden
voor de hele organisatie achter een oorzaak van een landschap — en de
koppeling staat op de oorzaak erboven, in de scope erboven. De oorzaak
eronder zegt in haar lezer wat haar verklaart, en de tekening trekt de lijn
gestreept over de grens. Op een oorzaak van deze scope koppelt
**Lokale oorzaak** een oorzaak van een scope eronder die ze verklaart; op een oorzaak
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
*Filters* wist ze allemaal. **Problemen, lichtpunten of beide** — beide is
de standaard — laat de waarnemingen van de andere soort weg, en wat alleen
daarachter ligt: een grondoorzaak achter een probleem en een lichtpunt
blijft. **Bewaarde filters** bewaart de filters die aan
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
opnieuw aan als wat ze toont verandert, tot je zoomt; de zoomknoppen, en {key:Mod} met het scrollwiel, zoomen, en slepen over de achtergrond verschuift
haar. **Boven een record hangen** — of er met {key:Tab} op komen — volgt de keten
beide kanten op: alles wat eraan gekoppeld is blijft en de rest vervaagt, en
de volledige titel, het label en de scope staan eronder. {key:Enter} of een klik
leest het. Dezelfde records onder dezelfde filters komen elke keer op
dezelfde plek.` },
    { title: `Oplossingen`, text: `Het derde tabblad, **Oplossingen**, begint waar de analyse ophoudt: wat het
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
optionele beschrijving met **Bewerken** en **Voorbeeld**, en een tabel van de
grondoorzaken van deze scope die ze aanpakt, gekoppeld zodra je voorstelt —
de knop zegt *Oplossing voorstellen voor 1 grondoorzaak*. Het schrijft een
genummerd record (\`SO-0003\`) en verder niets. Een oplossing pakt alleen
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

Van uitgewerkt naar **wordt getest** is een **experiment** (\`EX-0002\`) nodig:
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
\`observations/solutions/\` en \`observations/experiments/\`.

De lezer van een oplossing heeft dezelfde kleine knoppen als de analyse:
*Aanpakken* om nog een grondoorzaak aan te pakken zolang ze een idee of uitgewerkt
is, *Experiment* om er een te plannen zolang ze uitgewerkt is of getest
wordt, *Bewerken*, en *Laten vallen* en *Verwijderen*, die in \`⋯\` gaan waar
de lezer smal is. Een oplossing van een scope eronder, met Lokaal tonen aan
in haar kader getekend, wordt hier gelezen en in haar eigen scope bewerkt.

**Rechtsklik** op iets in de analyse of de tekening van de oplossingen voor
wat je ermee kunt — dezelfde acties als in de lezer, in dezelfde volgorde en
met dezelfde woorden, Bewerken daaronder, en op een oplossing de stappen die
haar poort biedt; een menu-item eindigt op “…” waar een dialoog of een vraag
volgt — en op een lijn — de verbanden van de analyse, de oorzaken van een oplossing, de
lijnen naar en vanuit een experiment — voor hoe sterk het verband is, of om
het los te maken. **Bewerken** geeft het record de hele breedte: de tekst
links, hoe het eruit komt te zien rechts, en de tekening terug zodra je naar
Lezen gaat.` },
  ],
  roadmap: [
    { title: `De roadmap`, text: `**Roadmap** in de bovenbalk opent het landschap op een tijdas. Alleen wat een
datum heeft krijgt een regel, dus een landschap van vierduizend applicaties met
negen datums is een roadmap van een paar regels — de rest staat op het canvas,
waar het thuishoort. Plannen staan bovenaan, dan applicaties, elke regel een reeks
stukken met de fase erop: gepland, live, uitfaserend, uitgefaseerd. Verbindingen met
een eigen periode volgen, dichtgevouwen met een aantal op de kop, per plan dat ze
verplaatst in oude lijnen die eindigen en nieuwe lijnen die beginnen, omdat een plan
dat elk koppelvlak verplaatst elke lijn een datum geeft. Initiatieven uit de scopes
hieronder staan onderaan.` },
    { title: `Plannen`, text: `Een **plan** is hoe een verandering van het landschap wordt vastgelegd: een titel,
een status, het venster waarin het loopt, wie het bezit, de applicaties die het
invoert, uitfaseert of wijzigt, de besluiten waarop het steunt, de mijlpalen, en
een tekst in markdown. Plannen verschijnen als banden op de as, met hun status op de
band, gestippeld voor een concept, en een teken per mijlpaal; mijlpalen te dicht op
elkaar vallen samen en zeggen hoeveel. De pagina van een plan is één document met één
scroll: de kop, een strook met mijlpalen die in beeld blijft, wat het wijzigt op één
regel per stuk, dan de tekst, dan de borden die het wijzigt, de principes die het
aanhaalt, de wijzigingen en de reacties. Een overzicht links gaat naar elk daarvan.
Een feit leest als woorden en een klik maakt van die ene regel een formulier.
**Bewerken** is alleen de tekst, in een eigen venster met voorbeeld, opgeslagen als één
stap. **Koppelingen** en **Eenheden** wachten tot je erom vraagt;
**De rest een dag geven…** verplaatst elke lijn zonder dag op één dag, en een regel opent om het hele
label te lezen en een eigen dag te zetten. Een mijlpaal buiten de periode mag, en
zegt dat.

**Borden** noemt de borden die houden wat het plan noemt. Daarvandaan openen kijkt
alleen: de band op het bord noemt het plan en de mijlpaal, stapt tussen de mijlpalen
en gaat terug naar het plan. Het statusmenu zegt wat een stap tegenhoudt, elke regel
naar wat het oplost.

Een plan loopt **concept → akkoord → loopt → gereed**, en kan vanuit elk daarvan
worden gestaakt. Anders dan bij een besluit kan elke stap terug, en een afgerond
plan blijft bewerkbaar: een besluit legt een moment vast, een plan beschrijft
werk. Wat het plan vorige maand zei staat in de historie van de map.

**Verschuiven…** verplaatst een plan met een aantal dagen — het venster, elke
mijlpaal, de dag van elke eenheid die het verplaatst, en de levenscyclusdatums
van de applicaties die het invoert en uitfaseert — in één stap, want een plan
dat uitloopt is één ding dat gebeurde. Een plan dat eenheden reorganiseert,
zegt wat dat doet met de mensen erin (zie *Verandering in de tijd*).

Elk plan is één markdownbestand in \`transitions/\` in je projectmap, genummerd
vanaf \`TR-0001\`.

**Initiatieven.** Een plan hoort bij het niveau dat het schrijft, en de roadmap
van een domein is die van het domein. Is een plan ook een zaak van de
organisatie — een migratie die het hele bedrijf volgt — kies dan
**Volgen op de roadmaps hierboven** onder ⋯ op zijn pagina. Het verschijnt dan op de roadmap van elk
niveau erboven, onder *Initiatieven uit de niveaus eronder*, met in woorden bij welk
niveau het hoort; daar wordt het gelezen en het wordt bewerkt waar het staat, en de
lezer opent het daar. De roadmapkaart op het organisatiescherm telt ze mee. De
keuze is er niet op de organisatie zelf, die geen roadmap boven zich heeft.` },
    { title: `De business case`, text: `De tekst van een plan kan een **business case** bevatten: een blok waarvan de
invoer een leesbare kasstroomtabel is, met de uitkomsten eronder uitgerekend.

\`\`\`\`markdown
\`\`\`business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
\`\`\`
\`\`\`\`

Een negatief getal is geld eruit, een positief geld erin, en een lege cel is nul.
Daaronder berekent de app de netto en cumulatieve kasstroom, de netto contante
waarde bij het opgegeven percentage, de interne rentabiliteit, de terugverdientijd
in perioden, het rendement op de investering en de baten-kostenverhouding. Je
tabel wordt nooit herschreven.

Een tweede tabel, \`Criterion | Weight | Score\`, geeft een gewogen score voor het
deel dat geen geld is — beoordeeld van één tot vijf, van een maximum dat de app
zelf afleidt in plaats van dat je het intypt. Alles daarbuiten hoort in een
besluit, met de afwegingen en de opties die je tegen elkaar hebt gezet.

**Business case toevoegen** in het bewerkvenster zet een leeg blok bij de cursor.` },
    { title: `Waarover de datums het oneens zijn`, text: `Onder de as staat een lijst met bevindingen (zie *Een lijst met bevindingen
lezen*): een applicatie die uitfaseert
terwijl er nog koppelingen live zijn, een opvolger die pas komt nadat wat hij
vervangt weg is, een uitfasering zonder benoemde opvolger, een koppeling die nog
geldig is nadat een van haar uiteinden is uitgefaseerd, een applicatie die nog
op een uitgefaseerd platform staat, en een plan dat over zijn einddatum heen is.

Eén regel is geen tegenstrijdigheid maar een ontbrekende plaat: koppelvlakken op
containerniveau tussen twee applicaties waar niemand een applicatiekoppelvlak
voor heeft getekend. **Overnemen**, in de uitleg erbij, tekent het en laat elk
van die lijnen erop landen, in één stap — of laat het staan, en er gebeurt
niets.

Het toont waar de datums elkaar tegenspreken. Het kan niet zien of een landschap
verouderd is — dat kan niets — en de pagina zegt dat onder de lijst.` },
  ],
  registers: [
    { title: `Eén naam in de hele organisatie`, text: `Een naam betekent overal in je map hetzelfde. Het magazijnsysteem is één
systeem, welk domein het ook tekent, en een capability die de organisatie
benoemt is diezelfde capability waar een landschap hem verfijnt — dus elk ding
wordt **één keer** vastgelegd, in één scope, en elke andere scope die het
gebruikt wijst naar datzelfde ding.

**De scope die het vastlegt, beheert het.** Daar zitten de details: in
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

Welke scope een ding beheert, wordt bepaald door **diepte**: de diepste
scope die het vastlegt. Die ene regel werkt beide kanten op, en dat is het
punt. Capabilities worden bij de organisatie vastgelegd en naar beneden
verfijnd, dus de organisatie houdt ze. Applicaties worden vastgelegd in het
landschap dat ze draait, dus een domein houdt de zijne — en een organisatie die
een applicatie alvast bij naam noemt, noemt een plaatshouder die opzij gaat
zodra iemand dieper het echte record schrijft.` },
    { title: `Wat een bevinding betekent`, text: `De app weigert hierover nooit een save. Hij leest de hele map bij het openen —
en opnieuw zodra de map onder je verandert — en meldt wat hij vindt. Elke regel
van de boom op het organisatiescherm draagt zijn eigen zin.

- **Conflict** — twee scopes op hetzelfde niveau leggen dezelfde naam vast.
  Iemand is halverwege een migratie, of twee teams noemden hetzelfde ding op
  dezelfde middag. Beide regels zeggen het, want geen van beide is de foute.
  Maak er één een verwijzing naar de ander van.
- **Verouderd** — de kopie van de naam klopt niet meer met hoe het beherende
  scope het noemt, of die scope is verplaatst. **Bijwerken** schrijft de
  kopieën in één stap terug, en dat kun je ongedaan maken als al het andere.
- **Ongedefinieerd** — een verwijzing naar iets dat niets in de map vastlegt. De
  kaart wordt getekend en de regel blijft staan; wat ontbreekt is ergens een
  record om naar te wijzen.
- **Een losse regel** — een lijn die eindigt op iets dat niets in de map heeft.
  Blijft staan en wordt als stomp getekend, en verdwijnt nooit bij een save.
- **Een voorstel** — een capability die een domein benoemde en geen scope
  erboven. Geen fout: het is een gesprek met het niveau erboven.
- **Zonder eigenaar** — een systeem dat als andermans is gemarkeerd zonder dat
  iemand heeft gezegd van wie.

Eén ding op die lijst is **informatie en geen fout**: een record dat niets in
zijn eigen scope tekent — geen bord houdt het, en geen tekening daar wijst
ernaar. Iets kan echt, beheerd en beschreven zijn zonder al op iemands plaat te
staan, dus het is een notitie, net als een voorstel, en wordt nooit als fout
gekleurd.` },
    { title: `Een lijst met bevindingen lezen`, text: `Elke lijst met bevindingen is dezelfde lijst: de **Controles** van een
eenheid, de samenvatting naast het organogram, de bevindingen van de
Conway-kaart, **Nog open** bij een plan en **Waar de datums het oneens zijn**
op de roadmap. Een startpagina telt haar bevindingen onder **Vraagt aandacht**
en zet ze op de pagina Controles.

- **Eén regel per controle**: het teken van haar gewicht, haar naam en
  hoeveel, dichtgevouwen. Klik op de regel om elke bevinding eronder te zien,
  in haar eigen zin.
- **Drie gewichten**, in deze volgorde. **Herstellen** (een rode stip): het
  model spreekt zichzelf tegen of kan niet kloppen, en het herstel zit in het
  model. **Nakijken** (een oranje driehoek): waarschijnlijk een gat of een
  risico, het bekijken waard. **Notitie** (een *i*): informatie die heel goed
  zo bedoeld kan zijn. De regel onder de lijst zegt welk teken wat is.
- **De notities zijn verborgen** achter **Notities tonen (N)**. Wat een lijst
  heeft opengevouwen, en of haar notities te zien zijn, duurt zolang de app
  open is en wordt nooit bewaard.
- **Klik op een bevinding om haar te lezen**: haar zin, haar gewicht en waar
  ze over gaat, **Waarom het ertoe doet**, **Hoe je het oplost**, en de acties
  die het oplossen of openen waar het wordt opgelost — het record openen, de
  tekening, de eenheid of de twee eenheden, het eenheidstype, het plan, de
  persoon in Mensen; **Koppelen…**, **Overnemen**, **Toewijzen…**,
  **De toewijzing beëindigen…**, **De toewijzing verwijderen**,
  **Een samenwerking vastleggen…**, **De vastlegging verwijderen**. Een lijst biedt de acties die ze kan doen waar ze staat, en
  het scherm dat ze opent doet de rest. **Alle bevindingen** gaat terug naar
  de bevinding waar je vandaan kwam.
- Een bevinding die is opgelost verdwijnt uit de lijst, en haar uitleg mee.
- **Markeren als bedoeld…**, onder de uitleg van een nakijkpunt of een
  notitie, zegt dat het zo bedoeld is: het vraagt waarom, en de reden mag leeg
  blijven. De bevinding verdwijnt uit de lijst en staat onder **Geaccepteerd
  (N)**, onder de controles, met haar reden en de dag waarop ze is
  gemarkeerd. **Terugnemen** daar brengt haar terug. Een markering is een stap
  in het model, bijgehouden in de scope waar de bevinding over gaat, dus
  iedereen ziet haar en de Activiteitenlijst noemt haar; gemarkeerd waar dat
  scope open is, neemt {key:Mod+Z} haar terug zoals elke andere stap. Een markering
  gaat over de bevinding zoals ze is: verander waar ze over gaat — een andere
  eenheid aan de samenwerking, een andere rol eindverantwoordelijk — en de
  bevinding komt terug. **Herstellen** kan niet worden gemarkeerd: het model
  spreekt zichzelf tegen, en het antwoord zit in het model. Waar je de
  scope die haar bijhoudt alleen mag lezen, wordt niets aangeboden. Een
  agent leest de markeringen en maakt er nooit een.` },
    { title: `De pagina Controles`, text: `**Controles** op de kaart van een startpagina, of een aantal onder **Vraagt
aandacht**, opent de pagina Controles over die startpagina: wat de controles
vinden in of onder haar, en op het organisatiescherm in de hele boom.

- **Elke controle, per categorie** — het landschap, plannen en datums, de
  organisatie, teams en systemen, analyse — met het teken van haar gewicht,
  haar naam en hoeveel ze vindt, nul ook: een controle die niets vindt is het
  weten nog steeds waard. Herstellen voor nakijken voor notitie binnen elke
  categorie.
- **Tonen** op de balk kiest welke gewichten je ziet. De notities zijn
  verborgen tot je ze toont, zoals in elke lijst, en wat je kiest duurt zolang
  de app open is.
- **Kies een controle** om haar te lezen: haar gewicht en categorie,
  **Waarom het ertoe doet**, **Hoe je het oplost**, en **Gevonden (N)** — elke
  bevinding ervan, elk in haar scope. Klik op een ervan om haar te openen
  waar ze wordt opgelost: het record, de tekening, het plan, de pagina van het
  besturingsmodel, een persoon in Mensen. **Markeren als bedoeld…** naast een
  bevinding van een nakijkpunt of een notitie markeert haar vanaf hier, in de
  scope die haar bijhoudt, en **Geaccepteerd (N)** zet op een rij wat is
  gemarkeerd, elk met **Terugnemen**. Een toewijzing in een eenheid die er
  niet is biedt ernaast **De toewijzing verwijderen**, op dezelfde manier
  weggeschreven: er is geen eenheid meer om het vandaan op te lossen. Een
  markering die hier wordt gemaakt,
  met niets open, is een stap van die scope en staat niet op een
  ongedaan-stapel: **Terugnemen** is hoe je haar ongedaan maakt.
- Wat de pagina telt, komt uit wat de app al weet over de hele boom: de
  bevindingen tussen scopes, de eenheden en mensen van de organisatie, de
  datums van elke scope, en de Conway-kaart over de startpagina. Een paar
  controles lezen het hele document van een scope — een record op geen
  enkele weergave, de gegevens van de eigenaar op een stand-in, een lijn naar
  niets, de link van een tekening, de twee van de bedrijfslaag, een oorzaak
  die een waarneming eronder verklaart — en vinden iets waar die scope
  open is: de pagina zet ze op een rij met hun uitleg en zegt *Hier niet
  geteld* in plaats van een getal.` },
    { title: `Het register`, text: `**Register** op het organisatiescherm is elke applicatie in de hele map, op één
pagina. Niets schrijft hem: hij wordt telkens uit de scopes zelf afgeleid
wanneer de map gelezen wordt, dus hij kan niet afwijken van wat de mappen zeggen
en er is geen lijst die twee domeinen tegelijk bewerken.

Elke regel zegt hoe de applicatie heet, **welke scope haar beheert**, of ze
van iemand anders is en van wie, **in hoeveel scopes ze getekend is** (houd
de muis op het aantal voor de namen), en de bevindingen erover als kleine chips.
Het filterveld doorzoekt de naam, de sleutel en de scope; **Op naam** en
**Op niveau** zijn de twee volgordes. **Openen** gaat naar de scope die de
applicatie beheert, met de kaart geselecteerd — daar kunnen haar details worden
gewijzigd.

Een regel waar twee scopes dezelfde naam vastleggen biedt **Koppelen…**: dat
opent de scope waarvan de vastlegging moet wijken en vraagt het dáár, want
een vastlegging wordt alleen gewijzigd door de scope die haar heeft.` },
    { title: `Een vastlegging naar een andere scope verplaatsen`, text: `Waar iets is vastgelegd is een keuze die je achteraf kunt wijzigen. Kies de kaart
en klik op **Verplaatsen…** in de inspector; het venster biedt aan welke van de
vier van toepassing zijn.

- **Koppelen** — de eigen vastlegging opgeven en verwijzen naar die van een
  andere scope. Dit lost een conflict op, en het is wat een kaart nodig heeft
  die getekend is voordat iemand de echte vastlegging schreef. Deze scope
  houdt zijn eigen beschrijving, zijn kleuren en waar de kaart op zijn borden
  staat; het geeft de details op, waar de andere scope vanaf dan voor
  instaat.
- **Omhoog** — de vastlegging naar een scope hierboven verplaatsen en hier
  een verwijzing achterlaten. Dat is wat een applicatie in een landschap nodig
  heeft als het domein erboven degene hoort te zijn die haar beheert.
- **Omlaag** — het omgekeerde: naar een scope hieronder.
- **Overdragen** — naar elke andere scope. **Hier een verwijzing achterlaten**
  staat standaard aan; zet je het uit, dan tekent deze scope het ding
  helemaal niet meer.

**Een eenheid neemt haar mensen mee.** Een eenheid omhoog, omlaag of over
verplaatsen neemt elke toewijzing die voor haar wordt bijgehouden mee, in
dezelfde stap — ook de beëindigde, want wie haar rollen vervulde hoort bij de
eenheid — onder de id's die ze hadden, zodat ieders verleden van hen blijft. Een
verwijzing die achterblijft houdt er geen. De bevestiging zegt hoeveel er
meegaan.

De laatste drie schrijven **twee scopes**, dus ze vragen het eerst. De
scope waar het naartoe gaat wordt geschreven vóór deze scope verandert, en
dat is met opzet: gaat er halverwege iets mis, dan staat de vastlegging op
*beide* plaatsen — een conflict dat je ziet en met **Koppelen** oplost — en niet
op geen van beide.

Daarom **stopt ongedaan maken daar**. {key:Mod+Z} neemt alles terug wat je sindsdien deed
en weigert dan die stap, met een regel die zegt waarom: maar de helft ervan staat
op de stapel van dit venster, en de andere helft is een bestand in een scope
waar hier niemand voor spreekt. Verplaats de vastlegging opnieuw, de andere kant
op, om het terug te zetten.

Een verplaatsing wordt geweigerd, met de reden, als de scope waar het
naartoe zou gaan de naam al beheert, als een verplaatsing omhoog een scope
noemt waar dit niet onder valt, en als het verwijderen van de vastlegging dingen
die eronder vallen zonder ouder zou achterlaten.` },
  ],
  operating: [
    { title: `Het besturingsmodel`, text: `De kaart **Besturingsmodel** op het startscherm van de organisatie opent hoe
de organisatie zichzelf heeft ingericht: de soorten eenheden die ze heeft, de
rollen die elke soort heeft, en waar elke rol verantwoordelijk voor is — in
haar eigen woorden. Het wordt bij de organisatie bijgehouden en daar bewerkt;
geopend boven een andere scope kun je het alleen lezen, en dat staat er ook.
Elke wijziging is een stap: ze staat in Activiteit, {key:Mod+Z} draait haar terug, en
elk eenheidstype, elke rol en elke verantwoordelijkheid heeft een eigen
geschiedenis.` },
    { title: `Structuur`, text: `De pagina heeft vijf tabbladen, naar de vraag die elk beantwoordt: **Structuur**,
**Rollen**, **Verantwoordelijkheden**, **Uitzonderingen** en **Bibliotheken**. Welk
tabblad, deel en welke eenheid openstaat staat in het adres van de pagina, zodat een
link en een agent hetzelfde scherm bereiken.

Een **eenheidstype** is het woord van de organisatie voor een soort eenheid.
**Structuur** tekent de typen als de structuur die ze vormen, per **niveau**: hoe diep
een eenheid van het type kan zitten. Elke kaart noemt het type, hoeveel eenheden het nu
heeft en de rollen, elk op een regel, met *geeft leiding* bij een leidinggevende rol.
Onder de niveaus zegt één regel wat nergens zit en welke rollen in geen type zitten.
Een type dat nergens zit, telt ook mee op de regel **Controles** op de startpagina
van de organisatie en staat op haar pagina Controles.

Op een kaart klikken kiest het type: waar het mag zitten, wat erin mag zitten en de
rollen lichten op, de rest dimt, en rechts opent de lezer. Op een rol klikken kiest die
en tekent de rapportagelijnen, doorgetrokken voor een leidinggevende en gestippeld voor
een functionele. Een leeg model toont de drie stappen op volgorde, met
**Begin met een bibliotheek** voorop.

De lezer van een type zegt waar het mag zitten, met **Wijzigen**, en elke rol op één
regel: hoeveel, en waaraan de houders rapporteren. Alleen een lijn die dit type wijzigt
valt op, als *eigen lijn hier*. **Meer** bevat of een eenheid meerdere domeinen mag
bedienen, het maximum aan applicaties, de volgorde in het niveau en de dagen.

Op de regel van een rol klikken toont aan wie de houders rapporteren en **waar dat
vandaan komt**, de bovenste regel eerst: de eigen lijn van een houder, van de eenheid,
van dit type, van de rol, dan de nesting. **Lijn wijzigen voor** dit type zet hier een
lijn; **Terug naar wat de rol zegt** haalt hem weg; een andere keuze is
**Via de nesting in dit type**. Een lijn die een kring zou sluiten
wordt geweigerd, met de reden.` },
    { title: `Rollen`, text: `**Rollen** toont elke rol: waar die zit, de leidinggevende en het aandeel. Een rol kiezen
opent hem groot: doel, houders en vacatures, de lijnen, waarvoor hij instaat, wie eraan
rapporteert, en elke eenheid met wie de rol daar vervult. Op een eenheid klikken gaat naar
haar plaats in de organisatie. **Meer** bevat de korte naam, de volgorde van haar kolom en
haar dagen.

De twee eigenaarsregels staan boven de lijst. Een regel die niet is ingesteld zegt wat
daarvan het gevolg is. Een rol verwijderen haalt hem uit de typen en de regels, in één
stap; vervullen mensen hem nog, dan zegt de vraag hoeveel en waar.` },
    { title: `Verantwoordelijkheden`, text: `**Verantwoordelijkheden** opent op een deel: links een boom van de groepen, rechts een
raster met de rollen die daarin een aandeel hebben. De andere rollen zijn samengevouwen
in één kolom **+N**: een klik erop toont ze, en **Eén als kolom toevoegen** voegt er
een toe. **Hele organisatie** toont alles, voor audits en export. **Eenheid**
beperkt het raster tot de rollen van één eenheid en zegt wie ze vervult; een rij met de A
buiten de eenheid zegt waar die zit. De lezer van een eenheid op het organogram leidt
hierheen.

Op een cel klikken selecteert en schrijft niets. R, A, C, I of – op het toetsenbord, of de
knoppen onder het raster, zetten de letter als één stap. Elke verantwoordelijkheid wil
precies één A: een rij zonder of met meer zegt dat onder **Nodig**, de boom telt wat eronder
zit en de telling boven het raster geldt altijd de hele organisatie. **Filter** houdt rollen
en groepen over, **Ordenen** bevat de volgorde en **Exporteren** bewaart CSV.` },
    { title: `Uitzonderingen`, text: `**Uitzonderingen** is de ene lijst van alles wat iets anders zegt dan het model: de lijn
van een type, van een eenheid, van één houder, en een rol buiten de plaatsen van de
eenheid. Een rij kiezen toont hem groot, met **Terug naar standaard**. Zeggen meerdere typen
hetzelfde, dan biedt de pagina **De rol wijzigen** aan: dat vraagt eerst, en is één stap.` },
    { title: `Bibliotheken`, text: `Met de app komen vier vertrekpunten mee: **Scrum**, **SAFe**, de
waardestromen van **IT4IT** (de zeven van versie 3.0) en **Team Topologies**.
Elk is alleen-lezen, heeft een versie, en is geschreven in het Engels,
Nederlands en Duits, in de eigen woorden van deze app.

**Uit een bibliotheek…** opent ze in een dialoog boven de pagina. Links staan
de bibliotheken; de gekozen bibliotheek staat in het midden getekend als de
structuur die ze zou maken, in dezelfde banen als je eigen, alleen-lezen:
elk eenheidstype met zijn doel en de rollen die het heeft, en onder de banen
de rollen die in geen van haar typen zitten. Klik op een rol om te zien waar
die voor staat. Vink een eenheidstype aan, of een losse rol: wat het nodig
heeft komt mee en staat gestippeld — de rollen van een type, de typen waar het
in de bibliotheek onder valt — en een rol neemt altijd de
verantwoordelijkheden mee waarin ze een aandeel heeft. Een onderdeel dat je
model al heeft, zegt **in je model als …**, of **(gekoppeld)** waar een eerdere
stap het aan een eigen onderdeel koppelde, en wordt gebruikt zoals het is.

Rechts is **Wat er binnenkomt** de stap voordat hij wordt geschreven. Elke
naam kan ter plekke worden veranderd, te beginnen met het woord van de
bibliotheek in de taal waarin je werkt. Elk eenheidstype zegt waar het komt:
zoals in de bibliotheek, bovenaan, naast een van je eigen typen — op dezelfde
plaatsen — of erbinnen. Een type dat bovenaan zijn bibliotheek staat en geen
van haar typen bevat, komt naast je diepste type dat niets bevat, zodat de
teams van Team Topologies naast je eigen teams staan in plaats van los
bovenaan. Elke rol wordt overgenomen, of een eigen rol wordt ervoor gebruikt —
voorgesteld waar de bibliotheek zegt dat de twee hetzelfde zijn, of waar de
namen gelijk zijn — en dan wordt er niets voor overgenomen. **Overnemen** zegt
hoeveel onderdelen de stap maakt en schrijft ze als één stap: de pagina
markeert daarna wat nieuw is tot je haar verlaat, en het bericht onderaan
biedt **Ongedaan maken**, dat die stap terugneemt zolang er sindsdien niets
is gebeurd. {key:Mod+Z} neemt hem ook terug.

Wat binnenkomt is van de organisatie: hernoem het, herschrijf het, schrap
het. Het tabblad **Bibliotheken** toont per bibliotheek **Wat binnenkwam**:
het woord van de bibliotheek naast hoe het hier heet, dat je ter plekke kunt
hernoemen — klik op het woord van de bibliotheek om het onderdeel te openen
waar het wordt bewerkt — en wat er sindsdien veranderd is; en de onderdelen
waarvoor een eigen onderdeel werd gebruikt, als **je eigen … gebruikt**. Een
naam of een plek die bij het overnemen werd gekozen, is geen verandering; een
eenheidstype dat sindsdien is verplaatst wel. Elk onderdeel onthoudt op welk
onderdeel van welke bibliotheek en welke versie het is gebaseerd, zodat
**Vergelijken met de bibliotheken** laat zien waarin het verschilt van de
bibliotheek zoals die nu wordt meegeleverd — gelezen in de taal waarin het is
overgenomen — en zegt wanneer een bibliotheek een nieuwere versie heeft. Er
wordt nooit iets samengevoegd. De namen van de raamwerken zijn van hun
eigenaren; geen van de bibliotheken wordt door hen onderschreven.` },
    { title: `Eenheden en de mensen erin`, text: `Een actor wordt een **eenheid** zodra hij een eenheidstype heeft: kies er een
onder **Eenheid** in zijn inspector, op een bord of op zijn pagina, en
**Geen eenheid** maakt hem weer een partij. Niets anders maakt iets een eenheid. De
eenheid waarin hij zit is de actor waaronder hij is ingedeeld, en de dagen
waarop hij begint en eindigt zijn zijn levenscyclusdata — een eenheid die is
uitgefaseerd, is beëindigd.

**Een eenheid maak je het snelst op het organogram**: **+ Eenheid
bovenaan**, of de **+** op de naamregel van de eenheid waarin ze komt (zie
*Het organogram*). Een actor een type geven in zijn inspector, op een bord of
een blad, werkt zoals voorheen.

**De inspector van een eenheid zet de eenheid voorop.** Op een bord, een
blad, het organogram of haar pagina komt haar naam eerst, met
**Verplaatsen…** en **Tekening maken** in de **⋯** ernaast. Onder de naam
staan haar eenheidstype, met daaronder de scope waarin ze is ingedeeld, en dan
de eigen onderdelen van de eenheid. Als laatste komt **Element**, ingeklapt:
de eigen velden van de actor — zijn gegevenspagina, Algemeen met levenscyclus
en beschrijving, Weergave en Gegevens. Het klapt weer in zodra je
een andere eenheid kiest. Op de pagina staan dezelfde velden uitgeschreven
onder de eenheid. Een actor zonder type houdt de inspector van een element
zoals die was, met **Eenheid** onder zijn tabblad Algemeen.

De onderdelen van een eenheid, in die volgorde:

- **Valt onder**: de eenheid waaronder ze op de dag valt, of *Bovenaan*. Waar
  je de eenheid mag wijzigen, is het een knop die **Verplaatsen…** opent
  (zie *Een eenheid naar een andere plek verplaatsen*, onder *Het organogram*).
- **Rollen, vandaag**: elke rol die haar type heeft, met hoeveel het er wil,
  en wie hem vandaag vervult — met de naam uit het register, het aandeel waar
  dat niet al iemands tijd is, *waarnemend*, en *jij*. Elke rol staat erin,
  ook de optionele, ook waar het organogram een lege optionele rol weglaat.
  Een rol met te weinig mensen toont **+ vacature**; een klik wijst iemand toe.
  **+ toewijzen** bij een rol met plaats voor nog iemand doet hetzelfde.
  **Een rol naast die van het type…** voegt alleen aan deze eenheid een
  optionele rol toe.
- **Wie haar aanstuurt**: één regel voor ieder die vandaag een aansturende rol
  vervult, in deze eenheid of een erboven, de dichtstbijzijnde eerst — en,
  waar zo'n rol elders rapporteert via een lijn van een lijnmanager, wie
  daar uitkomt, gemarkeerd *via een lijn* — of *via een uitzondering* waar
  het de eigen lijn van deze eenheid is of iemands eigen lijn. **waarom?**
  zegt wat dat betekent:
  de app zegt het en geeft er geen rechten mee.
- **Rapportagelijnen**: elke rol van de eenheid die vandaag een
  rapportagelijn heeft, waar ze uitkomt — de rol en de eenheid, of *in deze
  eenheid* — of ze van een lijnmanager is of functioneel, of ze van de rol is,
  van het eenheidstype of van deze eenheid zelf, en *niemand vervult haar*
  waar niemand de rol vervult waar ze uitkomt. Een eigen lijn van deze
  eenheid is een uitzondering op het model en is gemarkeerd *uitzondering*.
  **Overschrijven…** laat de rol wijzen naar een rol in welke eenheid ook —
  elke eenheid genoemd met de eenheden erboven, deze eenheid eerst in de
  lijst, voor een lijn erbinnen — of naar één persoon die haar daar vervult
  (*Welke bekleder*), of naar één persoon waar ook (**Rapporteert aan: Eén
  persoon**, diens rol ingevuld waar die er één heeft en gevraagd waar die er
  meer heeft); lijnmanager of functioneel, voor deze eenheid alleen, vanaf een
  dag en tot en met een dag waar het niet voorgoed is;
  **Hier via de nesting rapporteren** zegt dat de rol rapporteert zoals de
  eenheid genest is, wat haar type of de rol ook zegt; **De eigen lijn van
  deze eenheid weghalen** laat het type of de rol weer spreken.
  **Een lijn voor…** geeft een rol zonder lijn
  er een van zichzelf. De mensen in een rol met een lijn van een lijnmanager
  worden aangestuurd door de mensen in de rol waar ze uitkomt, en dan door
  wie hen aanstuurt; de rest van de eenheid via de nesting. Een lijn van een
  rol naar zichzelf in dezelfde eenheid, en een die een lus zou sluiten,
  worden geweigerd, met de reden. **Rapporteren hieraan** noemt de rollen
  elders waarvan de lijn op een rol van deze eenheid uitkomt, en de mensen
  wier eigen lijn dat doet.
- **Bedient**: de domeinen die ze bedient, de scope waarin ze is ingedeeld
  tenzij je anders zegt — maar nooit de organisatie: een eenheid die daar is
  ingedeeld bedient niets tot **+ Domein** haar er een geeft, en zegt
  **Geen domein** waar je alleen mag lezen. Een eenheid die meerdere domeinen bedient wordt
  ingedeeld in de scope erboven, en haar type moet dat toestaan. **+ Domein**
  kiest nog een domein, waar haar type er meer dan één toestaat. Een klik op
  een domein opent zijn startpagina, waar **Bediend door** hetzelfde zegt van
  de andere kant.
- **Eigenaar van**: elke applicatie die haar noemt als de actor waartoe die
  hoort.
- **Verantwoordelijk voor**: de gebieden, groepen en capabilities die haar
  zijn toegewezen, met de scope die de toewijzing bijhoudt als dat een andere
  is. **+ Gebied of capability** kiest er een uit de hele organisatie, en de
  toewijzing wordt weggeschreven in de scope die het definieert — die van
  deze scope als een stap hier, die van een andere als een stap daar, waar je
  die mag wijzigen. **✕** op een label haalt een toewijzing die hier wordt
  bijgehouden weg.
- **Werkt samen met**: de eenheden waarmee ze heeft vastgelegd samen te werken
  (zie *De Conway-kaart*).
- **In de tijd**: de dag vanaf wanneer ze er is, haar laatste dag, en elke
  verplaatsing die een plan van haar maakt (zie *Verandering in de tijd*).
- **Controles**: wat de organisatie vandaag over deze eenheid tegenspreekt —
  een rol met te weinig mensen of boven het maximum, een eenheid ingedeeld
  waar haar type niet mag staan, een die meer domeinen bedient dan het type
  toestaat of eigenaar is van meer applicaties dan de limiet, iemand die nog
  in een eenheid of rol zit die is beëindigd, iedereen erin van wie de
  aandelen samen meer dan al zijn tijd zijn, en een gebied, groep of
  capability waarvoor ze verantwoordelijk is in een domein dat noch zij noch
  een eenheid erboven bedient; en van haar rapportagelijnen een die nergens
  uitkomt omdat geen eenheid de rol heeft, een die bij meerdere eenheden kan
  uitkomen zonder dat er een erboven staat — **Overschrijven…** zegt welke —,
  een naar een rol die niemand vervult, en lijnen die terugkomen waar ze
  begonnen, vandaag of op een latere dag waarop een lijn begint of een plan
  een eenheid verplaatst. Een eenheid bedient een domein als ze die scope
  bedient, een scope erboven of een erbinnen. In de lijst met bevindingen
  biedt een rol met te weinig mensen **Toewijzen…** en een toewijzing die
  haar eenheid of rol heeft overleefd **De toewijzing beëindigen…**, waar je
  de mensen van die rol mag wijzigen. De home van de organisatie toont
  dezelfde bevindingen voor elke scope.

De onderdelen lezen de dag waarop het bord ernaast wordt bekeken. Op een bord
dat een andere dag toont — zijn eigen opgeslagen dag, of een dag gekozen onder
**Dag** of met de schuifregelaar van de roadmap — zegt de inspector *Zoals
op* die dag, en wie de rollen vervult, wie haar aanstuurt en de controles zijn
die van die dag, de verplaatsingen van plannen op die dag inbegrepen. Wat je
van daaruit toewijst of beëindigt, begint op die dag als die nog moet komen.

**Toewijzen** is één stap in de scope die de eenheid bijhoudt: kies de rol, de
persoon — gezocht in het register, *jij* gemarkeerd — het aandeel, de eerste
dag, en of het waarnemend is. De eigen rollen van de eenheid staan eerst; onder
**Een andere rol (een uitzondering)** staan de andere van de organisatie. Wie in
zo'n rol wordt geplaatst is een uitzondering op het model: het mag en is geen
bevinding, het venster zegt het voordat je opslaat, en overal waar die persoon
staat — de chip op het organogram, met een gestippelde magenta rand, de
inspector, de pagina Mensen — is het als uitzondering gemarkeerd. De eigen
rapportagelijn van de rol geldt daar voor die persoon. **Nieuwe persoon…** is het eigen formulier van
de pagina Mensen, dus wie misschien al in het register staat wordt aangeboden
voordat er een tweede vermelding komt. De toewijzing bevat het id van de
persoon, nooit de naam. Klik op iemand om de toewijzing te corrigeren, haar
te **Beëindigen op** vandaag, of een vergissing te verwijderen; een beëindigde
toewijzing blijft staan, als wat de persoon vervulde.

**Markeren als vertrokken**, op de pagina Mensen, beëindigt elke toewijzing van
de persoon op de laatste dag — één stap in elke scope die er een bijhoudt — en
haalt toewijzingen weg die pas daarna zouden beginnen.

**Een eenheid verwijderen** is een correctie: het zegt dat de eenheid er nooit
was, dus haar toewijzingen gaan in dezelfde stap mee, ook beëindigde, en de
vraag ervoor noemt wie wat niet langer is. Een eenheid die op een dag ophoudt
te bestaan beëindig je op die dag — met haar levenscyclus, of een plan — en
de rollen van haar mensen eindigen dan en blijven in hun geschiedenis staan.
**Een toewijzing in een eenheid die er niet is** — achtergelaten door een
eenheid die verwijderd werd voordat verwijderen ze meenam, of door een actor
die geen eenheid meer is — weegt **Herstellen**, *Een toewijzing in een eenheid
die er niet is*, wat haar dagen ook zijn: de persoon telt nog mee als
vervuller van de rol. Op de pagina Controles opent ze de persoon in Mensen,
en **De toewijzing verwijderen** haalt haar weg. De eenheden in een verwijderde
eenheid gaan een niveau hoger, of in een andere eenheid van haar type waar het
hunne daar niet mag staan, of gaan mee; de applicaties die ze bezat tonen als
van niemand (*Elementen*).

Een eenheid die een andere scope bijhoudt wordt hier getoond en daar
gewijzigd.

**Waar een aansturende rol een recht geeft.** De app geeft zelf geen rechten
aan wie een eenheid aanstuurt; een bron die weet wie zich aanmeldt mag dat wel,
en zegt het. Daar wijzigt iemand die aan een vermelding gekoppeld is en
vandaag een aansturende rol vervult de mensen van die eenheid en van de
eenheden eronder, ook in een scope die hij alleen mag lezen: **Toewijzen**,
een correctie, **Beëindigen op** en verwijderen — een aansturende rol alleen
in een eenheid onder de eigen. Rapportagelijnen verleggen dat recht: een rol
waarvan de lijn van een lijnmanager uitkomt bij een rol die hij vervult, mag
hij wijzigen, in welke eenheid ook, en de mensen die die op hun beurt
aansturen; een rol in zijn eenheden waarvan de mensen via zo'n lijn elders
rapporteren niet. Iemands eigen lijn van een lijnmanager verlegt het net zo,
voor die ene toewijzing: wie ze bereikt mag die wijzigen, en wie haar alleen
via de rol daar bereikte niet meer. Een functionele lijn geeft geen recht. Verder verandert er
niets aan de eenheid.
Hetzelfde geldt voor een vacature op het organogram, voor **Nieuwe persoon…**
en **Markeren als vertrokken** op de pagina Mensen waar de bron dat zegt, en
voor *Verplaats de mensen*, dat dan hun rijen schrijft en de andere laat zoals
ze zijn.` },
    { title: `Verandering in de tijd`, text: `Een correctie is een bewerking; een verandering heeft een dag. Een eenheid, een
rol of een eenheidstype hernoemen is een bewerking, en een eenheid buiten een
plan onder een andere eenheid zetten ook: het was altijd zo, en de historie
zegt wanneer het werd gecorrigeerd. Een eenheid begint en eindigt op haar
levenscyclusdata; een toewijzing op haar eerste en laatste dag; een
eenheidstype en een rol op de hunne.

**Op de pagina van het besturingsmodel** heeft een eenheidstype en een rol
**Vanaf**, **Tot en met** en **Gevolgd door** onder *In de tijd*. Een rol die
eindigt toont haar mensen na de laatste dag — de opvolger van de rol in
dezelfde eenheid is het voorstel voor elk — met *Verplaats de mensen* eronder
(zie hieronder). Een eenheidstype dat eindigt toont de eenheden die er daarna
nog zijn, met wie er een rol in vervult: wat elk nu is, beslis jij, door haar
een ander type te geven of haar te beëindigen. Een eenheid die nog van een
beëindigd type is, is een bevinding.

**Een rol uit een eenheidstype halen** — het ✕ ernaast onder *Rollen die het
heeft* — toont eerst wie die rol vervult in een eenheid van het type, waar de
eenheid er geen eigen plek voor heeft: *Verplaats de mensen*, onder de rollen,
elk met de opvolger van de rol die de eenheid nog heeft als voorstel, hun
laatste dag erin vandaag. **Schrijf als één stap** haalt de rol uit het type
samen met hun einden en begins, alles of niets, zodat niemand achterblijft in
een rol die het type van de eenheid niet heeft; **… houden**, met de naam van
de rol, laat het type zoals het is. Een rol die zo niemand vervult, gaat er
meteen uit.

**Een reorganisatie is een plan.** Op de pagina van een plan zet *Eenheden die
het verplaatst* een eenheid op een dag onder een nieuwe bovenliggende eenheid
— of bovenaan, onder de organisatie zelf — elk één stap. **Verschuiven…**
verplaatst die dagen met de rest van het plan. Vanaf haar dag geldt de
verplaatsing overal waar de organisatie wordt gelezen: het onderdeel van een
eenheid, de controles, wie een eenheid aanstuurt. Een gestaakt plan
verplaatst niets. Boven de koppelvlakken van het plan zegt de pagina, waar het
plan eenheden raakt:

- **Wat het met de organisatie doet**: de eenheden die het invoert en opheft,
  elk met haar dag, de verplaatsingen, en de rollen die de dag ervoor
  eindigen, met wat erop volgt.
- **De dag ervoor** en **op** de dag: de eenheden onder de kleinste bomen die
  de hele verandering bevatten, met wie er een rol in vervult — *eindigt*,
  *nieuw* en *verplaatst* gemarkeerd.
- **Verplaats de mensen**: elke toewijzing in een eenheid of rol die eindigt,
  elk met een voorstel — waar de eenheid heen ging (haar opvolger), of de
  opvolger van de rol — dat je overneemt of wijzigt; een team dat verhuist
  neemt zijn mensen mee, dus het staat er niet in. Niemands nieuwe plek wordt
  geraden: een rij zonder voorstel eindigt alleen. **Neem elk voorstel over**
  zet elke rij terug op haar voorstel, en **Schrijf als één stap** schrijft
  elk einde op de laatste dag en elk begin de dag erna, in elke scope die er
  een bijhoudt, tegelijk. Waar alleen de scope van het plan wordt geschreven,
  neemt {key:Mod+Z} de hele stap terug; waar ook andere scopes werden geschreven, wordt
  het in elk daarvan teruggezet.
- **Nog open op** de dag, in de lijst met bevindingen: wat de controles dan in
  die eenheden vinden — een over een eenheid opent die — elke
  verantwoordelijkheid die haar A kwijtraakt
  omdat de rol die er verantwoording voor aflegt eindigt, en elke samenwerking
  die de eenheden van het plan nog moeten vastleggen: *Leg vast hoe* een
  eenheid die het plan invoert of verplaatst *samenwerkt met* een andere, waar
  een koppelvlak tussen hun applicaties loopt zonder vastgelegde samenwerking —
  zoals wanneer het cluster dat het plan opheft haar had vastgelegd.
  **Een samenwerking vastleggen…** opent de eenheid van het plan, waar
  **Werkt samen met** haar vastlegt.` },
  ],
  people: [
    { title: `Mensen`, text: `**Mensen** op het startscherm van de organisatie is het register van de
mensen van de organisatie: één vermelding per persoon, met een naam, een
werkadres als je dat weet, en of iemand van de organisatie is of van buiten.
Meer wordt er niet bewaard — geen notities, geen foto.

Het register staat **buiten de geschiedenis**. Een wijziging hier is geen
stap: er is geen {key:Mod+Z} voor en geen regel in Activiteit, en de pagina zegt dat
ook, onder **Over het register** aan het eind van haar ene regel inleiding.
Daardoor kan een naam vergeten worden. De geschiedenis bewaart het id
van een persoon, nooit de naam, en elk scherm vraagt het register om de naam
wanneer het er een toont — dus als een naam uit het register verdwijnt,
verdwijnt hij in één keer van elk scherm.

- **Iedereen** staat in de lijst met soort, status en de **rollen vandaag**
  die ze vervullen — op één regel de eerste rol in haar eenheid en hoeveel er
  nog zijn (**Vervult vandaag** bij de persoon heeft ze allemaal), en *geen*
  voor wie niets vervult, zodat die opvalt — en is te
  zoeken op naam, adres, of een rol of eenheid die ze vervullen; **Toon**
  beperkt de lijst tot wie actief is, wie vertrokken is of wie vergeten is. De
  kolom leest de dag waarop de pagina bekeken wordt (**Bekijk op**, hieronder).
- **Persoon toevoegen** vraagt om een naam, een adres en de soort. Voordat er
  iemand wordt toegevoegd, zoekt het naar iemand die dezelfde persoon kan
  zijn: hetzelfde adres, dezelfde naam (hoofdletters, accenten en spaties
  tellen niet), een naam die op twee letters na gelijk is — *Pia Schultz*
  vindt *Pia Schulz* — of dezelfde achternaam en voorletter.
  **Deze gebruiken** neemt de vermelding die er al is; **Toch toevoegen** maakt een
  tweede, die je later kunt samenvoegen.
- **Mogelijk dubbel** zijn de paren in het register die één persoon kunnen
  zijn. Ze zijn ingeklapt telkens als de pagina opent, als één regel: hoeveel,
  hoeveel per teken, en **Nakijken**. Uitgeklapt is elk paar één rij, het
  sterkste teken eerst — hetzelfde adres, dezelfde naam, bijna dezelfde naam,
  dezelfde achternaam en voorletter — met de twee mensen naast elkaar en wat
  ze onderscheidt: de eerste rol die ze vandaag vervullen en hoeveel er nog
  zijn, het werkadres, *Extern*, en *account* waar een bron die weet wie zich
  aanmeldt zegt dat de vermelding aan een account gekoppeld is. Als er geen
  paar meer over is, is de regel weg.
- **Niet dezelfde persoon** beantwoordt dat de twee twee mensen zijn. Het
  paar wordt niet meer aangeboden, en wie een van beiden corrigeert, krijgt
  geen waarschuwing meer over de ander; iemand nieuw toevoegen kijkt nog wel
  naar allebei. Het antwoord staat in het register, buiten de geschiedenis
  zoals de rest ervan — de twee id's en de dag — en gaat met het register mee
  in een bewaarde kopie, ook een zonder namen. **N beantwoord als niet dezelfde
  persoon**, onder de lijst, toont de antwoorden, elk met **Terugnemen**,
  waarna het paar weer mogelijk dubbel is. Wie een van beiden vergeet of
  verwijdert, laat het antwoord vervallen; wie een van beiden samenvoegt met
  een derde vermelding, neemt het mee naar de vermelding die blijft, tenzij
  dat de ander van de twee is. Geen agent beantwoordt het, zoals geen agent
  samenvoegt.
- **Samenvoegen…** vraagt eerst welke vermelding blijft — de vermelding die
  aan een account gekoppeld is, en dan die met de meeste toewijzingen, staat
  vooraf gekozen, en je kunt de andere kiezen — en is definitief: één vermelding blijft,
  de andere wordt een verwijzing zonder naam, zodat alles wat ernaar wees de
  vermelding toont die blijft. Wie actief is samenvoegen met een vermelding
  die vertrokken is, vraagt wat klopt. **Er nog** laat het vertrek vervallen:
  de vermelding die blijft is weer actief, en het beleid telt niet langer af
  tot de naam wordt vergeten. **Vertrokken** beëindigt de rollen van de
  samengevoegde vermelding op de vertrekdag, zoals **Markeren als
  vertrokken** dat zou doen — een rol die na die dag begon vervalt, want een
  rol eindigt nooit voordat hij begon — en de vraag zegt eerst hoeveel van
  elk. *Er nog* staat vooraf gekozen als een van die rollen na de vertrekdag
  begon.
- **Lijst importeren…** neemt een lijst — geplakt, of uit een bestand — met op
  elke rij een naam, een adres en *intern* of *extern*, gescheiden door
  komma's of puntkomma's. Elke rij gaat door dezelfde controle: een rij die
  duidelijk iemand is die er al staat voegt niemand toe, een rij die dat
  misschien is wordt gemarkeerd en alleen toegevoegd als je **Toch toevoegen**
  aanvinkt, en de rest wordt toegevoegd.
- **Een persoon** laat zien wie het is, hoe ver iemand is met vertrekken, en
  wat iemand in de organisatie vervult: **Vervult vandaag**,
  **Gaat vervullen** en **Vervulde eerder**, elk een rol in een eenheid (zie
  *Eenheden en de mensen erin*). **Bekijk op** zegt hetzelfde op een andere
  dag — na een reorganisatie bijvoorbeeld — en **Terug naar vandaag** keert
  terug; kijken schrijft niets. **Dit ben ik** vertelt deze installatie
  welke vermelding jij bent, zodat je overal gemarkeerd wordt waar je
  voorkomt; dat wordt bij de installatie bewaard — voor een map die in een
  browser is geopend, in die browser — nooit in je map of in iets wat je
  exporteert. **Vind mij**, in de balk, toont dan de hele lijst met jouw vermelding gekozen.
  **Corrigeren…** wijzigt de naam, het adres of de soort, en zegt met wie de
  gecorrigeerde vermelding dan dezelfde persoon kan zijn — nooit met iemand
  over wie beantwoord is dat het niet dezelfde persoon is.
- **Markeren als vertrokken** vraagt om de laatste dag. De naam blijft
  zichtbaar tot het beleid hem vergeet.
- **Nu vergeten** vraagt eerst en haalt dan de naam en het adres voorgoed weg:
  vanaf dan toont elk scherm een pseudoniem, *Oud-collega 7KQM*. Het register
  bewaart geen geschiedenis van een naam, dus niets brengt hem terug. Een
  ondertekend besluit houdt de naam waarmee het is ondertekend, en toont die
  daar los: niets koppelt haar aan de vergeten vermelding.
- **Nu verwijderen**, bij een vermelding die al vergeten is, verwijdert haar uit
  het register; wat ernaar wees leest *een oud-collega*.
- **Verwijst naar hen** noemt elke vastlegging waarvan een veld de persoon
  bij id noemt — een element of plan waarvan ze eigenaar zijn, een
  waarneming die ze deden, een experiment dat ze uitvoeren, een besluit dat
  ze voorstelden of ondertekenden — met de scope die haar bewaart, en
  wat de regels van het besturingsmodel hen vandaag in eigendom geven (zie
  *Velden die een persoon noemen*). Een handtekening die haar naam hield,
  zegt de naam waarmee getekend is — behalve bij een vergeten vermelding, die
  alleen zegt dat de handtekening bestaat, zodat de naam zoals getekend nooit
  naast het pseudoniem staat. **Wat we bewaren** doet hetzelfde.
- **Wat we bewaren** toont alles wat het register over iemand bewaart, en wat
  naar die persoon wijst, als één document om te kopiëren: het antwoord op
  een inzageverzoek. Een verzoek om te wissen beantwoord je met **Nu
  vergeten**. Het zegt ook hoeveel vastleggingen de persoon in hun tekst
  noemen — woorden die in een veld zijn getypt in plaats van een gekozen
  persoon, die vergeten niet bereikt en zoeken wel vindt.

**Het beleid**, onderaan de pagina, is een instelling van de organisatie en
geen stap: hoe lang de naam van wie vertrekt bewaard blijft (90 dagen, tenzij
je dat wijzigt), hoe lang de vergeten vermelding daarna blijft (730 dagen),
en of een agent namen of pseudoniemen ziet. Wie de instellingen van de
organisatie mag wijzigen, stelt het in — op de desktop wie de map beheert.
De app past het toe als de organisatie wordt geopend en opnieuw elke dag dat
ze open blijft: een naam die langer dan de termijn is bewaard wordt vergeten,
een vermelding die langer dan de volgende termijn is bewaard wordt
verwijderd.

Waar de organisatie wordt bewaard door een bron die weet wie zich erbij
aanmeldt, kan die bron twee hiervan zelf doen: ze past het beleid toe op een
eigen schema, en de app vergeet dan niemand als de organisatie wordt geopend;
en ze weet welke vermelding jij bent, aan de hand van je account, zodat je
gemarkeerd wordt zonder **Dit ben ik**, dat dan niet wordt aangeboden.

Zo'n bron kan ook weten wie wat mag. De pagina biedt dan elke wijziging
alleen aan wie haar mag doen: **Persoon toevoegen**, **Corrigeren…** en
**Markeren als vertrokken** bijvoorbeeld alleen voor de mensen van je eigen
eenheden, en **Samenvoegen…**, **Nu vergeten**, **Nu verwijderen** en het
beleid alleen voor de beheerders van de organisatie. **Niet dezelfde
persoon** en **Terugnemen** krijgt wie de twee mag samenvoegen, en, waar de
bron een leidinggevende rol het recht geeft de mensen ervan te wijzigen, een
leidinggevende in wiens eenheden ze vandaag allebei zitten. Waar ze een werkadres
voor je achterhoudt, zegt de pagina *een adres dat je niet te zien krijgt* in
plaats van dat er geen is. Iemand als vertrokken markeren kan diens
toewijzingen meteen beëindigen; de pagina zegt hoeveel. En waar haar schema
iemand van wie de dag gekomen was niet vergat, omdat er na de laatste
werkdag nog met diens account is aangemeld, zegt de pagina dat bij de
status, en beslist wie de naam mag vergeten.

Op de desktop is het register het bestand
\`.lionsville-architecture/people.json\` in je map. **Het staat nooit in de
geschiedenis van de map**: geen momentopname neemt het mee, en een
\`git add\` die je in een terminal typt laat het ook weg, omdat een naam in een
commit een naam is die niets kan vergeten. Een kopie van de map via git
bevat daarom id's en geen namen; de bewaarde kopie neemt het register mee.
De antwoorden *niet dezelfde persoon* staan in hetzelfde bestand. Een versie
van de app van daarvoor leest de mensen en laat de antwoorden weg, en schrijft
het bestand zonder ze zodra ze het register weer wijzigt: de paren zijn dan
weer mogelijk dubbel, en verder gaat er niets verloren.` },
    { title: `Velden die een persoon noemen`, text: `Zes velden noemen een persoon: de **Eigenaar** van een element, de
**Eigenaar** van een plan, wie een waarneming deed (**Waargenomen door**),
wie een experiment uitvoert (**Door**), en wie een besluit voorstelde
(**Voorgesteld door**) en ondertekende (**Beoordelaars en ondertekening**).
Elk neemt een persoon uit het register, of tekst zoals altijd — een naam,
initialen, een team.

- **Uit het register…** naast het veld opent de kiezer van het register:
  zoek op naam, kies iemand, of **Nieuwe persoon…**, dat eerst zoekt naar
  iemand die dezelfde persoon kan zijn, zoals **Persoon toevoegen** doet.
  Terwijl je een naam typt, biedt het veld onder **In het register:** de
  vermeldingen aan die het kunnen zijn; kies er een om naar die persoon te
  verwijzen in plaats van de naam te schrijven. Een naam die op een naam in
  het register lijkt, wordt pas geschreven als je het veld verlaat, zodat een
  naam die je typt om iemand te vinden nooit in de geschiedenis belandt.
- **Een gekozen persoon** wordt bewaard als id. Het veld toont wat het
  register zegt: de naam, of *Oud-collega 7KQM* zodra de persoon vergeten
  is, of *een oud-collega* zodra de vermelding verwijderd is. Een
  samengevoegde vermelding toont de vermelding waarin ze opging. Het kruisje
  haalt de persoon uit het veld.
- **Tekst** blijft tekst. Tekst die geschreven is voordat het register
  bestond, staat er nog, wordt getoond zoals getypt en gevonden door zoeken;
  vergeten bereikt haar niet, en **Wat we bewaren** telt haar.
- **Een handtekening houdt haar naam.** Als een als ondertekenaar gekozen
  persoon een oordeel geeft, wordt de naam die die dag in het register stond
  naast het id geschreven, en de naam van wie het voorstelde ligt op dezelfde
  manier vast zodra iemand heeft getekend. Die naam hoort bij het
  besluitrecord: het besluit toont haar ook nadat de persoon vergeten is,
  waar elk ander scherm het pseudoniem toont. Een agent die volgens het
  beleid pseudoniemen ziet, krijgt ook hier het pseudoniem, en hoort dat de
  naam zoals getekend voor hem achtergehouden wordt. Zodra de ondertekenaar
  vergeten of verwijderd is, verwijst de handtekening naar niemand: het
  besluit toont de naam zoals getekend los, ook terwijl het nog geschreven
  wordt; geen scherm toont haar naast het pseudoniem; zoeken op het
  pseudoniem vindt het besluit niet meer; en een agent krijgt de naam zoals
  getekend zonder id.
- **De eigenaar van een applicatie kan een rol volgen.** Als het
  besturingsmodel de regel heeft *de eigenaar van een applicatie is een rol
  van haar team* (zie *Het besturingsmodel*), toont een applicatie waarop
  niemand een eigenaar schreef de mensen die die rol vandaag vervullen in de
  eenheid uit **Hoort bij** — op de dag afgeleid en nooit opgeslagen, dus de
  eigenaar verandert als de persoon in de rol verandert. Een naam in **Eigenaar**
  gaat voor. **Hoort bij** wordt bij elke applicatie gevraagd: bij een
  applicatie van de organisatie zelf is het de eenheid waar ze bij hoort.
- **Een stand-in** heeft geen eigen eigenaar; ze toont de eigenaar die haar
  master noemt, met hetzelfde id.
- **Zoeken** vindt een persoon via het register: een naam vindt de
  vastleggingen die naar die persoon verwijzen, en een vergeten persoon wordt
  gevonden aan het pseudoniem en niet meer aan de naam.` },
  ],
  guidance: [
    { title: `Richtlijnen: principes, onderwerpen en bouwstenen`, text: `Principes, onderwerpen en bouwstenen beantwoorden één vraag, wat dit werk moet
sturen, en staan onder één ingang, **Richtlijnen**, met elk een tabblad. Elk
tabblad heeft een eigen adres en één regel die zegt waar het voor is; *Welke heb
ik nodig?* zegt wanneer je welke gebruikt. Elk is een lijst met één regel per
item: een regel kiezen opent het item groot, en de pijltjes lopen door de lijst.` },
    { title: `Principes`, text: `Een principe stuurt de ontwerpen en besluiten in een scope: *least
privilege*, *kopen voor bouwen*. Elke scope kan eigen principes hebben, en
een principe geldt in de scope die het bewaart, in elke scope daaronder, en
overal waar een onderwerp dat het bewaart relevant is (zie *Onderwerpen*). De
kaart **Principes** op een home zegt hoeveel er van de scope zelf zijn en
hoeveel er gelden, en opent de pagina. Een regel zegt alleen wat opvalt: geen
woord is een aanvaard, flexibel principe; **Filter** beperkt de lijst op status,
regime en groep. Een principe van elders zegt waar het bewaard wordt: daar wordt
het gewijzigd en besproken. **Meer** bij een principe bevat Intrekken, Samenvoegen
en Verwijderen, en zegt waarom Verwijderen geweigerd wordt.

**Nieuw principe** vraagt een titel en een uitspraak, een regime — *vast*,
altijd aan te houden, of *flexibel*, af te wegen — en de status: een
*kandidaat* waarover nog gesproken wordt, met de vraag waar het om gaat;
*aanvaard*; of *ingetrokken*. Een principe heeft een nummer in zijn scope,
\`PR-0007\`, en zijn **aspecten** zijn daaronder genummerd, \`PR-0007.2\`: de
delen die een record één voor één kan volgen of waarvan het kan afwijken.
Groepen ordenen de lijst; **Groepen** geeft ze een naam en een
volgorde. Wie de uitspraak of de aspecten van een aanvaard principe wijzigt,
**scherpt** het aan: je wordt om een notitie gevraagd, die met de dag onder
het principe blijft staan. Twee principes die hetzelfde zeggen worden
**samengevoegd**; een principe waar een record naar verwijst wordt
ingetrokken in plaats van verwijderd.

**Verwijzen.** Een besluit, een waarneming, een oplossing, een plan, een
element en een bouwsteen hebben elk een sectie **Principes**: de principes
die het record volgt, of waarvan het met een reden afwijkt, of — bij een
waarneming — dat een principe standhoudt, wringt of ontbrak. *Kan gelden*
stelt de principes voor waarvan de woorden bij die van het record passen. Een
verwijzing naar een principe dat er niet meer is, is een bevinding op de
pagina Controles, net als principes die niemand gebruikt en principes die
wringen.` },
    { title: `Onderwerpen`, text: `Een onderwerp loopt door de organisatie heen — *beveiliging*, *integratie*,
*data* — en is relevant voor sommige scopes en niet voor andere. Onderwerpen
zijn eigen scopes onder de plek **Onderwerpen** van de organisatie, die
ontstaat bij het eerste onderwerp; een onderwerp kan subonderwerpen hebben.
De kaart **Onderwerpen** op de home van de organisatie opent de catalogus:
elk onderwerp, genest, met hoeveel scopes het bereikt; gekozen, waar het relevant
is en de bouwstenen en principes die het bewaart. **Meer** bij een koppeling bevat
beëindigen, de dagen wijzigen en verwijderen.

Een onderwerp wordt **vanaf een dag** aan een scope gekoppeld, en de
koppeling kan op een dag eindigen: **+ Scope…** bij het onderwerp, of
**+ Onderwerp…** onder *Onderwerpen* op de home van een scope —
dezelfde koppeling, van beide kanten. **Meer** bij een koppeling bevat
**Beëindigen op een dag…**, dat de koppeling als geschiedenis bewaart,
**Dagen wijzigen…**, en **Weghalen**, voor een koppeling die per vergissing is
gemaakt. De principes van een
onderwerp gelden overal waar het vandaag relevant is, en de scopeboom toont
een onderwerp als een rij ↗ onder elke scope waarvoor het relevant is. Een
onderwerp kan worden hernoemd, beschreven, onder een ander onderwerp
geplaatst, en verwijderd zolang het niets bewaart.

**+ Onderwerp…** op de home van een scope opent een keuzevenster dat gemaakt
is voor veel onderwerpen: typ om er een te vinden op naam of op waar het over
gaat, of blader erdoor zoals de catalogus ze nest. Elke rij zegt waar het
onderwerp vandaag geldt en wat het bewaart, en het aangewezen onderwerp is
naast de lijst helemaal te lezen. Vink er zoveel aan als er gelden en voeg ze
samen toe; een subonderwerp komt mee met zijn onderwerp. Past er niets, dan
maakt **Nieuw onderwerp…** er een met de getypte naam, relevant voor die scope.

Het type van een onderwerp is **Onderwerp**, en dat van de plek Onderwerpen
ook. Een scope die al bestaat wordt een onderwerp in zijn **Instellingen**:
kies **Onderwerp** onder *Wat dit is*, en bewaren zet hem onder Onderwerpen —
of onder het onderwerp dat bij *Ondergebracht bij* gekozen is — met alles eronder.` },
    { title: `Bouwstenen`, text: `Een bouwsteen is wat veel oplossingen hergebruiken: een *message gateway*,
een *identiteitsdienst*. Hij wordt bewaard in een onderwerp of een scope, en
de kaart **Bouwstenen** opent de lijst van alle bouwstenen. Eén kiezen leest hem
groot; **Open het hele record** is zijn pagina, met de lijst weggevouwen, op vier
tabbladen:

- **Over** — zijn document, met een hoofdstuk per gebruikscontext, en de
  principes die hij volgt.
- **Eisen** — zijn **capabilities**, elk één zin en een *must* waar een
  oplossing die volledig moet afdekken, en zijn **gebruikscontexten**, de
  situaties waarin hij gebruikt wordt, in woorden, die elk zeggen hoeveel ze
  van elke capability nodig hebben: een Harvey ball van leeg tot vol, met een
  legenda. Een klik kiest een cel en schrijft niets; spatie gaat een kwart verder,
  en 0 tot 4 zet hem. **Meer** op een rij haalt een capability weg, en de naam
  van een gebruikscontext opent zijn hoofdstuk.
- **Opties** — de catalogus: producten, diensten en wat zelf gebouwd
  wordt dat hem kan leveren, elk met leverancier en status, en de elementen
  in het landschap die het zijn.
- **Waar gebruikt** — de **beoordeling** van elke scope. **Beoordelen
  voor een scope…** begint er een, met de contexten die daar gelden,
  eventueel met de scores van de beoordeling van een andere scope. In het
  raster wordt elke optie gescoord op elke capability; de **fit** is hoeveel
  van wat deze scope nodig heeft zij afdekt, en een optie die een must niet
  volledig afdekt valt af, wat haar fit ook is.

**Een besluit voorstellen…** bij een beoordeling zet een besluit klaar in die
scope, met de opties, hun fit en de drijfveren ingevuld. Zodra het besluit op
de besluitenpagina van zijn scope is aanvaard, legt de beoordeling de gekozen
oplossing vast, en zeggen de inspectors van haar elementen en de bibliotheek
dat ze voor die scope gekozen zijn.` },
  ],
  agent: [
    { title: `Werken met een agent`, text: `Je codeeragent — Claude Code, Codex, Cursor of een andere MCP-client — kan
verbinding maken met de desktop-app (*Een agent koppelen…* op de balk, of
het symbool naast het menu) en in de organisatie werken terwijl je meekijkt.
De agent leest elke scope en kan de app bewegen zoals jij dat doet: een scope
openen, naar een bord of een blad gaan, de besluiten of de roadmap openen,
de waarnemingen openen op het tabblad Register, Analyse of Oplossingen, een
rapport bekijken. Hij kan een bord, een blad, een kaart of een
technologielandschap openen met één ding daarop geselecteerd, als die
weergave het tekent. Je hoeft er niets voor open te zetten, en een weergave
openen maakt er nooit een: heeft een scope geen weergave van de soort die de
agent vraagt, dan krijgt de agent dat te horen en blijft het scherm waar het
is — er een maken is een wijziging als elke andere. Wat hij opent, zie je
ook, dus de pagina van een record die over het bord open stond, gaat dicht.

Zolang de agent de app beweegt of het model wijzigt, zegt een strook onder
in het venster dat, met de naam van de agent en — als die dat heeft gezegd —
waar hij mee bezig is. Wat je ondertussen aanklikt, kan veranderen wat de
agent daarna ziet; daarom staat de strook er, zodat je het weet voordat je
klikt. **Stoppen** op die strook beëindigt de sessie van de agent: de strook
verdwijnt, de agent hoort het bij zijn volgende aanroep en wordt geacht te
melden hoe ver hij was in plaats van door te gaan. Hij kan vragen om verder
te mogen; zeg je dat, dan begint een nieuwe sessie en is de strook terug.

Alles wat een agent wijzigt, staat in Activiteit onder zijn naam en wordt
ongedaan gemaakt met {key:Mod+Z}, zoals altijd.

Een agent kan het **personenregister** lezen, er iemand aan toevoegen — hij
hoort het als er al iemand vergelijkbaars in staat — en iemand als vertrokken
markeren. Hij ziet namen, of pseudoniemen waar het beleid van de organisatie
dat zegt, en hoort of iemand een adres heeft, nooit het adres zelf. Hij kan
niemand vergeten, verwijderen of samenvoegen, en het beleid niet wijzigen:
dat doe jij, op de pagina Mensen. Het register is geen stap, dus wat een agent
daar doet staat niet in Activiteit en is niet ongedaan te maken met {key:Mod+Z}.

Een agent kan ook de **boom van scopes** bijhouden: een scope onder een andere
maken — een domein, of een landschapsscope met zijn eerste bord, vanaf het
begin bediend door een eenheid — er een hernoemen en beschrijven, er een type
aan geven, hem ergens anders opbergen, en er een verwijderen. Hij verwijdert
één scope tegelijk, en nooit een met scopes eronder. Een scope met werk erin
gaat pas weg nadat de agent je heeft verteld wat erin zit en jij in je eigen
woorden hebt gezegd dat hij met alles erin weg mag: je woorden gaan mee met de
verwijdering, en een melding op het scherm zegt wat er weg is. Daarvoor is er
geen {key:Mod+Z}. Elke wijziging is een eigen stap van die scope, in zijn
geschiedenis, zoals een wijziging vanaf een startpagina — geen stap die {key:Mod+Z} in
de werkruimte terugdraait. De agent laat de scope die in de werkruimte open
is op zijn plek in de boom: om die te hernoemen, te verplaatsen of te
verwijderen, of een scope erboven te verplaatsen of te verwijderen, gaat hij
eerst naar de startpagina van die scope, zoals jij zou doen.

Een agent leest de **principes** die in een scope gelden en hoe elk daar
komt te gelden, de **onderwerpen** en waar elk geldt, en de **bouwstenen** met
de evaluatie die elke scope ervan maakte. Hij kan een principe voorstellen en
wijzigen en er een citeren vanuit een record; een onderwerp maken en het
koppelen aan de scopes waarvoor het relevant is; de capabilities,
gebruikscontexten en catalogus van een bouwsteen wijzigen; de evaluatie van
een bouwsteen in een scope beginnen, de opties beoordelen en het besluit
voorstellen dat eruit volgt, zoals **Een besluit voorstellen…** op de pagina van
de bouwsteen doet — aannemen doe jij. Als hij een beschrijving of een besluit
schrijft, verwijst hij naar een weergave, een element, een principe, een
evaluatie, een besluit of een waarneming met dezelfde woorden die
*Invoegen ▾* schrijft.` },
    { title: `Bibliotheken`, text: `Een agent leest het besturingsmodel met \`unitTypes.list\`, \`roles.list\` en
\`responsibilities.list\`, vanuit de organisatie welke scope er ook open is, en
wijzigt het met \`unitType.add\`, \`unitType.update\`, \`role.add\` en
\`role.update\` terwijl de organisatie de open scope is. \`unitTypes.list\` geeft
elk eenheidstype zijn baan — 1 bovenaan, en onder het diepste type waaronder
het mag vallen — en noemt ze per baan, dan op hun \`order\` daarin, dan op naam,
die nergens onder vallen als laatste.` },
    { title: `Eenheden en de mensen erin`, text: `Een agent maakt een actor een eenheid met \`element.update\` (\`unitTypeId\`,
\`scopes\`, \`extraSlots\`), vraagt met \`assignments.list\` wie wat vervult — over
de hele boom, en voor één eenheid haar rollen en wie haar aanstuurt — en wijst
toe en beëindigt met \`assignment.add\` en \`assignment.end\` in de scope die de
eenheid bijhoudt, en corrigeert er een — het aandeel, waarnemend, de dagen en
iemands eigen rapportagelijnen (\`reportsTo\`) — met \`assignment.update\`.
\`reportingLine.set\` zegt de eigen lijn van een eenheid, naar een rol in een
eenheid of naar één persoon (\`to.person\`), en \`reportingLines.list\` geeft elke
lijn met waar ze is gezegd en of ze een uitzondering is, en noemt de
uitzonderlijke plaatsingen. De agent krijgt mee dat hij zich aan de standaard
van het model houdt, alleen een uitzondering schrijft als je erom vraagt, en
zegt dat hij dat deed. Een agent vergeet, verwijdert of voegt nooit iemand samen.
\`element.remove\` op een eenheid neemt ook haar toewijzingen mee en noemt ze
in het antwoord (\`assignmentsRemoved\`), zet de eenheden erin een niveau
hoger waar hun type daar mag staan (\`unitsMoved\`), maakt het team leeg van de
applicaties die haar noemen (\`teamCleared\`) en neemt haar regels in andere
scopes mee (\`alsoChanged\`). Waar de eenheden erin niet hoger mogen, wordt het
geweigerd, \`agent.unitsInside\`, met de keuzes genoemd: de agent vraagt het
jou, en roept opnieuw aan met \`units\` — \`into:<id>\`, \`up\` of \`delete\`; \`checks.list\` noemt een achtergelaten
toewijzing \`check.assignmentOrphaned\`, die een persoon verwijdert.
Wie een scope bedient is de \`scopes\` van de eenheid, weggeschreven met
\`element.update\` in de scope die de eenheid bijhoudt — de organisatie, \`""\`,
is er nooit een, en wordt weggelaten uit wat wordt weggeschreven; wie verantwoordelijk is
voor een capability is een \`assigned\`-regel, weggeschreven met \`relation.add\`
in de scope die hem definieert; en \`checks.list\` noemt een capability die
buiten haar domein is toegewezen \`check.unitNotServing\`.
\`assignments.list\` zegt wie elke houder aanstuurt, elk met \`via\` — \`nesting\`
of \`line\` — en de functionele lijnen apart. De lijn van een rol in een
eenheidstype is \`reportsTo\` in \`unitType.add\` en \`unitType.update\`; de eigen
lijn van een eenheid is \`reportingLine.set\` — naar een rol in een eenheid
waar ook, of via de nesting hier — en \`reportingLine.remove\`, in de scope die
de eenheid bijhoudt; \`reportingLines.list\` noemt elke lijn op een dag, waar
ze uitkomt en wat de lijnen tegenspreken. Een lijn naar zichzelf wordt
geweigerd met \`reportingLine.self\` en een die een lus sluit met
\`reportingLine.loop\`, met de keten.` },
    { title: `Verandering in de tijd`, text: `Een agent zet een eenheid op de dag van een plan onder een nieuwe
bovenliggende eenheid met \`plan.move\`, dateert een eenheidstype of rol met
\`unitType.update\` en \`role.update\` (\`from\`, \`until\`, \`successors\`), en leest
de organisatie van een dag met \`assignments.list\` en \`checks.list\` (\`on\`).
Waar een eenheid staat, corrigeert hij zonder dag met \`element.update\` en
\`parentId\` — elke eenheid in de organisatie, gevonden op haar id, of geen voor
bovenaan — in de scope die de eenheid bijhoudt: een kringloop wordt geweigerd,
en een plek waar haar type niet mag staan wordt gemeld (\`misplaced\`).` },
    { title: `Wie met wie samenwerkt`, text: `Een agent maakt beide weergaven met \`diagram.create\` (\`chart\`, \`conway\`), opent
ze met \`app.open\`, op een Conway-kaart met \`tab\` (\`grid\`, \`lines\`), \`group\` en \`pair\`, en leest wat ze tekenen met \`diagram.inspect\`: de eenheden
met per rol wie die vervult en wat vacant is op de dag van de weergave, in de
volgorde van het organogram en nooit dichtgevouwen, of de kolommen, de
overschrijdingen en de bevindingen, elk met de sleutel, het gewicht en de
categorie van haar controle, zoals \`checks.list\` ze geeft. Een samenwerking legt hij
vast met \`relation.add\`, type \`interacts\` en een \`mode\`.` },
  ],
}
