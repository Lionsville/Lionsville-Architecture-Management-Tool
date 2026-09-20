import { describe, expect, it } from 'vitest'
import type { Cause, Observation } from '../model/observation'
import {
  causeFileText, causeFromFile, causePath, observationFileText, observationFromFile, observationPath,
} from './observationFile'

const observation: Observation = {
  id: 'ob-a1', number: 3, title: 'The nightly claims batch runs into office hours', date: '2026-09-08',
  where: 'Claims settlement run', impact: 'major', seen: 4, shared: true,
  body: '## What we saw\n\nStill running at 08:40.\n',
  history: [
    { date: '2026-09-08', kind: 'recorded' },
    { date: '2026-09-10', kind: 'seen', note: 'Monday run' },
    { date: '2026-09-11', kind: 'shared' },
    { date: '2026-09-15', kind: 'absorbed', id: 'ob-b7', scope: 'acme/claims', seen: 2 },
  ],
}

const cause: Cause = {
  id: 'ca-x', number: 2, title: 'Batch window sized for 2019 volumes', state: 'verified',
  body: '## Why we think so\n\nVolumes doubled.\n',
  explains: [{ id: 'ob-a1', strength: 'strong' }, { id: 'ob-b7', scope: 'acme/claims', strength: 'weak' }, { id: 'ca-y', strength: 'normal' }],
}

describe('an observation as a file', () => {
  it('is filed flat under observations/, numbered first', () => {
    expect(observationPath(observation)).toBe('observations/0003-the-nightly-claims-batch-runs-into-office-hours.md')
    expect(observationPath({ ...observation, title: '  ' })).toBe('observations/0003-observation.md')
  })

  it('writes front matter, a heading people say out loud, and the body', () => {
    const text = observationFileText(observation)
    expect(text.startsWith('---\nid: ob-a1\nnumber: 3\ndate: 2026-09-08\n')).toBe(true)
    expect(text).toContain('shared: true')
    expect(text).toContain('history:\n  - date: 2026-09-08\n    kind: recorded\n')
    expect(text).toContain('# OB-0003 — The nightly claims batch runs into office hours\n\n## What we saw')
  })

  it('round-trips unchanged', () => {
    expect(observationFromFile(observationFileText(observation), observationPath(observation))).toEqual(observation)
    const local: Observation = { ...observation, where: undefined, shared: undefined, history: [{ date: '2026-09-08', kind: 'recorded' }] }
    delete local.where
    delete local.shared
    expect(observationFromFile(observationFileText(local), observationPath(local))).toEqual(local)
  })

  it('reads a hand-written file: number from the name, defaults for the rest, one recorded event', () => {
    const read = observationFromFile('# Seen it\n\nA note.\n', 'observations/0007-seen-it.md')
    expect(read).toEqual({
      id: 'ob-7', number: 7, title: 'Seen it', date: '', impact: 'minor', seen: 1, body: 'A note.',
      history: [{ date: '', kind: 'recorded' }],
    })
    expect(observationFromFile('# No number\n', 'observations/README.md')).toBeUndefined()
  })

  it('drops a history row it cannot read rather than the file', () => {
    const text = '---\nnumber: 1\ndate: 2026-09-01\nhistory:\n  - date: 2026-09-01\n    kind: recorded\n  - kind: seen\n  - date: 2026-09-02\n    kind: teleported\n---\n# T\n'
    expect(observationFromFile(text, 'observations/0001-t.md')?.history).toEqual([{ date: '2026-09-01', kind: 'recorded' }])
  })
})

describe('a cause as a file', () => {
  it('is filed under observations/causes/', () => {
    expect(causePath(cause)).toBe('observations/causes/0002-batch-window-sized-for-2019-volumes.md')
  })

  it('round-trips unchanged, links and all', () => {
    const text = causeFileText(cause)
    expect(text).toContain('# CA-0002 — Batch window sized for 2019 volumes')
    expect(text).toContain('explains:\n  - id: ob-a1\n    strength: strong\n  - id: ob-b7\n    scope: acme/claims\n    strength: weak\n')
    expect(causeFromFile(text, causePath(cause))).toEqual(cause)
  })

  it('defaults a mistyped state and strength rather than refusing', () => {
    const text = '---\nnumber: 4\nstate: certain\nexplains:\n  - id: ob-1\n    strength: huge\n  - strength: strong\n---\n# CA-0004 — Why\n\nBody.\n'
    expect(causeFromFile(text, 'observations/causes/0004-why.md')).toEqual({
      id: 'ca-4', number: 4, title: 'Why', state: 'assumed', body: 'Body.', explains: [{ id: 'ob-1', strength: 'normal' }],
    })
  })
})
