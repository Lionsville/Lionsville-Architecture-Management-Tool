// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: a provider's parts.
 *
 * What a provider hands the app when its source opens, what the app hands
 * back, and one scope open as whoever answers for its source sees it. Types
 * only, so a process that draws nothing may name them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export type {
  SourceActivityLine, SourceChip, SourceFailure, SourceLocation, SourceMenuEntry, SourceRecentActivity, SourceStatus, SourceWork,
} from '../../platform/sourceProvider'
export type {
  BarButtonProps, Problem, ProblemAction, SourceAttachments, SourceBand, SourceChanges, SourceComments, SourceFrame, SourceOpen, SourcePageProps,
  SourcePeople, SourceSlotProps, StatusTone,
} from '../../ports/ProviderParts'
export type { ExternalStep, RebaseReport, RebaseRun, ScopeSession, SessionChange, StepFold } from '../../ports/ScopeSession'
