/**
 * `./tools` means `./tools.ts`, for a node that is reading this tree directly.
 *
 *   node --experimental-strip-types --import ./scripts/tsSpecifiers.mjs …
 *
 * Every import in `src/` names its neighbour without an extension, because a
 * bundler resolves it and writing `.ts` in the source of a module that ships as
 * `.js` is a lie about what is there. Node's own resolver does not guess: in an
 * ES module a specifier is a URL, so `./tools` is a file that does not exist.
 *
 * That is the one thing between a node process and this tree's source. So it is
 * a hook, twenty lines, rather than an extension on some thousands of import
 * lines: ask node first, and on a miss ask again for `<specifier>.ts` and then
 * for `<specifier>/index.ts` — the two spellings a bundler would have tried.
 * Nothing else is touched, so a bare package name and anything that does
 * resolve behave exactly as they would without it.
 *
 * `registerHooks` rather than `register`, so this runs on the main thread and
 * one `--import` is the whole story: no loader thread, nothing to await, and a
 * failure to resolve that still says which specifier and which importer.
 *
 * Used by `src/agent/pure.test.ts` to prove the agent module loads from source
 * in a plain node process, and available to any process that wants to do the
 * same.
 */
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.')) return nextResolve(specifier, context)
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      for (const spelling of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(spelling, context)
        } catch {
          // The next spelling, or the original error: a specifier that resolves
          // to nothing is the importer's problem, not this hook's.
        }
      }
      throw error
    }
  },
})
