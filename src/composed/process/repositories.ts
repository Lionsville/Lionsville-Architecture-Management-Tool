// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: where work is kept.
 *
 * The repositories, in the domain's words (ADR-0031): what a filling of each
 * answers, and what is carried out as one parcel. Types only.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export type {
  EntriesWanted, EntryId, EntryLabelled, HistoryCursor, HistoryEntry, HistoryPage, HistoryRepository, RecordWanted, UnreadKept,
} from '../../ports/HistoryRepository'
export type { ImageBytes, ImageListing, ImageRepository, Put } from '../../ports/ImageRepository'
export type { CarriedOut } from '../../ports/Interchange'
export type { IndexChanges, IndexRead, IndexedScope, OrganisationIndex } from '../../ports/OrganisationIndex'
export type {
  DistinctAnswered, DistinctTakenBack, PeopleBrought, PeopleChanges, PeopleRead, PeopleRefused, PeopleRepository, PersonRemoved, PersonWritten,
} from '../../ports/PeopleRepository'
export type { Repositories } from '../../ports/Repositories'
export type {
  Applied, Created, Moved, NewScope, Refused, RemoveOptions, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../../ports/ScopeRepository'
export type { SettingsOf, SettingsRepository } from '../../ports/SettingsRepository'
