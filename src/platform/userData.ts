/**
 * Where the desktop keeps a person's own things — and why that folder is not
 * named after the product.
 *
 * Electron derives `userData` from `app.getName()`, which is the bundle's
 * `productName`. Rename the product and the folder moves: every install's
 * preferences, its remembered working folder, its recent list, its update
 * settings and the agent server's kept port and token stay on disk under the
 * old name while the new build looks for them under the new one. Nothing
 * fails loudly. A person is simply asked to choose a working folder again, is
 * offered no recents, and hands an agent a token nobody kept.
 *
 * So the address is frozen here, at the name the product carried when those
 * folders were created, and `electron/main/index.ts` pins `userData` to it
 * before anything reads a path. The name on screen moves freely above it
 * (`PRODUCT_NAME` in `windowTitle.ts`, `productName` in `package.json`); this
 * string addresses a directory and is never shown to anybody.
 *
 * **Do not change this value** — not to match a rename, not for tidiness. The
 * only thing that would justify moving the folder is a migration that carries
 * its contents over, and that is a decision record rather than an edit here.
 */
export const USER_DATA_NAME = 'Lionsville Architecture Management Tool'
