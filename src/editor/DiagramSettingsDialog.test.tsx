// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { DEFAULT_ASPECT_CONFIG } from '../model/aspects';
import type { DesignDiagram, DiagramSettings } from '../model/types';

afterEach(() => cleanup());

const diagram = (over: Partial<DesignDiagram> = {}): DesignDiagram => ({
  id: 'd1', kind: 'layer7', name: 'Landscape', placements: [], ...over,
});

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
  it('shows the standard five when the diagram has never been configured', () => {
    open();
    for (const entry of DEFAULT_ASPECT_CONFIG) expect(labelField(entry.label)).toBeDefined();
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

  it('derives the placeholder for a column with no curated code', () => {
    open({ aspectConfig: [{ key: 'custom-obs', label: 'Observability' }] });
    expect((screen.getByLabelText('Badge') as HTMLInputElement).placeholder).toBe('OBS');
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

  it('renames a column without moving its key, so recorded statuses survive', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Disaster recovery' }] });
    fireEvent.change(labelField('Disaster recovery'), { target: { value: 'Continuity' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
  });

  it('keeps a badge code and drops a blank one', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity', code: 'CONT' }] });
    fireEvent.change(labelField('CONT'), { target: { value: 'CNT' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([
      { key: 'dr', label: 'Continuity', code: 'CNT' },
    ]);
  });

  it('drops a column that was emptied rather than saving a nameless one', () => {
    const { onSave } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.change(labelField('Cost'), { target: { value: '  ' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
  });

  it('removes a column outright', () => {
    const { onSave } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cost' }));
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }]);
  });

  it('saves an empty column set, which is how a landscape says it tracks none', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Continuity' }));
    expect(screen.getByText(/no maturity badges at all/)).toBeDefined();
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([]);
  });

  it('reorders columns', () => {
    const { onSave } = open({
      aspectConfig: [{ key: 'dr', label: 'Continuity' }, { key: 'cost', label: 'Cost' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move Cost up' }));
    save();
    expect(onSave.mock.calls[0][1].aspectConfig?.map((c) => c.key)).toEqual(['cost', 'dr']);
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

  it('keys a custom column from the label it ends up with, not the placeholder', () => {
    const { onSave } = open({ aspectConfig: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Add your own' }));
    fireEvent.change(labelField('New column'), { target: { value: 'Service levels' } });
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([
      { key: 'custom-service-levels', label: 'Service levels' },
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

  it('resets to the standard five', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'custom-sla', label: 'SLA' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to the standard five' }));
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toEqual([...DEFAULT_ASPECT_CONFIG]);
  });

  it('hides the badges without discarding the columns', () => {
    const { onSave } = open({ aspectConfig: [{ key: 'dr', label: 'Continuity' }] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show maturity badges' }));
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
  it('offers the title block but no maturity columns', () => {
    const { onSave } = open({ kind: 'container', name: 'App · containers' });
    expect(screen.getByLabelText('Author')).toBeDefined();
    expect(screen.queryByText('MATURITY COLUMNS')).toBeNull();
    save();
    expect(onSave.mock.calls[0][1].aspectConfig).toBeUndefined();
  });
});
