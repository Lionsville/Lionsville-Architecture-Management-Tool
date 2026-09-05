// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { InspectorPanel } from './InspectorPanel';

/**
 * U7b collapse: the inspector shrinks to a rail with an always-reachable expand
 * chevron; expanding restores the body. InspectorPanel is presentational
 * (collapse state is owned by EditorBody), so a small stateful harness exercises
 * the toggle.
 */

afterEach(() => cleanup());

function Harness({ initial = false }: { initial?: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <ThemeProvider theme={createTheme()}>
      <InspectorPanel collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)}>
        <div>PANEL_BODY</div>
      </InspectorPanel>
    </ThemeProvider>
  );
}

describe('InspectorPanel — collapse (U7b)', () => {
  it('renders the body and a collapse chevron when expanded', () => {
    render(<Harness />);
    expect(screen.getByText('PANEL_BODY')).toBeDefined();
    expect(screen.getByLabelText('Collapse inspector')).toBeDefined();
  });

  it('collapsing hides the body and shows an expand chevron; expanding restores it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Collapse inspector'));

    // Rail: body gone, expand chevron reachable.
    expect(screen.queryByText('PANEL_BODY')).toBeNull();
    expect(screen.getByLabelText('Expand inspector')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Expand inspector'));
    expect(screen.getByText('PANEL_BODY')).toBeDefined();
    expect(screen.getByLabelText('Collapse inspector')).toBeDefined();
  });

  it('exposes a reachable toggle when mounted already-collapsed', () => {
    render(<Harness initial />);
    expect(screen.queryByText('PANEL_BODY')).toBeNull();
    expect(screen.getByLabelText('Expand inspector')).toBeDefined();
  });
});
