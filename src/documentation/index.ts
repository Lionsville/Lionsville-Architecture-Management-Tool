/**
 * Descriptions as documents: the outline, the element links inside them, and
 * the pages that render them.
 */
export { linkElementRefs, outline, stripInline } from './documentation'
export type { MarkdownRenderOptions, OutlineEntry } from './documentation'
/** Pictures a document holds, and how it refers to them (ADR-0009). */
export { IMAGES_FOLDER, documentsUsing, imageReference, imageSrcFile, imagesUsedIn } from './images'
export type { NamedDocument } from './images'
/** The business case a document computes, and the block it is written in (ADR-0009). */
export {
  businessCaseTemplate, computeBusinessCase, internalRateOfReturn, netPresentValue, readAmount,
  readBusinessCase, SCORE_SCALE,
} from './businessCase'
export type { BusinessCase, BusinessCaseResult, CashLine, Criterion } from './businessCase'
