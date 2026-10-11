// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * SAFe, as a starting point: a portfolio, the trains in it and the teams on a
 * train, and the roles that run each. The names are SAFe's own; every purpose
 * and description is written here, in this project's words (see
 * `../library.ts`). SAFe is a registered trademark of Scaled Agile, Inc.
 * (`THIRD-PARTY-NOTICES.md`).
 */
import type { Library } from '../library'

const PORTFOLIO = { en: 'Portfolio', nl: 'Portfolio', de: 'Portfolio' }
const TRAIN = { en: 'Train', nl: 'Trein', de: 'Zug' }
const TEAM = { en: 'Team', nl: 'Team', de: 'Team' }

export const SAFE: Library = {
  id: 'safe',
  version: '1',
  name: 'SAFe',
  note: {
    en: 'A portfolio, the release trains in it and the teams on each train, and the roles that run them.',
    nl: 'Een portfolio, de release trains erin en de teams op elke trein, en de rollen die ze leiden.',
    de: 'Ein Portfolio, die Release Trains darin und die Teams in jedem Zug, und die Rollen, die sie führen.',
  },
  unitTypes: [
    {
      entry: 'portfolio',
      name: PORTFOLIO,
      purpose: {
        en: 'Where the organisation decides which large pieces of work it funds, and keeps them in line with its strategy.',
        nl: 'Waar de organisatie beslist welke grote stukken werk ze financiert, en die in lijn houdt met haar strategie.',
        de: 'Wo die Organisation entscheidet, welche großen Arbeitspakete sie finanziert, und sie mit ihrer Strategie in Einklang hält.',
      },
      top: true,
      within: [],
      slots: [
        { role: 'business-owner', min: 1 },
        { role: 'enterprise-architect', min: 0, max: 1 },
        { role: 'epic-owner', min: 0 },
      ],
    },
    {
      entry: 'agile-release-train',
      name: { en: 'Agile Release Train', nl: 'Agile Release Train', de: 'Agile Release Train' },
      purpose: {
        en: 'A long-lived group of teams that plans together, on one rhythm, and delivers one stream of value.',
        nl: 'Een blijvende groep teams die samen plant, in één ritme, en één stroom van waarde oplevert.',
        de: 'Eine dauerhafte Gruppe von Teams, die gemeinsam in einem Rhythmus plant und einen Wertstrom liefert.',
      },
      top: true,
      within: ['portfolio'],
      spans: true,
      slots: [
        { role: 'release-train-engineer', min: 1, max: 1 },
        { role: 'product-management', min: 1, max: 1 },
        { role: 'system-architect', min: 1, max: 1 },
        { role: 'business-owner', min: 1 },
      ],
    },
    {
      entry: 'agile-team',
      name: { en: 'Agile Team', nl: 'Agile Team', de: 'Agile Team' },
      purpose: {
        en: 'A small team on a train that builds, tests and delivers its part of the train\'s work.',
        nl: 'Een klein team op een trein dat zijn deel van het werk van de trein bouwt, test en oplevert.',
        de: 'Ein kleines Team in einem Zug, das seinen Teil der Arbeit des Zuges baut, testet und liefert.',
      },
      within: ['agile-release-train'],
      slots: [
        { role: 'product-owner', min: 1, max: 1 },
        { role: 'team-coach', min: 1, max: 1 },
        { role: 'team-member', min: 3, max: 9 },
      ],
    },
  ],
  roles: [
    {
      entry: 'business-owner',
      name: { en: 'Business Owner', nl: 'Business Owner', de: 'Business Owner' },
      short: 'BO',
      purpose: {
        en: 'Answers for what a portfolio or a train achieves for the business, and for what it spends.',
        nl: 'Staat in voor wat een portfolio of een trein voor de organisatie bereikt, en voor wat het uitgeeft.',
        de: 'Steht dafür ein, was ein Portfolio oder ein Zug für das Geschäft erreicht und was es ausgibt.',
      },
      duties: [
        { responsibility: 'set-the-direction', raci: 'A' },
        { responsibility: 'approve-an-epic', raci: 'A' },
        { responsibility: 'plan-the-interval', raci: 'C' },
      ],
    },
    {
      entry: 'enterprise-architect',
      name: { en: 'Enterprise Architect', nl: 'Enterprise Architect', de: 'Enterprise Architect' },
      short: 'EA',
      purpose: {
        en: 'Keeps the technology choices of the portfolio coherent, and guides the architects on its trains.',
        nl: 'Houdt de technologiekeuzes van het portfolio samenhangend, en begeleidt de architecten op de treinen.',
        de: 'Hält die Technologieentscheidungen des Portfolios stimmig und begleitet die Architekten in den Zügen.',
      },
      duties: [
        { responsibility: 'set-the-direction', raci: 'C' },
        { responsibility: 'approve-an-epic', raci: 'C' },
        { responsibility: 'keep-the-runway', raci: 'C' },
      ],
    },
    {
      entry: 'epic-owner',
      name: { en: 'Epic Owner', nl: 'Epic Owner', de: 'Epic Owner' },
      short: 'EO',
      purpose: {
        en: 'Carries one large initiative from an idea to a decision, and then helps the trains deliver it.',
        nl: 'Brengt één groot initiatief van idee tot besluit, en helpt daarna de treinen het op te leveren.',
        de: 'Bringt eine große Initiative von der Idee bis zur Entscheidung und hilft danach den Zügen, sie zu liefern.',
      },
      duties: [{ responsibility: 'approve-an-epic', raci: 'R' }, { responsibility: 'set-the-direction', raci: 'I' }],
    },
    {
      entry: 'release-train-engineer',
      name: { en: 'Release Train Engineer', nl: 'Release Train Engineer', de: 'Release Train Engineer' },
      short: 'RTE',
      purpose: {
        en: 'Keeps the train\'s planning and delivery rhythm going, and clears what blocks its teams.',
        nl: 'Houdt het plannings- en opleverritme van de trein gaande, en ruimt op wat zijn teams blokkeert.',
        de: 'Hält den Planungs- und Lieferrhythmus des Zuges in Gang und räumt aus dem Weg, was seine Teams blockiert.',
      },
      duties: [{ responsibility: 'plan-the-interval', raci: 'A' }, { responsibility: 'deliver-the-iteration', raci: 'I' }],
    },
    {
      entry: 'product-management',
      name: { en: 'Product Management', nl: 'Product Management', de: 'Product Management' },
      short: 'PM',
      purpose: {
        en: 'Decides what the train builds next and why, and owns the train\'s backlog and roadmap.',
        nl: 'Beslist wat de trein hierna bouwt en waarom, en is eigenaar van de backlog en de roadmap van de trein.',
        de: 'Entscheidet, was der Zug als Nächstes baut und warum, und verantwortet Backlog und Roadmap des Zuges.',
      },
      duties: [
        { responsibility: 'order-the-train-backlog', raci: 'A' },
        { responsibility: 'plan-the-interval', raci: 'R' },
        { responsibility: 'set-the-direction', raci: 'C' },
      ],
    },
    {
      entry: 'system-architect',
      name: { en: 'System Architect', nl: 'System Architect', de: 'System Architect' },
      short: 'SA',
      purpose: {
        en: 'Shapes the train\'s solution and the interfaces between its teams, a step ahead of the work.',
        nl: 'Geeft vorm aan de oplossing van de trein en de koppelvlakken tussen zijn teams, een stap voor op het werk.',
        de: 'Gestaltet die Lösung des Zuges und die Schnittstellen zwischen seinen Teams, einen Schritt vor der Arbeit.',
      },
      duties: [
        { responsibility: 'keep-the-runway', raci: 'A' },
        { responsibility: 'order-the-train-backlog', raci: 'C' },
        { responsibility: 'plan-the-interval', raci: 'C' },
      ],
    },
    {
      entry: 'product-owner',
      name: { en: 'Product Owner', nl: 'Product Owner', de: 'Product Owner' },
      short: 'PO',
      purpose: {
        en: 'Orders a team\'s backlog and decides what it delivers in each iteration, in step with the train.',
        nl: 'Ordent de backlog van een team en beslist wat het in elke iteratie oplevert, in de pas met de trein.',
        de: 'Ordnet das Backlog eines Teams und entscheidet, was es in jeder Iteration liefert, im Takt mit dem Zug.',
      },
      duties: [
        { responsibility: 'deliver-the-iteration', raci: 'A' },
        { responsibility: 'order-the-train-backlog', raci: 'C' },
        { responsibility: 'plan-the-interval', raci: 'R' },
      ],
    },
    {
      entry: 'team-coach',
      name: { en: 'Scrum Master/Team Coach', nl: 'Scrum Master/Team Coach', de: 'Scrum Master/Team Coach' },
      short: 'TC',
      purpose: {
        en: 'Helps a team work well together and get better at how it works, and keeps it in step with the train.',
        nl: 'Helpt een team goed samen te werken en beter te worden in hoe het werkt, en houdt het in de pas met de trein.',
        de: 'Hilft einem Team, gut zusammenzuarbeiten und besser darin zu werden, wie es arbeitet, und hält es im Takt mit dem Zug.',
      },
      duties: [{ responsibility: 'deliver-the-iteration', raci: 'C' }, { responsibility: 'plan-the-interval', raci: 'C' }],
    },
    {
      entry: 'team-member',
      name: { en: 'Agile Team member', nl: 'Lid van een Agile Team', de: 'Mitglied eines Agile Teams' },
      short: 'TM',
      purpose: {
        en: 'Builds, tests and delivers the team\'s work, and shares in deciding how it is done.',
        nl: 'Bouwt, test en levert het werk van het team op, en beslist mee over hoe dat gebeurt.',
        de: 'Baut, testet und liefert die Arbeit des Teams und entscheidet mit, wie sie getan wird.',
      },
      duties: [{ responsibility: 'deliver-the-iteration', raci: 'R' }, { responsibility: 'keep-the-runway', raci: 'R' }],
    },
  ],
  responsibilities: [
    {
      entry: 'set-the-direction',
      name: { en: 'Set the portfolio\'s direction and budgets', nl: 'Richting en budgetten van het portfolio bepalen', de: 'Richtung und Budgets des Portfolios festlegen' },
      description: {
        en: 'Say where the portfolio is going, and how much each stream of value may spend getting there.',
        nl: 'Zeggen waar het portfolio heen gaat, en hoeveel elke waardestroom daaraan mag uitgeven.',
        de: 'Sagen, wohin das Portfolio geht und wie viel jeder Wertstrom auf dem Weg dorthin ausgeben darf.',
      },
      group: PORTFOLIO,
    },
    {
      entry: 'approve-an-epic',
      name: { en: 'Approve an epic', nl: 'Een epic goedkeuren', de: 'Ein Epic genehmigen' },
      description: {
        en: 'Decide, on a short case for it, whether a large initiative goes ahead.',
        nl: 'Op basis van een korte onderbouwing beslissen of een groot initiatief doorgaat.',
        de: 'Anhand einer kurzen Begründung entscheiden, ob eine große Initiative weitergeht.',
      },
      group: PORTFOLIO,
    },
    {
      entry: 'plan-the-interval',
      name: { en: 'Plan the next planning interval', nl: 'Het volgende planning interval plannen', de: 'Das nächste Planning Interval planen' },
      description: {
        en: 'Bring the train\'s teams together to agree what they will deliver over the next few iterations.',
        nl: 'De teams van de trein samenbrengen om af te spreken wat ze de komende iteraties opleveren.',
        de: 'Die Teams des Zuges zusammenbringen, um zu vereinbaren, was sie in den nächsten Iterationen liefern.',
      },
      group: TRAIN,
    },
    {
      entry: 'order-the-train-backlog',
      name: { en: 'Order the train\'s backlog', nl: 'De backlog van de trein ordenen', de: 'Das Backlog des Zuges ordnen' },
      description: {
        en: 'Keep the features the train may build in one list, most valuable first.',
        nl: 'De features die de trein kan bouwen in één lijst bijhouden, de waardevolste eerst.',
        de: 'Die Features, die der Zug bauen kann, in einer Liste führen, die wertvollsten zuerst.',
      },
      group: TRAIN,
    },
    {
      entry: 'keep-the-runway',
      name: { en: 'Keep the architecture ahead of the work', nl: 'De architectuur voor het werk uit houden', de: 'Die Architektur der Arbeit voraushalten' },
      description: {
        en: 'Make sure what the next features need from the architecture is there before the teams need it.',
        nl: 'Zorgen dat wat de volgende features van de architectuur nodig hebben er is voordat de teams het nodig hebben.',
        de: 'Dafür sorgen, dass das, was die nächsten Features von der Architektur brauchen, da ist, bevor die Teams es brauchen.',
      },
      group: TRAIN,
    },
    {
      entry: 'deliver-the-iteration',
      name: { en: 'Deliver the team\'s iteration', nl: 'De iteratie van het team opleveren', de: 'Die Iteration des Teams liefern' },
      description: {
        en: 'Build, test and show what the team took on for the iteration.',
        nl: 'Bouwen, testen en laten zien wat het team voor de iteratie op zich nam.',
        de: 'Bauen, testen und zeigen, was das Team sich für die Iteration vorgenommen hat.',
      },
      group: TEAM,
    },
  ],
}
