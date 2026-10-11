// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Team Topologies, as a starting point: its four kinds of team. The kinds are
 * named as Team Topologies names them; what each is for is written here, in
 * this project's words (see `../library.ts`). The three ways teams work
 * together are rows between units, not entries of a library, and are said in
 * the note only.
 */
import type { Library } from '../library'

export const TEAM_TOPOLOGIES: Library = {
  id: 'team-topologies',
  version: '1',
  name: 'Team Topologies',
  note: {
    en: 'Four kinds of team, and three ways for teams to work together: in collaboration, one as a service to another, and one facilitating another.',
    nl: 'Vier soorten teams, en drie manieren waarop teams samenwerken: in samenwerking, de een als dienst voor de ander, en de een die de ander faciliteert.',
    de: 'Vier Arten von Teams und drei Weisen, wie Teams zusammenarbeiten: in Zusammenarbeit, das eine als Dienst für das andere und das eine, das das andere befähigt.',
  },
  unitTypes: [
    {
      entry: 'stream-aligned',
      name: { en: 'Stream-aligned team', nl: 'Stream-aligned team', de: 'Stream-aligned Team' },
      purpose: {
        en: 'Delivers one flow of change for one part of the business, from the first question to running it, with as few hand-offs as it can.',
        nl: 'Levert één stroom van veranderingen voor één deel van de organisatie, van de eerste vraag tot het draaien ervan, met zo min mogelijk overdrachten.',
        de: 'Liefert einen Strom von Änderungen für einen Teil des Geschäfts, von der ersten Frage bis zum Betrieb, mit so wenigen Übergaben wie möglich.',
      },
      top: true,
      within: [],
      slots: [],
    },
    {
      entry: 'platform',
      name: { en: 'Platform team', nl: 'Platformteam', de: 'Plattform-Team' },
      purpose: {
        en: 'Offers internal services other teams take up on their own, so that they need to know less to deliver.',
        nl: 'Biedt interne diensten die andere teams zelfstandig afnemen, zodat ze minder hoeven te weten om op te leveren.',
        de: 'Bietet interne Dienste, die andere Teams selbstständig nutzen, sodass sie weniger wissen müssen, um zu liefern.',
      },
      top: true,
      within: [],
      slots: [],
    },
    {
      entry: 'enabling',
      name: { en: 'Enabling team', nl: 'Enabling team', de: 'Enabling Team' },
      purpose: {
        en: 'Spends a while with another team to help it take up a skill or a practice, and then moves on.',
        nl: 'Trekt een tijd op met een ander team om het te helpen een vaardigheid of werkwijze eigen te maken, en gaat dan verder.',
        de: 'Verbringt eine Zeit mit einem anderen Team, um ihm zu helfen, eine Fähigkeit oder Praxis zu übernehmen, und zieht dann weiter.',
      },
      top: true,
      within: [],
      spans: true,
      slots: [],
    },
    {
      entry: 'complicated-subsystem',
      name: { en: 'Complicated-subsystem team', nl: 'Complicated-subsystem team', de: 'Complicated-Subsystem Team' },
      purpose: {
        en: 'Looks after a part that needs rare, deep knowledge, so that the teams using it do not have to carry that knowledge.',
        nl: 'Zorgt voor een onderdeel dat zeldzame, diepe kennis vraagt, zodat de teams die het gebruiken die kennis niet zelf hoeven te dragen.',
        de: 'Kümmert sich um einen Teil, der seltenes, tiefes Wissen braucht, damit die Teams, die ihn nutzen, dieses Wissen nicht selbst tragen müssen.',
      },
      top: true,
      within: [],
      slots: [],
    },
  ],
  roles: [],
  responsibilities: [],
}
