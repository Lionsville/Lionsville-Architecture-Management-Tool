import { describe, expect, it, vi } from 'vitest';
import { readOnce, remembering } from './remember';

/**
 * The bound, and the promise that goes with it: forgetting is invisible.
 * Everything filed here is a pure function of its key, so an evicted answer is
 * recomputed and is the same answer — which is what makes the limit a memory
 * decision rather than a behaviour one.
 */

describe('a bounded store', () => {
  it('answers with what it was given', () => {
    const held = remembering<number>(3);
    held.set('a', 1);
    expect(held.get('a')).toBe(1);
    expect(held.get('b')).toBeUndefined();
  });

  it('never holds more than its limit', () => {
    const held = remembering<number>(3);
    for (let n = 0; n < 100; n += 1) held.set(`k${n}`, n);
    expect(held.size).toBe(3);
  });

  it('forgets the one it has gone longest without being asked for', () => {
    const held = remembering<number>(3);
    held.set('a', 1);
    held.set('b', 2);
    held.set('c', 3);
    // Asking for `a` makes `b` the oldest, so the fourth entry evicts `b`.
    expect(held.get('a')).toBe(1);
    held.set('d', 4);
    expect(held.get('b')).toBeUndefined();
    expect(held.get('a')).toBe(1);
    expect(held.get('c')).toBe(3);
    expect(held.get('d')).toBe(4);
  });

  it('does not grow when a key is written twice', () => {
    const held = remembering<number>(3);
    held.set('a', 1);
    held.set('a', 2);
    expect(held.size).toBe(1);
    expect(held.get('a')).toBe(2);
  });
});

describe('a reader that answers from memory', () => {
  it('reads a text once', () => {
    const read = vi.fn((text: string) => text.length);
    const reader = readOnce(read, 10);
    expect(reader('hello')).toBe(5);
    expect(reader('hello')).toBe(5);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('tells two texts apart', () => {
    const reader = readOnce((text: string) => text.toUpperCase(), 10);
    expect(reader('a')).toBe('A');
    expect(reader('b')).toBe('B');
    expect(reader('a')).toBe('A');
  });

  it('remembers an absent answer as an answer', () => {
    const read = vi.fn(() => undefined);
    const reader = readOnce(read, 10);
    expect(reader('x')).toBeUndefined();
    expect(reader('x')).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('gives the same answer after it has forgotten and read again', () => {
    const read = vi.fn((text: string) => text.length);
    const reader = readOnce(read, 2);
    expect(reader('one')).toBe(3);
    reader('two');
    reader('three');
    expect(reader('one')).toBe(3);
    expect(read).toHaveBeenCalledTimes(4);
  });
});
