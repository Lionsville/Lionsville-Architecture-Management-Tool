# ADR-0045 — One design system: tokens as the source, a kit the screens are composed from

* Status: accepted, 7 November 2026; as built, 7 November 2026, tokens, fonts,
  the accent seam and the language at the root; the screens moved onto the kit
  the same day (*As built: the screens on the kit*, below); implemented,
  7 November 2026 (4.0.0, not yet released)
* Date: 2026-11-07
* Deciders: Wouter Simons
* Extends: ADR-0022 (source providers), ADR-0044 (one way every page behaves)

*Extended by ADR-0048 (§5), 7 November 2026: the zoom floor of 60% becomes each
canvas's own, a poster going lower by dropping names rather than shrinking them, and
three tokens join: `--poster-title`, `--on-poster-title`, `--canvas-t-near`.*

## Context and Problem Statement

The screens were written one at a time, on Material UI with its default look and
inline `sx`. Measured over the shipped source: 269 of 310 component files import
MUI, with 2,712 `sx` props, and about twenty-five MUI names cover nearly all of
it. There were colours in JavaScript, computed with `alpha` and `darken`, with no
token behind them; several lists, panels and status texts that each do the same
job differently; and a card on a board wrapped in MUI's `Box` and `Typography`,
which rendered 500 simple cards at 13 ms against 0.3 ms for plain elements with a
class.

Separately, several pages stayed in English under a Dutch or German bar. The
strings existed; no provider of the language stood at the root of the app.

The question: how does this application get one visual language, and one place
where a list or a panel is defined, without a rewrite and without losing what the
current stack gives it?

## Decision Drivers

* **One source for every value**, read by static CSS, by MUI and by what is drawn
  outside the page, in both modes.
* **Contrast measured, not hoped for**: every pair that carries words at 4.5:1 and
  everything that has to be seen at 3:1 (`app/theme.contrast.test.ts`).
* **A screen drawn before the kit must not look like a different product** while
  the rest moves.
* **Speed on what repeats**: a board or a sheet draws hundreds of the same thing.
* **Reuse enforced**, because a convention that lives in a readme disappears in the
  third hurried patch.
* **Nothing public changes shape needlessly**: the module matrix, the provider
  seams, the `data-guide` names and the tests' harness stay.

## Considered Options

* **Change framework** (Svelte, Solid, Vue, Lit). Plain React renders the cards in
  a fraction of a millisecond, so React is not where the cost sits. The public
  provider seams are React components; a framework change would break whatever is
  composed over them, and the whole test suite. No.
* **Canvas or WebGL for the board**, or a commercial diagram library. A renderer of
  our own loses the DOM's focus, accessibility tree and tests; the licences of the
  libraries do not sit with AGPL. No: xyflow and ELK stay.
* **Tailwind 4 and a codemod of every `sx`.** It would convert 78 % of `sx`
  mechanically, and keep every one-off style it converts, which is the thing being
  removed. With about thirty components, most `sx` goes when a screen moves onto
  the kit; what is left is small layout. No.
* **Pigment CSS.** On hold upstream. No.
* **Replace MUI's controls now** (Base UI, React Aria). Possibly worthwhile behind
  the kit, control by control, where one fights the design or a profile says so.
  It changes nothing a person sees, and nothing else waits for it. Not now.
* **Tokens as CSS variables, handed to MUI, and a kit of our own in front of it.**
  Chosen.

## Decision Outcome

### 1. The stack

React, TypeScript, MUI behind the kit, xyflow, ELK, libavoid and Electron stay.

### 2. Tokens are the source

`widgets/kit/tokens.ts` holds every colour, type size and frame measure, in a
light and a dark table of the same names. A token may name another
(`--line-uses: var(--line-ink)`), so a meaning has its own name and a colour one
home. The values were picked in OKLCH and are written as the sRGB they come to, so
that a picture, the canvas and a contrast measurement can read them.

The direction: the light theme is a survey sheet, warm paper and blue-black ink;
the dark one a blueprint, night blue and pale drafting lines. Corners are square.
One accent, petrol, that no status uses.

The tokens reach the screen three ways, all from `app/theme.ts`:

* as custom properties on the root, through the baseline, for static CSS;
* as MUI's palette, which MUI hands its components as CSS variables
  (`cssVariables`), so every existing screen wears the tokens at once. The palette
  stays in values and not `var()`s, because screens do sums on it while drawing;
* as resolved values (`tokensOf(theme)`), for the canvas's tokens
  (`editor/theme/tokens.ts`), an export and the contrast test.

`secondary` is an ink, because a second hue nobody picked would be a second
accent. A theme drawn inside another in a different mode, a picture exported in
the other theme, carries values and not variables, because MUI's variables sit on
the page's root, one set per page.

### 3. The typefaces

Source Sans 3 and Source Code Pro, both under the SIL Open Font License 1.1, are
bundled as variable woff2 subset to Latin, so no page reaches a font server and
every install looks the same. They are pinned by checksum in
`build/dependencyPolicy.ts` and carried in the notices. `font-display: swap`: a
word is never held back for a font.

### 4. An accent is a provider's to say

`ProviderParts.accent` is a `#rgb` or `#rrggbb`: a source may say what its
environment wears, so that a person can tell one place from another at a glance.
`widgets/kit/accent.ts` is the one pure function over it.

What is chosen is a hue and roughly how strong. Lightness is fixed per mode at what
the default uses, in OKLCH where equal lightness reads as an equal step, and the
main shade then walks away from its grounds until it reaches 4.5:1 on every one of
them and under its own ink. Soft shades follow by the same recipe, and tokens that
name the accent follow by name.

Refused, rather than bent: a colour within 15° of a status's hue in either mode,
because a selected row must never read as a warning; and one with no hue to speak
of, which could not be seen beside the inks. Refused, the default stands and the
trail says why. The three registers core ships give none, and stay petrol.

### 5. The kit

`widgets/kit/` is where a screen's parts come from. Its README is the architecture:
the names, how a screen composes them, static CSS rather than `sx` on what repeats,
and what a screen may not do. It sits in `widgets`, which may import only the
words, so a kit component cannot know the model: it is handed what the screen
worked out.

`build/literalColours.test.ts` holds each file to the literal colours it has now
and a new file to none. The count only goes down.

### 6. The language is said once, at the root

`App` provides the language around everything under the shell. The English default
stays, for a component tested alone.

## Consequences

* Every screen changes appearance at once, including the ones not yet moved onto
  the kit, and some of those will look unfinished until they are.
* The board's tint per zone and per kind are gone: a shape is told by its form, and
  colour answers one question at a time. Keyboard focus and selection on a card now
  share a family of hue, and are told apart by where they are drawn.
* A `.css` file is new to this tree. Vite handles it in every build, and tests see
  nothing of it.
* MUI's variables are not resolved by jsdom, so the test harness builds its theme
  with values; a test reading a computed colour still reads a colour.
* About 140 kB of fonts, of which a page in a Western European language fetches
  about 50 kB.
* MUI remains a dependency. Leaving it is a later decision that the kit makes
  possible and this record does not take.

## As built: the type scale and the text size

The first scale carried six sizes in px, and screens added ten more of their own.
It is five now, in rem: small, body, large, title and page, at 13, 15, 17, 20 and 26
px at a browser's default, and what holds text is in rem with them. A person sets a
step in the top row, 90 to 150 percent, on the document's root; a browser's own text
size reaches the same sizes. A canvas stays in px, since its zoom is what makes it
larger and its reading distances depend on it. `build/literalFontSizes.test.ts`
keeps a size from being written anywhere else.

## As built: the screens on the kit

Every screen composes the kit now: the frame and its two rows, the homes and the
tree, the board and the container diagram with one View bar, Colour menu, Day control
and dock, the sheet and its poster, the technology landscape, the chart and the
Conway map, observations, decisions, the roadmap and a plan, the register and Checks,
people and the operating model, Guidance, the drawing's edges, settings and
preferences, and the first run. `kit/README.md` lists each part and what it is for.

What did not move: MUI still draws beneath the kit, as §1 said, and a dialog a build
composed from this one draws for itself is that build's. `build/literalColours.test.ts`
keeps the files that still hold a literal colour to the count each holds, and
`build/literalFontSizes.test.ts` keeps a size from being written outside the scale.
