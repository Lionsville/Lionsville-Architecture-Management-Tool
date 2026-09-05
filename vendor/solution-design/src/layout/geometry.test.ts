import { describe, expect, it } from 'vitest';
import type { Point, Rect } from '../types';
import { inflate, pathHitsObstacles, segmentIntersectsRect } from './geometry';

const p = (x: number, y: number): Point => ({ x, y });
const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

describe('inflate', () => {
  it('grows on every side by margin', () => {
    expect(inflate(rect(10, 10, 20, 20), 5)).toEqual(rect(5, 5, 30, 30));
  });
  it('shrinks with a negative margin', () => {
    expect(inflate(rect(10, 10, 20, 20), -2)).toEqual(rect(12, 12, 16, 16));
  });
});

describe('segmentIntersectsRect', () => {
  const box = rect(100, 100, 100, 100); // spans x 100..200, y 100..200

  it('true when the segment passes straight through', () => {
    expect(segmentIntersectsRect(p(0, 150), p(300, 150), box)).toBe(true);
  });
  it('true when an endpoint sits inside', () => {
    expect(segmentIntersectsRect(p(150, 150), p(400, 150), box)).toBe(true);
  });
  it('false when the segment goes around', () => {
    expect(segmentIntersectsRect(p(0, 0), p(300, 0), box)).toBe(false);
  });
  it('false for a segment flush along the boundary (zero-length overlap)', () => {
    // Running exactly along the top edge y=100 grazes but does not cut through.
    expect(segmentIntersectsRect(p(0, 100), p(300, 100), box)).toBe(false);
  });
  it('true for a diagonal that clips a corner region', () => {
    expect(segmentIntersectsRect(p(90, 210), p(210, 90), box)).toBe(true);
  });
  it('respects margin', () => {
    // Passes 5px above the box: clean at margin 0, a hit once inflated by 10.
    expect(segmentIntersectsRect(p(0, 95), p(300, 95), box)).toBe(false);
    expect(segmentIntersectsRect(p(0, 95), p(300, 95), box, 10)).toBe(true);
  });
});

describe('pathHitsObstacles', () => {
  const obstacles = [rect(100, 100, 100, 100)];
  it('counts a straight path that cuts through', () => {
    expect(pathHitsObstacles([p(0, 150), p(300, 150)], obstacles)).toBe(1);
  });
  it('is zero for a path that routes around', () => {
    const around = [p(0, 150), p(0, 50), p(300, 50), p(300, 150)];
    expect(pathHitsObstacles(around, obstacles)).toBe(0);
  });
  it('counts each offending segment against each obstacle', () => {
    const two = [rect(100, 100, 50, 100), rect(200, 100, 50, 100)];
    expect(pathHitsObstacles([p(0, 150), p(300, 150)], two)).toBe(2);
  });
});
