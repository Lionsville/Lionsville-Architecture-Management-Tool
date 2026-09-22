// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Grid spacing shared by the background dots and the snap grid, so the visual
 * and the snap agree (U4a). Also the default copy/paste offset. Its own module
 * so the menu dispatcher and the keymap can read it without importing the
 * canvas component they are part of.
 */
export const GRID_SIZE = 26;
