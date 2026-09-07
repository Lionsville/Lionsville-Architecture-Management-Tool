/**
 * The README's Download section, pointed at one release.
 *
 * Its three links go straight to the installers rather than to the release
 * page, and an installer's name carries its version — so every stable release
 * would leave the README one version behind. The release workflow runs this
 * once the three builds have succeeded (`readme` in `release.yml`), on `main`,
 * and commits what changed. A beta never reaches here: the links point at
 * stable releases only, and a beta install is told about them by the app.
 *
 * Kept as one pure function over the text so the rewrite is tested against
 * the README as it is, and so a hand edit that breaks the pattern is caught by
 * the test rather than by a release that silently changed nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * The version inside an installer's name. Stable only — a prerelease suffix
 * would be indistinguishable from the `-mac-arm64` that follows it, and the
 * README never links a beta anyway.
 */
const STABLE = String.raw`\d+\.\d+\.\d+`

/** The README with every download link and the version line moved to `version`. */
export function withDownloadLinks(readme: string, version: string): string {
  if (!new RegExp(`^${STABLE}$`).test(version)) throw new Error(`'${version}' is not a stable version`)
  return readme
    .replace(
      new RegExp(`/releases/download/v${STABLE}/lionsville-architecture-management-tool-${STABLE}-`, 'g'),
      `/releases/download/v${version}/lionsville-architecture-management-tool-${version}-`,
    )
    .replace(new RegExp(`<sub>Version ${STABLE} `, 'g'), `<sub>Version ${version} `)
}

/** Every version the README's download links currently name, without duplicates. */
export function linkedVersions(readme: string): string[] {
  const found = new Set<string>()
  for (const m of readme.matchAll(new RegExp(`/releases/download/v(${STABLE})/`, 'g'))) found.add(m[1])
  return [...found]
}

// `node build/readmeDownloads.ts <version> [README.md]`, from the repository root.
if (process.argv[1]?.endsWith('readmeDownloads.ts')) {
  const [version, path = 'README.md'] = process.argv.slice(2)
  if (!version) {
    console.error('usage: node build/readmeDownloads.ts <version> [README.md]')
    process.exit(2)
  }
  const before = readFileSync(path, 'utf8')
  const after = withDownloadLinks(before, version)
  if (after === before) {
    console.log(`${path} already points at ${version}`)
  } else {
    writeFileSync(path, after)
    console.log(`${path}: ${linkedVersions(before).join(', ')} → ${version}`)
  }
}
