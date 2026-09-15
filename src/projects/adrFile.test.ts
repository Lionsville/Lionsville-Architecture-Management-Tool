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
  it('numbers the file so a folder listing reads in decision order, per list', () => {
    expect(adrPath(record())).toBe('decisions/0007-keep-the-working-file-in-a-folder.md')
    // The landscape's ADR-0007 and an application's ADR-0007 are two records,
    // so an application gets a folder of its own.
    expect(adrPath(record({ subjectId: 'crews' })))
      .toBe('decisions/crews/0007-keep-the-working-file-in-a-folder.md')
  })

  it('keeps an id that is not a slug out of the path, and names a file without a title', () => {
    expect(adrPath(record({ subjectId: '../escape' }))).toBe('decisions/0007-keep-the-working-file-in-a-folder.md')
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
  it('reads back everything it wrote, with or without signers, heading and all', () => {
    const full = record({ subjectId: 'crews', supersededBy: 'adr-9', status: 'superseded' })
    expect(adrFromFile(adrFileText(full), adrPath(full))).toEqual(full)
    const bare = record({ signers: [] })
    expect(adrFromFile(adrFileText(bare), adrPath(bare))).toEqual(bare)
    // A body that starts with a heading of its own keeps it.
    const headed = record({ body: '# Not the title\n\nprose' })
    expect(adrFromFile(adrFileText(headed), adrPath(headed))?.body).toBe('# Not the title\n\nprose')
  })

  it('takes the number and the application from the path of a hand-written file, or refuses it', () => {
    const held = adrFromFile('# ADR-0012 — Written by hand\n\nprose\n', 'decisions/0012-written-by-hand.md')
    expect(held).toMatchObject({ number: 12, title: 'Written by hand', body: 'prose', status: 'proposed' })
    const filed = adrFromFile('# ADR-0003 — Dropped in\n', 'decisions/crews/0003-dropped-in.md')
    expect(filed?.subjectId).toBe('crews')
    // A file that carries no number anywhere is not a record.
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

/**
 * The field was renamed when the three decision lists became one
 * (ADR-0012 §7). Nothing about the file changed but the name of one field, so
 * it is a read-time alias inside the same format rather than a migration —
 * and format 6 drops it.
 */
describe('subjectId, and the old spelling', () => {
  it('reads applicationId as subjectId, and writes only the new word', () => {
    const text = [
      '---', 'id: adr-1', 'number: 7', 'status: accepted', 'date: 2026-01-01',
      'applicationId: crews', '---', '', '# ADR-0007 — Keep the crews app', '', 'Because.', '',
    ].join('\n')
    const held = adrFromFile(text, 'decisions/0007-keep.md')
    expect(held?.subjectId).toBe('crews')
    const written = adrFileText(held!)
    expect(written).toContain('subjectId: crews')
    expect(written).not.toContain('applicationId')
  })

  /** The front matter wins over the folder, as it always has. */
  it('still takes the subject from the folder when the file says nothing', () => {
    const text = ['---', 'number: 3', '---', '', '# ADR-0003 — Something', ''].join('\n')
    expect(adrFromFile(text, 'decisions/wms/0003-something.md')?.subjectId).toBe('wms')
  })
})
