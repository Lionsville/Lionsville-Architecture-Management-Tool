// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: fillings that keep work nowhere.
 *
 * The repositories and the command channel in memory, and a folder that is
 * not on a disk: what a suite runs a contract over beside its own filling.
 * For a suite, never for a build.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { FakeDirectory } from '../../adapters/folder/fakeDirectory'
export { folderRepositories } from '../../adapters/folder/folderRepositories'
export { memoryGit } from '../../adapters/folder/memoryGit'
export { InMemoryCommandChannel } from '../../adapters/memory/InMemoryCommandChannel'
export { memoryRepositories } from '../../adapters/memory/memoryRepositories'
