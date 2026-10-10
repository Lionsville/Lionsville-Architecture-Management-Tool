// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Pictures loaded when shown, through the whole app (ADR-0031 §3).
 *
 * The shipped example, with pictures added to its landscape, opened in the
 * app over the memory repositories, whose image repository counts every
 * picture asked of it. What comes into view is the test's to say, through the
 * browser's own IntersectionObserver, stubbed: opening the scope asks for no
 * picture; a card's description on the board, and a decision's page, each ask
 * for the pictures scrolled into view and for no other, once; and a report
 * asks for what it prints, when it is produced.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { ImageEntry } from '../model/imageName'
import type { ImageRepository } from '../ports/ImageRepository'
import type { ScopeSnapshot } from '../projects/scope'
import { drawnPictures, picturesForReport } from '../documentation/pictureReport'
import { MarkdownView } from '../documentation/ui/MarkdownView'
import { CollectPictures } from '../documentation/ui/PictureCollector'
import { PicturesProvider } from '../documentation/ui/Pictures'
import { heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import { EXAMPLES, exampleScopes } from './testing/examples'
import { renderApp, renderShell } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

// --- the browser's view, which the test scrolls ------------------------------------------

const watched = new Map<Element, IntersectionObserverCallback>()

/** The observer every provider makes, recording what it watches; nothing is in view until the test says. */
class Observer {
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(element: Element) { watched.set(element, this.callback) }
  unobserve(element: Element) { watched.delete(element) }
  disconnect() {}
}

beforeAll(() => { vi.stubGlobal('IntersectionObserver', Observer) })
afterAll(() => { vi.unstubAllGlobals() })
afterEach(() => { watched.clear() })

/** Every picture of this name on screen comes into view. */
function scrollTo(name: string): void {
  act(() => {
    for (const [element, callback] of [...watched]) {
      if (element.getAttribute('data-picture') !== name) continue
      callback([{ target: element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    }
  })
}

// --- the example, pictured ---------------------------------------------------------------

/** A PNG header saying 640 × 480: all a library entry reads, and all jsdom needs. */
function png(width: number, height: number): string {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]
  const word = (value: number) => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes, ...word(width), ...word(height), 8, 6, 0, 0, 0))}`
}

const PICTURES = ['depot.png', 'yard.png', 'crews.png', 'route.png']

const top = EXAMPLES[0].path
const example: ScopeSnapshot[] = exampleScopes(EXAMPLES[0]).map((scope) => ({
  ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
}))
const plain = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!
const board = plain.model.diagrams.find((diagram) => diagram.kind === 'layer7')!
const onBoard = new Set(board.members?.map((member) => member.id) ?? [])
const card = plain.model.elements.find((element) => element.kind === 'application' && onBoard.has(element.id))!

const DESCRIPTION = '![The depot](image:depot.png)\n\nA long way down.\n\n![The yard](image:yard.png)'
const DECISION = { id: 'pictured', title: 'Crews plan from the depot' }
const BODY = '![Crews](image:crews.png)\n\nFurther on.\n\n![Route](image:route.png)'
const ANOTHER = { id: 'plain', title: 'Plans are kept for a year' }

const landscape: ScopeSnapshot = {
  ...plain,
  model: {
    ...plain.model,
    elements: plain.model.elements.map((element) => (element.id === card.id ? { ...element, description: DESCRIPTION } : element)),
    decisions: [...(plain.model.decisions ?? []), {
      id: DECISION.id, number: 99, title: DECISION.title, status: 'proposed', date: '2026-09-29', body: BODY, signers: [],
    }, {
      id: ANOTHER.id, number: 98, title: ANOTHER.title, status: 'proposed', date: '2026-09-29', body: 'No pictures.', signers: [],
    }],
  },
  imageLibrary: PICTURES.map((file) => ({ file, url: png(640, 480) })),
}
const scopes = example.map((scope) => (scope.path === landscape.path ? landscape : scope))

/** The memory repositories, with every picture asked of them written down. */
function counted(held: HeldRepositories = heldRepositories(scopes)): { repositories: HeldRepositories; asked: string[] } {
  const asked: string[] = []
  const images: ImageRepository = {
    id: held.images.id,
    put: (scope, name, bytes) => held.images.put(scope, name, bytes),
    list: (scope, within) => held.images.list(scope, within),
    find: (scope, name) => held.images.find(scope, name),
    bytes: (scope, name) => {
      asked.push(name)
      return held.images.bytes(scope, name)
    },
    bytesAt: (scope, address) => held.images.bytesAt(scope, address),
  }
  return { repositories: { ...held, images }, asked }
}

async function opened() {
  const { repositories, asked } = counted()
  await repositories.ready
  const initialProject = await repositories.read(landscape.path)
  renderApp({ repositories, boot: { initialProject } })
  const found = await waitFor(() => {
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${card.id}"]`)
    expect(node).not.toBeNull()
    return node!
  })
  return { asked, card: found, repositories, initialProject: initialProject! }
}

/** Let every answer already given land. */
async function settled(): Promise<void> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
}

function onScreen(name: string): HTMLImageElement {
  const found = document.querySelector<HTMLImageElement>(`img[data-picture="${name}"]`)
  if (!found) throw new Error(`${name} is not on screen`)
  return found
}

// The whole app, rendered and driven through several pages per test: on a
// shared two-core runner one such test took 5.6 s where it takes 0.7 s here,
// so the suite takes the budget the other whole-app suites take.
describe('pictures, through the app', { timeout: 20_000 }, () => {
  it('opening a scope full of pictures asks for none of them', async () => {
    const { asked, initialProject } = await opened()
    expect(initialProject.images?.map((entry) => entry.name).sort()).toEqual([...PICTURES].sort())
    await settled()
    expect(asked).toEqual([])
  })

  it('on the board, a card\'s description asks for the picture scrolled into view, once, and for no other', async () => {
    const { asked, card: node } = await opened()
    node.focus()
    fireEvent.keyDown(node, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('button', { name: 'Preview description' }))
    await waitFor(() => onScreen('yard.png'))
    const box = { width: onScreen('depot.png').getAttribute('width'), height: onScreen('depot.png').getAttribute('height') }
    expect(box).toEqual({ width: '640', height: '480' })
    await settled()
    expect(asked).toEqual([])

    scrollTo('depot.png')
    await waitFor(() => expect(onScreen('depot.png').getAttribute('src')).toBeTruthy())
    scrollTo('depot.png')
    await settled()
    expect(asked).toEqual(['depot.png'])
    expect(onScreen('yard.png').getAttribute('src')).toBeNull()
    expect({ width: onScreen('depot.png').getAttribute('width'), height: onScreen('depot.png').getAttribute('height') }).toEqual(box)
  })

  it('on a decision\'s page, asks for what is scrolled into view, and nothing more for a picture seen before', async () => {
    const { asked } = await opened()
    fireEvent.click(await screen.findByText('Decisions'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText(DECISION.title))
    await waitFor(() => onScreen('route.png'))
    await settled()
    expect(asked).toEqual([])

    scrollTo('route.png')
    await waitFor(() => expect(onScreen('route.png').getAttribute('src')).toBeTruthy())
    expect(asked).toEqual(['route.png'])
    expect(onScreen('crews.png').getAttribute('src')).toBeNull()

    // Away to another record and back: the page kept the bytes, and shows them without asking.
    const other = within(screen.getByTestId('adr-list')).getByText(ANOTHER.title)
    fireEvent.click(other)
    await waitFor(() => expect(document.querySelector('img[data-picture="route.png"]')).toBeNull())
    fireEvent.click(within(screen.getByTestId('adr-list')).getByText(DECISION.title))
    await waitFor(() => expect(onScreen('route.png').getAttribute('src')).toBeTruthy())
    await settled()
    expect(asked).toEqual(['route.png'])
  })

  it('the organisation\'s home, whose scope holds pictures too, asks for none of them', async () => {
    const pictured = scopes.map((scope) => (scope.path === '' ? { ...scope, imageLibrary: [{ file: 'map.png', url: png(800, 600) }] } : scope))
    const { repositories, asked } = counted(heldRepositories(pictured))
    await repositories.ready
    expect((await repositories.read(''))?.images?.map((entry) => entry.name)).toEqual(['map.png'])
    renderApp({ repositories, boot: { initialProject: undefined } })
    expect(await screen.findByTestId('organisation-name')).toBeDefined()
    await settled()
    expect(asked).toEqual([])
  })

  it('a report asks for what it prints, when it is produced, and for nothing before', async () => {
    const { repositories, asked } = counted()
    await repositories.ready
    const scope = (await repositories.read(landscape.path))!
    const library: readonly ImageEntry[] = scope.images ?? []
    const documents = [
      scope.model.elements.find((element) => element.id === card.id)!.description!,
      scope.model.decisions!.find((decision) => decision.id === DECISION.id)!.body,
    ]
    const drawn = drawnPictures()
    const { container } = renderShell(
      <PicturesProvider source={repositories.images} scope={scope.id!} library={library}>
        <CollectPictures onDrawn={drawn.add}>
          {documents.map((markdown) => <MarkdownView key={markdown} markdown={markdown} />)}
        </CollectPictures>
      </PicturesProvider>,
    )
    const printed = [...container.querySelectorAll('img[data-picture]')].map((img) => img.getAttribute('data-picture')!)
    await settled()
    expect(asked).toEqual([])

    const report = await picturesForReport(repositories.images, drawn.pictures())
    expect([...asked].sort()).toEqual([...printed].sort())
    expect(report.pictures.map((one) => one.entry.name)).toEqual(printed)
    expect(report.pictures.map((one) => one.scope)).toEqual(printed.map(() => scope.id))
    expect(report.of(scope.id!, 'depot.png')?.mediaType).toBe('image/png')
  })
})
