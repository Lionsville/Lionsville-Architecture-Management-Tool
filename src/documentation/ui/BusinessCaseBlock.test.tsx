// @vitest-environment jsdom
/**
 * What a reader of a business case sees.
 *
 * The arithmetic is pinned in `businessCase.test.ts` against the workbook this
 * was designed down from; what is pinned here is that the answers reach the
 * page, that a reader can tell a computed row from a typed one, and that a
 * block being typed still shows its own text.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { BusinessCaseBlock } from './BusinessCaseBlock'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const WORKBOOK = [
  'currency: EUR',
  'discount rate: 10%',
  '',
  '| Line          | Year 0   | Year 1 | Year 2  |',
  '| ------------- | -------- | ------ | ------- |',
  '| Investment    | -415 000 |        |         |',
  '| Cost savings  |          | 25 000 | 125 000 |',
].join('\n')

describe('BusinessCaseBlock', () => {
  it('shows the lines that were typed and the rows it worked out', () => {
    const { container } = renderShell(<BusinessCaseBlock code={WORKBOOK} />)
    expect(container.querySelector('[data-state="computed"]')).not.toBeNull()
    expect(screen.getByRole('cell', { name: 'Investment' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Net' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Cumulative' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Year 0' })).toBeTruthy()
  })

  it('names the period the discount rate belongs to, so a reader can check it', () => {
    renderShell(<BusinessCaseBlock code={WORKBOOK} />)
    expect(within(screen.getByTestId('figure-npv')).getByText(/10%/)).toBeTruthy()
  })

  it('computes only what it was given the inputs for', () => {
    renderShell(<BusinessCaseBlock code={WORKBOOK.replace('discount rate: 10%', '')} />)
    expect(screen.queryByTestId('figure-npv')).toBeNull()
    // A payback that never happens is absent rather than shown as a zero.
    expect(screen.queryByTestId('figure-payback')).toBeNull()
    expect(screen.getByTestId('figure-roi')).toBeTruthy()
  })

  it('keeps the source on screen when there are no figures in it yet', () => {
    const { container } = renderShell(<BusinessCaseBlock code={'currency: EUR\nnothing yet'} />)
    expect(container.querySelector('[data-state="unreadable"]')).not.toBeNull()
    expect(container.textContent).toContain('nothing yet')
  })

  it('says the scale and the maximum beside a weighted score', () => {
    // The sheet this replaces reported a score out of a maximum computed at
    // five per criterion under a label that said one to ten.
    renderShell(
      <BusinessCaseBlock
        code={`${WORKBOOK}\n\n| Criterion | Weight | Score |\n| --- | --- | --- |\n| Alignment | 3 | 4 |`}
      />,
    )
    expect(screen.getByText('Weighted score 12 out of 15, scored 1 to 5.')).toBeTruthy()
  })

  it('prints a currency it does not know rather than refusing it', () => {
    const { container } = renderShell(<BusinessCaseBlock code={WORKBOOK.replace('EUR', 'credits')} />)
    expect(container.textContent).toContain('credits')
  })
})
