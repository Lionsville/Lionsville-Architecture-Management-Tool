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
import { act, cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import type { UploadedLogo } from '../model'
import type { HostModel } from '../model/fromInterchange'
import { WORKING_FILE_TYPE, WORKING_FILE_VERSION } from '../model/hostModel'
import type { ProjectSnapshot } from '../projects/project'
import type { TextDocument } from '../ports/DocumentGateway'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFileChannel, ProjectFiles } from './useProjectFiles'
import type { ModelSession } from './useModelSession'

afterEach(() => cleanup())

const model = (): HostModel => ({
  name: 'Landscape',
  customerName: 'Acme',
  elements: [],
  connections: [],
  diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
})

const snapshot = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
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

function mount(documents: Partial<ProjectFileChannel>) {
  const notify = vi.fn()
  const session = fakeSession()
  const channel: ProjectFileChannel = {
    save: () => Promise.resolve(),
    readText: () => Promise.resolve('{}'),
    readDataUrl: () => Promise.resolve('data:image/png;base64,AA'),
    ...documents,
  }
  let files!: ProjectFiles
  function Host() {
    files = useProjectFiles({ session, documents: channel, notify, s: translator('en') })
    return null
  }
  render(<Host />)
  return { files: () => files, notify, session }
}

/** Let the gateway's promise and its handler settle. */
const settle = () => act(() => Promise.resolve().then(() => {}))

describe('saving a document out', () => {
  it('says "saved" only once the gateway accepted it', async () => {
    const { files, notify } = mount({ save: () => Promise.resolve() })
    act(() => files().saveWorkingFile())
    expect(notify).not.toHaveBeenCalled() // not before the promise settles
    await settle()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Working file saved'), 'success')
  })

  it('says it did not, when it did not', async () => {
    const { files, notify } = mount({ save: () => Promise.reject(new Error('disk full')) })
    act(() => files().saveWorkingFile())
    await settle()
    expect(notify).toHaveBeenCalledWith('The file could not be saved: disk full', 'error')
    expect(notify).not.toHaveBeenCalledWith(expect.anything(), 'success')
  })

  it('holds the interchange document to the same standard', async () => {
    const { files, notify } = mount({ save: () => Promise.reject(new Error('cancelled')) })
    act(() => files().saveInterchange())
    await settle()
    expect(notify).toHaveBeenCalledWith('The file could not be saved: cancelled', 'error')
  })

  it('names the file after the project, not after a constant', async () => {
    const save = vi.fn((_doc: TextDocument) => Promise.resolve())
    const { files } = mount({ save })
    act(() => files().saveWorkingFile())
    await settle()
    expect(save.mock.calls[0][0].name).toBe('acme-landscape.lvarch')
  })
})

describe('opening a file', () => {
  const workingFile = () => JSON.stringify({
    type: WORKING_FILE_TYPE, version: WORKING_FILE_VERSION, model: model(), activeDiagramId: 'd1',
  })
  const file = (name = 'x.lvarch') => new File([''], name)

  it('adopts a working file and keeps its geometry', async () => {
    const { files, notify, session } = mount({ readText: () => Promise.resolve(workingFile()) })
    act(() => files().openFile(file()))
    await settle()
    expect(session.adopt).toHaveBeenCalledWith(expect.anything(), false)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Working file'), 'success')
  })

  it('adopts an interchange document and asks for a fresh layout', async () => {
    const document = JSON.stringify({
      formatVersion: 1,
      elements: [{ id: 'e1', name: 'Thing', kind: 'application' }],
      connections: [],
      diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ elementId: 'e1' }] }],
    })
    const { files, session } = mount({ readText: () => Promise.resolve(document) })
    act(() => files().openFile(file('x.json')))
    await settle()
    expect(session.adopt).toHaveBeenCalledWith(expect.anything(), true)
  })

  it('names the syntax error rather than swallowing it', async () => {
    const { files, notify, session } = mount({ readText: () => Promise.resolve('{ not json') })
    act(() => files().openFile(file()))
    await settle()
    expect(notify.mock.calls[0][0]).toContain('Not valid JSON')
    expect(notify.mock.calls[0][1]).toBe('error')
    expect(session.adopt).not.toHaveBeenCalled()
  })

  it('refuses a file from a version this build does not know', async () => {
    const future = JSON.stringify({ type: WORKING_FILE_TYPE, version: 99, model: model() })
    const { files, notify } = mount({ readText: () => Promise.resolve(future) })
    act(() => files().openFile(file()))
    await settle()
    // Today it is reported as "neither one nor the other", which is honest but
    // not helpful: a newer file is a recognisable case and deserves its own
    // sentence. Pinned here so the day that changes is a deliberate one.
    expect(notify).toHaveBeenCalledWith(
      'This file is neither an interchange document nor a working file.', 'error')
  })

  it('says so when the file could not be read at all', async () => {
    const { files, notify } = mount({ readText: () => Promise.reject(new Error('unreadable')) })
    act(() => files().openFile(file()))
    await settle()
    expect(notify).toHaveBeenCalledWith(
      'The document could not be processed: unreadable', 'error')
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
