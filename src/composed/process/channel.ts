// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the command channel.
 *
 * Where a step goes when a scope has more than one author (ADR-0022): the
 * envelope, the sequenced step and the answer. Types only.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export type { CommandChannel, PublishAnswer, SequencedStep, StepEnvelope } from '../../ports/CommandChannel'
