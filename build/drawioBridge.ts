// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the app adds to the pruned draw.io, at the end of its `PostConfig.js`.
 *
 * draw.io's JSON protocol says nothing about what is selected and cannot set a
 * shape's link, and those are the two things the app needs to say *this shape
 * points at Billing* in words. So a little of this runs inside the frame: it
 * tells the page which shape is selected and what it points at, takes back
 * where a shape should point, and takes down draw.io's hint with the raw
 * `element:<id>` address, which the page's strip replaces.
 *
 * The frame stays as sandboxed as it was and holds nothing it did not have. It
 * speaks only to its parent, the way draw.io's own protocol does. A draw.io
 * whose names have moved loses the strip and keeps everything else, which is why
 * each hook looks before it reaches, and the pin is what moves them.
 */
export const DRAWIO_BRIDGE = `
;(function () {
  if (typeof EditorUi === 'undefined' || typeof mxVertexHandler === 'undefined') return;
  var ELEMENT = /^element:(.+)$/;
  var say = function (message) { window.parent.postMessage(JSON.stringify(message), '*'); };

  var hint = mxVertexHandler.prototype.updateLinkHint;
  if (hint) {
    mxVertexHandler.prototype.updateLinkHint = function (link, links) {
      return hint.call(this, ELEMENT.test(link || '') ? null : link, links);
    };
  }

  var install = function (ui) {
    var graph = ui.editor && ui.editor.graph;
    if (!graph || !graph.getSelectionModel) return;
    var told = function () {
      var cells = graph.getSelectionCells();
      var cell = cells.length === 1 && graph.getModel().isVertex(cells[0]) ? cells[0] : null;
      var link = cell ? graph.getLinkForCell(cell) : null;
      var matched = ELEMENT.exec(link || '');
      say({ event: 'lvSelection', shape: cell ? cell.id : null, element: matched ? matched[1] : null, any: cells.length > 0 });
      // The format panel is there for what is selected, and the canvas is what a person came for.
      if (ui.toggleFormatPanel) ui.toggleFormatPanel(cells.length > 0);
    };
    graph.getSelectionModel().addListener(mxEvent.CHANGE, told);
    window.addEventListener('message', function (event) {
      if (event.source !== window.parent || typeof event.data !== 'string') return;
      var asked;
      try { asked = JSON.parse(event.data); } catch (e) { return; }
      // A drawing loaded: nothing is selected, and draw.io has just put its panels up.
      if (asked && asked.action === 'load') { window.setTimeout(told, 300); return; }
      if (!asked || asked.action !== 'lvPoint') return;
      var cell = graph.getModel().getCell(asked.shape);
      if (!cell) return;
      graph.getModel().beginUpdate();
      try {
        graph.setLinkForCell(cell, asked.element ? 'element:' + asked.element : null);
        if (asked.element && asked.name) graph.cellLabelChanged(cell, asked.name, false);
      } finally {
        graph.getModel().endUpdate();
      }
      told();
    });
  };

  var init = EditorUi.prototype.init;
  EditorUi.prototype.init = function () {
    var answer = init.apply(this, arguments);
    install(this);
    return answer;
  };
})();
`
