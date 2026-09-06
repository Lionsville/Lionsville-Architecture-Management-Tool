/**
 * A decision record through a file and back. The round trip is the whole test:
 * a record that loses its signers, its number or a paragraph of its body on the
 * way to disk is worse than one that was never written out.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../decisions/adr'
import { adrFileText, adrFromFile, adrPath } from './adrFile'

function record(over: Partial<Adr> = {}): Adr {
  return {
    id: 'adr-1',
    number: 7,
    title: 'Keep the working file in a folder',
    status: 'accepted',
    date: '2026-09-06',
    body: '## Context and Problem Statement\n\nOne file diffs as coordinates.\n\n## Decision\n\nA folder.',
    signers: [{ name: 'Wouter Simons', role: 'Architect', verdict: 'approved', signedAt: '2026-09-06' }],
    ...over,
  }
}

describe('adrPath', () => {
  it('numbers the file so a folder listing reads in decision order', () => {
    expect(adrPath(record())).toBe('decisions/0007-keep-the-working-file-in-a-folder.md')
  })

  it('gives an application its own folder, because numbers are per list', () => {
    // The landscape's ADR-0007 and an application's ADR-0007 are two records.
    expect(adrPath(record({ applicationId: 'crews' })))
      .toBe('decisions/crews/0007-keep-the-working-file-in-a-folder.md')
  })

  it('keeps an id that is not a slug out of the path', () => {
    expect(adrPath(record({ applicationId: '../escape' }))).toBe('decisions/0007-keep-the-working-file-in-a-folder.md')
  })

  it('still names a file for a record with no title yet', () => {
    expect(adrPath(record({ title: '' }))).toBe('decisions/0007-decision.md')
  })
})

describe('adrFileText', () => {
  it('writes the fields above and the prose below', () => {
    expect(adrFileText(record({ signers: [] }))).toBe([
      '---',
      'id: adr-1',
      'number: 7',
      'status: accepted',
      'date: 2026-09-06',
      '---',
      '',
      '# ADR-0007 — Keep the working file in a folder',
      '',
      '## Context and Problem Statement',
      '',
      'One file diffs as coordinates.',
      '',
      '## Decision',
      '',
      'A folder.',
      '',
    ].join('\n'))
  })

  it('writes the same bytes twice for the same record', () => {
    expect(adrFileText(record())).toBe(adrFileText(record()))
  })
})

describe('adrFromFile', () => {
  it('reads back everything it wrote', () => {
    const adr = record({ applicationId: 'crews', supersededBy: 'adr-9', status: 'superseded' })
    expect(adrFromFile(adrFileText(adr), adrPath(adr))).toEqual(adr)
  })

  it('reads back a record with no signers and no application', () => {
    const adr = record({ signers: [] })
    expect(adrFromFile(adrFileText(adr), adrPath(adr))).toEqual(adr)
  })

  it('keeps a body that starts with a heading of its own', () => {
    const adr = record({ body: '# Not the title\n\nprose' })
    expect(adrFromFile(adrFileText(adr), adrPath(adr))?.body).toBe('# Not the title\n\nprose')
  })

  it('takes the number from the file name when a hand-written file has none', () => {
    const held = adrFromFile('# ADR-0012 — Written by hand\n\nprose\n', 'decisions/0012-written-by-hand.md')
    expect(held).toMatchObject({ number: 12, title: 'Written by hand', body: 'prose', status: 'proposed' })
  })

  it('takes the application from the folder when the field is missing', () => {
    const held = adrFromFile('# ADR-0003 — Dropped in\n', 'decisions/crews/0003-dropped-in.md')
    expect(held?.applicationId).toBe('crews')
  })

  it('refuses a file that carries no number anywhere', () => {
    expect(adrFromFile('# Just prose\n', 'decisions/notes.md')).toBeUndefined()
  })

  it('falls back to proposed for a status nobody recognises', () => {
    // A record whose status cannot be read must not be treated as accepted:
    // accepted is one of the states that locks the record.
    const held = adrFromFile('---\nnumber: 1\nstatus: nearly\n---\n\n# ADR-0001 — X\n', 'decisions/0001-x.md')
    expect(held?.status).toBe('proposed')
  })

  it('drops a signer with no name rather than inventing one', () => {
    const text = '---\nnumber: 1\nsigners:\n  - role: Architect\n  - name: W\n---\n\n# ADR-0001 — X\n'
    expect(adrFromFile(text, 'decisions/0001-x.md')?.signers).toEqual([{ name: 'W' }])
  })
})
