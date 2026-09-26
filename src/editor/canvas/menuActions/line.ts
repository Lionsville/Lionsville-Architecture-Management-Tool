// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import {
  insertWaypointOnDrawn,
  isAutoRoute,
  removeWaypoint,
  routeFor,
  routeSides,
} from '../../../model/routes';
import { rectOf } from './geometry';
import type { MenuActionFamily } from './types';

/** What a right-click on a line, or on one of its bends, offers. */
export const LINE_ACTIONS = {
  'add-bend': ({ host, state, connectionId }) => {
    if (!connectionId) return;
    const connection = host.model.relations.find((c) => c.id === connectionId);
    if (!connection) return;
    const route = routeFor(host.diagram, connectionId);
    const waypoints = route?.waypoints ?? [];
    // Against the DRAWN line — each end where `routeEndAnchor` attaches it, a
    // fixed side included — so the new bend lands on the leg the user clicked
    // next to.
    const source = rectOf(host, connection.sourceId);
    const target = rectOf(host, connection.targetId);
    if (!source || !target) return;
    host.actions.setEdgeRoute(
      connectionId,
      insertWaypointOnDrawn(waypoints, source, target, state.flowPosition, routeSides(route)),
    );
  },
  'remove-bend': ({ host, state: { target } }) => {
    if (target.kind !== 'edgeHandle') return;
    const waypoints = routeFor(host.diagram, target.connectionId)?.waypoints ?? [];
    host.actions.setEdgeRoute(target.connectionId, removeWaypoint(waypoints, target.index));
  },
  'remove-all-bends': ({ host, connectionId }) => {
    if (connectionId) host.actions.setEdgeRoute(connectionId, []);
  },
  'pin-route': ({ host, connectionId }) => {
    if (!connectionId) return;
    // The same test `menuItems` used for the label, so a click does what it said.
    const route = routeFor(host.diagram, connectionId);
    host.actions.setRouteSource(connectionId, route && !isAutoRoute(route) ? 'auto' : 'manual');
  },
  'reset-route': ({ host, connectionId }) => {
    if (connectionId) host.resetRoute?.(connectionId);
  },
  'attach-at': ({ host, args, connectionId }) => {
    if (!connectionId || !args.attachEnd) return;
    host.setRouteSides?.(
      connectionId,
      args.attachEnd === 'source' ? { sourceSide: args.attachSide } : { targetSide: args.attachSide },
    );
  },
  'set-line-shape': ({ host, args, connectionId }) => {
    if (connectionId) host.actions.updateConnection(connectionId, { routing: args.routing });
  },
  'set-direction': ({ host: { actions, model }, args, connectionId }) => {
    if (!connectionId) return;
    if (args.direction === 'one-way') actions.updateConnection(connectionId, { isBidirectional: false });
    else if (args.direction === 'two-way') actions.updateConnection(connectionId, { isBidirectional: true });
    else if (args.direction === 'reverse') {
      const connection = model.relations.find((c) => c.id === connectionId);
      if (connection) {
        actions.updateConnection(connectionId, {
          sourceId: connection.targetId,
          targetId: connection.sourceId,
        });
      }
    }
  },
  'edit-label': ({ host, connectionId }) => {
    if (connectionId) host.editLabel(connectionId);
  },
  'reset-label-position': ({ host, connectionId }) => {
    if (connectionId) host.actions.setEdgeLabelPosition(connectionId, undefined);
  },
  // Where an interface arrives a level down (ADR-0013): the drag without the
  // drag. No container named is the way back to the boundary, which removes
  // the container line rather than re-ending it.
  'lands-on': ({ host: { actions, model }, args, connectionId }) => {
    if (!connectionId) return;
    const connection = model.relations.find((c) => c.id === connectionId);
    if (!connection) return;
    if (args.containerId === undefined) {
      if (connection.refines !== undefined) actions.removeLanding(connectionId);
      return;
    }
    if (connection.refines !== undefined) actions.moveLanding(connectionId, args.containerId);
    else actions.landInterface(connectionId, args.containerId);
  },
  'delete-connection': ({ host, connectionId }) => {
    if (!connectionId) return;
    if (host.requestDeleteConnection) host.requestDeleteConnection(connectionId);
    else host.actions.deleteConnection(connectionId);
  },
} satisfies MenuActionFamily;
