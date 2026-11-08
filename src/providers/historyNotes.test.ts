// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What *Take a snapshot…* says of where the history is kept, per source: the
 * two kept in this browser go with its data and say they are no backup; the
 * desktop's folder keeps its history in the folder, with git, and says
 * nothing of the kind.
 */
import { describe, expect, it } from 'vitest'
import { DE } from './strings/de'
import { EN } from './strings/en'
import { NL } from './strings/nl'

const NO_BACKUP = { en: 'no backup', nl: 'geen back-up', de: 'keine Sicherung' } as const
const TABLES = { en: EN, nl: NL, de: DE } as const

describe('the snapshot note, per source', () => {
  for (const language of ['en', 'nl', 'de'] as const) {
    const table = TABLES[language]
    it(`says the browser's history is no backup, and the desktop folder's is not tied to a browser (${language})`, () => {
      // This browser's own storage, and a folder in a tab, whose history is kept in the browser beside it.
      expect(table['browser.historyNote']).toContain(NO_BACKUP[language])
      expect(table['folder.historyNoteBrowser']).toContain(NO_BACKUP[language])
      // The desktop's git folder.
      expect(table['folder.historyNote']).not.toContain(NO_BACKUP[language])
      expect(table['folder.historyNote']).toContain('git')
    })
  }
})
