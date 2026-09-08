/**
 * Which fence names draw as something, and what they are handed (ADR-0009).
 *
 * A ```mermaid fence has been drawn rather than printed since the documentation
 * page existed, and the way that worked was a class name compared in two places
 * inside `MarkdownView` — once to draw the fence and once to stop the `pre`
 * around it becoming a code block. A second kind of block would have been a
 * second pair of those, which is how a renderer acquires a switch statement
 * nobody dares extend.
 *
 * So: one table. A name maps to a component, `blockFor` answers with it, and
 * everything else about a fence stays the renderer's business. Adding a block
 * is adding a row here and writing the component; nothing in `MarkdownView`
 * learns the name.
 *
 * **An unknown name falls through to a code block**, which is both what happens
 * today and the property worth keeping deliberately: a block this build cannot
 * draw must still show its source. A document written against a newer version
 * of this app therefore opens in an older one with its blocks as text, which is
 * the honest degradation and needs no version check to arrange.
 *
 * This lives in `ui/` and not beside the module's pure files, because a
 * registry of React components is React. What each block *computes* is pure and
 * lives one level up — `businessCase.ts` — so it can be tested in node without
 * one of these on screen.
 */
import type { ComponentType } from 'react'
import { BusinessCaseBlock } from './BusinessCaseBlock'
import { MermaidBlock } from './MermaidBlock'
import type { MermaidRenderer } from './MermaidBlock'

/** The prefix `react-markdown` puts on a fence's language. */
const LANGUAGE_PREFIX = 'language-'

/**
 * What a block may be told beyond its own text.
 *
 * Every block is handed the whole context whether it wants it or not, so that
 * adding a seam for one block is not a change to the signature of all of them.
 */
export type BlockContext = {
  /** How a mermaid fence is drawn. A test hands in a fake; see `MermaidBlock`. */
  renderMermaid?: MermaidRenderer
}

export type BlockProps = {
  /** The fence's contents, with the trailing newline the parser leaves removed. */
  code: string
  context: BlockContext
}

export type BlockRenderer = ComponentType<BlockProps>

/**
 * The table. A name here is a name in a document somebody has written, so an
 * entry is only ever added, never renamed.
 *
 * A `Map` rather than an object literal, and not as a matter of taste: the
 * lookup key comes out of a document, and `BLOCKS['constructor']` on a plain
 * object answers with `Object.prototype.constructor` — a function, which the
 * renderer would then mount as a component. A `Map` has no prototype to reach
 * through, so a fence can be called anything at all and still simply not be
 * found.
 */
export const BLOCKS: ReadonlyMap<string, BlockRenderer> = new Map<string, BlockRenderer>([
  ['mermaid', ({ code, context }) => <MermaidBlock code={code} render={context.renderMermaid} />],
  ['business-case', ({ code }) => <BusinessCaseBlock code={code} />],
])

/** The fence name in a `language-…` class, or nothing for inline code. */
export function blockNameOf(className: string | undefined): string | undefined {
  if (!className) return undefined
  return className
    .split(' ')
    .find((name) => name.startsWith(LANGUAGE_PREFIX))
    ?.slice(LANGUAGE_PREFIX.length)
}

/** What draws this fence, if anything does. */
export function blockFor(className: string | undefined): BlockRenderer | undefined {
  const name = blockNameOf(className)
  return name ? BLOCKS.get(name) : undefined
}
