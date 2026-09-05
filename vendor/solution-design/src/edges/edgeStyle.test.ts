import { describe, expect, it } from 'vitest';
import {
  edgeDashArray,
  edgePathKind,
  resolveArrowheads,
  resolveEdgeStroke,
} from './edgeStyle';

/**
 * U4b edge-style resolution. These fallbacks are the D1 contract: an
 * absent/NULL field must resolve exactly as the edge rendered before this
 * feature existed.
 */

describe('resolveEdgeStroke', () => {
  it('uses the explicit colour when set', () => {
    expect(resolveEdgeStroke('#2f6fdb', '#theme')).toBe('#2f6fdb');
  });
  it('falls back to the theme token when absent', () => {
    expect(resolveEdgeStroke(undefined, '#theme')).toBe('#theme');
  });
});

describe('edgeDashArray', () => {
  it('is undefined for solid and for absent (the default)', () => {
    expect(edgeDashArray(undefined)).toBeUndefined();
    expect(edgeDashArray('solid')).toBeUndefined();
  });
  it('returns a dash pattern for dashed and dotted', () => {
    expect(edgeDashArray('dashed')).toBe('6 4');
    expect(edgeDashArray('dotted')).toBe('1.5 5');
  });
});

describe('resolveArrowheads', () => {
  it('derives from isBidirectional when no explicit heads (today\'s default)', () => {
    expect(resolveArrowheads({ isBidirectional: false })).toEqual({ start: false, end: true });
    expect(resolveArrowheads({ isBidirectional: true })).toEqual({ start: true, end: true });
  });
  it('lets explicit per-end tokens override the derivation', () => {
    expect(
      resolveArrowheads({ isBidirectional: false, sourceArrowhead: 'arrow', targetArrowhead: 'none' }),
    ).toEqual({ start: true, end: false });
    // Explicit "none" on the source of a bidirectional edge beats the derivation.
    expect(
      resolveArrowheads({ isBidirectional: true, sourceArrowhead: 'none' }),
    ).toEqual({ start: false, end: true });
  });
});

describe('edgePathKind', () => {
  it('maps absent to smoothstep (today\'s default)', () => {
    expect(edgePathKind(undefined)).toBe('smoothstep');
    expect(edgePathKind('smooth')).toBe('smoothstep');
  });
  it('maps each explicit routing token', () => {
    expect(edgePathKind('orthogonal')).toBe('orthogonal');
    expect(edgePathKind('straight')).toBe('straight');
    expect(edgePathKind('curved')).toBe('curved');
  });
});
