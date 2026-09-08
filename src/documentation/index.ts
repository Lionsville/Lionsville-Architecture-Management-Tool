/**
 * Descriptions as documents: the outline, the element links inside them, and
 * the pages that render them.
 */
export { linkElementRefs, outline, stripInline } from './documentation'
export type { MarkdownRenderOptions, OutlineEntry } from './documentation'
/** Pictures a document holds, and how it refers to them (ADR-0009). */
export { IMAGES_FOLDER, imageReference, imageSrcFile, imagesUsedIn } from './images'
