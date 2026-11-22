// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: the kit.
 *
 * The parts a screen composes (ADR-0045), and the few widgets beside them a
 * page of a build composed from this one is drawn with.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { arrivingPage } from '../../widgets/Arriving'
export { PageDialog } from '../../widgets/PageDialog'
export { BackIcon, CloseIcon, ForwardIcon } from '../../widgets/icons'
export { Band } from '../../widgets/kit/Band'
export { Button, IconButton } from '../../widgets/kit/Button'
export { Dialog } from '../../widgets/kit/Dialog'
export { TextField } from '../../widgets/kit/Field'
export { FilterWords } from '../../widgets/kit/FilterWords'
export { List } from '../../widgets/kit/List'
export type { ListGroup, ListRow } from '../../widgets/kit/List'
export { Mark } from '../../widgets/kit/Mark'
export type { MenuEntry } from '../../widgets/kit/Menu'
export { PageState } from '../../widgets/kit/PageState'
export { Panel, PanelSection } from '../../widgets/kit/Panel'
export { Preview, PreviewFact } from '../../widgets/kit/Preview'
export { PageHead } from '../../widgets/kit/Section'
export { Segmented } from '../../widgets/kit/Segmented'
export { SettleRow } from '../../widgets/kit/SettleRow'
export type { SettleSide } from '../../widgets/kit/SettleRow'
export { TabPanel, Tabs } from '../../widgets/kit/Tabs'
export { FRESH_VIEW, listed } from '../../widgets/kit/listView'
export type { ListView } from '../../widgets/kit/listView'
export { rovedIndex } from '../../widgets/kit/roving'
export { usePlaceTab } from '../../widgets/placeTab'
