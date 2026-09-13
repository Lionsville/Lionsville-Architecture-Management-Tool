/**
 * THIRD-PARTY-NOTICES.md: every library that ships inside the app, and its
 * licence text verbatim.
 *
 * Almost every licence here — MIT, ISC, BSD, Apache, MPL — asks for exactly one
 * thing in return: that its copyright and permission notice travels with the
 * binary. Nothing in the packaged app said any of it, because everything is
 * bundled by Vite and `dependencies` is deliberately empty (see
 * `electron-builder.cjs`), so there was no `node_modules` in the asar for a
 * reader to find the texts in either.
 *
 * The list is derived rather than maintained: the bare specifiers imported by
 * the shipped source, closed over each package's own `dependencies`. That is a
 * slight over-approximation — a dependency the bundler tree-shakes away is
 * still named here — and that is the safe direction to be wrong in.
 *
 * Deriving it from `node_modules` rather than from the built bundle is what
 * makes it testable in node and runnable without a build; `thirdPartyNotices.test.ts`
 * regenerates the file and fails when what is committed no longer matches, so
 * adding a dependency and forgetting the notices is a red `npm run check`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** What `renderNotices` needs to say about one package. */
export interface PackageNotice {
  name: string
  version: string
  /** The SPDX expression the package declares, or `undefined` when it declares none. */
  license?: string
  /** The text of its LICENSE/COPYING file, when it ships one. */
  text?: string
  /** Where to read the original, for a package that ships no licence file. */
  homepage?: string
}

/** The part of a package.json this file reads. */
export interface Manifest {
  version?: string
  license?: string | { type?: string }
  licenses?: { type?: string }[]
  dependencies?: Record<string, string>
  homepage?: string
  repository?: string | { url?: string }
}

/** Source that is compiled into the app: not a test, not a test helper. */
export function isShipped(path: string): boolean {
  return !/\.test\.tsx?$/.test(path) && !/\.contract\.ts$/.test(path) && !path.includes('/testing/')
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

/**
 * The packages named by these sources. A bare specifier only: a relative path
 * is our own code, `node:` and `electron` are the host, and a query suffix is
 * Vite's (`?worker`, `?url`).
 */
export function packagesImportedBy(sources: string[]): string[] {
  const found = new Set<string>()
  for (const source of sources) {
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      const bare = specifier.split('?')[0]
      if (!bare || bare.startsWith('.') || bare.startsWith('/')) continue
      if (bare.startsWith('node:') || bare === 'electron') continue
      const parts = bare.split('/')
      found.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0])
    }
  }
  return [...found].sort()
}

/**
 * A `@types/…` package is declarations and nothing else: no line of it reaches
 * the bundle, so it is not in the app and does not belong in its notices.
 */
export function shipsCode(name: string): boolean {
  return !name.startsWith('@types/')
}

/**
 * The seeds and everything they depend on, transitively. `read` returning
 * undefined means the package is not installed — a `node:` builtin that slipped
 * through, or an optional dependency — and it is left out rather than thrown
 * over, because a missing optional is not a licence problem.
 */
export function dependencyClosure(seeds: string[], read: (name: string) => Manifest | undefined): string[] {
  const seen = new Set<string>()
  const queue = [...seeds]
  while (queue.length > 0) {
    const name = queue.shift() as string
    if (seen.has(name) || !shipsCode(name)) continue
    const manifest = read(name)
    if (!manifest) continue
    seen.add(name)
    queue.push(...Object.keys(manifest.dependencies ?? {}))
  }
  return [...seen].sort()
}

/** The SPDX expression a manifest declares, in any of the three shapes npm has used. */
export function licenseOf(manifest: Manifest): string | undefined {
  if (typeof manifest.license === 'string') return manifest.license
  if (manifest.license?.type) return manifest.license.type
  const old = manifest.licenses?.map((l) => l.type).filter(Boolean)
  return old && old.length > 0 ? old.join(' OR ') : undefined
}

/** Where a reader can find the original, for a package whose own text is missing. */
export function homepageOf(manifest: Manifest): string | undefined {
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  return manifest.homepage ?? repository?.replace(/^git\+/, '').replace(/\.git$/, '')
}

const HEADING = 'Third-party notices'

/**
 * The document. Every package gets its own section with the licence text as it
 * ships — not a canonical copy of MIT, because the copyright lines differ and
 * those are the part the licence actually asks for.
 */
export function renderNotices(notices: PackageNotice[], productName: string): string {
  const lines = [
    `# ${HEADING}`,
    '',
    `${productName} is distributed with the open-source libraries below, each under its`,
    'own licence, reproduced here as it ships.',
    '',
    'The list is generated by `build/thirdPartyNotices.ts`: it is what the app is',
    'built from — every package the shipped source imports, and everything those',
    'depend on in turn. A library the bundler ends up dropping is still named here,',
    'which is the safe direction for a notice to be wrong in.',
    '',
    `${notices.length} packages:`,
    '',
    ...notices.map((n) => `- ${n.name} ${n.version} — ${n.license ?? 'licence not declared'}`),
    '',
  ]
  for (const notice of notices) {
    lines.push(
      '---',
      '',
      `## ${notice.name} ${notice.version}`,
      '',
      `Licence: ${notice.license ?? (notice.text ? 'not declared; see the text below' : 'not declared')}`,
      '',
    )
    if (notice.text) {
      // A licence file may itself be markdown with a fenced block in it (elkjs
      // ships one), so the fence has to be longer than anything inside the text.
      const text = notice.text.replace(/\r\n/g, '\n').trimEnd()
      const longest = Math.max(2, ...[...text.matchAll(/^`{3,}/gm)].map((m) => m[0].length))
      const fence = '`'.repeat(longest + 1)
      lines.push(fence, text, fence, '')
    } else {
      lines.push(
        `This package ships no licence file. Its licence as declared is above; the`,
        `original text is published at ${notice.homepage ?? 'its own repository'}.`,
        '',
      )
    }
  }
  return lines.join('\n')
}

/** The licence-ish file a package ships, if it ships one. */
function licenseTextIn(directory: string): string | undefined {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return undefined
  }
  const file = entries.find((e) => /^(licen[cs]e|copying)/i.test(e))
  if (!file) return undefined
  try {
    return readFileSync(join(directory, file), 'utf8')
  } catch {
    return undefined
  }
}

/** Every `.ts`/`.tsx` file under a directory. */
function sourceFilesIn(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) sourceFilesIn(path, found)
    else if (/\.tsx?$/.test(entry.name)) found.push(path)
  }
  return found
}

/**
 * The notices for one checkout. `modules` is a node_modules directory; npm
 * hoists, so a package is looked for there and a nested copy of a second
 * version is not listed separately.
 */
export function noticesFor(root: string, sourceRoots = ['src', 'electron']): PackageNotice[] {
  const modules = join(root, 'node_modules')
  const read = (name: string): Manifest | undefined => {
    try {
      return JSON.parse(readFileSync(join(modules, name, 'package.json'), 'utf8')) as Manifest
    } catch {
      return undefined
    }
  }
  const sources = sourceRoots
    .flatMap((dir) => sourceFilesIn(join(root, dir)))
    .filter((path) => isShipped(path.replaceAll('\\', '/')))
    .map((path) => readFileSync(path, 'utf8'))
  const names = dependencyClosure(packagesImportedBy(sources), read)
  return names.map((name) => {
    const manifest = read(name) as Manifest
    return {
      name,
      version: manifest.version ?? '',
      license: licenseOf(manifest),
      text: licenseTextIn(join(modules, name)),
      homepage: homepageOf(manifest),
    }
  })
}

// `node build/thirdPartyNotices.ts [--check]`, from the repository root.
if (process.argv[1]?.endsWith('thirdPartyNotices.ts')) {
  const target = 'THIRD-PARTY-NOTICES.md'
  const product = 'The Lionsville Architecture Management Tool'
  const generated = renderNotices(noticesFor(process.cwd()), product)
  if (process.argv.includes('--check')) {
    const current = readFileSync(target, 'utf8')
    if (current !== generated) {
      console.error(`${target} is out of date; run: node build/thirdPartyNotices.ts`)
      process.exit(1)
    }
    console.log(`${target} is up to date`)
  } else {
    writeFileSync(target, generated)
    console.log(`${target}: ${noticesFor(process.cwd()).length} packages`)
  }
}
