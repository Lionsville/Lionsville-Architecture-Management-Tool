// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a page reports back to the window it is drawn in: a failure, for the
 * trail and where it has a sentence for the person too, and a change that
 * landed with the step that takes it back.
 */
import type { StringKey } from '../i18n'

/** Report a failure to the trail, and — with a key — to the person as well. */
export type Failed = (where: string, cause: unknown, key?: StringKey) => void

/**
 * A change that landed, and the step that takes it back: drawn by the kit's
 * toast, whose button says Undo with its key, rather than as an offer.
 */
export type ToastUndo = { undo: { onPress: () => void; shortcut?: string } }
