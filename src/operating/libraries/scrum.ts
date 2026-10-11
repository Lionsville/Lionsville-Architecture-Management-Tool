// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Scrum, as a starting point: one kind of team and the three parts people play
 * in it. The names are Scrum's own; every purpose and description is written
 * here, in this project's words (see `../library.ts`).
 */
import type { Library } from '../library'

export const SCRUM: Library = {
  id: 'scrum',
  version: '1',
  name: 'Scrum',
  note: {
    en: 'One small team that delivers in short cycles, and the three parts people play in it.',
    nl: 'Eén klein team dat in korte cycli oplevert, en de drie rollen die mensen daarin spelen.',
    de: 'Ein kleines Team, das in kurzen Zyklen liefert, und die drei Rollen, die Menschen darin spielen.',
  },
  unitTypes: [{
    entry: 'scrum-team',
    name: { en: 'Scrum Team', nl: 'Scrumteam', de: 'Scrum-Team' },
    alike: ['safe:agile-team'],
    purpose: {
      en: 'A small team that organises its own work and delivers something usable at the end of every short cycle.',
      nl: 'Een klein team dat zijn eigen werk organiseert en aan het eind van elke korte cyclus iets bruikbaars oplevert.',
      de: 'Ein kleines Team, das seine Arbeit selbst organisiert und am Ende jedes kurzen Zyklus etwas Nutzbares liefert.',
    },
    top: true,
    within: [],
    slots: [
      { role: 'product-owner', min: 1, max: 1 },
      { role: 'scrum-master', min: 1, max: 1 },
      { role: 'developer', min: 3, max: 9 },
    ],
  }],
  roles: [
    {
      entry: 'product-owner',
      name: { en: 'Product Owner', nl: 'Product Owner', de: 'Product Owner' },
      alike: ['safe:product-owner'],
      short: 'PO',
      purpose: {
        en: 'Decides what the team works on next and why, and answers for the value of what it delivers.',
        nl: 'Bepaalt waar het team hierna aan werkt en waarom, en staat in voor de waarde van wat het oplevert.',
        de: 'Entscheidet, woran das Team als Nächstes arbeitet und warum, und steht für den Wert dessen ein, was es liefert.',
      },
      duties: [
        { responsibility: 'order-the-backlog', raci: 'A' },
        { responsibility: 'plan-the-cycle', raci: 'C' },
        { responsibility: 'deliver-an-increment', raci: 'I' },
        { responsibility: 'improve-the-way-of-working', raci: 'C' },
      ],
    },
    {
      entry: 'scrum-master',
      name: { en: 'Scrum Master', nl: 'Scrum Master', de: 'Scrum Master' },
      alike: ['safe:team-coach'],
      short: 'SM',
      purpose: {
        en: 'Helps the team and the people around it work the way they agreed to, and clears what slows them down.',
        nl: 'Helpt het team en de mensen eromheen te werken zoals ze hebben afgesproken, en ruimt op wat hen ophoudt.',
        de: 'Hilft dem Team und den Menschen um es herum, so zu arbeiten, wie sie es vereinbart haben, und räumt aus dem Weg, was sie bremst.',
      },
      duties: [
        { responsibility: 'plan-the-cycle', raci: 'C' },
        { responsibility: 'improve-the-way-of-working', raci: 'A' },
      ],
    },
    {
      entry: 'developer',
      name: { en: 'Developer', nl: 'Developer', de: 'Developer' },
      alike: ['safe:team-member'],
      short: 'Dev',
      purpose: {
        en: 'Builds, tests and improves the product, and decides with the rest of the team how the work is done.',
        nl: 'Bouwt, test en verbetert het product, en bepaalt samen met de rest van het team hoe het werk gedaan wordt.',
        de: 'Baut, testet und verbessert das Produkt und entscheidet mit dem übrigen Team, wie die Arbeit getan wird.',
      },
      duties: [
        { responsibility: 'order-the-backlog', raci: 'C' },
        { responsibility: 'plan-the-cycle', raci: 'A' },
        { responsibility: 'deliver-an-increment', raci: 'A' },
        { responsibility: 'improve-the-way-of-working', raci: 'R' },
      ],
    },
  ],
  responsibilities: [
    {
      entry: 'order-the-backlog',
      name: { en: 'Order the backlog', nl: 'De backlog ordenen', de: 'Das Backlog ordnen' },
      description: {
        en: 'Keep one list of what the product needs, most valuable first, and make sure everyone can read it.',
        nl: 'Eén lijst bijhouden van wat het product nodig heeft, het waardevolste eerst, en zorgen dat iedereen hem kan lezen.',
        de: 'Eine Liste dessen führen, was das Produkt braucht, das Wertvollste zuerst, und dafür sorgen, dass alle sie lesen können.',
      },
      group: { en: 'Scrum', nl: 'Scrum', de: 'Scrum' },
    },
    {
      entry: 'plan-the-cycle',
      name: { en: 'Plan the cycle', nl: 'De cyclus plannen', de: 'Den Zyklus planen' },
      description: {
        en: 'Agree at the start of each cycle what it should achieve and how the team will get there.',
        nl: 'Aan het begin van elke cyclus afspreken wat die moet opleveren en hoe het team daar komt.',
        de: 'Zu Beginn jedes Zyklus vereinbaren, was er erreichen soll und wie das Team dorthin kommt.',
      },
      group: { en: 'Scrum', nl: 'Scrum', de: 'Scrum' },
    },
    {
      entry: 'deliver-an-increment',
      name: { en: 'Deliver a usable increment', nl: 'Een bruikbaar increment opleveren', de: 'Ein nutzbares Inkrement liefern' },
      description: {
        en: 'Finish work to the standard the team agreed, so that what is delivered can be used.',
        nl: 'Werk afmaken volgens de norm die het team afsprak, zodat wat wordt opgeleverd bruikbaar is.',
        de: 'Arbeit nach dem vereinbarten Maßstab fertigstellen, sodass das Gelieferte genutzt werden kann.',
      },
      group: { en: 'Scrum', nl: 'Scrum', de: 'Scrum' },
    },
    {
      entry: 'improve-the-way-of-working',
      name: { en: 'Improve the way of working', nl: 'De werkwijze verbeteren', de: 'Die Arbeitsweise verbessern' },
      description: {
        en: 'Look back at the end of each cycle and change one thing about how the team works.',
        nl: 'Aan het eind van elke cyclus terugkijken en één ding veranderen aan hoe het team werkt.',
        de: 'Am Ende jedes Zyklus zurückblicken und eine Sache daran ändern, wie das Team arbeitet.',
      },
      group: { en: 'Scrum', nl: 'Scrum', de: 'Scrum' },
    },
  ],
}
