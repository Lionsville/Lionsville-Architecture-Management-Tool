// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The fields column: wide enough for three dates in a row, and no wider than
 * leaves the document readable beside it. Its own module, because the editor
 * keeps the width from the first download and the page arrives when it opens.
 */
export const FIELDS_COLUMN = { default: 340, min: 280, max: 720 } as const;
