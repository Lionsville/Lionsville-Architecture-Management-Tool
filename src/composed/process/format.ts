// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the folder's format.
 *
 * A scope as files, the files' names, the working file's manifest and the
 * interchange: what a process that keeps a folder runs as a library. The one
 * part of the implementations the surface offers (ADR-0031 §4).
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { DECISIONS_FOLDER } from '../../adapters/folder/format/adrFile'
export { IMAGES_FOLDER, SCOPE_FOLDERS, isBinaryPath, isFormatPath, scopeFiles } from '../../adapters/folder/format/folderFormat'
export type { FolderFile } from '../../adapters/folder/format/folderFormat'
export { PICTURES, drawingPictureFile, imageNameOfFile, namesInDocuments, pictureFileOf } from '../../adapters/folder/format/imageLibrary'
export { bringIn, carryScopes, open } from '../../adapters/folder/format/interchange'
export { openScopeFolder } from '../../adapters/folder/format/migrate4to5'
export { OBSERVATIONS_FOLDER, OBSERVATION_SUBFOLDERS } from '../../adapters/folder/format/observationFile'
export { SCOPE_FILE, SCOPE_FORMAT_VERSION } from '../../adapters/folder/format/scopeHeader'
export { MANIFEST_TYPE, compareManifests, manifestOf } from '../../adapters/folder/format/workingFileManifest'
export type { ManifestScope, WorkingFileManifest } from '../../adapters/folder/format/workingFileManifest'
