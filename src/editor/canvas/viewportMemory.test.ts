import { describe, expect, it } from 'vitest';
import { ViewportMemory } from './viewportMemory';

describe('ViewportMemory', () => {
  it('answers nothing for a diagram never left, and the last viewport for one that was', () => {
    const memory = new ViewportMemory();
    expect(memory.recall('l7')).toBeUndefined();
    memory.keep('l7', { x: 10, y: 20, zoom: 0.8 });
    memory.keep('l7', { x: 30, y: 40, zoom: 1.2 });
    expect(memory.recall('l7')).toEqual({ x: 30, y: 40, zoom: 1.2 });
  });

  it('keeps one per diagram, and hands out copies', () => {
    const memory = new ViewportMemory();
    const left = { x: 1, y: 2, zoom: 1 };
    memory.keep('l7', left);
    memory.keep('cd', { x: 500, y: 500, zoom: 2 });
    left.x = 99;
    const back = memory.recall('l7')!;
    expect(back).toEqual({ x: 1, y: 2, zoom: 1 });
    back.zoom = 3;
    expect(memory.recall('l7')?.zoom).toBe(1);
    expect(memory.recall('cd')).toEqual({ x: 500, y: 500, zoom: 2 });
  });
});
