/**
 * What a project is, where it is filed, and what the app remembers between
 * sessions. A project is addressed by a `ScopePath` — the folder it is in,
 * from the root of the tree (ADR-0012 §1) — and a group is derived from the
 * projects filed under it, because there is nowhere to keep an empty one.
 */
export * from './scope'
export * from './scopePath'
export * from './scopeLabel'
export * from './preferences'
export * from './documentSession'
export * from './fileText'
export * from './adrFile'
export * from './folderFormat'
export * from './workingFile'
export * from './migrate3to4'
export * from './migrate4to5'
export * from './migration'
export * from './commitMessage'
export * from './historyPath'
export * from './folderSettings'
