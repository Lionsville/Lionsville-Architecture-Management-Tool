// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The text scale on the root (`textScale`), followed as a person changes it: for
 * a width worked out in a script, and for a canvas that frames itself again
 * when everything on it has grown or shrunk.
 */
import { useEffect, useState } from 'react'
import { textScale } from './tokens'

export function useTextScale(): number {
  const [scale, setScale] = useState(textScale)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined
    const watch = new MutationObserver(() => setScale(textScale()))
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-text-size'] })
    return () => watch.disconnect()
  }, [])
  return scale
}
