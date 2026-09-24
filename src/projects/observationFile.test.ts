// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Cause, Experiment, Observation, Solution } from '../model/observation'
import {
  causeFileText, causeFromFile, causePath, experimentFileText, experimentFromFile, experimentPath,
  observationFileText, observationFromFile, observationPath, solutionFileText, solutionFromFile, solutionPath,
} from './observationFile'

const observation: Observation = {
  id: 'ob-a1', number: 3, title: 'The nightly claims batch runs into office hours', date: '2026-09-08',
  where: 'Claims settlement run', by: 'W. Simons', impact: 'major', seen: 4, shared: true, archived: true,
  body: '## What we saw\n\nStill running at 08:40.\n',
  history: [
    { date: '2026-09-08', kind: 'recorded' },
    { date: '2026-09-10', kind: 'seen', note: 'Monday run' },
    { date: '2026-09-11', kind: 'shared' },
    { date: '2026-09-15', kind: 'absorbed', id: 'ob-b7', scope: 'acme/claims', seen: 2 },
    { date: '2026-09-20', kind: 'archived', note: 'Fixed by the window change' },
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
    expect(text).toContain('by: W. Simons\n')
    expect(text).toContain('shared: true\narchived: true\n')
    expect(text).toContain('history:\n  - date: 2026-09-08\n    kind: recorded\n')
    expect(text).toContain('  - date: 2026-09-20\n    kind: archived\n    note: Fixed by the window change\n')
    expect(text).toContain('# OB-0003 — The nightly claims batch runs into office hours\n\n## What we saw')
  })

  it('round-trips unchanged', () => {
    expect(observationFromFile(observationFileText(observation), observationPath(observation))).toEqual(observation)
    const local: Observation = { ...observation, history: [{ date: '2026-09-08', kind: 'recorded' }] }
    delete local.where
    delete local.by
    delete local.shared
    delete local.archived
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

const solution: Solution = {
  id: 'so-a', number: 4, title: 'One estimate service for every channel', state: 'testing', benefit: 'large', cost: 'medium',
  addresses: [{ id: 'ca-x', strength: 'strong' }, { id: 'ca-y', strength: 'weak' }],
  validatedWith: ['Customer service lead', 'Data platform: the team'],
  attempts: [{ when: '2024', what: 'A nightly sync', why: 'It lagged by a day: nobody trusted it' }, { what: 'A spreadsheet', why: 'Stale' }],
  whyNow: 'The tracking feed is live now', waived: 'Nothing to trial: an appointment', decision: 'adr-1', plan: 'tr-2',
  body: '## The idea\n\nOne service.\n',
  history: [
    { date: '2026-07-01', kind: 'proposed' },
    { date: '2026-07-15', kind: 'moved', to: 'shaped' },
    { date: '2026-07-16', kind: 'waived', note: 'Nothing to trial' },
    { date: '2026-07-17', kind: 'linked', to: 'decision', id: 'adr-1' },
  ],
}

const experiment: Experiment = {
  id: 'ex-a', number: 2, title: 'Two weeks at desk 3', tests: ['so-a', 'so-b'], hypothesis: 'Calls about the estimate halve',
  measure: 'Calls tagged "estimate" per week', where: 'Call centre, desk 3', by: 'Customer service lead',
  from: '2026-08-04', to: '2026-08-18', outcome: 'confirmed', result: 'From 41 to 12 a week.',
  body: '## How it is set up\n\nOne desk.\n',
}

describe('a solution as a file', () => {
  it('is filed under observations/solutions/', () => {
    expect(solutionPath(solution)).toBe('observations/solutions/0004-one-estimate-service-for-every-channel.md')
    expect(solutionFileText(solution)).toContain('# SO-0004 — One estimate service for every channel')
  })
  it('round-trips unchanged, lists and history and all', () => {
    expect(solutionFromFile(solutionFileText(solution), solutionPath(solution))).toEqual(solution)
  })
  it('round-trips a bare idea without inventing fields', () => {
    const bare: Solution = {
      id: 'so-b', number: 1, title: 'Own the data', state: 'idea', addresses: [], validatedWith: [], attempts: [],
      noneKnown: true, body: '', history: [{ date: '2026-09-24', kind: 'proposed' }],
    }
    expect(solutionFromFile(solutionFileText(bare), solutionPath(bare))).toEqual(bare)
  })
  it('defaults a mistyped state and drops an unknown event rather than refusing', () => {
    const text = solutionFileText(solution).replace('state: testing', 'state: nonsense').replace('kind: proposed', 'kind: nonsense')
    const back = solutionFromFile(text, solutionPath(solution))!
    expect(back.state).toBe('idea')
    expect(back.history).toHaveLength(3)
  })
})

describe('an experiment as a file', () => {
  it('is filed under observations/experiments/ and round-trips unchanged', () => {
    expect(experimentPath(experiment)).toBe('observations/experiments/0002-two-weeks-at-desk-3.md')
    expect(experimentFromFile(experimentFileText(experiment), experimentPath(experiment))).toEqual(experiment)
  })
  it('reads a hand-written one: number from the name, planned by default', () => {
    const back = experimentFromFile('# EX-0007 — Trial\n\nNotes.\n', 'observations/experiments/0007-trial.md')
    expect(back).toMatchObject({ number: 7, title: 'Trial', outcome: 'planned', tests: [], hypothesis: '' })
  })
})
