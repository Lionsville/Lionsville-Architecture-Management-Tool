/**
 * What a project is, where it is filed, and what the app remembers between
 * sessions. A project is addressed by a `ProjectRef` — a group path and a key
 * inside it — and a group is derived from the projects filed under it, because
 * there is nowhere to keep an empty one.
 */
export * from './project'
export * from './projectRef'
export * from './group'
export * from './preferences'
export * from './documentSession'
export * from './fileText'
export * from './adrFile'
export * from './folderFormat'
export * from './workingFile'
export * from './migration'
