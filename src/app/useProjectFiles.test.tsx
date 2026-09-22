// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Files in and files out, and — the reason this file exists — what is said
 * afterwards.
 *
 * Both exports used to fire the gateway and toast success in the next
 * statement, without waiting for it. A refused save then showed "saved" and the
 * user had every reason to believe it; that is the one failure mode worse than
 * no message at all.
 *
 * The session is a plain object rather than the real hook: what is under test
 * is this hook's conversation with the gateway, and `useModelSession` has a
 * suite of its own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import type { UploadedLogo } from '../model'
import type { HostModel } from '../model/hostModel'
import { WORKING_FILE_TYPE, WORKING_FILE_VERSION } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { unzipSync } from 'fflate'
import { sealBytes, unsealBytes } from '../projects/sealedFile'
import { workingFileBytes } from '../projects/workingFile'
import type { SavedDocument } from '../ports/DocumentGateway'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFileChannel, ProjectFiles } from './useProjectFiles'
import type { ModelSession } from './useModelSession'
import type { AskPassword } from './usePasswordPrompt'
import type { LandingPrompts } from './workingFileFlows'

afterEach(() => cleanup())

const model = (): HostModel => ({
  name: 'Landscape',
  elements: [],
  relations: [],
  diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
})

const snapshot = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: model(),
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** Only the six members this hook reaches for; the rest would be scenery. */
function fakeSession() {
  const library: UploadedLogo[] = []
  return {
    snapshot: () => snapshot(),
    current: () => model(),
    currentLibrary: () => library,
    setLogoLibrary: vi.fn(),
    adopt: vi.fn(),
  } as unknown as ModelSession & { adopt: ReturnType<typeof vi.fn> }
}

/** The dialog, answered without a person: the same password every time. */
const PASSWORD = 'correct horse'
const typed: AskPassword = () => Promise.resolve(PASSWORD)
/** The landing question, answered "here" without a person (ADR-0025). */
const here: LandingPrompts = {
  askDestination: () => Promise.resolve('here'),
  confirmReplace: () => Promise.resolve(true),
}

function mount(
  documents: Partial<ProjectFileChannel>,
  workingSet?: () => Promise<ScopeSnapshot[]>,
  adoptWorkingSet?: (scopes: readonly ScopeSnapshot[]) => Promise<void>,
  askPassword: AskPassword = typed,
) {
  const notify = vi.fn()
  const session = fakeSession()
  const channel: ProjectFileChannel = {
    save: () => Promise.resolve(),
    readBytes: () => Promise.resolve(bytes('{}')),
    readDataUrl: () => Promise.resolve('data:image/png;base64,AA'),
    ...documents,
  }
  let files!: ProjectFiles
  function Host() {
    files = useProjectFiles({
      session,
      documents: channel,
      ...(workingSet ? { workingSet } : {}),
      ...(adoptWorkingSet ? { adoptWorkingSet } : {}),
      askPassword,
      landing: here,
      notify,
      s: translator('en'),
    })
    return null
  }
  render(<Host />)
  return { files: () => files, notify, session }
}

/** What a sealed export holds, once the password has opened it (ADR-0023). */
async function inside(doc: SavedDocument): Promise<Record<string, Uint8Array>> {
  const plain = await unsealBytes(doc.bytes as Uint8Array, PASSWORD)
  if (!plain) throw new Error('the export did not open under the password it was sealed with')
  return unzipSync(plain)
}

/** The organisation, with the open scope filed under it — what a store holds. */
const organisation = (): ScopeSnapshot => ({
  path: '',
  model: { ...model(), name: 'Acme Logistics' },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

const bytes = (text: string) => new TextEncoder().encode(text)

/** Let the gateway's promise and its handler settle. */
const settle = () => act(() => Promise.resolve().then(() => {}))

describe('saving a document out', () => {
  it('says "saved" only once the gateway accepted it', async () => {
    const { files, notify } = mount({ save: () => Promise.resolve() })
    act(() => files().saveWorkingFile())
    expect(notify).not.toHaveBeenCalled() // not before the promise settles
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining('Working file saved'), 'success'))
  })

  it('says it did not, when it did not', async () => {
    const { files, notify } = mount({ save: () => Promise.reject(new Error('disk full')) })
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('The file could not be saved: disk full', 'error'))
    expect(notify).not.toHaveBeenCalledWith(expect.anything(), 'success')
  })

  it('writes nothing and says nothing when the password dialog is cancelled', async () => {
    // A closed dialog is a decision, not a failure: no file, and no toast to
    // say there was none.
    const save = vi.fn((_doc: SavedDocument) => Promise.resolve())
    const { files, notify } = mount({ save }, undefined, undefined, () => Promise.resolve(undefined))
    act(() => files().saveWorkingFile())
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(save).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('hands a picture over as the bytes it is, and says so afterwards', async () => {
    const saved: unknown[] = []
    const { files, notify } = mount({ save: (doc) => { saved.push(doc); return Promise.resolve() } })
    act(() => files().savePicture({ name: 'Business architecture.png', bytes: new Uint8Array([1, 2]), mediaType: 'image/png' }))
    expect(saved).toEqual([{ name: 'Business architecture.png', bytes: new Uint8Array([1, 2]), mediaType: 'image/png' }])
    await settle()
    expect(notify).toHaveBeenCalledWith('Picture saved.', 'success')
  })

  it('names the file after the project, not after a constant', async () => {
    const save = vi.fn((_doc: SavedDocument) => Promise.resolve())
    const { files } = mount({ save })
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].name).toBe('landscape.lvarch')
  })

  it('hands the working file over sealed, with the zip it is inside', async () => {
    // Version 3 is the project folder, zipped (ADR-0003): something a person
    // can unzip and read — once the password has opened it (ADR-0023). On the
    // outside it is bytes that are nothing else, and not a zip.
    const save = vi.fn((_doc: SavedDocument) => Promise.resolve())
    const { files } = mount({ save })
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    const doc = save.mock.calls[0][0]
    expect(doc.mediaType).toBe('application/octet-stream')
    expect(doc.bytes?.slice(0, 2)).not.toEqual(new Uint8Array([0x50, 0x4b]))
    expect(await unsealBytes(doc.bytes as Uint8Array, 'incorrect horse')).toBeUndefined()
    expect(Object.keys(await inside(doc))).toContain('scope.json')
  })
})

describe('exporting the whole working set', () => {
  const saveSpy = () => vi.fn((_doc: SavedDocument) => Promise.resolve())

  it('writes every scope the store holds, not only the one that is open', async () => {
    const save = saveSpy()
    const { files } = mount({ save }, () => Promise.resolve([organisation(), snapshot()]))
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    const written = await inside(save.mock.calls[0][0])
    expect(Object.keys(written)).toContain('scope.json')
    expect(Object.keys(written)).toContain('acme/landscape/scope.json')
  })

  it('names the file after the organisation, so the root does not export as `.lvarch`', async () => {
    const save = saveSpy()
    const { files } = mount({ save }, () => Promise.resolve([organisation(), snapshot()]))
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].name).toBe('acme-logistics.lvarch')
  })

  it('takes the open scope from the session, not from the store', async () => {
    // The store holds what was last written; the session holds what is on
    // screen. An export that quietly left out the last ten minutes would be
    // worse than one that refused.
    const stale: ScopeSnapshot = { ...snapshot(), model: { ...model(), name: 'Stale' } }
    const save = saveSpy()
    const { files } = mount({ save }, () => Promise.resolve([organisation(), stale]))
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    const written = await inside(save.mock.calls[0][0])
    const header = JSON.parse(new TextDecoder().decode(written['acme/landscape/scope.json']))
    expect(header.name).toBe('Landscape')
  })

  it('falls back to the open scope alone where there is no store to ask', async () => {
    const save = saveSpy()
    const { files } = mount({ save })
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(Object.keys(await inside(save.mock.calls[0][0]))).toContain('scope.json')
    expect(save.mock.calls[0][0].name).toBe('landscape.lvarch')
  })

  it('says so, once, when the store cannot be read', async () => {
    const { files, notify } = mount({}, () => Promise.reject(new Error('folder gone')))
    act(() => files().saveWorkingFile())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('The file could not be saved: folder gone', 'error'))
  })
})

describe('opening a file', () => {
  const workingFile = () => JSON.stringify({
    type: WORKING_FILE_TYPE, version: WORKING_FILE_VERSION, model: model(), activeDiagramId: 'd1',
  })
  const file = (name = 'x.lvarch') => new File([''], name)

  it('adopts a version-3 working file — a zip — and keeps its geometry', async () => {
    const { files, session } = mount({
      readBytes: () => Promise.resolve(workingFileBytes([snapshot()])),
    })
    act(() => files().openFile(file()))
    await waitFor(() => expect(session.adopt).toHaveBeenCalledWith(expect.anything(), false))
  })

  it('still adopts a version-2 working file, which is not a zip at all', async () => {
    const { files, notify, session } = mount({ readBytes: () => Promise.resolve(bytes(workingFile())) })
    act(() => files().openFile(file()))
    await waitFor(() => expect(session.adopt).toHaveBeenCalledWith(expect.anything(), false))
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Working file'), 'success')
  })

  it('refuses a file that is not a document of any kind', async () => {
    // This used to name the JSON syntax error. A file is now recognised by its
    // bytes rather than by an assumption that it is text — a working file is a
    // zip — so "not valid JSON" would be the wrong sentence for half the files
    // somebody might choose. Deliberately flipped with ADR-0003.
    const { files, notify, session } = mount({ readBytes: () => Promise.resolve(bytes('{ not json')) })
    act(() => files().openFile(file()))
    await waitFor(() => expect(notify.mock.calls[0][0]).toContain('not a working file'))
    expect(notify.mock.calls[0][1]).toBe('error')
    expect(session.adopt).not.toHaveBeenCalled()
  })

  it('refuses a file from a version this build does not know', async () => {
    const future = JSON.stringify({ type: WORKING_FILE_TYPE, version: 99, model: model() })
    const { files, notify } = mount({ readBytes: () => Promise.resolve(bytes(future)) })
    act(() => files().openFile(file()))
    // Today it is reported as "not a working file", which is honest but not
    // helpful: a newer file is a recognisable case and deserves its own
    // sentence. Pinned here so the day that changes is a deliberate one.
    await waitFor(() => expect(notify).toHaveBeenCalledWith('This file is not a working file.', 'error'))
  })

  it('opens a sealed file once the password is right, asking again after a wrong one', async () => {
    const sealed = await sealBytes(workingFileBytes([snapshot()]), PASSWORD, { iterations: 1_000 })
    const asked: (string | undefined)[] = []
    let attempt = 0
    const askPassword: AskPassword = (_mode, error) => {
      asked.push(error)
      attempt += 1
      return Promise.resolve(attempt === 1 ? 'incorrect horse' : PASSWORD)
    }
    const { files, notify, session } = mount(
      { readBytes: () => Promise.resolve(sealed) }, undefined, undefined, askPassword,
    )
    act(() => files().openFile(file('sealed.lvarch')))
    await waitFor(() => expect(session.adopt).toHaveBeenCalledWith(expect.anything(), false))
    // The first ask carries no verdict; the second carries the first's.
    expect(asked).toEqual([undefined, expect.stringContaining('not the password')])
    expect(notify).toHaveBeenCalledWith('Working file “sealed.lvarch” loaded.', 'success')
  })

  it('opens nothing, and says nothing, when the password dialog is cancelled', async () => {
    const sealed = await sealBytes(workingFileBytes([snapshot()]), PASSWORD, { iterations: 1_000 })
    const { files, notify, session } = mount(
      { readBytes: () => Promise.resolve(sealed) }, undefined, undefined, () => Promise.resolve(undefined),
    )
    act(() => files().openFile(file('sealed.lvarch')))
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(session.adopt).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('says so when the file could not be read at all', async () => {
    const { files, notify } = mount({ readBytes: () => Promise.reject(new Error('unreadable')) })
    act(() => files().openFile(file()))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      'The document could not be processed: unreadable', 'error'))
  })
})

describe('opening a working set', () => {
  const file = (name = 'x.lvarch') => new File([''], name)
  /** A file holding the organisation and one scope filed under it. */
  const setBytes = () => workingFileBytes([organisation(), { ...snapshot(), path: 'acme' }])

  it('writes the scopes that came with it, then adopts the one at the top', async () => {
    const adopt = vi.fn((_scopes: readonly ScopeSnapshot[]) => Promise.resolve())
    const { files, notify, session } = mount(
      { readBytes: () => Promise.resolve(setBytes()) }, undefined, adopt,
    )
    act(() => files().openFile(file('acme.lvarch')))
    await waitFor(() => expect(adopt).toHaveBeenCalledTimes(1))
    expect(adopt.mock.calls[0][0].map((scope) => scope.path)).toEqual(['acme/landscape/acme'])
    expect(session.adopt).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(
      'Working file “acme.lvarch” loaded, with 1 scopes filed under it.', 'success')
  })

  it('refuses it where there is nowhere to write the rest, rather than opening half of it', async () => {
    // Half a working set is the loss this whole arrangement exists to prevent:
    // the scope at the top would open, the ones under it would be gone, and
    // nothing would have said so.
    const { files, notify, session } = mount({ readBytes: () => Promise.resolve(setBytes()) })
    act(() => files().openFile(file('acme.lvarch')))
    await waitFor(() => expect(session.adopt).not.toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith(
      'This file holds a whole working set, which can only be opened into a working folder.', 'error')
  })

  it('says so, and adopts nothing, when a scope could not be written', async () => {
    const { files, notify, session } = mount(
      { readBytes: () => Promise.resolve(setBytes()) },
      undefined,
      () => Promise.reject(new Error('disk full')),
    )
    act(() => files().openFile(file('acme.lvarch')))
    await waitFor(() => expect(session.adopt).not.toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith('The document could not be processed: disk full', 'error')
  })

  it('takes the ordinary one-scope file the way it always did', async () => {
    const one = workingFileBytes([snapshot()])
    const adopt = vi.fn((_scopes: readonly ScopeSnapshot[]) => Promise.resolve())
    const { files, notify, session } = mount(
      { readBytes: () => Promise.resolve(one) }, undefined, adopt,
    )
    act(() => files().openFile(file('one.lvarch')))
    await waitFor(() => expect(adopt).not.toHaveBeenCalled())
    expect(session.adopt).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Working file “one.lvarch” loaded.', 'success')
  })
})

describe('adding a mark', () => {
  it('puts a readable one at the front of the library and says so', async () => {
    const { files, notify, session } = mount({})
    act(() => files().addLogo(new File(['<svg/>'], 'house.svg', { type: 'image/svg+xml' })))
    await settle()
    await settle()
    expect(session.setLogoLibrary).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Logo “house” added to your own library.', 'success')
  })

  it('turns the reader`s refusal key into a sentence, and never claims success', async () => {
    const { files, notify, session } = mount({})
    act(() => files().addLogo(new File(['x'], 'photo.jpg', { type: 'image/jpeg' })))
    await settle()
    await settle()
    expect(notify).toHaveBeenCalledWith(
      'Only SVG and PNG files can be added as a logo.', 'error')
    expect(session.setLogoLibrary).not.toHaveBeenCalled()
  })

  it('says so when the file itself could not be read', async () => {
    const { files, notify } = mount({ readDataUrl: () => Promise.reject(new Error('gone')) })
    act(() => files().addLogo(new File(['<svg/>'], 'house.svg', { type: 'image/svg+xml' })))
    await settle()
    await settle()
    expect(notify.mock.calls[0][1]).toBe('error')
  })
})
