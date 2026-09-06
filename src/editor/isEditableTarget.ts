/**
 * True when a keyboard event's target is a text-entry surface where the editor
 * must NOT hijack keys (copy/paste, Delete/Backspace, and the U4c canvas
 * shortcuts all bail on this). Covers native inputs and MUI Select internals.
 *
 * Extracted from SolutionDesignEditor so U4a's copy/paste path and the U4c
 * shortcut hook share one guard (behaviour unchanged from commit e357a01).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return true;
  // MUI Select renders its trigger as div[role="combobox"] and its open menu
  // as [role="listbox"] with [role="option"] items in a portal. Treat all of
  // these as editable so Backspace/Delete and Cmd+C/V don't leak to the editor
  // (deleting connections, opening the delete-confirm) while a dropdown is
  // focused. closest(...) covers portalled menu items too.
  return !!target.closest(
    '[role="combobox"], [role="listbox"], [role="option"], [aria-haspopup="listbox"]',
  );
}

/**
 * The marker a control puts on itself to say "these keys are mine".
 *
 * `isEditableTarget` covers text entry, which is the common case, but not the
 * other one: a widget that is not a text field and yet owns the very keys the
 * canvas shortcuts want. The panel seam is the example that forced this — an
 * ARIA `separator` whose whole keyboard contract is ← and →, exactly the keys
 * that nudge a selection. Stopping the React synthetic event there does not
 * help: the canvas's own listeners are NATIVE ones, on `document` in the
 * capture phase and on the editor wrapper, and both have already run by the
 * time React's root handler sees the key. So the guard has to live here, at
 * the point where the shortcut dispatch decides whether the event is its own.
 */
export const SHORTCUTS_IGNORE_ATTR = 'data-shortcuts-ignore';

const IGNORED_SELECTOR = `[role="separator"], [${SHORTCUTS_IGNORE_ATTR}]`;

/**
 * True when the event happened inside a control that owns its own keys — a
 * `role="separator"` (the panel seams) or anything carrying
 * `data-shortcuts-ignore`. Such a target is "not ours": the shortcut dispatch
 * skips it entirely, so one keypress means one thing.
 */
export function isShortcutIgnoredTarget(target: EventTarget | null): boolean {
  // Duck-typed on `closest` rather than `instanceof Element`, so this stays
  // callable from a plain-node test without a DOM global in scope; a text node
  // (which has no `closest`) answers through its parent.
  const node = target as (Node & { closest?: (selector: string) => Element | null }) | null;
  const element = typeof node?.closest === 'function' ? node : node?.parentElement;
  return !!element?.closest?.(IGNORED_SELECTOR);
}
