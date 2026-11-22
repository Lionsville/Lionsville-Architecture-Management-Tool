// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the desktop's main process.
 *
 * What a build composed from this one may ask of the main process, and what
 * the desktop's own folder is called. Loaded in main, so it is apart from
 * everything a page loads.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { hookOrigins, registerDesktopHook } from '../../platform/desktopHook'
export type { ChannelHost, DesktopHook, DesktopSide, HookInvoke, HookOrigin, SecretStore } from '../../platform/desktopHook'
export { USER_DATA_NAME } from '../../platform/userData'
