/**
 * Architecture decision records: what one is, where it may go next, who signed
 * it, and the page that reads them.
 *
 * Three lists, one shape. A group's records live on its profile; a landscape's
 * and every application's live on the model, told apart by `applicationId`.
 * The status is a state machine and its three end states lock the record —
 * `updateAdr` and `removeAdr` refuse them.
 */
export * from './adr'
export * from './adrScope'
export { AdrPage } from './ui/AdrPage'
