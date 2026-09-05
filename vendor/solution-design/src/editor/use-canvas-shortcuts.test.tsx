// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { type RefObject } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import type { ClipboardPayload } from '../model/clipboard';
import type { DesignDiagram, DesignModel } from '../types';
import type { EditorActions, Selection } from './useEditorState';
import { GRID_SIZE } from '../canvas/DiagramCanvas';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { useCanvasShortcuts, type CanvasShortcutHandlers } from './use-canvas-shortcuts';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

/** jsdom reports an empty navigator.platform → the keymap resolves Mod to Ctrl. */
const MOD = { ctrlKey: true } as const;

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ elementId: 'a1', zone: 'landscape', x: 100, y: 200 }] }],
    elements: [
      { id: 'a1', kind: 'application', name: 'App', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
  };
}

function diagram(m: DesignModel): DesignDiagram {
  return m.diagrams[0];
}

function stubActions(): EditorActions {
  return {
    addElement: vi.fn(),
    setAutoRoute: vi.fn(),
    updateElement: vi.fn(),
    updateElements: vi.fn(),
    movePlacements: vi.fn(),
    setPlacements: vi.fn(),
    applyTidyResult: vi.fn(),
    setDomainGroup: vi.fn(),
    setDomainGroups: vi.fn(),
    changeElementKind: vi.fn(),
    connect: vi.fn(),
    reconnect: vi.fn(),
    pasteClipboard: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    deleteSelection: vi.fn(),
    removeFromDiagram: vi.fn(),
    deleteFromModel: vi.fn(),
    setEdgeRoute: vi.fn(),
    setEdgeLabelPosition: vi.fn(),
    setRouteSource: vi.fn(),
    resetEdgeRoute: vi.fn(),
    setRouteSides: vi.fn(),
    setZoneSize: vi.fn(),
    setCanvasSize: vi.fn(),
    resizePlacement: vi.fn(),
    upsertDomainGroup: vi.fn(),
    moveDomainGroup: vi.fn(),
    renameDomainGroup: vi.fn(),
    removeDomainGroup: vi.fn(),
  };
}

interface HarnessProps {
  handlers: Omit<CanvasShortcutHandlers, 'clipboardRef' | 'pasteCountRef'>;
  clipboardRef: RefObject<ClipboardPayload | null>;
  pasteCountRef: RefObject<number>;
  /** Gate the container so tests can exercise late-mount / remount. */
  mounted?: boolean;
}

function Harness({ handlers, clipboardRef, pasteCountRef, mounted = true }: HarnessProps) {
  const setContainer = useCanvasShortcuts({ ...handlers, clipboardRef, pasteCountRef });
  if (!mounted) return <div data-testid="placeholder" />;
  return (
    <div ref={setContainer} data-testid="container">
      <div data-testid="node" tabIndex={0} />
      <input data-testid="field" />
      {/* Stands in for the inspector: a subtree that swallows keydown before it
          can bubble to the editor wrapper. MUI popovers, portals and a few of
          the inspector's own controls do exactly this, which is why ⌘Z from an
          inspector button used to do nothing (4B review follow-up). */}
      <div data-testid="inspector" onKeyDownCapture={(event) => event.stopPropagation()}>
        <button type="button" data-testid="inspector-button" />
        <input data-testid="inspector-field" />
      </div>
      {/* Stands in for the panel seam: an ARIA separator whose whole keyboard
          contract is ← and →, the keys the canvas would otherwise nudge with. */}
      <div data-testid="seam" role="separator" tabIndex={0} />
      {/* And the general marker — the palette's filter wraps itself in one. */}
      <div data-testid="ignored" data-shortcuts-ignore="">
        <button type="button" data-testid="ignored-child" />
      </div>
    </div>
  );
}

function setup(overrides: Partial<CanvasShortcutHandlers> = {}, mounted = true) {
  const m = model();
  const actions = stubActions();
  const setSelection = vi.fn<(s: Selection) => void>();
  const undo = vi.fn();
  const redo = vi.fn();
  const onForceSave = vi.fn();
  const onShowHelp = vi.fn();
  const onRequestDeleteElement = vi.fn();
  const onOpenContextMenu = vi.fn();
  const onRequestRename = vi.fn();
  const clipboardRef: RefObject<ClipboardPayload | null> = { current: null };
  const pasteCountRef: RefObject<number> = { current: 0 };

  const handlers: Omit<CanvasShortcutHandlers, 'clipboardRef' | 'pasteCountRef'> = {
    readOnly: false,
    model: m,
    diagram: diagram(m),
    selection: { elementIds: ['a1'], connectionIds: [], domainGroups: [] },
    actions,
    undo,
    redo,
    setSelection,
    onForceSave,
    onShowHelp,
    onRequestDeleteElement,
    onOpenContextMenu,
    onRequestRename,
    ...overrides,
  };

  const ui = (isMounted: boolean) => (
    <ReactFlowProvider>
      <Harness
        handlers={handlers}
        clipboardRef={clipboardRef}
        pasteCountRef={pasteCountRef}
        mounted={isMounted}
      />
    </ReactFlowProvider>
  );

  const view = render(ui(mounted));
  const setMounted = (isMounted: boolean) => view.rerender(ui(isMounted));
  return {
    view,
    setMounted,
    actions,
    setSelection,
    undo,
    redo,
    onForceSave,
    onShowHelp,
    onRequestDeleteElement,
    onOpenContextMenu,
    onRequestRename,
    clipboardRef,
    pasteCountRef,
  };
}

function node(view: ReturnType<typeof render>) {
  return view.getByTestId('node');
}

describe('useCanvasShortcuts — bail guard', () => {
  it('fires nothing when the target is an editable field', () => {
    const { view, actions, setSelection } = setup();
    fireEvent.keyDown(view.getByTestId('field'), { key: 'a', ...MOD });
    expect(setSelection).not.toHaveBeenCalled();
    expect(actions.pasteClipboard).not.toHaveBeenCalled();
  });

  /**
   * Controls that own their own keys.
   *
   * The panel seam resizes with ← and →; the palette's filter clears with
   * Escape. Neither is a text field, so `isEditableTarget` lets them through,
   * and neither can defend itself with `stopPropagation()` — this hook listens
   * on `document` in the CAPTURE phase, so it has already acted by the time a
   * React handler on the control runs. Both keys therefore used to mean two
   * things at once: resize AND nudge, clear AND deselect.
   */
  /**
   * Both listeners have to agree. jsdom reports every element as
   * `offsetParent: null`, which is exactly the "editor is not visible" case the
   * document listener declines — so a plain render exercises the wrapper
   * fallback, and faking offsetParent exercises the document capture listener.
   */
  for (const visible of [false, true]) {
    const path = visible ? 'document capture listener' : 'wrapper fallback listener';

    function setupWithPath() {
      const harness = setup();
      if (visible) {
        Object.defineProperty(harness.view.getByTestId('container'), 'offsetParent', {
          configurable: true,
          get: () => document.body,
        });
      }
      return harness;
    }

    it(`leaves the arrows to a role="separator" target (${path})`, () => {
      const { view, actions } = setupWithPath();
      fireEvent.keyDown(view.getByTestId('seam'), { key: 'ArrowRight' });
      expect(actions.movePlacements).not.toHaveBeenCalled();
      // …and the same key from the canvas still nudges, so the guard is narrow.
      fireEvent.keyDown(node(view), { key: 'ArrowRight' });
      expect(actions.movePlacements).toHaveBeenCalledTimes(1);
    });

    it(`leaves every chord to a data-shortcuts-ignore target, Escape included (${path})`, () => {
      const { view, actions, setSelection, undo } = setupWithPath();
      const ignored = view.getByTestId('ignored-child');
      fireEvent.keyDown(ignored, { key: 'Escape' });
      fireEvent.keyDown(ignored, { key: 'ArrowRight' });
      fireEvent.keyDown(ignored, { key: 'z', ...MOD });
      expect(setSelection).not.toHaveBeenCalled();
      expect(actions.movePlacements).not.toHaveBeenCalled();
      expect(undo).not.toHaveBeenCalled();
    });
  }

  it('still flushes a pending save from an ignored target', () => {
    // ⌘S keeps its licence everywhere: a save you asked for must not depend on
    // where the focus ring happened to be. (Through the document listener, so
    // the visible-editor gate has to be satisfied — jsdom reports every element
    // as offsetParent-less.)
    const { view, onForceSave } = setup();
    const container = view.getByTestId('container');
    Object.defineProperty(container, 'offsetParent', {
      configurable: true,
      get: () => document.body,
    });
    view.getByTestId('seam').dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(onForceSave).toHaveBeenCalledTimes(1);
  });
});

describe('useCanvasShortcuts — dispatch', () => {
  it('Mod+A selects all placed nodes (and preventDefaults the browser)', () => {
    const { view, setSelection } = setup();
    const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(event);
    expect(setSelection).toHaveBeenCalledWith({
      elementIds: ['a1'],
      connectionIds: [],
      domainGroups: [],
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('Escape deselects when something is selected', () => {
    const { view, setSelection } = setup();
    fireEvent.keyDown(node(view), { key: 'Escape' });
    expect(setSelection).toHaveBeenCalledWith({
      elementIds: [],
      connectionIds: [],
      domainGroups: [],
    });
  });

  it('Delete routes a selected element to the confirm dialog', () => {
    const m = model();
    const { view, onRequestDeleteElement } = setup({
      selectedElement: m.elements[0],
    });
    fireEvent.keyDown(node(view), { key: 'Delete' });
    expect(onRequestDeleteElement).toHaveBeenCalledWith('a1');
  });

  it('Delete removes a multi-selection via deleteSelection (no single-item ref set)', () => {
    const selection = { elementIds: ['a1', 'b2'], connectionIds: ['c1'], domainGroups: [] };
    const { view, actions, onRequestDeleteElement } = setup({ selection });
    fireEvent.keyDown(node(view), { key: 'Delete' });
    expect(onRequestDeleteElement).not.toHaveBeenCalled();
    expect(actions.deleteSelection).toHaveBeenCalledWith(selection);
  });

  it('Mod+C copies to the clipboard and resets the paste cascade', () => {
    const { view, clipboardRef, pasteCountRef } = setup();
    pasteCountRef.current = 3;
    fireEvent.keyDown(node(view), { key: 'c', ...MOD });
    expect(clipboardRef.current?.elements.map((e) => e.id)).toEqual(['a1']);
    expect(pasteCountRef.current).toBe(0);
  });

  it('Mod+V pastes the clipboard with a cascading offset', () => {
    const { view, actions, clipboardRef, pasteCountRef } = setup();
    clipboardRef.current = { elements: [], connections: [], placements: [] };
    fireEvent.keyDown(node(view), { key: 'v', ...MOD });
    expect(actions.pasteClipboard).toHaveBeenCalledWith(clipboardRef.current, {
      x: GRID_SIZE,
      y: GRID_SIZE,
    });
    expect(pasteCountRef.current).toBe(1);
  });

  it('Mod+X cuts: copies to clipboard then deletes the selection once', () => {
    const { view, actions, clipboardRef } = setup();
    fireEvent.keyDown(node(view), { key: 'x', ...MOD });
    expect(clipboardRef.current?.elements.map((e) => e.id)).toEqual(['a1']);
    expect(actions.deleteSelection).toHaveBeenCalledTimes(1);
    expect(actions.deleteSelection).toHaveBeenCalledWith({
      elementIds: ['a1'],
      connectionIds: [],
      domainGroups: [],
    });
  });

  it('Mod+D duplicates in place at a fixed grid offset, untouched by the paste cascade', () => {
    const { view, actions, clipboardRef, pasteCountRef } = setup();
    pasteCountRef.current = 5;
    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(event);
    expect(actions.pasteClipboard).toHaveBeenCalledTimes(1);
    expect(actions.pasteClipboard).toHaveBeenCalledWith(expect.anything(), { x: GRID_SIZE, y: GRID_SIZE });
    // Independent of the Cmd+V cascade: neither the counter nor the clipboard move.
    expect(pasteCountRef.current).toBe(5);
    expect(clipboardRef.current).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });

  it('Arrow nudges by a grid step through movePlacements (one batch)', () => {
    const { view, actions } = setup();
    fireEvent.keyDown(node(view), { key: 'ArrowRight' });
    expect(actions.movePlacements).toHaveBeenCalledTimes(1);
    expect(actions.movePlacements).toHaveBeenCalledWith([
      { elementId: 'a1', x: 100 + GRID_SIZE, y: 200, zone: 'landscape', domainGroup: undefined },
    ]);
  });

  it('Shift+Arrow nudges by 1px', () => {
    const { view, actions } = setup();
    fireEvent.keyDown(node(view), { key: 'ArrowUp', shiftKey: true });
    expect(actions.movePlacements).toHaveBeenCalledWith([
      { elementId: 'a1', x: 100, y: 199, zone: 'landscape', domainGroup: undefined },
    ]);
  });

  it('Mod+S force-saves and preventDefaults the browser save dialog', () => {
    const { view, onForceSave } = setup();
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(event);
    expect(onForceSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('? opens the help overlay', () => {
    const { view, onShowHelp } = setup();
    fireEvent.keyDown(node(view), { key: '?', shiftKey: true });
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });

  it('Shift+F10 and the Menu key both ask for the context menu, selection or not', () => {
    const { view, onOpenContextMenu } = setup({ selection: { elementIds: [], connectionIds: [], domainGroups: [] } });
    fireEvent.keyDown(node(view), { key: 'F10', shiftKey: true });
    fireEvent.keyDown(node(view), { key: 'ContextMenu' });
    expect(onOpenContextMenu).toHaveBeenCalledTimes(2);
    // Plain F10 is the browser's; it must not open anything.
    fireEvent.keyDown(node(view), { key: 'F10' });
    expect(onOpenContextMenu).toHaveBeenCalledTimes(2);
  });

  it('F2 asks for a rename of the selection, and is inert without one or read-only', () => {
    const { view, onRequestRename } = setup();
    fireEvent.keyDown(node(view), { key: 'F2' });
    expect(onRequestRename).toHaveBeenCalledTimes(1);

    cleanup();
    const empty = setup({ selection: { elementIds: [], connectionIds: [], domainGroups: [] } });
    fireEvent.keyDown(node(empty.view), { key: 'F2' });
    expect(empty.onRequestRename).not.toHaveBeenCalled();

    cleanup();
    const readOnly = setup({ readOnly: true });
    fireEvent.keyDown(node(readOnly.view), { key: 'F2' });
    expect(readOnly.onRequestRename).not.toHaveBeenCalled();
  });
});

describe('useCanvasShortcuts — undo/redo (U7)', () => {
  it('Mod+Z undoes and preventDefaults the browser undo', () => {
    const { view, undo } = setup();
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(event);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Mod+Shift+Z and Mod+Y both redo', () => {
    const { view, redo } = setup();
    fireEvent.keyDown(node(view), { key: 'z', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(node(view), { key: 'y', ctrlKey: true });
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it('does not fire while typing in an editable field', () => {
    const { view, undo, redo } = setup();
    fireEvent.keyDown(view.getByTestId('field'), { key: 'z', ...MOD });
    fireEvent.keyDown(view.getByTestId('field'), { key: 'z', ctrlKey: true, shiftKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('is inert under readOnly but still swallows the browser chord', () => {
    const { view, undo } = setup({ readOnly: true });
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(event);
    expect(undo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('useCanvasShortcuts — late mount / remount', () => {
  it('attaches once the container mounts after the first render', () => {
    const { view, setSelection, setMounted } = setup({}, false);
    // Container absent on first render.
    expect(view.queryByTestId('node')).toBeNull();

    setMounted(true);
    fireEvent.keyDown(view.getByTestId('node'), { key: 'a', ...MOD });
    expect(setSelection).toHaveBeenCalledTimes(1);
  });

  it('re-binds to the new node on unmount → remount (no orphaned listener)', () => {
    const { view, setSelection, setMounted } = setup();

    // Unmount the container (defined → undefined), then remount as a fresh node.
    setMounted(false);
    setMounted(true);

    fireEvent.keyDown(view.getByTestId('node'), { key: 'a', ...MOD });
    // Exactly one dispatch — proves no duplicate listener from the old node.
    expect(setSelection).toHaveBeenCalledTimes(1);
  });
});

describe('useCanvasShortcuts — document-level force-save (QF2)', () => {
  const modS = () =>
    new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });

  /** jsdom always reports offsetParent = null; fake "visible" for the gate. */
  function makeVisible(el: HTMLElement) {
    Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  }

  it('force-saves from document.body when the editor is the active surface', () => {
    const { view, onForceSave } = setup();
    makeVisible(view.getByTestId('container'));
    const event = modS();
    document.body.dispatchEvent(event);
    expect(onForceSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dispatches exactly once — the container listener does not also fire it', () => {
    const { view, onForceSave } = setup();
    makeVisible(view.getByTestId('container'));
    const event = modS();
    node(view).dispatchEvent(event);
    expect(onForceSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('no-ops when the editor is not the visible surface (gated on offsetParent)', () => {
    const { onForceSave } = setup(); // offsetParent stays null → editor is hidden
    document.body.dispatchEvent(modS());
    expect(onForceSave).not.toHaveBeenCalled();
  });

  it('removes the document listener on unmount', () => {
    const { view, onForceSave } = setup();
    makeVisible(view.getByTestId('container'));
    view.unmount();
    document.body.dispatchEvent(modS());
    expect(onForceSave).not.toHaveBeenCalled();
  });
});

describe('useCanvasShortcuts — readOnly gating', () => {
  it('blocks mutating shortcuts but still selects, and preventDefaults Mod+D', () => {
    const { view, actions, setSelection } = setup({ readOnly: true });
    // Duplicate is inert but still swallows the bookmark shortcut.
    const dup = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    node(view).dispatchEvent(dup);
    expect(actions.pasteClipboard).not.toHaveBeenCalled();
    expect(dup.defaultPrevented).toBe(true);

    // Nudge is inert in read-only.
    fireEvent.keyDown(node(view), { key: 'ArrowRight' });
    expect(actions.movePlacements).not.toHaveBeenCalled();

    // Selection still works read-only.
    fireEvent.keyDown(node(view), { key: 'a', ...MOD });
    expect(setSelection).toHaveBeenCalled();
  });
});

describe('useCanvasShortcuts — reach (4B: every chord, not only force-save)', () => {
  /** jsdom always reports offsetParent = null; fake "visible" for the gate. */
  function makeVisible(el: HTMLElement) {
    Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  }

  it('fires ⌘Z from a subtree that swallows the event before the wrapper sees it', () => {
    // The reported bug: focus on an inspector button, ⌘Z does nothing. The
    // container listener never got the event; the document-level one does.
    const { view, undo } = setup();
    makeVisible(view.getByTestId('container'));
    fireEvent.keyDown(view.getByTestId('inspector-button'), { key: 'z', ...MOD });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('dispatches exactly once when the event WOULD also reach the wrapper', () => {
    const { view, undo } = setup();
    makeVisible(view.getByTestId('container'));
    fireEvent.keyDown(node(view), { key: 'z', ...MOD });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('still bails inside a text field, wherever that field lives', () => {
    const { view, undo } = setup();
    makeVisible(view.getByTestId('container'));
    fireEvent.keyDown(view.getByTestId('inspector-field'), { key: 'z', ...MOD });
    expect(undo).not.toHaveBeenCalled();
  });

  it('leaves the rest of the page alone — a chord typed elsewhere is not ours', () => {
    const { view, undo } = setup();
    makeVisible(view.getByTestId('container'));
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    fireEvent.keyDown(outside, { key: 'z', ...MOD });
    expect(undo).not.toHaveBeenCalled();
    outside.remove();
  });

  it('force-save keeps its licence: it fires from a field and from outside', () => {
    const { view, onForceSave } = setup();
    makeVisible(view.getByTestId('container'));
    fireEvent.keyDown(view.getByTestId('inspector-field'), { key: 's', ...MOD });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    fireEvent.keyDown(outside, { key: 's', ...MOD });
    expect(onForceSave).toHaveBeenCalledTimes(2);
    outside.remove();
  });

  it('is inert while the editor is hidden — the container listener still serves it', () => {
    // No `makeVisible`: the document listener declines, and the fallback
    // listener on the wrapper answers a chord aimed at the canvas.
    const { view, undo } = setup();
    fireEvent.keyDown(node(view), { key: 'z', ...MOD });
    expect(undo).toHaveBeenCalledTimes(1);
  });
});

describe('useCanvasShortcuts — find (⌘F)', () => {
  it('opens the element finder and swallows the browser find bar', () => {
    const onOpenSearch = vi.fn();
    const { view } = setup({ onOpenSearch });
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    node(view).dispatchEvent(event);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still swallows the chord when no finder is wired', () => {
    const { view } = setup();
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    node(view).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('useCanvasShortcuts — it does not silence anybody else', () => {
  function makeVisible(el: HTMLElement) {
    Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  }

  it('lets a React handler further up still see the key it dispatched', () => {
    // Escape both deselects AND reverts the domain-group rename draft / closes
    // the palette tray; those handlers sit on React's render root, above the
    // editor wrapper. Stopping the event at the document would kill them.
    const { view, setSelection } = setup();
    makeVisible(view.getByTestId('container'));
    const seen: string[] = [];
    view.container.addEventListener('keydown', (event) => seen.push((event as KeyboardEvent).key));
    fireEvent.keyDown(node(view), { key: 'Escape' });
    expect(setSelection).toHaveBeenCalled();
    expect(seen).toEqual(['Escape']);
  });
});
