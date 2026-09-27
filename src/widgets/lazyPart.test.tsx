// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A part that is not in the first download. Every part here is made inside
 * its test, after the suite's setup has preloaded the ones its imports made
 * (`app/testing/lazyParts.ts`), so each starts out unfetched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { lazyPart } from './lazyPart'

afterEach(() => cleanup())

type Props = { open: boolean; title: string }

function Page({ open, title }: Props) {
  return open ? <h1>{title}</h1> : <p>closed</p>
}

/** A fetch the test lets go of when it says so. */
function held() {
  let release!: () => void
  const load = vi.fn(() => new Promise<typeof Page>((resolve) => { release = () => resolve(Page) }))
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
