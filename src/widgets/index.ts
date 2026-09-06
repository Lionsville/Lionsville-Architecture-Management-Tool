/**
 * Presentation with no opinions: stroke icons and the one confirm dialog.
 *
 * Below every module that draws, because more than one of them draws the same
 * pencil and asks the same question, and none of them may import another's
 * screens to get it. Nothing here knows what an element is.
 */
export * from './icons'
export { ConfirmDialog } from './ConfirmDialog'
