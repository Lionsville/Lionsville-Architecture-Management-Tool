// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The IT4IT value streams, as a starting point: responsibilities grouped by
 * the seven value streams of the standard's 3.0 edition — Evaluate, Explore,
 * Integrate, Deploy, Release, Consume and Operate — and three roles to carry
 * them. The value streams are named as the standard names them; what each
 * responsibility is, and every role, is written here, in this project's words
 * (see `../library.ts`). IT4IT is a trademark of The Open Group
 * (`NOTICE`).
 */
import type { Library, Words } from '../library'

const stream = (en: string, nl: string, de: string): Words => ({ en, nl, de })
const EVALUATE = stream('Evaluate', 'Evaluate', 'Evaluate')
const EXPLORE = stream('Explore', 'Explore', 'Explore')
const INTEGRATE = stream('Integrate', 'Integrate', 'Integrate')
const DEPLOY = stream('Deploy', 'Deploy', 'Deploy')
const RELEASE = stream('Release', 'Release', 'Release')
const CONSUME = stream('Consume', 'Consume', 'Consume')
const OPERATE = stream('Operate', 'Operate', 'Operate')

export const IT4IT: Library = {
  id: 'it4it',
  version: '1',
  name: 'IT4IT',
  note: {
    en: 'Responsibilities grouped by the seven value streams of the IT4IT standard, version 3.0, from weighing the portfolio to running a product, and three roles to carry them.',
    nl: 'Verantwoordelijkheden gegroepeerd naar de zeven waardestromen van de IT4IT-standaard, versie 3.0, van het wegen van het portfolio tot het draaien van een product, en drie rollen om ze te dragen.',
    de: 'Verantwortungen, gruppiert nach den sieben Wertströmen des IT4IT-Standards, Version 3.0, vom Abwägen des Portfolios bis zum Betrieb eines Produkts, und drei Rollen, die sie tragen.',
  },
  unitTypes: [],
  roles: [
    {
      entry: 'product-manager',
      name: { en: 'Product manager', nl: 'Productmanager', de: 'Produktmanager' },
      alike: ['safe:product-management'],
      short: 'PdM',
      purpose: {
        en: 'Decides which digital products are worth having, what each should do next, and what a release of it should hold.',
        nl: 'Beslist welke digitale producten de moeite waard zijn, wat elk hierna moet doen en wat een release ervan moet bevatten.',
        de: 'Entscheidet, welche digitalen Produkte sich lohnen, was jedes als Nächstes können soll und was ein Release davon enthalten soll.',
      },
      duties: [
        { responsibility: 'weigh-the-portfolio', raci: 'A' },
        { responsibility: 'fund-an-idea', raci: 'A' },
        { responsibility: 'shape-the-next-features', raci: 'A' },
        { responsibility: 'build-a-release', raci: 'A' },
        { responsibility: 'test-a-release', raci: 'C' },
        { responsibility: 'offer-to-consumers', raci: 'C' },
        { responsibility: 'remove-a-recurring-cause', raci: 'I' },
      ],
    },
    {
      entry: 'release-manager',
      name: { en: 'Release manager', nl: 'Releasemanager', de: 'Release-Manager' },
      short: 'RM',
      purpose: {
        en: 'Sees a release through testing and into production, and makes it something consumers can take up.',
        nl: 'Begeleidt een release door het testen heen naar productie, en maakt er iets van dat afnemers kunnen gebruiken.',
        de: 'Begleitet ein Release durch die Tests in die Produktion und macht daraus etwas, das Nutzer in Anspruch nehmen können.',
      },
      duties: [
        { responsibility: 'build-a-release', raci: 'C' },
        { responsibility: 'test-a-release', raci: 'A' },
        { responsibility: 'deploy-a-release', raci: 'A' },
        { responsibility: 'offer-to-consumers', raci: 'A' },
        { responsibility: 'keep-it-running', raci: 'I' },
      ],
    },
    {
      entry: 'operations-manager',
      name: { en: 'Operations manager', nl: 'Operationsmanager', de: 'Betriebsleiter' },
      short: 'OM',
      purpose: {
        en: 'Keeps the products running, answers the people who use them, and sees that what goes wrong is put right for good.',
        nl: 'Houdt de producten draaiende, staat de mensen die ze gebruiken te woord, en zorgt dat wat misgaat blijvend wordt verholpen.',
        de: 'Hält die Produkte am Laufen, steht den Menschen Rede und Antwort, die sie nutzen, und sorgt dafür, dass Fehler dauerhaft behoben werden.',
      },
      duties: [
        { responsibility: 'deploy-a-release', raci: 'C' },
        { responsibility: 'handle-a-request', raci: 'A' },
        { responsibility: 'keep-it-running', raci: 'A' },
        { responsibility: 'remove-a-recurring-cause', raci: 'A' },
      ],
    },
  ],
  responsibilities: [
    {
      entry: 'weigh-the-portfolio',
      name: { en: 'Weigh the portfolio against the strategy', nl: 'Het portfolio afwegen tegen de strategie', de: 'Das Portfolio gegen die Strategie abwägen' },
      description: {
        en: 'Look at every product the organisation has, and say which still serve where it is going.',
        nl: 'Kijken naar elk product dat de organisatie heeft, en zeggen welke nog passen bij waar ze heen gaat.',
        de: 'Jedes Produkt der Organisation betrachten und sagen, welche noch dazu passen, wohin sie geht.',
      },
      group: EVALUATE,
    },
    {
      entry: 'fund-an-idea',
      name: { en: 'Decide which ideas are funded', nl: 'Beslissen welke ideeën geld krijgen', de: 'Entscheiden, welche Ideen finanziert werden' },
      description: {
        en: 'Choose among proposals for new products and changes, and give the chosen ones a budget.',
        nl: 'Kiezen uit voorstellen voor nieuwe producten en wijzigingen, en de gekozen voorstellen een budget geven.',
        de: 'Unter Vorschlägen für neue Produkte und Änderungen wählen und den gewählten ein Budget geben.',
      },
      group: EVALUATE,
    },
    {
      entry: 'shape-the-next-features',
      name: { en: 'Shape a product\'s next features', nl: 'De volgende features van een product vormgeven', de: 'Die nächsten Features eines Produkts gestalten' },
      description: {
        en: 'Work out what a product should do next, and what its design must allow for.',
        nl: 'Uitwerken wat een product hierna moet doen, en waar het ontwerp rekening mee moet houden.',
        de: 'Ausarbeiten, was ein Produkt als Nächstes können soll und was sein Entwurf berücksichtigen muss.',
      },
      group: EXPLORE,
    },
    {
      entry: 'build-a-release',
      name: { en: 'Design and build a release', nl: 'Een release ontwerpen en bouwen', de: 'Ein Release entwerfen und bauen' },
      description: {
        en: 'Turn the chosen features, or a fix, into a release that is ready to go out.',
        nl: 'De gekozen features, of een herstel, omzetten in een release die klaar is om uit te gaan.',
        de: 'Die gewählten Features oder eine Korrektur in ein Release verwandeln, das bereit ist, ausgeliefert zu werden.',
      },
      group: INTEGRATE,
    },
    {
      entry: 'test-a-release',
      name: { en: 'Test a release before it goes out', nl: 'Een release testen voordat hij uitgaat', de: 'Ein Release testen, bevor es ausgeliefert wird' },
      description: {
        en: 'Show that a release does what it should, and does not break what worked before.',
        nl: 'Aantonen dat een release doet wat hij moet doen, en niet breekt wat eerder werkte.',
        de: 'Zeigen, dass ein Release tut, was es soll, und nicht kaputt macht, was vorher funktionierte.',
      },
      group: INTEGRATE,
    },
    {
      entry: 'deploy-a-release',
      name: { en: 'Put a release into production', nl: 'Een release in productie nemen', de: 'Ein Release in Produktion nehmen' },
      description: {
        en: 'Install a release where it runs for real, or take an old one away, without surprising anyone.',
        nl: 'Een release installeren waar hij echt draait, of een oude weghalen, zonder iemand te verrassen.',
        de: 'Ein Release dort installieren, wo es wirklich läuft, oder ein altes entfernen, ohne jemanden zu überraschen.',
      },
      group: DEPLOY,
    },
    {
      entry: 'offer-to-consumers',
      name: { en: 'Offer a product or a change to its consumers', nl: 'Een product of wijziging aan afnemers aanbieden', de: 'Ein Produkt oder eine Änderung den Nutzern anbieten' },
      description: {
        en: 'Say what consumers can now ask for, on what terms, and how they will be supported.',
        nl: 'Zeggen waar afnemers nu om kunnen vragen, op welke voorwaarden, en hoe ze worden ondersteund.',
        de: 'Sagen, was Nutzer nun anfordern können, zu welchen Bedingungen und wie sie unterstützt werden.',
      },
      group: RELEASE,
    },
    {
      entry: 'handle-a-request',
      name: { en: 'Handle a consumer\'s request', nl: 'Een verzoek van een afnemer afhandelen', de: 'Die Anfrage eines Nutzers bearbeiten' },
      description: {
        en: 'Take a request for a product or a change in how it is used, and see it through.',
        nl: 'Een verzoek om een product of een wijziging in het gebruik ervan aannemen en afronden.',
        de: 'Eine Anfrage nach einem Produkt oder einer Änderung seiner Nutzung annehmen und zu Ende bringen.',
      },
      group: CONSUME,
    },
    {
      entry: 'keep-it-running',
      name: { en: 'Keep a product running and restore it after a fault', nl: 'Een product draaiende houden en na een storing herstellen', de: 'Ein Produkt am Laufen halten und nach einer Störung wiederherstellen' },
      description: {
        en: 'Watch how a product behaves, and when it fails, get it working again as fast as is safe.',
        nl: 'In de gaten houden hoe een product zich gedraagt, en als het faalt, het zo snel als veilig is weer werkend krijgen.',
        de: 'Beobachten, wie sich ein Produkt verhält, und es nach einem Ausfall so schnell wie sicher wieder zum Laufen bringen.',
      },
      group: OPERATE,
    },
    {
      entry: 'remove-a-recurring-cause',
      name: { en: 'Remove the cause of a recurring fault', nl: 'De oorzaak van een terugkerende storing wegnemen', de: 'Die Ursache einer wiederkehrenden Störung beseitigen' },
      description: {
        en: 'Find out why the same fault keeps happening, and change what has to change so it stops.',
        nl: 'Uitzoeken waarom dezelfde storing blijft optreden, en veranderen wat moet veranderen zodat het ophoudt.',
        de: 'Herausfinden, warum dieselbe Störung immer wieder auftritt, und ändern, was sich ändern muss, damit sie aufhört.',
      },
      group: OPERATE,
    },
  ],
}
