// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a picker offers for a working file: a zip now, and the JSON documents
 * of versions 1 and 2, which still open.
 *
 * A file of its own, apart from the codec, so the composition can hand the
 * app what a picker offers at once and load the codec only when a file is
 * written or read (`interchange.ts`).
 */
export const WORKING_FILE_ACCEPTS = '.lvarch,.json,application/json,application/zip'
