/**
 * What the app runs inside, and what a failure looks like.
 *
 * The four things every layer may need and none of them owns: a refusal that
 * carries a key rather than a sentence, the shape of a diagnostic and its trail,
 * what the desktop log is called, and how much of the top bar belongs to the
 * window. Pure, and the one module the electron main process shares with the
 * renderer.
 */
export * from './errors'
export * from './diagnostics'
export * from './logFile'
export * from './windowChrome'
