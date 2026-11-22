// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: the contracts.
 *
 * The behaviour every filling of a seam must show: the six repositories and
 * the command channel, for a filling kept outside this tree.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { SAMPLE_SCOPE, describeCommandChannel, sampleHead } from '../../ports/CommandChannel.contract'
export type { ChannelOptions, ChannelUnderTest } from '../../ports/CommandChannel.contract'
export { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
export { describeImageRepository } from '../../ports/ImageRepository.contract'
export { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
export { describePeopleRepository } from '../../ports/PeopleRepository.contract'
export type { RepositoriesUnderTest, Spoiled } from '../../ports/Repositories.contract'
export { describeScopeRepository } from '../../ports/ScopeRepository.contract'
export { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
