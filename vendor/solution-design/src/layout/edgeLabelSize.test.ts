import { describe, expect, it } from 'vitest';
import { edgeLabelSize } from './edgeLabelSize';

describe('edgeLabelSize — chip-calibrated label estimator (U-edge-1)', () => {
  it('returns undefined when there is no label', () => {
    expect(edgeLabelSize({})).toBeUndefined();
    expect(edgeLabelSize({ label: '' })).toBeUndefined();
    expect(edgeLabelSize({ label: '   ' })).toBeUndefined();
    // A protocol without a label still reserves nothing — only labelled edges do.
    expect(edgeLabelSize({ protocol: 'HTTPS' })).toBeUndefined();
  });

  it('sizes a short label narrower than the chip cap', () => {
    const size = edgeLabelSize({ label: 'sync' });
    expect(size).toBeDefined();
    expect(size!.width).toBeLessThan(240);
    expect(size!.height).toBe(18);
  });

  it('caps a very long label at the chip maxWidth (240)', () => {
    const size = edgeLabelSize({ label: 'x'.repeat(200) });
    expect(size!.width).toBe(240);
  });

  it('is taller when a protocol line is present', () => {
    const plain = edgeLabelSize({ label: 'reads from' })!;
    const withProtocol = edgeLabelSize({ label: 'reads from', protocol: 'HTTPS' })!;
    expect(withProtocol.height).toBeGreaterThan(plain.height);
    expect(withProtocol.height).toBe(34);
  });

  it('widens to the longest wrapped line and can be driven by a long protocol', () => {
    const multiline = edgeLabelSize({ label: 'a\nlonger second line' })!;
    const single = edgeLabelSize({ label: 'a' })!;
    expect(multiline.width).toBeGreaterThan(single.width);

    // Short label, long protocol: width tracks the protocol.
    const longProtocol = edgeLabelSize({ label: 'ok', protocol: 'AMQP-OVER-WEBSOCKETS' })!;
    expect(longProtocol.width).toBeGreaterThan(edgeLabelSize({ label: 'ok' })!.width);
  });
});
