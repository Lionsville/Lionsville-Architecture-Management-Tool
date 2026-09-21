/**
 * The header, assembled.
 *
 * Two promises, and the second is the reason this is a test and not a smoke run.
 * With no hook registered — every build in this repository — the header is
 * character for character the one this app has always sent, so the seam costs
 * the shipped policy nothing. And a hook may widen exactly two directives by
 * exactly what an origin is: everything else about somebody else's string is
 * dropped, because a hook is code this tree never saw and one unchecked string
 * here is the sandbox gone.
 */
import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, isPageOrigin, pageOrigins } from './csp'

/** The policy split into what each directive allows, which is how it is read. */
function directives(header: string): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const part of header.split('; ')) {
    const [name, ...sources] = part.split(' ')
    found[name] = sources
  }
  return found
}

describe('contentSecurityPolicy', () => {
  it('sends what it always sent where no hook names anywhere', () => {
    const expected = [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')
    expect(contentSecurityPolicy()).toBe(expected)
    expect(contentSecurityPolicy([])).toBe(expected)
  })

  it('lets the page reach an origin a hook named, and no more than ask it', () => {
    const header = directives(contentSecurityPolicy([{ origin: 'https://work.example' }]))
    expect(header['connect-src']).toEqual(["'self'", 'data:', 'blob:', 'https://work.example'])
    // Asking somewhere is not loading a picture from there, and is nowhere near
    // running its code in this window.
    expect(header['img-src']).toEqual(["'self'", 'data:', 'blob:'])
    expect(header['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"])
    expect(header['default-src']).toEqual(["'self'"])
    expect(header['worker-src']).toEqual(["'self'", 'blob:'])
  })

  it('names it in img-src as well where that hook said pictures load from there', () => {
    const header = directives(contentSecurityPolicy([
      { origin: 'https://pictures.example', pictures: true },
    ]))
    expect(header['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https://pictures.example'])
    expect(header['connect-src']).toContain('https://pictures.example')
  })

  it('names an origin once, whichever hooks asked for it', () => {
    const header = directives(contentSecurityPolicy([
      { origin: 'https://work.example' },
      { origin: 'https://work.example', pictures: true },
      { origin: 'https://work.example:8443' },
    ]))
    expect(header['connect-src'])
      .toEqual(["'self'", 'data:', 'blob:', 'https://work.example', 'https://work.example:8443'])
    expect(header['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https://work.example'])
  })

  /**
   * The check that matters. A hook is somebody else's code, and every string
   * below would widen the policy far past what was asked for if it were folded
   * in as written — `*` most of all, and a `;` would add a directive of its own.
   */
  it('drops anything that is not an origin, and says which', () => {
    const named = [
      { origin: '*' },
      { origin: 'https://*.example' },
      { origin: 'https://work.example/scopes' },
      { origin: "https://work.example'; script-src *" },
      { origin: 'https://work.example https://other.example' },
      { origin: 'work.example' },
      { origin: '' },
      { origin: undefined as unknown as string },
      { origin: 'https://work.example' },
    ]
    const { data, refused } = pageOrigins(named)
    expect(data).toEqual(['https://work.example'])
    expect(refused).toHaveLength(8)
    const header = directives(contentSecurityPolicy(named))
    expect(header['connect-src']).toEqual(["'self'", 'data:', 'blob:', 'https://work.example'])
    // The one thing a `;` must not have done: added a directive.
    expect(Object.keys(header)).toHaveLength(10)
  })
})

describe('isPageOrigin', () => {
  it('takes a scheme, a host and at most a port', () => {
    expect(isPageOrigin('https://work.example')).toBe(true)
    expect(isPageOrigin('https://work.example:8443')).toBe(true)
    expect(isPageOrigin('https://a-host.sub.work.example')).toBe(true)
    expect(isPageOrigin('app://local')).toBe(true)
  })

  it('takes nothing with a path, a wildcard, a space or a quote in it', () => {
    expect(isPageOrigin('https://work.example/')).toBe(false)
    expect(isPageOrigin('https://work.example:')).toBe(false)
    expect(isPageOrigin('//work.example')).toBe(false)
    expect(isPageOrigin("'self'")).toBe(false)
    expect(isPageOrigin('data:')).toBe(false)
    expect(isPageOrigin(42)).toBe(false)
  })
})
