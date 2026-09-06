import { describe, expect, it } from 'vitest';
import { createTempId, isTempId } from './ids';

describe('createTempId / isTempId', () => {
  it('mints ids with the tmp- prefix', () => {
    const id = createTempId();
    expect(id.startsWith('tmp-')).toBe(true);
    expect(isTempId(id)).toBe(true);
  });

  it('mints unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createTempId()));
    expect(ids.size).toBe(200);
  });

  it('recognises server ids as non-temp', () => {
    expect(isTempId('42')).toBe(false);
    expect(isTempId('')).toBe(false);
    expect(isTempId('temporary')).toBe(false);
  });
});
