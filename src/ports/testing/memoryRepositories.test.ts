// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repository suites, run against the in-memory repositories written
 * for them — which is what shows every clause can be met, before any
 * implementation a person uses runs them.
 */
import { describeHistoryRepository } from '../HistoryRepository.contract'
import { describeImageRepository } from '../ImageRepository.contract'
import { describeOrganisationIndex } from '../OrganisationIndex.contract'
import { describeScopeRepository } from '../ScopeRepository.contract'
import { describeSettingsRepository } from '../SettingsRepository.contract'
import { memoryRepositories } from './memoryRepositories'

describeScopeRepository('memory', memoryRepositories)
describeOrganisationIndex('memory', memoryRepositories)
describeHistoryRepository('memory', memoryRepositories)
describeImageRepository('memory', memoryRepositories)
describeSettingsRepository('memory', memoryRepositories)
