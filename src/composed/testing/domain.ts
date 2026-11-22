// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: arithmetic a suite asks.
 *
 * Functions of the domain that a build composed from this one calls from its
 * suites only: a gesture planned, a place read from an address, a copy sealed.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { workingFileBytes } from '../../adapters/folder/format/workingFile'
export { linkTo, readPlace } from '../../agent/place'
export { planMove } from '../../observations/move'
export { isGestureRefusal, planGesture, writeCommand } from '../../projects/gestures'
export { readLanguage } from '../../projects/preferences'
export { readWhole } from '../../projects/scopeAccess'
export { sealBytes } from '../../projects/sealedFile'
