/** Nederlands, voor de roadmap (ADR-0009). Getypeerd vanuit `en.ts`. */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'roadmap.title': 'Roadmap',
  'roadmap.open': 'Roadmap',
  'roadmap.close': 'Roadmap sluiten',
  'roadmap.empty': 'Nog niets heeft een datum.',
  'roadmap.emptyHint': 'Geef een applicatie een levenscyclusdatum of schrijf een plan, dan verschijnt het hier.',
  'roadmap.today': 'Vandaag',
  'roadmap.showing': 'Toont',
  'roadmap.applications': 'Applicaties',
  'roadmap.plans': 'Plannen',
  'roadmap.newPlan': 'Nieuw plan',
  'roadmap.newPlanTitle': 'Hoe heet het plan?',
  'roadmap.noPlans': 'Nog geen plannen.',
  'roadmap.planFrom': 'Van',
  'roadmap.planTo': 'Tot',
  'roadmap.planPorted': '{done} van {total} koppelingen overgezet',
  'roadmap.windowFrom': 'Toon vanaf',
  'roadmap.windowTo': 'Toon tot',
  'roadmap.windowClear': 'Hele as',
  'roadmap.owner': 'Eigenaar',
  'roadmap.milestones': 'Mijlpalen',
  'roadmap.touches': 'Wat het verandert',
  'roadmap.restsOn': 'Besluiten waarop het steunt',
  'roadmap.status': 'Status',
  'roadmap.shift': 'Verschuiven…',
  'roadmap.shiftDays': 'Aantal dagen, vooruit of terug',
  'roadmap.shiftHelp': 'Verschuift het venster en elke mijlpaal, en de datums van wat het invoert en uitfaseert. Eén stap.',
  'roadmap.delete': 'Dit plan verwijderen',
  'roadmap.deleteConfirm': '“{name}” verwijderen? De datums die het op applicaties zette blijven staan.',
  'roadmap.scrubHelp': 'Sleep om het bord achter deze pagina naar een dag te brengen.',
  'plan.draft': 'Concept',
  'plan.agreed': 'Akkoord',
  'plan.running': 'Loopt',
  'plan.done': 'Gereed',
  'plan.abandoned': 'Gestaakt',
  'plan.introduces': 'Voert in',
  'plan.retires': 'Faseert uit',
  'plan.changes': 'Wijzigt',
  'plan.page': 'Plan',
  'plan.close': 'Terug naar de roadmap',
  'plan.read': 'Lezen',
  'plan.edit': 'Bewerken',
  'plan.source': 'Bron van het plan (markdown)',
  'plan.bodyEmpty': 'Nog niets geschreven.',
  'plan.role': 'Rol',
  'plan.addElement': 'Applicatie',
  'plan.add': 'Toevoegen',
  'plan.remove': 'Verwijderen',
  'plan.noElements': 'Benoemt nog niets. Voeg toe wat het invoert, uitfaseert of wijzigt.',
  'plan.date.live': 'Live vanaf',
  'plan.date.retiring': 'Uitfaseren vanaf',
  'plan.date.retired': 'Weg op',
  'plan.milestoneName': 'Mijlpaal',
  'plan.milestoneDate': 'Datum',
  'plan.noMilestones': 'Nog geen mijlpalen.',
  'plan.decision': 'Besluit',
  'plan.noDecisions': 'Steunt nog op geen vastgelegd besluit.',
  'plan.interfaces': 'Koppelingen',
  'plan.noInterfaces': 'Nog niets te verplaatsen: benoem wat het plan uitfaseert en wat het invoert, dan verschijnen de lijnen van het eerste hier.',
  'plan.counterpart': 'Met',
  'plan.protocol': 'Protocol',
  'plan.movesTo': 'Gaat naar',
  'plan.on': 'Op',
  'plan.ported': 'Verplaatst',
  'plan.planned': 'Gepland',
  'plan.notPlanned': 'Nog niet gepland',
  'plan.portAll': 'Rest overzetten',
  'plan.unport': 'Terugnemen',
  'plan.template': `## Doel

## Scope

## Aanpak en fasen

## Businesscase

{businessCase}

## Risico's

## Terugvalscenario
`,
  'check.title': 'Waarover de datums het oneens zijn',
  'check.none': 'De datums zijn onderling consistent.',
  'check.retiresWithDependants': '{name} wordt uitgefaseerd op {detail} terwijl er nog {count} koppelingen live zijn.',
  'check.successorTooLate': 'De opvolger van {name} gaat pas live nadat het weg is: {detail}.',
  'check.successorMissing': '{name} wordt uitgefaseerd op {detail} en er is geen opvolger benoemd.',
  'check.lineOutlivesEnd': '“{name}” is nog geldig nadat {detail} is uitgefaseerd.',
  'check.planOverdue': '{name} zou op {detail} klaar zijn en loopt nog.',
  'check.staleness': 'Dit toont waar de datums elkaar tegenspreken. Het kan niet zien of een landschap verouderd is.',
}
