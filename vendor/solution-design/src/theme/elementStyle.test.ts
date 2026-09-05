import { describe, expect, it } from 'vitest';
import { resolveAccent, shapeRadiusFor } from './elementStyle';

/**
 * U6a element-style resolution. These fallbacks are the D1/D2 contract: an
 * absent/NULL field must resolve exactly as the node rendered before this
 * feature existed (byte-identical when unset).
 */

describe('resolveAccent', () => {
  it('uses the explicit accent colour when set', () => {
    expect(resolveAccent({ accentColor: '#2f6fdb' }, '#fallback')).toBe('#2f6fdb');
  });
  it('falls back to the theme token when absent', () => {
    expect(resolveAccent({ accentColor: undefined }, '#fallback')).toBe('#fallback');
  });
});

describe('shapeRadiusFor', () => {
  it('returns each kind\'s current radius for the NULL variant (byte-identical)', () => {
    expect(shapeRadiusFor('application', undefined, false)).toBe(2);
    expect(shapeRadiusFor('externalSystem', undefined, false)).toBe(2);
    expect(shapeRadiusFor('inputChannel', undefined, false)).toBe(2);
    expect(shapeRadiusFor('managementTool', undefined, false)).toBe(2);
    expect(shapeRadiusFor('component', undefined, false)).toBe(2);
    expect(shapeRadiusFor('boundary', undefined, false)).toBe(3);
  });

  it('preserves the actor\'s conditional shape when the variant is NULL', () => {
    // No description → stadium pill; a description → rounded rect (ActorNode).
    expect(shapeRadiusFor('actor', undefined, false)).toBe(999);
    expect(shapeRadiusFor('actor', undefined, true)).toBe(2);
  });

  it('squares every kind for the sharp variant', () => {
    expect(shapeRadiusFor('application', 'sharp', false)).toBe(0);
    expect(shapeRadiusFor('actor', 'sharp', false)).toBe(0);
    expect(shapeRadiusFor('boundary', 'sharp', false)).toBe(0);
  });

  it('maps subtle and rounded on the plain rounded-rect kinds', () => {
    expect(shapeRadiusFor('externalSystem', 'subtle', false)).toBe(2);
    expect(shapeRadiusFor('externalSystem', 'rounded', false)).toBe(4);
    // Input channel is a plain rounded rect — no stadium clamp on any variant.
    expect(shapeRadiusFor('inputChannel', 'subtle', false)).toBe(2);
    expect(shapeRadiusFor('inputChannel', 'rounded', false)).toBe(4);
    expect(shapeRadiusFor('inputChannel', 'sharp', false)).toBe(0);
  });

  it('keeps the actor pill for subtle/rounded when it has no description', () => {
    expect(shapeRadiusFor('actor', 'subtle', false)).toBe(999);
    expect(shapeRadiusFor('actor', 'rounded', false)).toBe(999);
    expect(shapeRadiusFor('actor', 'sharp', false)).toBe(0);
  });

  it('treats a described actor like the rounded-rect kinds', () => {
    expect(shapeRadiusFor('actor', 'subtle', true)).toBe(2);
    expect(shapeRadiusFor('actor', 'rounded', true)).toBe(4);
    expect(shapeRadiusFor('actor', 'sharp', true)).toBe(0);
  });
});
