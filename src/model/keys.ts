/**
 * Interchange keys: lowercase letters, digits and dashes, unique across the
 * document. Shared by the aliasing step in the shell (which gives new elements a
 * permanent key on the first flush) and by the interchange export.
 */
export const KEY_RE = /^[a-z0-9-]+$/

export function slug(name: string): string {
  const s = String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'element'
}

/** A free key derived from the name, unique against `taken`. */
export function claimKey(name: string, taken: Set<string>): string {
  let key = slug(name)
  if (taken.has(key)) {
    let n = 2
    while (taken.has(`${key}-${n}`)) n++
    key = `${key}-${n}`
  }
  taken.add(key)
  return key
}
