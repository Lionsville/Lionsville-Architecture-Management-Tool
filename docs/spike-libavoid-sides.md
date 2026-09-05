# Spike: can libavoid-js pin a connector end to a side of a shape?

Date: 2026-09-03. Scope: `libavoid-js@0.4.5` as installed in `node_modules`. Report only — no
application source changed. Everything below was verified by running the module under Node
(it loads there fine, no browser needed), one probe mode per process because an emscripten
`abort()` is unrecoverable.

## Verdict

**Yes — via option (b), and only (b).**

- **(a) `ConnEnd(point, visDirs)` is NOT reachable.** It aborts the WASM module.
- **(b) `ShapeConnectionPin(shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)`
  + `ConnEnd(shapeRef, classId)` works**, and the requested side is honoured as a hard
  visibility constraint, not a penalty.

Why (a) fails: the WebIDL binder emits one wasm export per *arity*, and `ConnEnd` has
exactly two — `ConnEnd_1` and `ConnEnd_2`. The JS constructor is
`function(a, c) { this.g = (c === undefined) ? ConnEnd_1(a) : ConnEnd_2(a, c) }`, so *every*
two-argument call lands on `ConnEnd_2`, which is bound to the C++ overload
`ConnEnd(ShapeRef*, unsigned int classId)`. Passing a `Point*` there reinterprets the
pointer as a `ShapeRef*`; the first virtual call through it dies:

```
new Avoid.ConnEnd(pointOnRightEdge, Avoid.ConnDirRight)
  -> Aborted(unhandled exception: RuntimeError: function signature mismatch)
     at wasm://wasm/001da152:wasm-function[301]
  -> every later call throws "program has already aborted!"
```

That is exactly the failure `libavoidRouter.ts` calls *poisoned*: it would take out edge
routing for the whole session. The point-plus-direction overload simply was not put in the
IDL for this build.

## API surface actually available

Enum values, read off the loaded instance (all plain `number`s on the module object):

```
ConnDirNone 0   ConnDirUp 1   ConnDirDown 2   ConnDirLeft 4   ConnDirRight 8   ConnDirAll 15
ConnEndPoint 0  ConnEndShapePin 1  ConnEndJunction 2  ConnEndEmpty 3
portDirectionPenalty 5, reverseDirectionPenalty 8   (RoutingParameter ids)
```

Flags are a bitmask and combine: `ConnDirRight | ConnDirUp` → `directions()` returns 9.
`CONNECTIONPIN_UNSET` / `CONNECTIONPIN_CENTRE` are **not** exported, so class ids must be
our own integers ≥ 1.

`ShapeConnectionPin` constructor arities that exist in the wasm: 2, 3, 6, 7.

- 2: `(junction, classId)`
- 3: `(junction, classId, visDirs)`
- 6: `(shape, classId, xPortion, yPortion, insideOffset, visDirs)` — **always proportional**,
  offsets must be 0..1 (libavoid warns and misplaces the pin otherwise: `(a,1,10,20,0,Up)`
  produced `pos=(1100,2100)`)
- 7: `(shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)` — the one to use

Instance methods present: `setConnectionCost`, `position()`, `position(n)`, `directions()`,
`setExclusive`, `isExclusive`, `updatePosition`.

### Typing mismatches vs the shipped `.d.ts`

`dist/index.d.ts` and `typings/libavoid.d.ts` are byte-identical, and `package.json`'s
`exports["."].types` points at `./dist/libavoid.d.ts`, **which does not exist**. Beyond that:

1. `declare enum ConnDirFlags { // TODO }` — declared empty. The four direction constants are
   undocumented in the typings but present at runtime.
2. `ConnEnd` is typed `new (point)` **and** `new (shapeRef, classId)`. The second is real;
   nothing stops you writing `new ConnEnd(pt, 8)` — it type-checks against the
   `(shapeRef, classId)` signature only by accident, then aborts the module.
3. `ShapeConnectionPin`'s 6-arg proportional form is undocumented.
4. **Arities 4 and 5 are a live bug in the glue.** The JS constructor dispatches to bare
   globals that were never defined —
   `void 0 === h ? _emscripten_bind_ShapeConnectionPin_ShapeConnectionPin_4(...) : ...` — so a
   4- or 5-argument call throws `ReferenceError: ..._ShapeConnectionPin_4 is not defined`.
   Harmless (JS-level throw, module stays healthy) but it must never be reached.
5. `ConnRef` has only 3- and 4-arg wasm exports, yet the typings advertise `new (router)`.
   One- and two-arg calls construct without throwing, passing `undefined` down as null
   endpoints — do not use them.
6. Confirms the existing comment in `libavoidRouter.ts`: `ShapeRef.prototype.id` is
   `undefined`; `id()` lives on `Obstacle.prototype` only.

## Probe output

```
BASELINE centre->centre                (150,150) -> (450,150)

pinA position = (200,150) directions = 8 (asked 8)      # right edge of A
pinB position = (450,100) directions = 1 (asked 1)      # top edge of B
PINS A.right -> B.top   (200,150) -> (300,150) -> (300,84) -> (450,84) -> (450,100)
    first leg leaves RIGHT(+x)   last leg arrives DOWN(+y) into the top pin

PINS A.left -> B.right (deliberately awkward)
    (100,150) -> (84,150) -> (84,216) -> (516,216) -> (516,150) -> (500,150)
    a real detour around both shapes — proof the sides are obeyed, not preferred

MIXED A.bottom-pin -> B.centre-point   (150,200) -> (150,216) -> (450,216) -> (450,150)

portDirectionPenalty = 0 / 100 / 10000 -> byte-identical routes
7-arg right-edge pin, visDirs=ConnDirNone -> directions() == 8   (inferred from boundary)
7-arg centre pin,     visDirs=ConnDirNone -> directions() == 15
```

Shapes were A = 100..200 x 100..200 and B = 400..500 x 100..200, orthogonal router,
`shapeBufferDistance` 16 and `idealNudgingDistance` 32 — the same knobs `newRouter()` sets.

## Caveats

1. **Endpoint stripping must change.** `interiorWaypoints()`
   (`vendor/solution-design/src/layout/libavoidRouter.ts:812-824`) drops `route[0]` and
   `route[n-1]` because today they are node *centres* that the renderer re-derives. With pins
   they are the actual attachment points: the pinned route above strips to
   `(300,150) (300,84) (450,84)` and silently loses both that the edge leaves A at `(200,150)`
   and that it enters B at `(450,100)`. Either keep the endpoints when a side was requested, or
   have the renderer compute the same side anchor the router was given.
2. **Pins default to exclusive.** `isExclusive()` is `true` on a fresh pin, and a second
   connector asking for the same class id loses it. Observed: libavoid warns on **stderr**
   (`console.error` in a browser) — "can't connect to shape 1 since it has no pins with class
   id of 1" — and that `ConnEnd` **silently degrades to the shape centre**. No exception. Call
   `setExclusive(false)` on every pin; this board routinely has several edges on one side.
3. **An unknown class id fails the same silent way**: warning on stderr, route falls back to
   centre-to-centre. Nothing throws, so pin bookkeeping bugs will look like "the side setting
   does nothing" rather than failing loudly. Worth a dev-mode assertion that every
   `ConnEnd(shapeRef, classId)` has a matching pin.
4. **Pin ownership follows the existing discipline.** The `ShapeRef` owns its pins:
   `destroy(router)` succeeds with pins still alive, and we must not destroy them ourselves.
   `ConnEnd`s may still be destroyed right after `new ConnRef(...)` — verified, route unchanged.
5. **`portDirectionPenalty` is irrelevant here** — `visDirs` is a visibility restriction, so
   there is no knob to soften a side constraint. An impossible pair of sides yields a long
   detour, never a "nice" route. A product decision, not a tuning one.
6. Coordinates still carry float noise, so `rounded()` still applies. And pins are
   per-`ShapeRef`, so `addObstacle` must start returning the `ShapeRef` it currently discards.

## Recommended approach for `RouterConnection { sourceSide?, targetSide? }`

`RouterConnection` is at `libavoidRouter.ts:56-60`; the call path is
`runTier` (`:842`) → `addObstacle` (`:757`) / `addConnector` (`:770`).

1. **Type.** `type RouterSide = 'top' | 'right' | 'bottom' | 'left';` and add optional
   `sourceSide?: RouterSide; targetSide?: RouterSide;` to `RouterConnection`. Absent means
   "as today" — a centre `ConnEnd(point)`. This keeps every existing route byte-identical,
   which the current test suite will confirm.
2. **Extend `AvoidApi`** (hand-written slice at `:205-310`, `interface AvoidApi` at `:284`)
   with the four `ConnDir*` readonly numbers, an `AvoidShapeConnectionPin`
   (`setExclusive`, `directions`, `position`), the 7-arg `ShapeConnectionPin` constructor, and a
   second `ConnEnd` overload `new (shape: AvoidShapeRef, classId: number) => AvoidConnEnd`.
   Do **not** add a `(point, visDirs)` overload — see the verdict above.
3. **Keep ShapeRefs.** Have `addObstacle` return its `AvoidShapeRef` and let `runTier` hold an
   `ElementId -> AvoidShapeRef` map. Obstacles already go in in canonical id-sorted order, so
   the map is deterministic.
4. **Pin class ids.** Four fixed ids per shape — `top: 1, right: 2, bottom: 3, left: 4` — and
   create a pin **lazily**, only for sides some connection actually asks for. Fixed ids keep
   them stable across runs (matters for the id-sorted-determinism invariant) and let two
   connections share one side's pin. Offsets: `proportional: true`, `insideOffset: 0`, e.g.
   right = `(1.0, 0.5, ConnDirRight)`, top = `(0.5, 0.0, ConnDirUp)`. Always
   `setExclusive(false)`.
5. **`addConnector`** takes the optional sides and builds each end as either
   `new ConnEnd(shapeRef, classId)` or the existing `new ConnEnd(point)`. It therefore needs
   the endpoint *ids* as well as the points — `RoutingTier.connectors` (`:492`) currently
   carries only `{ id, source, target }`.
6. **Waypoints.** Give `interiorWaypoints` a flag for "this connection pinned an end", and
   keep the corresponding endpoint instead of stripping it. The finiteness and `size < 2`
   guards stay exactly as they are — they are the data-corruption defence and nothing here
   weakens the reason for them.
7. **Tests.** The awkward-sides case (`left -> right` on two side-by-side shapes) is the
   cheapest regression guard: it produces a distinctive detour that no unpinned route can
   accidentally match. Add one asserting an exclusive-pin *absence* too, so caveat 2 cannot
   regress into a silent centre fallback.
