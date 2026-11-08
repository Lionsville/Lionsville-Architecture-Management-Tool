// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n/strings'
import { homeMeta } from './ScopeHome'

describe('the line under a home\'s name', () => {
  it('keeps the moment it last changed on one line with its label, in every language', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const root = { path: '', name: 'Acme', children: [] }
      const line = homeMeta(root as never, root as never, '', '2026-11-08T03:25:00Z', language, translator(language))
      // From the label's first word to the date's end, nothing breaks: not "Zuletzt / geändert".
      const said = line.slice(line.search(/Last|Laatst|Zuletzt/))
      expect(said).toMatch(/^(Last\u00a0changed|Laatst\u00a0gewijzigd|Zuletzt\u00a0geändert)\u00a0\d/)
      expect(said).not.toMatch(/[ \t\n]/)
      expect(said.length).toBeGreaterThan(20)
    }
  })
})
