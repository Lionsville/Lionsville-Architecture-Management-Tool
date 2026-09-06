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
