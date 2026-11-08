// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ChapterText } from '../../types'

/** De titel van elk hoofdstuk, waar het over gaat, het uitgewerkte voorbeeld en wat de afbeelding toont. */
export const CHAPTERS: Readonly<Record<string, ChapterText>> = {
  start: {
    title: 'De eerste pagina',
    intro: 'De eerste pagina biedt drie wegen: je eigen organisatie beginnen, een voorbeeld bekijken, of verdergaan met werk dat je al hebt.',
    picture: 'De eerste pagina: een naam om mee te beginnen, het voorbeeld om te bekijken, en de manieren om werk te openen dat je hebt.',
    worked: {
      title: 'Eerst rondkijken',
      steps: [
        'Klik op de eerste pagina op **Voorbeeld openen**. Een strook op elk scherm zegt dat je het bezoekt.',
        'Open **Application landscape** onder Weergaven hier, verplaats een kaart en hernoem haar: probeer alles.',
        'Klik op **Voorbeeld verlaten** in de strook. Niets van wat je probeerde blijft.',
        'Typ de naam van je eigen organisatie, zoals *Acme Logistics*, en klik op **Beginnen**.',
      ],
    },
  },
  frame: {
    title: 'De weg vinden',
    intro: 'Twee rijen staan boven elk scherm: rij één zegt waar je bent en of je werk veilig is, rij twee noemt de plekken in de scope waarin je bent. De boom van scopes staat naast elke startpagina.',
    picture: 'Het kader: rij één met Terug en Vooruit, het pad, Zoeken, ongedaan maken en het statuswoord; rij twee met Start en de plekken; links de boom van scopes en ernaast de startpagina van een scope.',
    worked: {
      title: 'Van de organisatie naar een bord en terug',
      steps: [
        'Klik op de startpagina van de organisatie op **Warehouse** in de boom links.',
        'Klik onder **Weergaven hier** op **Application landscape**: het bord opent en rij twee toont het tabblad.',
        'Klik op **Acme Logistics** in het pad in rij één om naar de startpagina van de organisatie te gaan.',
        'Klik op **‹** (of {key:Cmd+[|Alt+Left} op de desktop) om terug te gaan naar het bord, precies zoals je het verliet.',
        'Druk op {key:Mod+K}, typ *roadmap* en druk op Enter om vanaf elke plek de roadmap te openen.',
      ],
    },
  },
  work: {
    title: 'Je werk, bestanden en instellingen',
    intro: 'Je werk wordt bewaard terwijl je werkt, in een map of in deze browser. Het statuswoord in rij één zegt waar en of het veilig is; van daaruit, en vanuit de menu’s, open je, kopieer je, deel je en kijk je terug.',
    picture: 'Je werk: het statuswoord in rij één, ingedrukt om het paneel te openen dat zegt waar het werk staat en wat het kan verplaatsen.',
    worked: {
      title: 'Je organisatie naar een andere computer meenemen',
      steps: [
        'Klik op het statuswoord in rij één om **Je werk** te openen.',
        'Klik op **Kopie bewaren…** en geef twee keer een wachtwoord.',
        'Neem het `.lvarch`-bestand mee naar de andere computer, open daar de app en kies **Een bestand openen…**.',
        'Typ het wachtwoord en kies waar het komt: een nieuwe map, of in plaats van wat daar open is.',
      ],
    },
  },
  board: {
    title: 'Landschapsborden en containerdiagrammen',
    intro: 'Een landschapsbord tekent de applicaties in banden, met de lijnen ertussen; een containerdiagram opent onder één applicatie en tekent waaruit ze bestaat. Het model is één, en een bord is een weergave ervan.',
    picture: 'Een landschapsbord: de banden, applicatiekaarten met hun status, een lijn met haar label, en het paneel van de geselecteerde kaart.',
    worked: {
      title: 'Een nieuwe applicatie tekenen en verbinden',
      steps: [
        'Open **Application landscape** en dubbelklik op een lege plek in de applicatieband.',
        'Typ *Route Optimiser* en druk op Enter: de kaart wordt getekend en geselecteerd.',
        'Wijs de kaart aan en sleep vanaf het nopje aan haar rand naar **Order Management**.',
        'Geef de lijn in het paneel het label *routes* en het protocol *REST*.',
        'Druk op {key:Mod+Z} als het niet was wat je bedoelde: eerst gaat de lijn, dan de kaart.',
      ],
    },
  },
  panel: {
    title: 'Het paneel en de recordpagina',
    intro: 'Wat geselecteerd is, lees en wijzig je in het paneel naast het werk. De recordpagina toont dezelfde regels met elk veld, de tekst die erover is geschreven en alles waarmee het verbonden is.',
    picture: 'Het paneel: de naam, één regel feiten, tabbladen, regels met label en waarde, en de eerste regels van de tekst.',
    worked: {
      title: 'Vastleggen wie een applicatie bezit',
      steps: [
        'Selecteer **Warehouse Management** op het bord.',
        'Klik in het paneel op **+ Eigenaar, leverancier…** en kies **Eigenaar**.',
        'Kies **Warehouse team** uit de eenheden, of typ een naam.',
        'Klik op **Record ›** naast de naam om het hele record te lezen, met tekst en lijnen.',
      ],
    },
  },
  technology: {
    title: 'Het technologielandschap',
    intro: 'Waar de applicaties op staan: de diensten die een platformteam aanbiedt en de platforms die ze leveren, in drie kolommen die van links naar rechts lezen. Niets wordt met de hand getekend; elke regel en lijn wordt uit de records gelezen.',
    picture: 'Het technologielandschap: applicaties, diensten en platforms in drie kolommen, met de lijnen van de gekozen regel.',
    worked: {
      title: 'Uitzoeken wie op een platform staat',
      steps: [
        'Open de weergave **Technologielandschap** van de organisatie.',
        'Klik op **OpenShift** in de kolom met platforms: de lijnen worden getekend en de lezer opent.',
        'Lees het getal op de regel: elke applicatie die erop staat of op iets eronder.',
        'Klik op **Als het wegviel…** voor het rapport van het platform: wat er overeind zou blijven.',
      ],
    },
  },
  sheet: {
    title: 'De bedrijfsarchitectuur en de dekking',
    intro: 'Een blad zegt wat de organisatie doet, voor wie, en hoeveel ervan door software wordt gedekt: een klantreis bovenaan, de gebieden met hun capabilities eronder, de belanghebbenden langs de zijkant. De dekking leest dezelfde laag als tabel van functies tegen applicaties.',
    picture: 'Een bedrijfsarchitectuur: de fasen van de klantreis bovenaan, de gebieden met hun capabilities, elk met wat het dekt.',
    worked: {
      title: 'Zeggen welke applicatie een capability dekt',
      steps: [
        'Open het blad **Bedrijfsarchitectuur** van de organisatie.',
        'Selecteer de capability **Invoicing**.',
        'Vink in het paneel onder **Gedekt door** **Billing** aan.',
        'De capability leest nu als gedekt door een systeem, en de aantallen van de kaart volgen.',
      ],
    },
  },
  poster: {
    title: 'De poster',
    intro: 'De poster tekent een blad als één pagina van vaste grootte: elk gebied een blok, elke capability een tegel. Lees haar op elke afstand; zet in Ontwerpen de blokken met de hand en sleep teams en applicaties op de tegels.',
    picture: 'De poster: de klantreis bovenaan, gebieden als blokken met capabilitytegels, en de schakelaar Lezen en Ontwerpen.',
    worked: {
      title: 'Een team op een capability zetten, op de poster',
      steps: [
        'Open het blad en kies **Poster**, dan **Ontwerpen**.',
        'Open de lade en zoek **Warehouse team**.',
        'Sleep het op de tegel **Slotting and replenishment**: het team antwoordt er nu voor.',
        'Kies weer **Lezen**; het label blijft op de tegel.',
      ],
    },
  },
  chart: {
    title: 'Het organogram en de Conway-kaart',
    intro: 'Het organogram wordt ingedeeld uit de eenheden en de mensen in hun rollen, op een dag; de Conway-kaart vraagt of de teams en de systemen die ze bezitten op één lijn liggen.',
    picture: 'Het organogram: eenheden in vakken met hun rollen en houders, een vacante rol, en het overzicht ernaast.',
    worked: {
      title: 'Een vacante rol vullen',
      steps: [
        'Open de weergave **Organogram**.',
        'Zoek **Warehouse team** in het overzicht en klik erop.',
        'Klik op **vacant** naast de rol die niemand heeft.',
        'Kies de persoon, het aandeel en de eerste dag, en klik op **Toewijzen**.',
      ],
    },
  },
  drawing: {
    title: 'Tekeningen',
    intro: 'Een tekening is de enige weergave die jij tekent en het model niet. Haar vormen kunnen naar elementen wijzen, zodat de afbeelding verbonden blijft met wat ze toont.',
    picture: 'Een tekening: haar balk, de afbeelding met de vormen die naar elementen wijzen omlijnd, en hoeveel links ze heeft.',
    worked: {
      title: 'Een schets van een magazijnstroom tekenen',
      steps: [
        'Klik op **+** in rij twee en kies **Tekening** onder *Dit teken je zelf*.',
        'Noem haar *Dock flow* en kies **Warehouse Management** als waar ze over gaat.',
        'Klik op **Tekening bewerken**, sleep **Warehouse Management** uit het palet op de pagina en teken eromheen.',
        'Klik op **Bewaren** en **Klaar**: de vorm is omlijnd op de afbeelding en opent haar element.',
      ],
    },
  },
  decisions: {
    title: 'Besluiten, geschiedenis en een andere dag',
    intro: 'Besluitrecords zeggen wat werd besloten en waarom, in een werkstroom die eindigt in een record dat niemand kan herschrijven. De geschiedenis bewaart momentopnamen van het werk; een bord kan op een andere dag worden bekeken zonder iets te wijzigen.',
    picture: 'Besluiten: de lijst onder Nog open, Van kracht en Beëindigd, en een record met bovenaan op een regel waar het staat.',
    worked: {
      title: 'Een besluit vastleggen en accepteren',
      steps: [
        'Open **Besluiten** in rij twee en klik op **Nieuw besluit**.',
        'Geef het de titel *Eén schrijver per scope* en zeg waar het over gaat.',
        'Schrijf de context en de opties in **Bewerken**, en klik op **Bewaren**.',
        'Stuur het ter review, en als de reviewers hebben getekend, klik op **Aanvaarden**.',
      ],
    },
  },
  observations: {
    title: 'Waarnemingen, oorzaken en oplossingen',
    intro: 'Wat het team zag, waarom het gebeurt en wat eraan wordt gedaan: waarnemingen worden geanalyseerd tot oorzaken en grondoorzaken, en een oplossing verdient haar weg van idee naar iets dat gebouwd is, getest met experimenten en getoetst aan de waarnemingen.',
    picture: 'De analyse: links de waarnemingen, rechts daarvan hun oorzaken en grondoorzaken, en als laatste de oplossingen die ze aanpakken.',
    worked: {
      title: 'Van een waarneming naar haar grondoorzaak',
      steps: [
        'Open **Waarnemingen** en klik op **Nieuwe waarneming**.',
        'Schrijf *Pickers wachten op aanvulling* met waar, wie het zag en wanneer, en leg het vast.',
        'Klik op **Oorzaak** in de lezer en schrijf *Slotting draait één keer per nacht*.',
        'Klik bij die oorzaak op **Tot grondoorzaak maken**, en dan op **Oplossing** om voor te stellen wat eraan te doen.',
      ],
    },
  },
  roadmap: {
    title: 'De roadmap en plannen',
    intro: 'De roadmap legt het landschap op een tijdas: alles met een datum krijgt een regel. Een plan legt een wijziging van het landschap vast, met zijn venster, mijlpalen en wat het invoert en uitfaseert.',
    picture: 'De roadmap: de liniaal met vandaag gemarkeerd, plannen als banden met mijlpalen, en applicaties als reeksen fasen.',
    worked: {
      title: 'Het uitfaseren van een applicatie plannen',
      steps: [
        'Open **Roadmap** en klik op **Nieuw plan**.',
        'Noem het *Oude tariefmotor uitfaseren*, met een venster van maart tot juni.',
        'Voeg onder wat het verandert **Rating (legacy)** toe als uitgefaseerd en **Tariff Engine** als ingevoerd.',
        'Lees **Waar de datums het oneens zijn** onder de as: een lijn die na haar einde nog live is, wordt daar genoemd.',
      ],
    },
  },
  registers: {
    title: 'Registers en controles',
    intro: 'Het register toont elke applicatie, dienst en elk platform in de organisatie, gelezen uit de scopes zelf. De pagina Controles toont wat de organisatie zichzelf tegenspreekt, per gewicht, met hoe je elk oplost.',
    picture: 'Het register: één regel per applicatie met de scope die ervoor antwoordt en de bevindingen, en de controles geteld per gewicht.',
    worked: {
      title: 'Een naam regelen die twee scopes allebei vastleggen',
      steps: [
        'Open **Controles** vanaf de startpagina van de organisatie en kies de controle over een dubbel vastgelegde naam.',
        'Lees **Waarom het ertoe doet** en **Hoe je het oplost**.',
        'Klik op de bevinding om het record te openen in de scope die moet wijken.',
        'Kies **Koppelen…**: die scope is nu stand-in voor het record van de ander, en de bevinding verdwijnt.',
      ],
    },
  },
  operating: {
    title: 'Het besturingsmodel en RACI',
    intro: 'Het eigen ontwerp van de organisatie voor hoe ze is ingericht: de soorten eenheden, de rollen die elk heeft en waarvoor elke rol antwoordt. Het staat bij de organisatie, en elke wijziging is een stap.',
    picture: 'Verantwoordelijkheden: links de groepen, en een raster van rollen tegen verantwoordelijkheden met R, A, C en I.',
    worked: {
      title: 'Beginnen met een bibliotheek',
      steps: [
        'Open **Besturingsmodel** vanaf de startpagina van de organisatie en klik op **Begin met een bibliotheek**.',
        'Kies **Team Topologies** en vink de eenheidstypen aan die je wilt.',
        'Hernoem onder **Wat er binnenkomt** *Stream-aligned team* naar het woord dat jullie gebruiken.',
        'Klik op **Binnenhalen**: één stap, die {key:Mod+Z} terugneemt.',
      ],
    },
  },
  people: {
    title: 'Mensen',
    intro: 'Het register van mensen van de organisatie: één regel per persoon, buiten de geschiedenis gehouden zodat een naam kan worden vergeten. Elk scherm vraagt het register om een naam als het er een toont.',
    picture: 'Mensen: één regel per persoon met de soort en de rollen die ze vandaag hebben.',
    worked: {
      title: 'Een collega toevoegen zonder dubbele',
      steps: [
        'Open **Mensen** en klik op **Persoon toevoegen**.',
        'Typ *Pia Schulz* en haar werkadres.',
        'Staat *Pia Schultz* al in het register, dan zegt het dat: klik op **Deze gebruiken**, of **Toch toevoegen**.',
        'Klik op **Dit ben ik** bij je eigen regel, zodat de app je overal markeert waar je staat.',
      ],
    },
  },
  guidance: {
    title: 'Principes, onderwerpen en bouwstenen',
    intro: 'Wat het werk moet leiden: principes die gelden in een scope en eronder, onderwerpen die door de organisatie lopen, en bouwstenen die veel oplossingen hergebruiken, elk geëvalueerd waar het wordt gebruikt.',
    picture: 'Richtlijnen: één ingang met een tabblad voor principes, onderwerpen en bouwstenen, een lijst met één regel per item.',
    worked: {
      title: 'Een principe schrijven en citeren',
      steps: [
        'Open **Richtlijnen** en klik op **Principes** op **Nieuw principe**.',
        'Schrijf *Kopen voor bouwen*, flexibel, en aanvaard het.',
        'Open een besluit en zeg onder **Principes** dat het *Kopen voor bouwen* volgt.',
      ],
    },
  },
  agent: {
    title: 'Werken met een agent',
    intro: 'Een coding agent die aan de desktop-app is gekoppeld, leest de organisatie, beweegt de app zoals jij dat doet en maakt wijzigingen die je ziet en ongedaan kunt maken. Terwijl hij werkt, zegt een balk dat, met Stoppen.',
    picture: 'Een agent aan het werk: de balk met de naam van de agent en wat hij doet, met Stoppen, en zijn wijzigingen in Activiteit.',
    worked: {
      title: 'Een agent een bord laten ordenen terwijl je kijkt',
      steps: [
        'Kies op de desktop **Een agent koppelen…** en kopieer de instellingen naar je agent.',
        'Vraag hem *Application landscape* te openen en op te ruimen.',
        'Kijk naar de balk onderaan; klik op **Stoppen** als hij ergens heen gaat dat je niet bedoelde.',
        'Lees zijn stappen in **Activiteit**, en druk op {key:Mod+Z} om terug te nemen wat je niet wilt.',
      ],
    },
  },
}
