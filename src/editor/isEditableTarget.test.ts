// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isEditableTarget, isShortcutIgnoredTarget } from './isEditableTarget';

describe('isEditableTarget', () => {
  function el(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  }

  it('is true for text inputs and textareas', () => {
    // (contentEditable is also honoured, but jsdom leaves isContentEditable
    // unimplemented, so it can't be exercised here.)
    expect(isEditableTarget(el('<input />'))).toBe(true);
    expect(isEditableTarget(el('<textarea></textarea>'))).toBe(true);
  });

  it('is true for a MUI Select trigger and its portalled menu items', () => {
    expect(isEditableTarget(el('<div role="combobox"></div>'))).toBe(true);
    expect(isEditableTarget(el('<div role="listbox"></div>'))).toBe(true);
    expect(isEditableTarget(el('<div aria-haspopup="listbox"></div>'))).toBe(true);
    // A menu option nested inside the listbox (closest walks up to it).
    const listbox = el('<ul role="listbox"><li role="option"><span>Bus</span></li></ul>');
    const span = listbox.querySelector('span') as HTMLElement;
    expect(isEditableTarget(span)).toBe(true);
  });

  it('is false for genuine node/canvas targets so Delete still removes them', () => {
    expect(isEditableTarget(el('<div></div>'))).toBe(false);
    expect(isEditableTarget(el('<button>Add</button>'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isShortcutIgnoredTarget', () => {
  function el(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  }

  it('is true for a separator — the panel seams own ← and →', () => {
    expect(isShortcutIgnoredTarget(el('<div role="separator"></div>'))).toBe(true);
  });

  it('is true anywhere inside a data-shortcuts-ignore subtree', () => {
    const wrapper = el('<div data-shortcuts-ignore=""><input /></div>');
    expect(isShortcutIgnoredTarget(wrapper)).toBe(true);
    expect(isShortcutIgnoredTarget(wrapper.querySelector('input'))).toBe(true);
  });

  it('answers for a text node through its parent', () => {
    const wrapper = el('<div data-shortcuts-ignore="">seam</div>');
    expect(isShortcutIgnoredTarget(wrapper.firstChild)).toBe(true);
  });

  it('is false for the canvas and for nothing at all', () => {
    expect(isShortcutIgnoredTarget(el('<div class="react-flow__node"></div>'))).toBe(false);
    expect(isShortcutIgnoredTarget(null)).toBe(false);
  });
});
