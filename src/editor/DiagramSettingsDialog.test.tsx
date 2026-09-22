// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DEFAULT_ASPECT_CONFIG } from '../model/aspects';
import type { DesignDiagram, DiagramSettings } from '../model/types';

afterEach(() => cleanup());

const diagram = (over: Partial<DesignDiagram> = {}): DesignDiagram => (laidOut({
  id: 'd1', kind: 'layer7', name: 'Landscape', placements: [], ...over,
}));

function open(over: Partial<DesignDiagram> = {}, client = 'Acme Logistics') {
  const onSave = vi.fn<(id: string, settings: DiagramSettings) => void>();
  const onClose = vi.fn();
  render(
    <DiagramSettingsDialog
      target={diagram(over)}
      defaultClient={client}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

/** The label field of the nth column row, found by its current value. */
const labelField = (value: string) => screen.getByDisplayValue(value);

describe('DiagramSettingsDialog — what it opens with', () => {
  it('opens on the standard five, with a derived placeholder where no code is curated', () => {
    open();
    for (const entry of DEFAULT_ASPECT_CONFIG) expect(labelField(entry.label)).toBeDefined();
    cleanup()
    open({ aspectConfig: [{ key: 'custom-obs', label: 'Observability' }] });
    expect((screen.getByLabelText('Badge') as HTMLInputElement).placeholder).toBe('OBS');
  });

  it('shows the configured columns instead, when there are some', () => {
    open({ aspectConfig: [{ key: 'dr', label: 'Continuity', code: 'CONT' }] });
    expect(labelField('Continuity')).toBeDefined();
    expect(labelField('CONT')).toBeDefined();
    expect(screen.queryByDisplayValue('Platform')).toBeNull();
  });

  /**
   * The whole reason hiding is a flag and not an empty config: what somebody
   * built has to still be there when they switch it back on.
   */
  it('still shows a hidden diagram its columns', () => {
    open({ showAspects: false, aspectConfig: [{ key: 'dr', label: 'Continuity' }] });
    expect(labelField('Continuity')).toBeDefined();
    expect(screen.getByText(/kept, and come back/)).toBeDefined();
  });

  /**
   * The placeholder is a promise about the card: leave this empty and the badge
   * says *that*. A curated code must not be shown as something derived.
   */
  it('shows the code the badge would actually carry as the placeholder', () => {
    open({ aspectConfig: [{ key: 'dr', label: 'Disaster recovery' }] });
    const code = screen.getByLabelText('Badge') as HTMLInputElement;
    expect(code.value).toBe('');
    expect(code.placeholder).toBe('DR');
  });

  it('offers the group as the client placeholder rather than filling it in', () => {
    open({}, 'Acme Rail');
    const field = screen.getByLabelText('Client') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.placeholder).toBe('Acme Rail');
  });
});

describe('DiagramSettingsDialog — what it saves', () => {
  it('stores only the deviations, so an untouched diagram stays untouched', () => {
    const { onSave } = open();
    save();
    expect(onSave).toHaveBeenCalledWith('d1', {
      name: 'Landscape',
      author: undefined,
      client: undefined,
      documentDate: undefined,
      showTitleBlock: undefined,
      aspectConfig: [...DEFAULT_ASPECT_CONFIG],
      showAspects: undefined,
    });
  });

  it('carries the title-block fields it was given', () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: ' W. Simons ' } });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'Acme Rail' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-05' } });
    save();
    expect(onSave.mock.calls[0][1]).toMatchObject({
      author: 'W. Simons', client: 'Acme Rail', documentDate: '2026-09-05',
    });
  });

  it('turns the title block off as an explicit false, not an absence', () => {
    const { onSave } = open();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Draw the title block' }));
    save();
    expect(onSave.mock.calls[0][1].showTitleBlock).toBe(false);
  });

  it('renames a column without moving its key, and keys a custom one from the label it ends with', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Disaster recovery' }] });
    fireEvent.change(labelField('Disaster recovery'), { target: { value: 'Continuity' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
    cleanup()
    const { onSave: onSave2 } = open({ aspectConfig: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Add your own' }));
    fireEvent.change(labelField('New column'), { target: { value: 'Service levels' } });
    save();
    expect(onSave2.mock.calls[0][1].aspectConfig).toEqual([
      { key: 'custom-service-levels', label: 'Service levels' },
    ]);
  });

  it('keeps a badge code, drops a blank one, and drops a column that was emptied', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity', code: 'CONT' }] });
    fireEvent.change(labelField('CONT'), { target: { value: 'CNT' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([
      { key: 'dr', label: 'Continuity', code: 'CNT' },
    ]);
    cleanup()
    const { onSave: onSave2 } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.change(labelField('Cost'), { target: { value: '  ' } });
    save();
    expect(onSave2.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
  });

  it('removes a column outright, reorders them, and resets to the standard five', () => {
    const { onSave } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cost' }));
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
    cleanup()
    const { onSave: onSave2 } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move Cost up' }));
    save();
    expect(onSave2.mock.calls[0][1].aspectConfig?.map((c) => c.key)).toEqual(['cost', 'dr']);
    cleanup()
    const { onSave: onSave3 } = open({ aspectConfig: [{ key: 'custom-sla', label: 'SLA' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to the standard five' }));
    save();
    expect(onSave3.mock.calls[0][1].aspectConfig).toEqual([...DEFAULT_ASPECT_CONFIG]);
  });

  it('saves an empty column set, which is how a landscape says it tracks none', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Continuity' }));
    expect(screen.getByText(/no operational aspects at all/)).toBeDefined();
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([]);
  });

  it('adds a standard column, and stops offering the ones already in use', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Disaster recovery' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Add standard…' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByText('Disaster recovery')).toBeNull();
    fireEvent.click(within(menu).getByText('Compliance'));
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([
      { key: 'dr', label: 'Disaster recovery' },
      { key: 'compliance', label: 'Compliance' },
    ]);
  });

  it('keeps two new columns apart even when they end up named the same', () => {
    const { onSave } = open({ aspectConfig: [] });
    const add = screen.getByRole('button', { name: 'Add your own' });
    fireEvent.click(add);
    fireEvent.change(labelField('New column'), { target: { value: 'Risk' } });
    fireEvent.click(add);
    fireEvent.change(labelField('New column'), { target: { value: 'Risk' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig?.map((c) => c.key))
      .toEqual(['custom-risk', 'custom-risk-2']);
  });

  it('hides the badges without discarding the columns', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity' }] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show the operational aspects' }));
    save();
    expect(onSave.mock.calls[0][1]).toMatchObject({
      showAspects: false,
      aspectConfig: [{ key: 'dr', label: 'Continuity' }],
    });
  });

  it('refuses a nameless diagram', () => {
    open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DiagramSettingsDialog — a container diagram', () => {
  it('offers the title block but no operational aspects', () => {
    const { onSave } = open({ kind: 'container', name: 'App · containers' });
    expect(screen.getByLabelText('Author')).toBeDefined();
    expect(screen.queryByText('OPERATIONAL ASPECTS')).toBeNull();
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toBeUndefined();
  });
});
