// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Nederlands, voor een draad met reacties (ADR-0037). */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'comments.title': 'Reacties',
  'comments.count': 'Reacties ({count})',
  'comments.empty': 'Nog geen reacties. Een reactie gaat over dit record en verandert het nooit.',
  'comments.write': 'Schrijf een reactie',
  'comments.writeReply': 'Schrijf een antwoord',
  'comments.send': 'Reageren',
  'comments.reply': 'Antwoorden',
  'comments.edit': 'Bewerken',
  'comments.save': 'Opslaan',
  'comments.cancel': 'Annuleren',
  'comments.remove': 'Verwijderen',
  'comments.removeTip': 'Haalt deze reactie uit de draad en laat een teken achter waar ze stond, zodat de antwoorden hun plek houden',
  'comments.removed': 'Reactie verwijderd',
  'comments.edited': 'bewerkt',
  'comments.you': 'jij',
  'comments.via': 'via {agent}',
  'comments.cameWith': 'Meegekomen met',
  'comments.who': 'Wie schrijft er? Kies jezelf één keer uit het register; de app onthoudt het als Dit ben ik.',
  'comments.noRegister': 'Een reactie wordt ondertekend door een persoon uit het register, en het register wordt hier niet gelezen.',
  'comments.elsewhere': 'Dit record staat in een andere scope: de reacties erop worden daar gelezen en geschreven.',
  'comments.openScope': '{scope} openen',
  'comments.readOnly': 'Deze scope wordt hier gelezen en niet gewijzigd, dus er kan niet worden gereageerd.',
  'comments.refused': 'De reactie is niet geschreven.',
  'comments.notLoaded': 'De reacties konden niet worden geladen.',
}
