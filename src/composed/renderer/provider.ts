// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: registering a source.
 *
 * The composition root's side of a source provider (ADR-0022): registering
 * one, what it is handed, and the channel to the desktop's hook.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export {
  desktopHookChannel, registerSourceProvider, registeredMenus, sourceChip, sourceChipFace, sourceChipPanel, sourceDescription,
} from '../../app/composition'
export type { RegisteredSourceProvider, SourceBase, SourceParts } from '../../app/composition'
