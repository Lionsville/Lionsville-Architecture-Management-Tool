/**
 * Where things end up on the canvas: tidy, ELK, and the libavoid router.
 * Pure — it computes geometry and draws nothing.
 */

/** Where the app publishes `libavoid.wasm`; call once before the editor routes. */
export { configureLibavoidWasm } from './libavoidRouter'
/**
 * Hand the router a factory for its worker, so routing runs off the main
 * thread. Constructing a worker is bundler-specific, so the composition owns
 * the `new Worker(...)` — without a factory everything routes in-process.
 */
export { configureLibavoidWorker, terminateLibavoidWorker } from './libavoidRouter'

/**
 * The same arrangement for the placement engine. ELK's layered algorithm is
 * synchronous and its cost grows steeply with the board, so on the main thread
 * a Tidy of three hundred boxes is five seconds of frozen window; beside it,
 * it is five seconds somebody can watch and cancel.
 */
export { configureElkWorker, cancelElkLayout, canCancelElkLayout } from './elkLayout'
/** What a Tidy answers when it will not lay a board out, and how big is too big. */
export { isLayoutRefusal, LayoutRefused, MAX_TIDY_NODES } from './elkLayout'
export type { LayoutRefusal } from './elkLayout'
