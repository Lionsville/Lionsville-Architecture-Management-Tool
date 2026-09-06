import { createContext, useContext } from 'react';
import type { MenuTarget } from './menuItems';
import type { MenuOpenEvent } from './useContextMenu';

/**
 * Lets layers rendered INSIDE the canvas (the domain-group boxes, for one) open
 * the canvas's context menu for their own target, without the callback having to
 * climb to the canvas's parent and back down again. `DiagramCanvas` provides it;
 * anything drawn into the flow viewport may consume it.
 */
export interface CanvasMenuApi {
  open(target: MenuTarget, event: MenuOpenEvent): void;
}

const noop: CanvasMenuApi = { open: () => undefined };

export const CanvasMenuContext = createContext<CanvasMenuApi>(noop);

export function useCanvasMenu(): CanvasMenuApi {
  return useContext(CanvasMenuContext);
}
