// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { GettingStartedText } from '../../types'

/** Beginnen: waar de help mee opent, in twee minuten gelezen. */
export const START: GettingStartedText = {
  title: 'Beginnen',
  intro: 'Zes stappen, twee minuten. Elke stap zegt waarop je drukt; de hoofdstukken daarna zeggen de rest wanneer je het nodig hebt.',
  steps: [
    {
      title: 'Waar het voor is',
      text: 'Lionsville Architect houdt de architectuur van je organisatie op één plek bij: de applicaties en de lijnen ertussen, het bedrijf dat ze dienen, de eenheden en mensen die ervoor staan, en de besluiten, waarnemingen en plannen over dat alles. Werk staat in **scopes**: de organisatie, en de domeinen en teams die eronder zijn ondergebracht.',
      picture: 'De startpagina van een scope: de naam, de weergaven die erin staan en wat er wordt bijgehouden.',
    },
    {
      title: 'Het kader',
      text: 'Elk scherm staat in hetzelfde kader. **Rij één** zegt waar je bent, vindt alles (⌘K), maakt ongedaan en zegt of je werk veilig is. **Rij twee** bevat de plekken van deze scope: Start, de weergaven, Besluiten, Waarnemingen, Roadmap. De **boom** van scopes staat links; het **paneel** rechts toont wat je selecteert.',
      picture: 'Het kader: rij één, rij twee met de plekken van de scope, de boom links en het paneel rechts.',
    },
    {
      title: 'Een scope en een weergave openen',
      text: 'Druk op een scope in de boom om de startpagina te lezen. Druk onder **Weergaven hier** op een weergave — het applicatielandschap, de bedrijfsarchitectuur, het organogram — en die opent met een tabblad in rij twee. **‹** in rij één gaat terug naar waar je was.',
      picture: 'De startpagina van een scope met de weergaven onder Weergaven hier.',
    },
    {
      title: 'Toevoegen en verbinden',
      text: 'Druk op een bord op **Toevoegen** in de balk, of dubbeldruk op een lege plek, en typ een naam. Om twee kaarten te verbinden wijs je er één aan en sleep je van de stip aan de rand naar de andere. Selecteer iets om het in het paneel te lezen en te wijzigen. ⌘Z neemt elke stap terug.',
      picture: 'Een bord met twee kaarten en de lijn ertussen, en het paneel van de geselecteerde kaart.',
    },
    {
      title: 'Een waarneming vastleggen',
      text: 'Iets opgemerkt — twee systemen die een andere prijs noemen, een trage overdracht? Open **Waarnemingen** in rij twee en druk op **Nieuwe waarneming**. Zeg in een paar woorden wat je zag. Druk later op **Vraag waarom** om de oorzaak te vinden, en stel een oplossing voor de grondoorzaak voor.',
      picture: 'De waarnemingenpagina: wat er gezien is, de oorzaken erachter en de voorgestelde oplossing.',
    },
    {
      title: 'Waar verder',
      text: 'Druk op elk scherm op de **?** in rij één, of op F1: de help opent bij dat scherm. Druk buiten een tekstveld op **?** op het toetsenbord voor de sneltoetsen. Elk paneel heeft ook een **?** in de kop. Lees verder bij *De weg vinden* en *Landschapsborden en containerdiagrammen*.',
      picture: 'Rij één met de ? die de help bij dit scherm opent, en Help ernaast.',
    },
  ],
}
