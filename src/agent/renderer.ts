/**
 * What only the renderer can do (ADR-0007), as the handler asks for it.
 *
 * Four things: show a diagram, lay it out, route it, and hand over the board
 * as pixels — plus pointing at an element so the person sees which one the
 * agent means. The handler declares this narrow shape and the workspace fills
 * it over the editor's handle; nothing here knows React Flow, which is what
 * keeps `agent/` testable in node with a plain object in this slot.
 *
 * Every refusal the renderer can make is a {@link RendererRefused} with a
 * reason, so the handler can turn it into the key the agent reads.
 */
import type { Rect } from '../model/types'

export type RendererRefusal =
  /** The window is hidden or minimised; nothing can be drawn. */
  | 'hidden'
  /** A layout pass is already running. */
  | 'busy'
  /** The board went away mid-request: a diagram switched, a project closed. */
  | 'gone'

export class RendererRefused extends Error {
  constructor(readonly reason: RendererRefusal) {
    super(reason)
    this.name = 'RendererRefused'
  }
}

export function isRendererRefusal(error: unknown): error is RendererRefused {
  return error instanceof RendererRefused
}

export type CaptureOptions = {
  /** The flow-coordinate region to capture. */
  readonly bounds: Rect
  /** Image pixels per flow pixel. */
  readonly pixelRatio: number
  /** Around the bounds, in flow pixels. */
  readonly padding: number
}

export type RendererView = {
  /** Put this diagram on screen and resolve once the editor has drawn it and settled. */
  show(diagramId: string): Promise<void>
  /** Lay the diagram on screen out, as the Tidy button does. Rejects with the layout's own refusal. */
  tidy(): Promise<void>
  /** Route the lines around the cards, as the Route button does. */
  route(): Promise<void>
  /** The board as a PNG. */
  capture(options: CaptureOptions): Promise<Uint8Array>
  /** Select an element and bring it into view, so the person sees which one is meant. */
  focus(elementId: string): void
}

// --- bytes as text, for an image block ------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Base64, by hand. `btoa` wants a binary string and `Buffer` is Node's; this
 * module runs in both and reaches for neither.
 */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let n = 0; n < bytes.length; n += 3) {
    const a = bytes[n]
    const b = n + 1 < bytes.length ? bytes[n + 1] : undefined
    const c = n + 2 < bytes.length ? bytes[n + 2] : undefined
    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : ALPHABET[c & 63]
  }
  return out
}
