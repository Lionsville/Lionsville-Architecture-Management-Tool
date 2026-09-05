import { describe, expect, it } from 'vitest';
import { LAYOUT_OPTIONS, groupOptions } from './elkLayout';

/**
 * Feedback round: layered spacing set on the root graph does NOT inherit into a
 * compound node, so every spacing we configure at the root has to be repeated
 * in `groupOptions` — otherwise a domain group's members silently fall back to
 * ELK's defaults on a whole-board Tidy while the same group tidied alone (flat
 * graph, root options apply) uses our values. That bug has now landed twice
 * (nodeNode gaps, then the edge-label clearances), so it is asserted
 * structurally: adding a spacing to LAYOUT_OPTIONS and forgetting the compound
 * node fails here instead of on someone's board.
 */
describe('compound nodes repeat every root spacing', () => {
  const spacingKeys = Object.keys(LAYOUT_OPTIONS).filter((key) => key.includes('.spacing.'));

  it('covers every root spacing key', () => {
    const group = groupOptions(64);
    expect(spacingKeys.length).toBeGreaterThan(0);
    for (const key of spacingKeys) {
      expect(group, `groupOptions is missing ${key}`).toHaveProperty(key);
    }
  });

  it('uses the caller density for the node gaps and constants for label clearance', () => {
    const group = groupOptions(120);
    expect(group['elk.spacing.nodeNode']).toBe('120');
    expect(group['elk.layered.spacing.nodeNodeBetweenLayers']).toBe('120');
    // Label clearance is set by the chip size, not by density — it matches the
    // root value at every density.
    expect(group['elk.spacing.edgeLabel']).toBe(LAYOUT_OPTIONS['elk.spacing.edgeLabel']);
    expect(group['elk.layered.spacing.edgeNodeBetweenLayers']).toBe(
      LAYOUT_OPTIONS['elk.layered.spacing.edgeNodeBetweenLayers'],
    );
  });
});

/**
 * The hybrid direction (feedback item 7): group boxes flow one way, their members
 * the other.
 *
 * The measurement this rests on is that a compound node's own `elk.direction` is
 * **silently ignored** under the default `INCLUDE_CHILDREN` — `root=RIGHT,
 * group=DOWN` produces the identical layout to `root=RIGHT, group=inherit`. So
 * the per-group direction and `SEPARATE_CHILDREN` are one feature and must ship
 * together; setting either alone is a no-op or a behaviour change nobody asked
 * for.
 */
describe('groupOptions — the per-group direction', () => {
  it('sets a direction inside the group when one is given', () => {
    expect(groupOptions(64, 'DOWN')['elk.direction']).toBe('DOWN');
  });

  it('sets NO direction when none is given, so every other mode inherits the root', () => {
    // The guard on "nothing about today's output moves": Across, Down and Auto
    // must reach ELK exactly as they did before hybrid existed.
    expect(groupOptions(64)).not.toHaveProperty('elk.direction');
  });

  it('keeps repeating every root spacing when a direction is added', () => {
    // The drift test above, re-run for the new signature — adding an option must
    // not quietly drop one.
    const group = groupOptions(64, 'DOWN');
    for (const key of Object.keys(LAYOUT_OPTIONS).filter((k) => k.includes('.spacing.'))) {
      expect(group, `groupOptions is missing ${key}`).toHaveProperty(key);
    }
  });
});
