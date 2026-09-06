// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { UploadedLogo } from '../../model/types';
import { LogoGrid } from './LogoGrid';
import { LogoLibraryProvider } from './logoRegistry';

/**
 * The picker (Phase 3b). One grid serves the inspector, the palette tray and
 * the element menu's popover, so these tests are where its behaviour is pinned:
 * search filters, None clears, a pick reports the key, and the upload tile shows
 * only when the host can take an upload.
 */

const LIBRARY: UploadedLogo[] = [
  { key: 'lib:eigen-merk', label: 'Eigen merk', url: 'data:image/png;base64,AAA' },
];

afterEach(() => cleanup());

function renderGrid(props: Partial<React.ComponentProps<typeof LogoGrid>> = {}, library = LIBRARY) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <LogoLibraryProvider value={library}>
        <LogoGrid {...props} onChange={onChange} />
      </LogoLibraryProvider>
    </ThemeProvider>,
  );
  return { onChange: onChange as ReturnType<typeof vi.fn> };
}

const search = () => screen.getByLabelText('Search icons');

describe('LogoGrid — the grid', () => {
  it('groups the built-ins under their category headings, None first', () => {
    renderGrid();
    expect(screen.getByLabelText('None')).toBeDefined();
    for (const heading of ['Data', 'Integration', 'Applications', 'Platform', 'Rail', 'Vendors']) {
      expect(screen.getByText(heading)).toBeDefined();
    }
    expect(screen.getByLabelText('Database')).toBeDefined();
    expect(screen.getByLabelText('SAP')).toBeDefined();
  });

  it('names itself as a group so the inspector and the tray can both label it', () => {
    renderGrid({ label: 'Icon' });
    const group = screen.getByRole('group', { name: 'Icon' });
    expect(within(group).getByLabelText('None')).toBeDefined();
  });

  it('lists uploaded marks under their own group, as images and never inline', () => {
    renderGrid();
    expect(screen.getByText('Uploaded')).toBeDefined();
    const tile = screen.getByLabelText('Eigen merk');
    const image = within(tile).getByRole('presentation');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe(LIBRARY[0].url);
  });

  it('marks the current choice as pressed, and only that one', () => {
    renderGrid({ value: 'database' });
    expect(screen.getByLabelText('Database').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('None').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Cache').getAttribute('aria-pressed')).toBe('false');
  });

  it('selects None when nothing is set', () => {
    renderGrid();
    expect(screen.getByLabelText('None').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('LogoGrid — picking', () => {
  it('reports the picked key', () => {
    const { onChange } = renderGrid();
    fireEvent.click(screen.getByLabelText('Database'));
    expect(onChange).toHaveBeenCalledWith('database');
  });

  it('reports an uploaded key as-is, namespace and all', () => {
    const { onChange } = renderGrid();
    fireEvent.click(screen.getByLabelText('Eigen merk'));
    expect(onChange).toHaveBeenCalledWith('lib:eigen-merk');
  });

  it('clears with None — undefined, not an empty string', () => {
    const { onChange } = renderGrid({ value: 'database' });
    fireEvent.click(screen.getByLabelText('None'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disables every tile in read-only mode', () => {
    const { onChange } = renderGrid({ disabled: true });
    const tile = screen.getByLabelText('Database') as HTMLButtonElement;
    expect(tile.disabled).toBe(true);
    fireEvent.click(tile);
    expect(onChange).not.toHaveBeenCalled();
    expect((search() as HTMLInputElement).disabled).toBe(true);
  });
});

describe('LogoGrid — search', () => {
  it('filters to the matching marks and drops the empty groups', () => {
    renderGrid();
    fireEvent.change(search(), { target: { value: 'database' } });

    expect(screen.getByLabelText('Database')).toBeDefined();
    expect(screen.queryByLabelText('Cache')).toBeNull();
    expect(screen.queryByText('Rail')).toBeNull();
  });

  it('finds a mark by a Dutch keyword the label never mentions', () => {
    renderGrid();
    fireEvent.change(search(), { target: { value: 'materieel' } });
    expect(screen.getByLabelText('Rolling stock')).toBeDefined();
    expect(screen.queryByLabelText('Database')).toBeNull();
  });

  it('filters the uploaded group too', () => {
    renderGrid();
    fireEvent.change(search(), { target: { value: 'eigen' } });
    expect(screen.getByLabelText('Eigen merk')).toBeDefined();
    expect(screen.queryByLabelText('Database')).toBeNull();
  });

  it('keeps the uploads under their own heading — "vendors" finds brand marks, not uploads', () => {
    renderGrid();
    fireEvent.change(search(), { target: { value: 'vendors' } });
    expect(screen.getByText('Vendors')).toBeDefined();
    expect(screen.queryByLabelText('Eigen merk')).toBeNull();
    expect(screen.queryByText('Uploaded')).toBeNull();

    fireEvent.change(search(), { target: { value: 'uploaded' } });
    expect(screen.getByLabelText('Eigen merk')).toBeDefined();
    expect(screen.queryByText('Vendors')).toBeNull();
  });

  it('keeps None reachable while filtered — clearing is never hidden behind a search', () => {
    renderGrid({ value: 'database' });
    fireEvent.change(search(), { target: { value: 'zzzznope' } });
    expect(screen.getByLabelText('None')).toBeDefined();
    expect(screen.getByText(/No icons match/)).toBeDefined();
  });
});

describe('LogoGrid — the upload tile', () => {
  it('appears only when the host can handle an upload', () => {
    const onRequestUpload = vi.fn();
    renderGrid({ onRequestUpload });
    fireEvent.click(screen.getByLabelText('Upload a logo'));
    expect(onRequestUpload).toHaveBeenCalledTimes(1);

    cleanup();
    renderGrid();
    expect(screen.queryByLabelText('Upload a logo')).toBeNull();
  });

  it('offers the upload group even with an empty library', () => {
    renderGrid({ onRequestUpload: vi.fn() }, []);
    expect(screen.getByText('Uploaded')).toBeDefined();
    expect(screen.getByLabelText('Upload a logo')).toBeDefined();
  });

  it('shows no uploaded group at all without a library or an upload handler', () => {
    renderGrid({}, []);
    expect(screen.queryByText('Uploaded')).toBeNull();
  });
});
