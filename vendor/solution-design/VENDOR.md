# Herkomst van dit pakket

**Wat het is.** `@lionsville/solution-design` 0.1.0 — de solution-design
diagrameditor, oorspronkelijk een workspace-pakket in de Lionsville-monorepo
`hal_app`.

**Hoe het hier kwam.** Met de hand gekopieerd op **23 augustus 2026**; de
bestandsdatums in `src/` en `README.md` zijn daar het bewijs van. Er is geen
git-remote, geen submodule en geen versie-pin die naar de bron verwijst: wat
hier ligt is de kopie zelf en niets anders.

**Wat het nu is: een fork.** Sinds **2 september 2026** wordt dit pakket hier
onderhouden. Zo is het afgesproken in `../../ROADMAP.md` (besluit 2):

- **Geen upstream-synchronisatie.** Er komt geen refresh uit `hal_app`, en
  wijzigingen hier gaan niet terug. Wie een verschil met de bron zoekt, moet
  dat handmatig doen — er is geen gemeenschappelijke commit om tegen te diffen.
- **Bewerk het ter plekke.** Nieuw werk gaat gewoon in `src/`; er is geen
  patchlaag, geen wrapper en geen "raak vendor niet aan"-regel.
- **Houd de tests groen.** `npx vitest run` in deze map (855 tests bij de
  overname op 2 september 2026, plus wat er sindsdien bij is gekomen),
  `npx tsc --noEmit -p .` en `npx eslint src` horen alle drie schoon te zijn
  voor en na elke wijziging. Dat is het enige vangnet dat een fork zonder
  upstream nog heeft.
- **`hal_app`-only oppervlak mag weg** zodra een fase de betreffende bestanden
  toch aanraakt (parameter-editor, scope-kostenchip, legacy drag-shims). Tot
  die tijd blijft het staan; het doet geen kwaad.

De verwijzingen in `README.md` naar `docs/specs/…`, `docs/intent/…` en
`docs/plans/…` wijzen naar documenten in `hal_app` die hier niet liggen. Ze
blijven staan als vindplaats van de oorspronkelijke bedoeling, niet als
bestanden die je hier kunt openen.

**Licentie.** Zie `../../LICENSE`: gebruiksrecht voor [Organization] voor de duur van
het programma, het intellectueel eigendom blijft bij Lionsville Group BV. Dat
geldt onverkort voor deze kopie. Het pakket zelf voegt daar niets aan toe; de
enige externe licentie om rekening mee te houden is die van `libavoid-js`
(LGPL-2.1-or-later), waarvoor `libavoid.wasm` ongehasht op het vaste pad
`/libavoid.wasm` wordt gepubliceerd zodat een eigen build van libavoid ervoor
in de plaats kan.
