// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A CycloneDX bill of materials for what a release ships, from npm's own.
 *
 * `npm sbom --omit dev` is the obvious command and describes nothing here:
 * everything the app ships is bundled, so every package is a dev dependency
 * and `dependencies` is empty on purpose (`electron-builder.cjs`). npm's
 * document of the whole tree, on the other hand, names the compilers, the test
 * runner and the installer builder as if they shipped. So npm writes the
 * document — its format, its purls, its hashes from the lockfile — and this
 * keeps the components that are in what ships: the same closure the notices
 * are made from (`thirdPartyNotices.ts`, `Part`), and the dependency graph
 * between those.
 *
 * A part with `production` is taken as npm describes it without the dev tree —
 * a program that installs its `dependencies` beside itself ships exactly those.
 * Several parts, from several installs, are one document.
 *
 *   node build/sbom.ts <out.cdx.json> <part>...
 *
 * where a part is `<install>=<source>,<source>` (bundled from that install) or
 * `<install>=production`, each relative to the working directory.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { partClosure, type Part } from './thirdPartyNotices.ts'

export type Component = { 'bom-ref': string; name: string; version?: string; [key: string]: unknown }
export type Bom = {
  bomFormat: string
  specVersion: string
  metadata?: { component?: Component; [key: string]: unknown }
  components?: Component[]
  dependencies?: { ref: string; dependsOn?: string[] }[]
  [key: string]: unknown
}

/** A document with only these packages in it, and the graph between them. */
export function keepOnly(bom: Bom, names: ReadonlySet<string>): Bom {
  const components = (bom.components ?? []).filter((component) => names.has(component.name))
  const refs = new Set(components.map((component) => component['bom-ref']))
  const root = bom.metadata?.component?.['bom-ref']
  if (root) refs.add(root)
  const dependencies = (bom.dependencies ?? [])
    .filter((edge) => refs.has(edge.ref))
    .map((edge) => ({ ...edge, dependsOn: (edge.dependsOn ?? []).filter((ref) => refs.has(ref)) }))
  return { ...bom, components, dependencies }
}

/** Several documents as one: the first one's metadata, every component once. */
export function merge(boms: readonly Bom[]): Bom {
  const [first] = boms
  const components = new Map<string, Component>()
  const edges = new Map<string, Set<string>>()
  for (const bom of boms) {
    for (const component of bom.components ?? []) components.set(component['bom-ref'], component)
    for (const edge of bom.dependencies ?? []) {
      const to = edges.get(edge.ref) ?? new Set<string>()
      for (const ref of edge.dependsOn ?? []) to.add(ref)
      edges.set(edge.ref, to)
    }
  }
  return {
    ...first,
    components: [...components.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'])),
    dependencies: [...edges].map(([ref, to]) => ({ ref, dependsOn: [...to].sort() })),
  }
}

/** Reads `<install>=production` or `<install>=<source>,<source>`. */
export function parsePart(text: string): Part {
  const [install, what] = text.split('=')
  if (!install || !what) throw new Error(`a part is <install>=production or <install>=<source>,…; got "${text}"`)
  return what === 'production' ? { install, production: true } : { install, sources: what.split(',') }
}

function npmSbom(install: string, production: boolean): Bom {
  // From the lockfile, so the answer is the one `npm ci` installs, and not
  // whatever else a working tree has accumulated in node_modules.
  const args = ['sbom', '--sbom-format', 'cyclonedx', '--package-lock-only', ...(production ? ['--omit', 'dev'] : [])]
  return JSON.parse(execFileSync('npm', args, { cwd: install, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32' })) as Bom
}

/**
 * The document for the product at `root`. npm names the subject after the folder
 * it ran in, which on a runner is the checkout's; the product's own name and
 * version are what a reader looks the document up by, so those are written in.
 */
export function sbomOf(root: string, parts: readonly Part[]): Bom {
  const bom = merge(parts.map((part) => {
    const install = join(root, part.install)
    if (part.production && !part.sources) return npmSbom(install, true)
    return keepOnly(npmSbom(install, false), new Set(partClosure(root, part).all))
  }))
  const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string; version?: string }
  const subject = bom.metadata?.component
  return subject ? { ...bom, metadata: { ...bom.metadata, component: { ...subject, name: name ?? subject.name, version: version ?? subject.version } } } : bom
}

// `node build/sbom.ts <out.cdx.json> <part>...`
if (process.argv[1]?.endsWith('sbom.ts')) {
  const [target, ...parts] = process.argv.slice(2)
  if (!target || parts.length === 0) {
    console.error('usage: node build/sbom.ts <out.cdx.json> <install>=production|<source>,<source> ...')
    process.exit(2)
  }
  const bom = sbomOf(process.cwd(), parts.map(parsePart))
  writeFileSync(target, `${JSON.stringify(bom, null, 2)}\n`)
  console.log(`sbom: ${target}, ${bom.components?.length ?? 0} components`)
}
