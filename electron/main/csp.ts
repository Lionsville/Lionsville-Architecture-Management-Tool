// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The renderer's budget, assembled — and the one part of it a build composed
 * from this one has a say in.
 *
 * The header used to be a constant in `index.ts`, which is right up to the
 * moment somewhere else is where the work is kept. A page served
 * `connect-src 'self' data: blob:` cannot reach a registered source at all, and
 * what it does instead of saying so is fail every request quietly and blame the
 * network. Widening the policy for everybody is the other wrong answer: the
 * header is ADR-0007's sandbox written down, and a shell that may reach anywhere
 * has stopped being one.
 *
 * So a desktop hook names the origins its own source needs
 * (`platform/desktopHook.ts`) and they are folded in here, at the point the
 * header is built. This build registers no hook, so `contentSecurityPolicy()`
 * over an empty list is exactly the header this app has always sent — which is
 * what the suite beside this file pins first.
 *
 * Its own file because it is arithmetic: a list of names in, one string out,
 * with no Electron and no `net.fetch` around it. What a hook may widen and what
 * it may not is then a test rather than a smoke run.
 */
import type { HookOrigin } from '../../src/platform/desktopHook'

/**
 * What an origin looks like, and the whole of what is accepted as one.
 *
 * Scheme, host, at most a port — the unit a CSP source list is written in.
 * Nothing else passes: no path (a CSP would keep the origin and drop the path,
 * so a hook naming one is a hook that thinks it has narrowed something), no
 * wildcard, no comma, no space, no quote, no `;`. That last group is why this is
 * a check and not a trim — a hook is somebody else's code, and one string
 * reaching this header unchecked is `default-src *` in a build nobody audited.
 *
 * A host is spelled out rather than parsed with `URL`, which accepts far more
 * than a source list may hold and normalises some of it silently.
 */
const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/i

/** Is this a thing the page may be allowed to reach, spelled the way it must be? */
export function isPageOrigin(value: unknown): value is string {
  return typeof value === 'string' && ORIGIN.test(value)
}

/**
 * The origins that may be folded in, deduplicated and in the order the hooks
 * named them, with what each of them is for.
 *
 * Exported for the header below and for the caller that wants to log what it
 * dropped: a hook whose origin is refused has a page that cannot reach it, and
 * finding that out from a log line beats finding it out from a request that
 * failed for no stated reason.
 */
export function pageOrigins(named: readonly HookOrigin[]): {
  readonly data: readonly string[]
  readonly pictures: readonly string[]
  readonly refused: readonly string[]
} {
  const data: string[] = []
  const pictures: string[] = []
  const refused: string[] = []
  for (const entry of named) {
    if (!isPageOrigin(entry?.origin)) {
      refused.push(String(entry?.origin))
      continue
    }
    if (!data.includes(entry.origin)) data.push(entry.origin)
    if (entry.pictures && !pictures.includes(entry.origin)) pictures.push(entry.origin)
  }
  return { data, pictures, refused }
}

/**
 * The renderer's own budget.
 *
 * `'wasm-unsafe-eval'` is the libavoid router: compiling WebAssembly is barred by
 * a plain `script-src 'self'`, and without it the editor silently draws straight
 * lines. `'unsafe-inline'` for styles is Emotion, which injects the MUI theme as
 * style tags — MUI cannot run without it. `blob:` covers the module worker and
 * the PNG export; `connect-src` needs `data:`/`blob:` for the same two.
 *
 * A hook's origins reach `connect-src`, which is the directive that is about
 * where the page may ASK something, and `img-src` only where that hook said
 * pictures load from there. Nothing reaches `script-src`, `style-src`,
 * `worker-src` or `frame-src`, and there is no seam that would let it: code from
 * somewhere else running in this window is not a source of work, it is a second
 * app, and `object-src 'none'` and `base-uri 'none'` stay absolute for the same
 * reason.
 */
export function contentSecurityPolicy(named: readonly HookOrigin[] = []): string {
  const { data, pictures } = pageOrigins(named)
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data: blob:", ...pictures].join(' '),
    "font-src 'self' data:",
    ["connect-src 'self' data: blob:", ...data].join(' '),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}
