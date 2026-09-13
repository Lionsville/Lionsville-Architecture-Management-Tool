// @vitest-environment jsdom
/**
 * The BPMN block on screen: a drawing for a document that has one, and the
 * source under a reason for one that cannot be drawn.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { BpmnBlock } from './BpmnBlock'
import { renderShell } from '../../app/testing/renderShell'
import { ORDER_PROCESS } from '../bpmn.test'

afterEach(() => cleanup())

describe('BpmnBlock', () => {
  it('draws the process as SVG, every shape and flow by id', () => {
    renderShell(<BpmnBlock code={ORDER_PROCESS} />)
    const block = screen.getByTestId('bpmn-block')
    expect(block.dataset.state).toBe('drawn')
    const svg = block.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('88 8 724 404')
    expect(svg.querySelectorAll('[data-shape]')).toHaveLength(13)
    expect(svg.querySelector('[data-shape="task"][data-id="check"]')?.textContent).toContain('Check the')
    expect(svg.querySelector('[data-shape="participant"][data-id="acme"]')?.textContent).toBe('Acme Logistics')
    expect(svg.querySelectorAll('[data-edge="sequence"]')).toHaveLength(5)
    expect(svg.querySelector('[data-edge="message"][data-id="mf1"]')?.textContent).toBe('order')
  })

  it('shows the source under a reason when it cannot draw', () => {
    renderShell(<BpmnBlock code="<svg/>" />)
    const block = screen.getByTestId('bpmn-block')
    expect(block.dataset.state).toBe('failed')
    expect(block.textContent).toContain('This process could not be drawn.')
    expect(block.textContent).toContain('not a BPMN document')
    expect(block.querySelector('code')?.textContent).toBe('<svg/>')
  })
})
