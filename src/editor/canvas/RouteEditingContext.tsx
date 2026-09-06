import { createContext, useContext } from 'react';
import type { Point } from '../../model/types';
import type { AttachSidesPatch } from '../../model/routes';

/**
 * Lets FloatingEdge instances edit their manual route, label anchor, and label
 * text, and open the waypoint context menu — without per-edge callback
 * plumbing through edge data.
 */
export interface RouteEditingApi {
  readOnly: boolean;
  /** Replace a connection's waypoints on the active diagram (label anchor kept). */
  setWaypoints(connectionId: string, waypoints: Point[]): void;
  /** Move (or reset, with undefined) a connection's label anchor on the active diagram. */
  setLabelPosition(connectionId: string, position: Point | undefined): void;
  /** Commit an inline label edit (design-wide connection text; undefined clears). */
  setLabelText(connectionId: string, label: string | undefined): void;
  /** Select the connection (label clicks bypass React Flow's edge hit-testing). */
  selectConnection(connectionId: string): void;
  /** Open the line menu for one bend handle (the canvas's shared context menu). */
  openWaypointMenu(connectionId: string, index: number, position: { x: number; y: number }): void;
  /** Open the line menu for the line itself, e.g. from the label chip. */
  openEdgeMenu(connectionId: string, position: { x: number; y: number }): void;
  /** Screen → flow coordinate mapping (zoom/pan aware). */
  toFlowPosition(position: { x: number; y: number }): Point;
  /** Claim the route for the user without touching its geometry (`manual`). */
  pinRoute(connectionId: string): void;
  /** Hand the route back to the next automatic pass (`auto`); a bend-less pin is deleted. */
  unpinRoute(connectionId: string): void;
  /** Forget the stored route and re-route the line — see `EditorActions.resetEdgeRoute`. */
  resetRoute(connectionId: string): void;
  /** Fix (or free, with `undefined`) the side an end attaches to — see `EditorActions.setRouteSides`. */
  setSides(connectionId: string, sides: AttachSidesPatch): void;
  /**
   * Start the inline label editor of one connection — the menu's "Edit label"
   * and F2. A nonce, handled once per edge, exactly like `focusElement`.
   */
  labelEditRequest?: { connectionId: string; nonce: number };
}

const noop: RouteEditingApi = {
  readOnly: true,
  setWaypoints: () => undefined,
  setLabelPosition: () => undefined,
  setLabelText: () => undefined,
  selectConnection: () => undefined,
  openWaypointMenu: () => undefined,
  openEdgeMenu: () => undefined,
  toFlowPosition: (p) => p,
  pinRoute: () => undefined,
  unpinRoute: () => undefined,
  resetRoute: () => undefined,
  setSides: () => undefined,
};

export const RouteEditingContext = createContext<RouteEditingApi>(noop);

export function useRouteEditing(): RouteEditingApi {
  return useContext(RouteEditingContext);
}
