# Brûkershantlieding

De Lionsville Architecture Management Tool tekenet in applikaasjelânskip yn
Layer 7-bannen en de C4-containerdiagrammen dêrûnder. Dit is de hantlieding
foar it brûken derfan. Wat it is en wêrom't it bestiet stiet yn de
[README](../README.md); dizze hantlieding is der ek yn it
[Ingelsk](manual.en.md), it [Nederlânsk](manual.nl.md) en it
[Dútsk](manual.de.md).

## Begjinne

**Desktop.** Download it ynstallaasjebestân foar jo platfoarm fan de
[releaseside](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
De app sjocht op de eftergrûn oft dêr in nijere ferzje stiet en seit it as dy
der is — **Download…** iepenet it ynstallaasjebestân yn jo brouwer, **Skip
This Version** seit dizze net, en it finkje yn dat finster set de automatyske
kontrôle út. Der ynstallearret himsels neat. **Check for Updates…** yn it
appmenu freget it op fersyk.

**Brouwer.** Fanút in kloon fan de repository ien kear `npm run setup`, dêrnei
`npm run dev`; iepenje <http://127.0.0.1:5200>. Dêr't de brouwer it oanbiedt —
Chromium docht dat — kin in ljepblêd krekt as de desktop yn in map wurkje. Dêr't
dat net kin, libbet alles wat jo meitsje yn de opslach fan dy brouwer oant jo in
bestân bewarje.

Yn beide gefallen ferlit neat jo kompjûter. Der is gjin akkount, gjin backend
en gjin telemetry.

## It organisaasjeskerm

De app iepenet op de **organisaasje** — de wurkmap sels, dy't in ûnderdiel is
lykas elk oar en dêr't al it oare ûnder falt. In **ûnderdiel** is ien dokumint:
in namme, in lânskip, de containerdiagrammen dêrûnder, de besluten, de plannen,
de bedriuwsarsjitektuer en alles wat derop stiet. Underdielen **nestelje**, en
elk fan har is itselde dokumint — de organisaasje boppe-oan, in **domein**
dêrûnder, in **lânskip** dêr wer ûnder, sa djip as jo wurk freget.

It skerm is it thús fan de organisaasje en gjin list mei dokuminten, en it
bestiet út fjouwer dielen.

![It organisaasjeskerm: de namme en de keppelings boppe-oan, de eigen siden fan de organisaasje as kaarten, de beam fan domeinen en lânskippen, en de foarbylden ûnderoan](screenshot-organisation.png)

**Wa't it is**, boppe-oan: de namme, de klant as de tekeningen foar in oar makke
binne, hoefolle domeinen en lânskippen derûnder falle, wannear't der foar it
lêst wat feroare, de beskriuwing en de keppelings. In map dy't noch gjin namme
hat freget der hjir om yn plak fan in kop te toanen.

**De eigen siden**, as fjouwer kaarten. **Bedriuwsarsjitektuer** telt de
klantreizen, gebieten, funksjes en belanghawwenden dy't de organisaasje sels
hat, en seit hoefolle funksjes noch oan gjin inkeld domein tawiisd binne;
**Besluten** telt de fêstlizzingen per status en neamt de nijste; **Roadmap**
telt de plannen en toant it earste dêr't har datums it net oer iens binne.
**Register** telt elke applikaasje yn de hiele map, hoefolle troch in domein
behearre wurde en hoefolle fan in oar binne, en seit wêr't it register it net
oer iens is. Elke kaart iepenet wat er telt; as jo de side slute binne jo wer
hjir.

**De beam**, dêrûnder: ien rige per ûnderdiel, de bern ynsprongen, mei in
pylkje om in domein tichtklappe te kinnen. In rige seit hoefolle deryn sit —
lânskippen en diagrammen oer de hiele tûke foar in domein, diagrammen foar in
lânskip — en wannear't der foar it lêst wat feroare. Dêrûnder, dêr't der wat te
sizzen is, draacht er syn **befiningen**: hoefolle nammen twa ûnderdielen beide
opeaskje, hoefolle kopyen ferâldere binne, en de rest fan *Ien namme yn de hiele
organisaasje* hjirûnder. **Folchoarder** set op namme of op wat jo it lêst
wizige hawwe.

- **Iepenje** giet in ûnderdiel yn dat wat tekenet. In ûnderdiel dat neat
  tekenet is in domein: alles wat derûnder falt wurdt neamd, en der is gjin
  tekenflak om te toanen.
- **Nij ûnderdiel…** freget om in namme en ûnder hokker ûnderdiel it falle
  moat. Elke rige hat der ien fan himsels, en dat is de koarte wei om ûnder dat
  ûnderdiel wat ta te foegjen.
- **Ynstellings…** op elke rige hâldt de namme, wat it is (organisaasje,
  domein, programma, lânskip — in wurd foar it skerm, der hâldt him neat oars),
  in klant, in beskriuwing, keppelings, en **Underbrocht by**, dat it
  ferpleatst.
- **Fuortsmite** hellet it ûnderdiel fuort mei alles wat derûnder falt: syn map
  op de desktop, syn records yn de brouwer. In wurkbestân dat jo earne oars
  bewarre hawwe wurdt net oanrekke. De organisaasje sels kin net fuortsmiten
  wurde — dat is de map dy't jo iepene hawwe.

**Foarbylden**, as lêste. Ien kopiearje yn in lege map sûnder namme makket it
foarbyld *de* organisaasje; ien kopiearje yn in map dy't al wat is bringt it
ûnder by in nij ûnderdiel fan himsels. Hoe dan ek is it fan dat momint ôf fan
jo, en neat wat jo dogge rekket it foarbyld sels.

In ûnderdiel omneame jout it in oar label en fierder neat — wêr't it ûnderbrocht
is, is syn adres, en omneame is net ferpleatse. Ien ferpleatse feroaret it adres
fan it ûnderdiel en fan alles dêrûnder, en lit de ynhâld ûnoanrekke: elke
ferwizing earne oars yn de map dy't derhinne wiisde wurdt yn deselde stap nei it
nije adres oerbrocht, sadat in ferpleatsing nea in spoar fan ferâldere kopyen
efterlit. By it starten iepenet de app it ûnderdiel dat jo iepen hienen opnij.

Seis nammen wurde wegere, om't de eigen mappen fan in ûnderdiel se al brûke:
`diagrams`, `docs`, `decisions`, `transitions`, `images` en `logos`.

## Ien namme yn de hiele organisaasje

In namme betsjut oeral yn jo map itselde. It pakhússysteem is ien systeem,
hokker domein it ek tekenet, en in capability dy't de organisaasje neamt is dy
capability oeral dêr't in lânskip him ferfynt — dus elk ding wurdt **ien kear**
fêstlein, yn ien ûnderdiel, en elk oar ûnderdiel dat it brûkt wiist nei
datselde.

**It ûnderdiel dat it fêstleit, behearret it.** Dat record draacht de details:
yn hokker faze it is en op hokker datums, wa't de eigner is, hokker leveransier
it ferkeapet, wêr't it op boud is, hoe ryp it is. Feroarje dêr wat en oeral
dêr't it tekene wurdt stiet it nije.

**Oeral oars stiet in ferwizing** — in kaartsje dat it ding tekenet sûnder it te
behearren. In ferwizing toant syn namme mei in lytse rigel **út …** derûnder dy't
seit wêr't it echt definiearre is, en de ynspektor seit itselde mei in knop om
dêrhinne te gean. De namme en dy rigel binne kopyen, dus dy steane
allinnich-lêze, en sa ek alles wat by de details fan de behearder heart. Wat in
ferwizing *wol* drage kin is **syn eigen beskriuwing** — wat it ERP foar it
pakhús betsjut is in oare side as wat it ERP is, en beide binne it opskriuwen
wurdich. Sa ek de kleur, de foarm en it ikoan dy't jo it jouwe, en wêr't jo it
op jo eigen boerden sette.

Hokker ûnderdiel in ding behearret wurdt bepaald troch **djipte**: it djipste
ûnderdiel dat it fêstleit. Dy iene regel wurket beide kanten út, en dat is krekt
de bedoeling. Capabilities wurde by de organisaasje fêstlein en nei ûnderen
ferfine, dus de organisaasje hâldt se. Applikaasjes wurde fêstlein yn it lânskip
dat se draait, dus in domein hâldt syn eigen — en in organisaasje dy't in
applikaasje al by namme neamt foardat ien him útwurke hat, neamt in plakhâlder
dy't oan de kant giet sadree't ien djipper it echte record skriuwt.

### Wat in befining betsjut

De app wegeret hjiroer nea in bewaring. Hy lêst de hiele map by it iepenjen —
en opnij sadree't de map ûnder jo feroaret — en meldt wat er fynt. Elke rige
fan de beam op it organisaasjeskerm draacht syn eigen rigel.

- **Konflikt** — twa ûnderdielen op itselde nivo lizze beide deselde namme
  fêst. Ien is healwei in migraasje, of twa teams neamden op deselde middei
  itselde ding. Beide riges sizze it, om't gjin fan beide de ferkearde is. Meitsje
  fan de iene in ferwizing nei de oare.
- **Ferâldere** — de kopy fan de namme is net mear hoe't it behearrende
  ûnderdiel it neamt, of it ûnderdiel dêr't er nei wiist is ferpleatst.
  **Bywurkje** skriuwt de kopyen yn ien stap werom, en dat kinne jo ûngedien
  meitsje lykas al it oare.
- **Undefiniearre** — in ferwizing nei wat neat yn de map fêstleit. It kaartsje
  wurdt tekene en de line bliuwt; wat it nedich hat is earne in record om nei te
  wizen.
- **In losse rigel** — in line dy't einiget op wat neat yn de map hat. Bliuwt
  stean en wurdt as stompke tekene, nea troch in bewaring fuortsmiten.
- **In foarstel** — in capability dy't in domein neamd hat en dy't gjin
  ûnderdiel derboppe hat. Gjin flater: it is in petear mei it nivo derboppe.
- **Sûnder eigner** — in systeem dat as fan in oar markearre is sûnder dat ien
  sein hat fan wa.

Ien ding op de list is **ynformaasje en gjin flater**: in record dat gjin boerd
yn syn eigen ûnderdiel tekenet. In ding kin echt, behearre en dokumintearre wêze
sûnder al op immen syn plaat te stean, dus it wurdt apart teld en nea kleure as
in befining.

### It register

**Register** op it organisaasjeskerm is elke applikaasje yn de hiele map, op ien
side. Neat skriuwt it: it wurdt út de ûnderdielen sels lêzen elke kear dat de
map lêzen wurdt, dus it kin net ôfwike fan wat de mappen sizze en der is gjin
list dy't twa domeinen tagelyk bewurkje kinne.

Elke rige seit hoe't de applikaasje hjit, **hokker ûnderdiel him behearret**,
oft er fan in oar is en fan wa, **hoefolle ûnderdielen him tekenje** (wiis it
oantal oan foar har nammen), en de befiningen deroer as lytse chips. It
filterfak siket yn de namme, de kaai en it ûnderdiel; **Op namme** en **Op
nivo** binne de twa folchoarders. **Iepenje** giet it ûnderdiel yn dat de
applikaasje behearret, mei it kaartsje selektearre, en dêr kinne de details
feroare wurde.

In rige dy't seit dat twa ûnderdielen beide de namme fêstlizze biedt
**Keppelje…**: dat iepenet it ûnderdiel waans record wike moat en freget it
dêr, om't in record allinnich feroare wurdt troch it ûnderdiel dat it hat.

### In record nei in oar ûnderdiel ferpleatse

Wêr't in ding fêstlein is, is in kar dy't jo efterôf feroarje kinne. Selektearje
it kaartsje en druk op **Ferpleatse…** yn de ynspektor; it finster biedt oan wat
fan de fjouwer fan tapassing is.

- **Keppelje** — it record fan dit ûnderdiel opjaan en ferwize nei ien dat in
  oar ûnderdiel al hat. Dit is wat in konflikt oplost, en wat in kaartsje nedich
  hat dat tekene is foardat ien it echte record skreau. Dit ûnderdiel hâldt syn
  eigen beskriuwing, syn kleuren en wêr't it kaartsje op syn boerden stiet; it
  jout de details op, dy't it oare ûnderdiel fan dan ôf behearret.
- **Omheech** — it record nei in ûnderdiel ferpleatse dêr't dit ûnder falt, en
  hjir in ferwizing efterlitte. Wat in applikaasje dy't yn in lânskip tekene is
  nedich hat as it domein derboppe him beheare moat.
- **Omleech** — it omkearde: it nei in ûnderdiel ferpleatse dat ûnder dit falt.
- **Oerdrage** — it nei elk oar ûnderdiel ferpleatse. **Hjir in ferwizing
  efterlitte** stiet standert oanfinke; helje it finkje fuort en dit ûnderdiel
  tekenet it ding hielendal net mear.

De lêste trije skriuwe **twa ûnderdielen**, dus dy freegje earst. It ûnderdiel
dêr't it hinne giet wurdt skreaun foardat dit feroaret, en dat is mei opsetsin:
giet der healwei wat mis, dan hâlde jo it record op *beide* plakken oer — in
konflikt dat jo sjen en mei **Keppelje** oplosse kinne — en net op gjin.

Dat is ek wêrom't **ûngedien meitsjen dêr ophâldt**. ⌘Z nimt alles werom wat jo
sûnt dien hawwe, en wegeret dan dy stap mei in rigel dy't seit wêrom: mar de
helte derfan stiet op de stapel fan dit finster, en de oare helte is in bestân
yn in ûnderdiel dêr't hjir neat foar sprekt. Om it werom te setten, ferpleatse
jo it record nochris de oare kant út.

In ferpleatsing wurdt wegere, mei de reden, as it ûnderdiel dêr't it hinne soe
de namme al behearret, as in omheech in ûnderdiel neamt dêr't dit net ûnder
falt, en as it fuorthelje fan it record dingen dy't derûnder falle sûnder wat
efterlitte soe om yn te sitten.

## Jo wurkmap (desktop)

De earste kear dat de desktop-app rint freget er om in **map om yn te wurkjen**,
en alles wat jo meitsje libbet dêr as bestannen dy't jo lêze kinne:

```
<jo map>/
  scope.json                          de organisaasje: har namme, klant, keppelings
  acme-logistics/                     in ûnderdiel dêrûnder
    scope.json                        itselde bestân nochris, ien nivo leger
    warehouse-landscape/              en nochris
      scope.json                      hoe't it hjit, en wat it hâldt
      model.json                      de eleminten en de linen dertusken
      diagrams/landscape.json         wat in diagram is
      diagrams/landscape.geometry.json     wêr't syn eleminten steane
      docs/warehouse.md               de beskriuwing fan in elemint, as proaza
      decisions/0007-one-writer.md    in beslút
      logos/own.svg                   in logo dat jo opladen hawwe
```

In map mei in `scope.json` deryn is in ûnderdiel, en de mappen dêryn dy't der
ien hawwe binne de ûnderdielen dêrûnder. Ferpleats in map yn jo
bestânsbehearder en it ûnderdiel stiet op syn nije adres; neat deryn seit wêr't
it wennet.

**In map fan in âldere ferzje iepenet.** De earste kear dat dizze ferzje der
ien sjocht set er de hiele beam om — `project.json` en `group.json` wurde
`scope.json` — en, dêr't de map in git-repository is, leit er earst fêst hoe't
de map derút seach. It nochris rinne litte docht neat.

Der sit neat ferstoppe yn de app. Set de map yn OneDrive, yn Dropbox, op in
netwurkskiif of yn in git-repository en er gedraacht him lykas al it oare dêr.
**Wizigje…** op it organisaasjeskerm bringt jo nei in oare map; de mappen dy't
jo earder brûkt hawwe steane yn **File ▸ Open Recent Folder**, elk ûnder de
namme dy't har organisaasje harsels jout.

Twa dingen folgje derút dat jo wurk bestannen binne.

- **In oar kin se feroarje.** As in bestân ûnder jo feroaret — de checkout fan
  in kollega, in sync-client, josels op in oare masine — ferskynt der in strook
  boppe it tekenflak. Sûnder iepensteand wurk biedt dy oan om har ferzje oer te
  nimmen; mei net bewarre wurk seit er dat beide kanten feroare binne en freget
  er hokker oerbliuwt. Hy skriuwt har ferzje nea oer sûnder te freegjen.
- **Alles wurdt skreaun sa't it feroaret.** Trije sekonden neidat jo ophâlde
  mei bewurkjen, as jo it finster ferlitte, en as jo it slute. Allinnich de
  bestannen dy't echt feroare binne wurde opnij skreaun, dus ien elemint
  ferpleatse skriuwt ien lyts bestân opnij en fierder neat.

In ljepblêd yn de brouwer kin ek yn in map wurkje, dêr't de brouwer it oanbiedt
— mar de tastimming oerlibbet selden in werstart en dernei freegje kostet in
klik, dus in ljepblêd pakt in ûnthâlden map allinnich wer op as de tastimming
noch jildt en begjint oars sûnder in wurd yn de brouweropslach. De desktop is de
iene dy't kieze moat.

## Skiednis (desktop)

As de masine **git** hat, kin de app in skiednis fan jo map byhâlde. **Bewarje…
▸ Momintopname…** biedt in berjocht dat al skreaun is út wat jo dien hawwe —
"Warehouse Management wizige, 3 eleminten ferpleatst" — en dat jo bewurkje
kinne foardat it fêstlein wurdt. De earste momintopname freget oft der
überhaupt skiednis byholden wurde moat; hoe dan ek ferlit neat de masine.

**Bewarje… ▸ Skiednis…** neamt elke momintopname. Ien kieze toant wat der sûnt
feroare is — applikaasjes tafoege, fuortsmiten en wizige, ferbiningen tekene en
trochknipt, besluten nommen — mei de geometry as in oantal yn plak fan in list,
om't in oprêdslach ien sin is en fjouwerhûndert feroare rigels.

**De skiednis fan ien ding.** De kiezer boppe-oan de skiednisside beheint him
ta in diagram, in beskriuwing of in beslút: de list wurdt de momintopnamen dy't
it rekke hawwe, en de feroarings de rigels dy't deroer geane. Deselde side
iepenet al beheind fanút **Skiednis…** op it menu fan in diagramtabblêd, op de
dokumintaasjeside en op de side fan in beslút.

In beskriuwing is it iene ûnderwerp dat net de saak fan ien ûnderdiel is: in
namme betsjut oeral yn de map itselde, dus de side fan in elemint wurdt skreaun
dêr't it definiearre is *en* oeral dêr't in ûnderdiel it tekenet en seit wat it
dêr betsjut. De skiednis fan dat elemint is de gearfoeging fan dy siden, en in
rigel ûnder de kiezer neamt de ûnderdielen dy't er lêst. Ien weromsette bliuwt
fan dit ûnderdiel: it set werom wat de side fan dit ûnderdiel sei, en de oaren
binne oan harsels om werom te setten.

**Weromsette.** Mei in momintopname keazen makket **Dizze ferzje weromsette…**
it diagram, de beskriuwing of it beslút wer wat it doe wie; mei it hiele projekt
yn byld docht **It hiele projekt weromsette…** itselde foar alles. In
weromsetting is in nije wiziging boppe-op alles wat sûnt barde, gjin stap
werom: de skiednis groeit troch, de Aktiviteitslist seit *Diagram Warehouse
weromset nei 3 sep*, ⌘Z makket it ûngedien, en de folgjende momintopname leit
it fêst. De app biedt dy momintopname daliks oan. In beslút dat oannommen,
ôfwiisd of ferfongen is bliuwt sa't it is — skriuw in nij dat it ferfangt — en
in weromset diagram lit eleminten fuort dy't net mear besteane, en seit hoefolle.

**Labels.** **Label…** op in keazen momintopname jout it in eigen wurd — "Oan
de direksje toand" — dat njonken syn berjocht toand wurdt, nea yn plak dêrfan.
In label reizget mei de skiednis mei, dus in kollega sjocht itselde merkteken
op itselde plak, yn dizze app of yn elke git-client. Twa labels mei deselde
namme yn ien map wurde wegere; kies in oar wurd.

Sûnder git biedt de app dit gewoan net oan, en al it oare wurket as earder.

## De wurkromte

Ien iepen projekt: in balke boppe-oan, de editor dêrûnder.

| Yn de balke | Wat it docht |
|---|---|
| **Projekten…** | Werom nei it organisaasjeskerm |
| **Ynstellings…** | De namme fan dit ûnderdiel en wêr't it ûnderbrocht is, en syn standerts: de skriuwer dy't op in eksportearre diagram neamd wurdt, en de ripenskolommen dêr't in nij lânskip mei begjint. In ûnderdiel ferpleatse bringt it ûnder by in oar en lit de ynhâld ûnoanrekke |
| **Bewarje…** | **Wurkbestân** (`.lvarch`) is alles: geometry, opmak, jo eigen logo's, fêstsette rûtes — de map fan jo ûnderdiel yn ien bestân. **Interchange-dokumint** is allinnich topology en semantyk, de foarm foar review en ferzjebehear. Op de desktop biedt it menu ek **Momintopname…** en **Skiednis…** |
| **Iepenje…** | Laadt ien fan beide, en werkent hokker oan wat der yn it bestân stiet en net oan de namme |
| **Aktiviteit** | Wat der sûnt it iepenjen oan dit projekt feroare is — in list mei beneamde stappen en de tiid dat elk set is. Allinnich-lêze: ⌘Z is hoe't jo weromgeane |
| **Tema** | Ljocht, tsjuster of systeem. Systeem folget jo kompjûter en skeakelet dermei mei |
| **Bewarre · uu:mm** | Wêr't it projekt stiet: de tiid dat it foar it lêst skreaun is, of **Noch net bewarre wizigings**, **Dwaande mei bewarjen…**, **Wizige op skiif**, **Hjir én op skiif wizige** |

Alles wurdt automatysk bewarre wylst jo wurkje: trije sekonden neidat jo
ophâlde, by it ferlitten fan it finster, en by it sluten — en slute mei net
bewarre wurk freget earst. Yn in brouwer sûnder map seit de app ien kear as syn
opslach foar sa'n fjouwer fyfde fol is — dat is de iennichste warskôging dy't
jo krije, om't in brouwer sûnder te freegjen ophâldt mei bewarjen. As de
opslach botwei wegeret (fol, of blokkearre yn in priveefinster) seit de balke
ûnderoan it ien kear en wurket de editor troch; bewarje dan in wurkbestân, want
sûnder opslach is it projekt fuort as it ljepblêd slút.
Elk berjocht (bewarre, laden, mislearre) ferskynt yn dy balke ûnderoan.

**Taal.** De taalknop rjochts yn de arkbalke fan de editor (dy toant de koade
fan de taal dêr't jo yn sitte: NL, FY, DE of EN) iepenet in menu mei de
fjouwer: Nederlands, Frysk, Deutsch en English. Ien kieze skeakelet de hiele
ynterface om: menu's, finsters, tooltips, bânnammen, flatermeldings en it
titelblok fan in PNG-eksport. De earste kear beslút de taal fan de brouwer. It
ûntwerp sels feroaret net; elemintnammen binne ynhâld, gjin ynterface.

## Tekenje

**It lânskip** hat fiif bannen: akteuren, ynfierkanalen, eksterne systemen, it
applikaasjelânskip en de behearlaach. Sleep in elemint út it palet links yn in
bân, of rjochtsklik op it tekenflak en **Hjir taheakje**. Bannen feroarje fan
grutte troch oan har râne te slepen.

**Domeingroepen** sette de applikaasjes dy't byinoar hearre yn in flak. Foegje
der ien ta út it palet of út it tekenflakmenu, jou it in kleur, sleep der
applikaasjes yn, rêd it op himsels op. In groep fuorthelje lit har eleminten
stean dêr't se steane.

**Containerdiagrammen.** Dûbelklik op in applikaasje om it containerdiagram
dêrûnder te iepenjen, of om der ien te meitsjen. De applikaasje wurdt de grins
fan dat diagram en har komponinten sitte deryn. De tabblêden boppe-oan neame it
lânskip en de containerdiagrammen dêrûnder; rjochtsklik op in tabblêd om it om
te neamen, te duplisearjen, fuort te smiten of de **diagramynstellingen** te
iepenjen.

**Dingen fine.** ⌘F / Ctrl+F iepenet de siker: typ in namme, kategory,
leveransier of technology, Enter of in klik selektearret it elemint en it
tekenflak skoot dernei ta, nei in oar diagram as dat moat. It palet hat syn
eigen sykfunksje, yn beide talen.

**Panielen.** Sleep de râne tusken in paniel en it tekenflak om it fan grutte te
feroarjen, dûbelklik op de râne foar de standertbreedte, brûk de pylkjes om in
paniel ta in smelle strook yn te klappen. De knop foar de oersichtskaart yn de
arkbalke toant of ferberget de kaart yn de hoeke.

**Toetseboerd.** Tab rint troch de eleminten op it tekenflak, Enter selektearret
it elemint mei fokus en Shift+Enter foeget it oan de seleksje ta. De pylktoetsen
ferskowe de seleksje in roasterstap, mei Shift ien piksel. `?` toant elke
fluchtoets.

## Eleminten

Sân soarten: applikaasje, komponint, ekstern systeem, ynfierkanaal, beharkark,
akteur, en de domeingroep dy't se hâldt. Selektearje der ien en de **ynspektor**
rjochts toant syn fjilden yn trije tabblêden.

- **Algemien.** Namme, kategory, leveransier, technology, libbenssyklus (pland,
  aktyf, ôfboud wurdend, ôfboud; toand as badge, ôfboude eleminten wurde
  dimd), oft jo it beheare, de beskriuwing (sjoch *Dokumintaasje*), en wêr't it
  stiet.
- **Werjefte.** Aksintkleur, foarm, ikoan, ikoangrutte.
- **Gegevens.** De **ripensaspekten** fan in applikaasje: foar elke kolom fan
  dit diagram beheard, foar in part, gjin of op risiko, mei in oantekening. De
  kolommen wurde per diagram ynsteld yn syn ynstellingen.

**Ikoanen.** Sa'n hûndert ynboude merktekens, te sykjen op namme, kategory en
trefwurd yn beide talen, yn twa grutten: lyts yn de kop, grut foarop it
kaartsje foar in diagram dat fan in ôfstân lêzen wurdt. **In logo oplade** yn
de kiezer foeget jo eigen SVG of PNG ta (oant 200 kB). Opladen logo's reizgje
mei yn it wurkbestân, nea yn it interchange-dokumint.

**Mear as ien tagelyk.** Selektearje ferskate eleminten en de ynspektor biedt
libbenssyklus, kleur, ikoan en domeingroep foar allegear, elk ien stap yn
ûngedien meitsjen.

**Soarte feroarje.** Rjochtsklik op in elemint, **Soarte feroarje ▸**, en kies
wat it wêze moatten hie; ferbiningen, beskriuwing en plak bliuwe. Twa gefallen
wurde wegere mei de reden: in applikaasje dy't in containerdiagram hat, en in
komponint dy't noch oan in applikaasje hinget.

Eleminten hearre by it model, net by in diagram: ien elemint kin op ferskate
diagrammen stean, en **Út it diagram helje** is wat oars as **Út it model
fuortsmite**. Fuortsmite freget earst, en seit hoefolle ferbiningen meigeane.

## Ferbiningen

Sleep fan it hânfet fan it iene elemint nei it oare, of rjochtsklik en
**Ferbining begjinne nei…**. In ferbining draacht in label, in protokol (wat jo
ek type: REST, EDI, Kafka), in rjochting dy't de pylkpunten bepaalt, in kleur en
in linestyl. Dûbelklik op it label om it op it plak te bewurkjen.

Linen wurde troch in echte router om eleminten hinne lein en wurde opnij lein as
der wat ferskoot. As automatysk net is wat jo wolle:

- Sleep in **pil** midden op in segmint om dat segmint te ferskowen, sleep in
  **fjouwerkantsje** om in knik te ferpleatsen; de rûte wurdt hânmjittich en de
  router lit him mei rêst.
- **Hjir in knikpunt taheakje**, **Knikpunt fuorthelje**, **Werom nei
  automatyske rûte** yn it linemenu.
- **Rûte fêstsette** hâldt in line krekt sa't er is, ek ien sûnder knikken.
- **Oanhechtsje oan ▸** kiest fan hokker kant fan in elemint elk ein fuortgiet
  of oankomt, of hâld Alt yndrukt wylst jo in ferbining fan in bepaald
  sydhânfet slepe. In keazen kant is in betingst dy't de router respektearret,
  gjin hânmjittige rûte.
- Sleep it label fan syn standertplak ôf; **Labelposysje werstelle** set it
  werom.

Op in tige drok boerd — mear as sa'n hûndertfyftich linen dy't om ien kanaal
stride — wegeret automatysk rûtsjen yn plak fan der minuten oan te besteegjen,
en seit dat yn de balke ûnderoan. Der giet neat ferlern: de linen hâlde de
rûtes dy't se hienen, en alles wat jo mei de hân tekene hawwe bliuwt krekt sa't
jo it litten hawwe.

## Yndieling

**Yndieling oprêde** lit in automatyske yndieling oer it diagram rinne, mei in
rjochting (breed, djip, of groepen breed en har applikaasjes djip), in
tichtens, en fêstsettings foar wat jo mei de hân pleatst hawwe. **Ferbiningen
rûtsje** tekenet allinnich de linen opnij en lit elk elemint stean dêr't it
stiet; **Alles opnij rûtsje** negearret fêstsettings. In domeingroep kin út har
menu op himsels oprêden wurde.

Oprêden wurket njonken de app yn plak fan deryn, dus it finster bliuwt libben
wylst it rint en de knop Oprêde wurdt ûnderwilens in **Annulearje**. Op in
diagram fan mear as fjouwerhûndert blokken wegeret it en seit dat, yn plak fan
ferskate minuten te tinken: ferdiel it boerd oer diagrammen, of rêd ien
domeingroep tagelyk op.

Mei de hân: **útlinje** en **ferdiele** fan in seleksje út de sweevjende
arkbalke of it seleksjemenu, in **roaster** mei útlinjen as opsje, ferskowe
mei de pylken, **passend meitsje** (Shift+1) en 100 % (Shift+2).

## Dokumintaasje

Elk elemint hat in markdown-beskriuwing, en dy kin in hiele side wêze. Iepenje
him as side mei **Dokumintaasje iepenje** yn it menu fan it elemint, de
útklapknop njonken it beskriuwingsfjild yn de ynspektor, Enter op it
selektearre elemint, of in dûbelklik op alles wat gjin applikaasje is.

De side iepenet om te **lêzen**: it dokumint mei in ynhâldsopjefte, de oare
eleminten fan it diagram links om tusken te wikseljen (in sidemerk toant wa't
al dokumintaasje hat), en de eigen fjilden fan it elemint rjochts. **Bewurkje**
set de boarne links en it resultaat dernjonken, en makket de fjilden rjochts ek
te bewurkjen. ⌘B en ⌘I omsette de seleksje; Escape ferlit earst Bewurkje, dan
de side. Wizigings wurde bewarre nei in koart skoft en as jo fuortgeane, ien
stap yn ûngedien meitsjen per skoft.

In lege side kin **begjinne mei it sjabloan**: in koptabel en de gebrûklike
seksjes. De rige **Koarte beskriuwing** fan dy tabel is wat it elemint op it
tekenflak toant; sûnder dy is it de earste alinea. `[[Namme]]` yn de tekst
wurdt in keppeling nei dat elemint. Gewoane keppelings iepenje bûten de app.

**Dokumintaasje** yn de balke boppe-oan iepenet de side foar it selektearre
elemint, of foar it earste elemint op it diagram as der neat selektearre is. In
koadeblok markearre as `mermaid` wurdt op elke side as diagram tekene. In blok
markearre as `bpmn` wurdt as proses tekene: BPMN 2.0 XML sa't de gongbere
modellearders it bewarje, mei in eigen diagramseksje dy't seit wêr't alles
stiet — pools en lanes, taken, eveneminten, gateways, streamen en berjochten,
allinnich-lêze. De side fan in proseselemint is dêr't ien heart (syn
`realises`-rigel seit fan hokker capability it de wize fan dwaan is), en in
bestân sûnder diagramseksje wurdt as tekst toand ûnder in rigel dy't seit
wêrom.

## Besluten

**Besluten** yn de balke boppe-oan iepenet de arsjitektuerbesluten: in beam
links, de fêstlizzingen fan de keazen knoop yn it midden, en it beslút dat jo
lêze rjochts.

De besluten fan dit ûnderdiel binne **ien list**. In beslút heart óf by it
ûnderdiel as gehiel, óf it giet oer ien ding deryn — in applikaasje, in
capability, in stap yn in klantreis — en de beam hat in knoop foar elk ding dat
besluten hat, mei elke applikaasje neamd oft er al besluten hat of net. Wat út
it model gien is hâldt syn besluten ûnder *Fuortsmiten applikaasjes*.

Dêrûnder komme de ûnderdielen **boppe** dit, elk as in seksje: *Fan Acme
Logistics*, *Fan Retail*. Har besluten wurde hjir lêzen en **wizige dêr't se
hearre** — de lêzer toant se sûnder knop Bewurkje en biedt oan dat ûnderdiel te
iepenjen. De nûmering is per ûnderdiel, dus ADR-0001 fan it domein en ADR-0001
fan it lânskip binne twa besluten en wienen dat altyd al.

In beslút folget it MADR-formaat: kontekst en probleemstelling, beslisfaktoaren,
de oerwoegen opsjes, de útkomst en har gefolgen, de foar- en neidielen fan elke
opsje, mear ynformaasje. **Nij beslút** freget om de titel en begjint de tekst
fan dat sjabloan út. Titel, status, datum en beslútnimmers binne fjilden boppe
de tekst; de tabel **Beoardielers en ûndertekening** oan de ein neamt oan wa't
it beslút foarlein is, elk mei in oardiel en de dei dat it jûn is.

De status is in wurkstream, gjin label. In beslút begjint as **foarsteld**, giet
nei **yn behanneling**, en wurdt dan **oannommen** of **ôfwiisd**. Dy twa binne
it ein fan de wei: fan dêr ôf kin it beslút net mear bewurke of fuortsmiten
wurde, om't in beslút dat efterôf oerskreaun wurde kin gjin fêstlizzing derfan
is. In oannommen beslút kin letter **ferfongen** wurde, wat freget om it beslút
dat it ferfangt en de keppeling beide kanten út toant. Yn behanneling kin
weromset wurde nei foarsteld.

It sykfjild boppe de list siket yn elk beslút yn de beam tagelyk — titel, tekst
en beoardielers, dy fan dit ûnderdiel en dy derboppe. Teksten binne markdown,
mei deselde `[[Namme]]`-keppelings as de dokumintaasje; **Help by opmaak**
njonken de boarne toant de syntaksis, mermaid-diagrammen ynbegrepen. Wizigings
wurde mei dit ûnderdiel bewarre.

## Tiid, en de dei dy't in boerd toant

Elke applikaasje kin **libbenssyklusdatums** drage njonken har libbenssyklus:
de dei dat se live giet, de dei dat se begjint ôf te bouwen, de dei dat se fuort
is. Alle trije binne opsjoneel, en in applikaasje sûnder ien derfan gedraacht
har krekt sa't se altyd die. Dêr't in datum foarby is wint er fan de bewarre
libbenssyklus, om't in lânskip dat trije jier nei de go-live noch "pland" seit
in lânskip is dat nimmen bywurke hat.

In ferbining kin in eigen **finster** drage, *jildich fan* en *jildich oant*.
Hast gjin hat der ien nedich: in line sûnder finster is der salang't beide
dingen dy't er ferbynt der binne. De linen dy't der wol ien nedich hawwe binne
de tydlike — in sync, in rûtearfassade, in dûbele skriuwaksje — en dat is krekt
de hybride faze fan in ferfanging.

**Toant** op de diagrambalke seit hokker dei it boerd tekenet. Der stiet
*Hjoed* oant jo in dei neame, en dan stiet dy dei der en ljochtet er op, sadat
in boerd dat 2028 toant net liket op in boerd dat no toant. Elk kaartsje tekenet
de faze dêr't it op dy dei yn sit, en in line mei in finster ferskynt allinnich
dêrbinnen. De dei feroarje is in gewoane bewurking: it is ien rigel yn
Aktiviteit en ⌘Z nimt it werom.

Sa wurdt in takomstich diagram makke. Rjochtsklik op in tabblêd en kies
**Duplisearje per datum…**, kies in dei, en jo hawwe in twadde boerd fan
itselde lânskip sa't it dan stean sil. Der is altyd mar ien model, dus de twa
kinne net útinoar rinne. In eksportearre PNG fan in datearre boerd neamt de
dei yn syn titel.

**Ferfongen troch** op in applikaasje neamt har opfolger, en **Eigner** seit
wa't derfoar oanspraaklik is. Eigner wie eartiids in rige yn it
dokumintaasjesjabloan; it is no in fjild, sadat de kontrôles fan de roadmap in
persoan neame kinne.

## De roadmap

**Roadmap** yn de balke boppe-oan iepenet it lânskip op in tiidas. Allinnich
wat in datum hat krijt in rige, dus in lânskip fan fjouwertûzen applikaasjes
mei njoggen datums deryn is in roadmap fan in pear rigels — de rest stiet op it
tekenflak, dêr't it heart. Elke rige is in rin fan kleurde stikken: pland, live,
ôfbouwe, fuort. In line troch elke rige markearret hjoed, en in twadde de dei
dy't it boerd efter de side toant.

De skúf lâns de boppekant ferpleatst dat boerd. Sleep him en it tekenflak
derefter folget, sadat de plaat en de as it net ûniens wêze kinne oer hokker
dei it giet.

### Plannen

In **plan** is hoe't in feroaring fan it lânskip opskreaun wurdt: in titel, in
status, it tiidfinster dêr't it oer rint, wa't de eigner is, de applikaasjes
dy't it ynfiert, ôfbout of feroaret, de besluten dêr't it op stipet, syn
mylpealen, en in tekst yn markdown. Plannen ferskine as bannen ûnder de
applikaasjes op de as, mei in merkteken per mylpeal. Kies der ien en it iepenet
rjochts.

In plan rint **konsept → akkoart → rint → klear**, en kin út elk fan dy
opjûn wurde. Oars as by in beslút kin elke stap weromnommen wurde en kin in
plan dat klear is noch bewurke wurde: in beslút leit in momint fêst, en in plan
beskriuwt wurk. Wat it plan foarige moanne sei stiet yn de skiednis fan de map.

**Ferskowe…** ferskoot in plan mei in tal dagen — syn tiidfinster, elke
mylpeal, en de libbenssyklusdatums fan de applikaasjes dy't it ynfiert en
ôfbout — yn ien stap, om't in plan dat útrint ien ding is dat bard is.

Elk plan is ien markdown-bestân yn `transitions/` yn jo projektmap, nûmere fan
`TR-0001` ôf omheech.

**Inisjativen.** In plan heart by it nivo dat it skriuwt, en de roadmap fan in
domein is dy fan it domein. Is in plan ek in saak fan de organisaasje — in
migraasje dy't it hiele bedriuw folget — set dan **Inisjatyf** oan op syn side.
It ferskynt dan op de roadmap fan elk nivo derboppe, ûnder *Inisjativen út de
nivo's derûnder*, mei it nivo dêr't it by heart op in chip; dêr wurdt it lêzen
en it wurdt bewurke dêr't it stiet, en de chip iepenet it dêr. De roadmapkaart
op it organisaasjeskerm telt se mei. De skeakeler is der net op de
organisaasje sels, dy't gjin roadmap boppe har hat.

### De business case

De tekst fan in plan kin in **business case** hâlde: in koadeblok waans ynfier in
kasstreamtabel is dy't jo lêze kinne, mei de sifers derûnder útrekkene.

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

In negatyf getal is jild dat útgiet, in posityf jild dat ynkomt, en in lege sel
is nul. Derûnder rekkenet de app de netto en kumulative kasstream út, de netto
kontante wearde tsjin it persintaazje dat jo opjûn hawwe, de ynterne
rintabiliteit, de werombeteltiid yn perioaden, it rendemint op ynvestearring en
de baten-kostenferhâlding. Jo tabel wurdt nea oerskreaun.

In twadde tabel, `Criterion | Weight | Score`, foeget in weage skoare ta foar it
diel dat gjin jild is — beoardiele fan ien oant fiif, út in maksimum dat de app
útrekkenet en net ien dat jo type. Alles dêrbûten heart yn in beslút, mei syn
beslisfaktoaren en de opsjes dy't jo ôfwoegen hawwe.

**Business case tafoegje** yn it bewurkpaniel set in leech blok yn by de
kursor.

### Wêr't de datums it net oer iens binne

Under de as stiet in list mei tsjinstridichheden: in applikaasje dy't ôfboud
wurdt wylst der noch ferbiningen live binne, in opfolger dy't pas oankomt neidat
it ding dat er ferfangt fuort is, in ôfbou sûnder opfolger neamd, in ferbining
dy't noch jildich is neidat ien fan har einen ôfboud is, en in plan dat oer de
dei hinne is dat it klear wêze soe.

It seit wêr't de datums inoar tsjinsprekke. It kin net sizze dat in lânskip
ferâldere is — neat kin dat — en de side seit dat ûnder de list.

## De bedriuwsarsjitektuer

**+** yn de diagramtabblêden, dan **Bedriuwsarsjitektuer**, makket in **blêd**:
de laach boppe de applikaasjes, op ien side. In lânskip seit wat der draait en
wat mei wat praat. In blêd seit wat de organisaasje docht, foar wa't se it
docht, en hoefolle derfan überhaupt troch software dutsen wurdt.

In blêd wurdt *yndield*, net tekene. Der is neat te slepen en der is gjin
router: wat it toant binne fjouwer beammen — in klantreis, de gebieten fan
ferantwurdlikheid dêrûnder, de capabilities dêrbinnen, en de belanghawwenden
lâns de kant — en de side wurdt út har folchoarder en har djipte berekkene. It
krijt in tabblêd njonken de boerden, en it iepenjen lit it tekenflak dêr't it
wie, dus de plaat dêr't jo oan wurken stiet der noch as jo weromkomme.

![It blêd mei de bedriuwsarsjitektuer: de belanghawwenden lâns de kant, de klantreis boppelâns mei ien rige per baan, en de gebieten mei har capabilities en hoe't elk ynfolle is](screenshot-sheet.png)

### De klantreis, en de paden dertroch

Boppelâns rint ien **klantreis**: wat de organisaasje docht, fan begjin oant
ein. Har fazen binne de kolommen, fan links nei rjochts te lêzen, en ûnder elke
faze steane de stappen dy't dêryn set wurde.

Ien klantreis is selden ien paad. In stap kin in **baan** neame — de
belanghawwende waans eigen paad it is — en it blêd tekenet in rige per baan
ûnder deselde fazen, it mienskiplike paad earst. Wêr't in baan splitst en wêr't
er wer oanslút stiet nearne opskreaun: it is de earste en de lêste faze dêr't de
baan in eigen stap yn hat. In faze binnen dat berik dêr't er gjin yn hat wurdt
tekene as *lykas de rige hjirboppe*; bûten it berik wurdt de baan hielendal net
tekene. Neat kin it ûniens wêze oer wêr't in paad ôfgiet en weromkomt, om't
neat oars as syn stappen it seit.

In stap dy't ien bûten de organisaasje set — in partner dy't in oarder
ôfhannelet — wurdt markearre as bûten de organisaasje dien, sadat de side sizze
kin dat in faze troch nimmen fan binnen dutsen wurdt.

### Gebieten, en wat se ynfollet

Under de klantreis steane de **gebieten** fan ferantwurdlikheid, elk mei syn
groepen en de capabilities dêrbinnen. De djipte is wat tekene wurdt, en it model
ken de wurden net: in yngong boppe-oan is in gebiet, ien dêryn in groep, ien dêr
wer yn in capability.

Elke capability seit wa't him ynfollet:

- **in applikaasje**, of ferskate — de applikaasjes dy't him stypje. In
  capability mei twa derfan dêr't ien fan ôfboud wurdt is in migraasje dy't jo
  sjen kinne.
- **minsken** — nimmen syn software, immen syn wurk. In folslein antwurd en
  gjin gat: in side dy't dit as probleem tekene soe jo oanriede software te
  keapjen foar wat jo mei de hân dogge.
- **noch neat** — gjin fan beide, en dát *is* it gat, en de reden om de side te
  tekenjen.

Dy wurde út it model lêzen en net op it kaartsje bewarre: in capability is
ynfolle om't wat yn it lânskip him stipet. **Stipe troch…** yn de ynspektor is
hoe't dy rigel skreaun wurdt, en stipe kin in finster drage lykas alles mei in
datum derop, dus in capability dy't fan maart ôf ynfolle is, is fan maart ôf
ynfolle.

Oan de ein stiet in bân foar wat **noch net oan in domein tawiisd** is — de
gebieten dy't oan nimmen jûn binne. It is in befining, gjin flater: in list
fan wat de organisaasje sein hat te dwaan en noch net sein hat wa't it docht.

### Ien meitsje

In blêd op in projekt sûnder wat boppe syn applikaasjes is leech, en de lege
side biedt de twa plakken om te begjinnen: **Nije klantreis** en **Nij
gebiet**. Al it oare is in **+** dêr't it ding komme soe, en se wurkje allegear
gelyk — wat jo makke hawwe ferskynt, it is selektearre, en de kursor stiet yn
syn namme, dus jo type oer hoe't it hjitte hinne en drukke op Enter.

- **Nije klantreis** makket de klantreis en har earste faze, *Begjin*, en
  rjochtet dit blêd derop, om't in bân dy't in kop is mei neat derûnder net is
  wêr't jo om fregen.
- **+ faze**, oan de ein fan de fazerige, set in kolom oan de ein.
- **+ stap**, yn elke sel, foeget in stap ta oan dy faze op it paad fan dy
  rige.
- **+ baan…**, ûnder de lêste rige, freget waans paad it is — ien fan jo
  belanghawwenden, of in namme dy't jo type, markearre as bûten de organisaasje
  as dat sa is — en by hokker faze er splitst, om't in baan tekene wurdt dêr't
  syn stappen binne en ien sûnder stappen hielendal net tekene wurdt.
- **+ gebiet**, nei it lêste gebiet, foeget der ien ta en tekenet it op dit blêd
  fan it momint ôf dat it bestiet.
- **+ groep** en **+ capability** yn in gebiet, en **+ capability** yn in groep.
  In capability dy't streekrjocht yn in gebiet makke is, is in kaartsje yn de
  kolom, en wurdt in groep sadree't der wat yn set wurdt.
- **+ belanghawwende**, njonken in yngong op de rail, foeget der ien ûnder ta;
  **+ groep**, ûnderoan de rail, begjint in eigen tûke.

**Stipe troch…** en **Dien troch…** yn de ynspektor binne hoe't in capability
ynfolle wurdt: finkje in applikaasje oan en dy stipet dizze capability, finkje
in team oan en it is fan har. Elk finkje is in eigen stap, en de rigel ûnder de
namme fan de capability feroaret wylst jo dwaande binne.

**Fuortsmite**, ûnderoan de ynspektor, hellet fuort wat selektearre is en elke
rigel dy't derop einige. It wurdt wegere salang't der wat yn sit, en seit
hoefolle: neat kaskadearret, dus in gebiet dat jo fuortsmite is in gebiet dat jo
earst leechmakke hawwe.

**Wat dit blêd tekenet**, de skowers yn de balke boppe-oan, giet oer it blêd en
net oer it model — hokker klantreis boppelâns rint (in projekt mei twa
klantreizen begjint mei gjin fan beide), hokker gebieten tekene wurde en yn
hokker folchoarder, de folchoarder fan de banen, en oft de rail der überhaupt
stiet.

### Ien bewurkje

Kies wat op de side en it iepenet rjochts: syn namme, syn beskriuwing, wêr't it
ûnder falt, wêr't it tusken syn buorlju stiet, waans paad in stap is, oft in
belanghawwende fan bûten de organisaasje is, en de libbenssyklus dêr't in
capability yn sit — in capability dy't boud wurdt sit yn deselde faze as in
applikaasje dy't boud wurdt. It iene ding ûnder it oare ferpleatse wurdt wegere
as it in ding yn himsels sette soe; de wegering wurdt yn de list oanbean, net
derút ferburgen. It each yn de balke boppe-oan ferberget de rail mei
belanghawwenden.

In applikaasje iepenje fanút de ynfolling fan in capability bringt jo nei in
boerd dat him echt tekenet, mei in wiksel fan boerd as it boerd dêr't jo op
steane dat net docht — en nei de eigen side fan de applikaasje as gjin inkeld
boerd him tekenet.

### De bedriuwskaart

**+** yn de diagramtabblêden, dan **Bedriuwskaart**, makket de twadde yndielde
werjefte — of **Kaart** op de kaart Bedriuwsarsjitektuer fan it
organisaasjeskerm iepenet dy fan de organisaasje. It is deselde laach de oare
kant út lêzen: elke funksje lâns de kant, yn de folchoarder dêr't it blêd se yn
tekenet en ynsprongen op djipte; in kolom per applikaasje dy't de riges neame;
in merkteken dêr't de iene de oare stipet. Op in seksje — in gebiet, in groep —
is it merkteken hol en betsjut it *wat hjirûnder*: de gearfetting, sadat de kop
fan in gebiet seit wêr't it hiele gebiet op stipet foardat jo syn capabilities
lêze. Applikaasjes dy't in oar ûnderdiel behearret wurde boppelâns groepearre
ûnder de namme fan dat ûnderdiel, om't de systemen dy't de capabilities fan de
organisaasje stypje meast fan in lânskip binne, en in kolom dy't net seit fan
wa't er is de helte sein hat.

Twa kolommen komme as lêste. **Minsken** is markearre dêr't ien tawiisd is —
ien kolom en net ien per belanghawwende, om't "mei de hân dien" ien antwurd is.
**Dekking** is it gat: *net dutsen* op in capability dy't neat en nimmen dekt,
*minsken* op ien dy't mei de hân dien wurdt sûnder systeem, en op in seksje
hoefolle fan de capabilities dêrûnder net dutsen binne. De balke boppe-oan telt
de trije op. In kaart mei in *per datum*-dei telt de riges dy't op dy dei live
binne, dus in systeem dat yn maart wat begjint te stypjen is in gat op de kaart
fan febrewaris.

Kies in rige en it iepenet rjochts, lykas op it blêd — *Stipe troch…*
ynbegrepen, dus in gat kin sletten wurde fan de side ôf dy't it toant. Kies in
kolomkop om de applikaasje te iepenjen, dêr't dit ûnderdiel him hat.

## Sykje

**Sykje** yn de balke boppe-oan, of ⌘K, siket yn it hiele projekt tagelyk:
eleminten op namme, kategory, leveransier en technology; dokumintaasje op wat
deryn skreaun stiet; en besluten op alle trije nivo's, dy fan de groep
ynbegrepen. In elemint kieze selektearret it en skoot dernei ta, in treffer yn
de dokumintaasje iepenet de side fan dat elemint, en in beslút iepenet syn
fêstlizzing. ⌘F yn de editor bliuwt de flugge siker as alles wat jo wolle in
blok op it tekenflak is.

## Diagramynstellingen

Rjochtsklik op in diagramtabblêd, **Diagramynstellingen…**.

- **Op de tekening.** Auteur, klant en datum foar it titelblok fan in
  PNG-eksport, elk mei as weromfal de standert fan it projekt of de dei fan
  eksportearjen as it leech bliuwt, en oft it titelblok überhaupt tekene wurde
  moat.
- **Ripenskolommen.** De aspektkolommen dy't applikaasjes op dit diagram
  drage: foegje in standert ta (platfoarm, CI/CD, DR, feiligens, monitoring,
  backup, compliance, kosten), foegje jo eigen ta, neam om, feroarje de
  folchoarder, of set de badges hielendal út. In kolom omneame hâldt elke
  status dy't der al tsjin fêstlein is.

## Bewarje, eksportearje, diele

Trije wegen nei bûten, foar trije doelen.

- **It wurkbestân** (`.lvarch`) is alles en is wat jo jouwe oan ien dy't fierder
  bewurket. It is jo projektmap yn ien bestân — in zip — dus elkenien kin it
  útpakke en lêze wat deryn sit sûnder dit ark. Wurkbestannen fan eardere
  ferzjes iepenje noch.
- **It interchange-dokumint** draacht topology en semantyk en gjin geometry of
  opmak: in diff derfan toant wat der oan de arsjitektuer feroare is, net wat
  der op it tekenflak ferskood is. In ynboud ikoan reizget mei as `iconType`;
  in opladen logo net. Wat dit ark net begrypt yn in dokumint oerlibbet in
  rûngong ûnoanrekke, en in dokumint dat gjin ikoanen brûkt komt wurd foar wurd
  werom.
- **PNG-eksport** (de downloadknop) iepenet in finster mei in foarbyld fan de
  plaat sa't dy fuortgiet: yn it ljochte of it tsjustere tema los fan dat op it
  skerm, mei it label fan elke line of allinnich de keale linen, mei of sûnder
  it titelblok lâns de ûnderkant — klant, auteur en datum — en mei of sûnder de
  leginda derûnder, dy't seit wat de badge- en libbenssykluskleuren betsjutte.
  De eksport fan in containerdiagram draacht syn C4-hoeke yn de strook: it
  nivo, de applikaasje, in sin en de datum. Libbenssyklusbadges kinne earst út
  set wurde foar in skjinne plaat. As in logo net ynbêde wurde koe, seit de
  balke ûnderoan hokker. In tige grut boerd is tsientallen megapiksels en
  duorret efkes om te tekenjen, dus it finster seit hoe grut de ôfbylding wurdt
  en syn knop freget foardat it begjint.

## Foarkarren

Roaster, útlinjen, libbenssyklusbadges, ynklapte panielen en har breedten, de
oersichtskaart, de ynstellingen foar oprêden, de taal en it tema wurde per
brouwer of per desktop-ynstallaasje ûnthâlden. Se hearre by jo, net by it
projekt: se reizgje net mei yn in bestân.

## Ûngedien meitsje

**⌘Z** dekt alles, yn de folchoarder dêr't jo it yn dien hawwe: in blok
ferpleatst, in diagram omneamd, in beslút oannommen, in projektynstelling
wiske. In namme type is ien stap en net ien per letter, en in sleep en de linen
dy't dêrnei opnij lein wurde binne ien stap — dus ien kear werom jout jo wat jo
hienen en net wat jo in toetsoanslach earder hienen.

**Aktiviteit** yn de balke boppe-oan neamt dy stappen mei har nammen en tiden.
It is in ferslach, gjin wei werom: nei in rigel ta stappe soe in fraach oproppe
("en alles dêrnei?") dy't ⌘Z al beantwurdet.

## Fluchtoetsen dy't it witten wurdich binne

| Toetsen | Docht |
|---|---|
| `?` | Elke fluchtoets |
| ⌘F / Ctrl+F | In elemint sykje |
| Enter | De dokumintaasje fan it selektearre elemint iepenje |
| F2 | De seleksje omneame |
| Delete | De seleksje fuortsmite, nei in fraach |
| ⌘Z, ⌘⇧Z | Ûngedien meitsje, opnij dwaan — ien stapel oer alles |
| ⌘C ⌘X ⌘V, ⌘D | Kopiearje, knippe, plakke, duplisearje |
| Pylken, ⇧Pylken | Ferskowe mei in roasterstap, mei in piksel |
| Shift+1, Shift+2, `=`, `-` | Passend meitsje, 100 %, ynzoome, útzoome |
| Shift+F10 | It menu foar de seleksje |
| ⌘S / Ctrl+S | No bewarje |

Op Windows en Linux lêze jo Ctrl foar ⌘.
