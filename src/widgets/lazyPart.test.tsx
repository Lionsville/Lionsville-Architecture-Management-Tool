// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A part that is not in the first download. Every part here is made inside
 * its test, after the suite's setup has preloaded the ones its imports made
 * (`app/testing/lazyParts.ts`), so each starts out unfetched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Component, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { lazyPart, PartNotLoaded } from './lazyPart'

afterEach(() => cleanup())

type Props = { open: boolean; title: string }

function Page({ open, title }: Props) {
  return open ? <h1>{title}</h1> : <p>closed</p>
}

/** A page that holds something of its own: how often its button was pressed. */
function Counter({ title }: Props) {
  const [pressed, setPressed] = useState(0)
  return <button onClick={() => { setPressed(pressed + 1) }}>{`${title} ${pressed}`}</button>
}

/** A fetch the test lets go of when it says so. */
function held(part: ComponentType<Props> = Page) {
  let release!: () => void
  const load = vi.fn(() => new Promise<ComponentType<Props>>((resolve) => { release = () => resolve(part) }))
  return { load, release: () => act(async () => { release(); await Promise.resolve() }) }
}

describe('lazyPart', () => {
  it('fetches nothing for a page that has not been opened', () => {
    const { load } = held()
    const Part = lazyPart(load, { until: (props: Props) => props.open })
    render(<Part open={false} title="Register" />)
    expect(load).not.toHaveBeenCalled()
    expect(screen.queryByText('closed')).toBeNull()
  })

  it('draws the fallback while the script is on the way, and the page once it is there', async () => {
    const { load, release } = held()
    const Part = lazyPart(load, { until: (props: Props) => props.open, fallback: () => <span>loading</span> })
    render(<Part open title="Register" />)
    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.getByText('loading')).toBeTruthy()
    await release()
    expect(await screen.findByText('Register')).toBeTruthy()
  })

  it('draws a page it has loaded directly after that, open or not, so its closing plays out', async () => {
    const { load, release } = held()
    const Part = lazyPart(load, { until: (props: Props) => props.open })
    const { rerender } = render(<Part open title="Register" />)
    await release()
    await screen.findByText('Register')
    rerender(<Part open={false} title="Register" />)
    expect(screen.getByText('closed')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps what a page holds through the renders after its script arrived', async () => {
    const { load, release } = held(Counter)
    const Part = lazyPart(load, { until: (props: Props) => props.open })
    const { rerender } = render(<Part open title="Register" />)
    await release()
    fireEvent.click(await screen.findByText('Register 0'))
    expect(screen.getByText('Register 1')).toBeTruthy()
    // The caller draws again — a register that changed, a page that closed:
    // the part is the one it was, not one drawn anew from nothing.
    rerender(<Part open title="Register" />)
    expect(screen.getByText('Register 1')).toBeTruthy()
    rerender(<Part open={false} title="Register" />)
    expect(screen.getByText('Register 1')).toBeTruthy()
  })

  it('draws a part whose script arrived while it was not wanted in the very render that wants it', async () => {
    const { load, release } = held(Counter)
    const Part = lazyPart(load, { until: (props: Props) => props.open })
    const { rerender } = render(<Part open={false} title="Register" />)
    const fetched = Part.preload()
    await release()
    await fetched
    // No await: what an eager part would be, in the same commit as the change
    // that wanted it — a page opened by a press holds the focus before the next key.
    rerender(<Part open title="Register" />)
    fireEvent.click(screen.getByText('Register 0'))
    rerender(<Part open={false} title="Register" />)
    expect(screen.getByText('Register 1')).toBeTruthy()
  })

  it('brings the parts it opens: fetched beside it, and here before it is drawn', async () => {
    const page = held()
    const plan = held()
    const Plan = lazyPart(plan.load, { until: (props: Props) => props.open })
    const Roadmap = lazyPart(page.load, { until: (props: Props) => props.open, brings: [Plan], fallback: () => <span>loading</span> })
    const { rerender } = render(<><Roadmap open title="Roadmap" /><Plan open={false} title="Plan" /></>)
    expect(page.load).toHaveBeenCalledTimes(1)
    expect(plan.load).toHaveBeenCalledTimes(1)
    await page.release()
    expect(screen.getByText('loading')).toBeTruthy()
    await plan.release()
    expect(await screen.findByText('Roadmap')).toBeTruthy()
    rerender(<><Roadmap open title="Roadmap" /><Plan open title="Plan" /></>)
    expect(screen.getByText('Plan')).toBeTruthy()
    expect(plan.load).toHaveBeenCalledTimes(1)
  })

  it('is drawn all the same where a part it brings will not load, which asks again when it is wanted', async () => {
    const plan = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('the script is gone')))
      .mockImplementation(() => Promise.resolve(Page))
    const Plan = lazyPart<Props>(plan, { until: (props) => props.open })
    const Roadmap = lazyPart<Props>(() => Promise.resolve(Page), { brings: [Plan] })
    await Roadmap.preload()
    render(<><Roadmap open title="Roadmap" /><Plan open title="Plan" /></>)
    expect(screen.getByText('Roadmap')).toBeTruthy()
    expect(await screen.findByText('Plan')).toBeTruthy()
    expect(plan).toHaveBeenCalledTimes(2)
  })

  /**
   * Offline, a reader whose thread had not arrived: the import rejects as a
   * browser's does, and the line takes the part's place while the rest of
   * the screen stands and answers its keys.
   */
  it('draws a quiet line with Try again where its script will not load, and the screen around it goes on working', async () => {
    const load = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
      .mockImplementation(() => Promise.resolve(Page))
    const Part = lazyPart<Props>(load)
    const typed = vi.fn()
    render(<><input aria-label="reader" onKeyDown={(event) => { if (event.key === 'Enter') typed() }} /><Part open title="Comments" /></>)
    expect((await screen.findByTestId('part-not-loaded')).textContent).toContain('This could not be loaded.')
    const reader = screen.getByLabelText('reader')
    reader.focus()
    fireEvent.keyDown(reader, { key: 'Enter' })
    expect(typed).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(reader)
    fireEvent.click(screen.getByTestId('part-retry'))
    expect(await screen.findByText('Comments')).toBeTruthy()
    expect(screen.queryByTestId('part-not-loaded')).toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('draws what the part says where its script will not load, and asks again from it', async () => {
    const load = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
      .mockImplementation(() => Promise.resolve(Page))
    const Part = lazyPart<Props>(load, { failed: (props, retry) => <button onClick={retry}>{`${props.title} not here`}</button> })
    render(<Part open title="Comments" />)
    fireEvent.click(await screen.findByText('Comments not here'))
    expect(await screen.findByText('Comments')).toBeTruthy()
  })

  it('says a part\'s own words through the line', () => {
    render(<PartNotLoaded message="comments.notLoaded" onRetry={() => {}} />)
    expect(screen.getByTestId('part-not-loaded').textContent).toBe('Comments could not be loaded.Try again')
  })

  it('leaves a part that loaded and then throws to the boundary above, as before', async () => {
    function Broken(): ReactNode { throw new Error('a bug in the part') }
    class Above extends Component<{ children: ReactNode }, { caught?: string }> {
      override state: { caught?: string } = {}
      static getDerivedStateFromError(caught: Error) { return { caught: caught.message } }
      override render() { return this.state.caught ? <p>{this.state.caught}</p> : this.props.children }
    }
    const Part = lazyPart<Props>(() => Promise.resolve(Broken as ComponentType<Props>))
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<Above><Part open title="Comments" /></Above>)
      expect(await screen.findByText('a bug in the part')).toBeTruthy()
      expect(screen.queryByTestId('part-not-loaded')).toBeNull()
    } finally {
      quiet.mockRestore()
    }
  })

  it('asks again after a fetch that failed', async () => {
    const load = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('the script is gone')))
      .mockImplementation(() => Promise.resolve(Page))
    const Part = lazyPart<Props>(load)
    await expect(Part.preload()).rejects.toThrow('the script is gone')
    await Part.preload()
    render(<Part open title="Register" />)
    expect(screen.getByText('Register')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })
})
