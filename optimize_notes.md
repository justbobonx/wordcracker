# WordCracker — optimize notes

Related: `dev_notes.md` (how the game works). This file is draw/mobile cost and leftover visual debt.

---

## Draw stack (current)

`GameView.draw` after the tall BG, in CSS pixels × `dpr`:

1. `letterBgList` — `shine_circle.png`, tint black, α 0.45, scale `letterScale`
2. `connectorList` — vert/diag link, path `hlColor`, α 0.6, scale `letterScale`
3. each `Letter.draw`:
   - `Letter.bg` — same PNG, tint black, α 0.5, scale `baseScale` (layout only)
   - `letter_shine` if `currentScore === 1` — path tint, scale `displayScale()`
   - `letters.png` clip — path tint or grey, scale `displayScale()`
   - `letter_fg` — **not** tinted, scale `displayScale()`

Two black pads per cell. Same bitmap, slightly different alpha. Both now track grid/screen size.

No canvas `filter` / `shadowBlur`. Soft edge is baked into `shine_circle.png`.

---

## Tint graph

Stored on `GfxState.tint` (`0xAARRGGBB`). `Sprite._getTintedImage()` rebuilds an offscreen multiply **every draw** of every non-white sprite. One shared `_tintCanvas` — no cache.

| Who | Color |
|-----|--------|
| `Letter.setTint` | letter + shine + that letter's `userConnector` |
| `setScore(0)` | `0xFF999999` |
| append / prepend | `curHLWord.hlColor` |
| `addConnector` | same `hlColor` |
| `killLetter` | `0xCCCCCC` |
| pads | `0xFF000000` at construct; never follow path color |
| `letter_fg` | never tinted |

`ColorWheel.next()` supplies path colors.

---

## Suggested work (priority)

### 1. Cache tints (biggest real win)

Key: `bitmap + clipRect + tint`. Keep a small Map of offscreen canvases. 26 glyphs × ~12 colors is nothing.

Skip `_getTintedImage` when the tint has not changed. Do not change the layer stack to get this.

White / empty tint already skips the pass — keep that.

### 2. One pad, not two

`letterBgList` and `Letter.bg` are the same asset on the same point. Delete one list.

If the look becomes a crisp tile (below), neither PNG is required.

### 3. Crisp letter tiles (style; agreed direction)

`shine_circle.png` is a soft blob. Wanted look is a rounded square with opacity.

Draw once, not through the tint factory:

```js
ctx.fillStyle = 'rgba(0,0,0,0.45)';
ctx.beginPath();
ctx.roundRect(x, y, size, size, radius);
ctx.fill();
```

`size` must be `96 * letterScale` (layout), same contract as the fixed pad. Do **not** use `shadowBlur` to fake the old glow — more expensive than the PNG.

Score shrink stays on the glyph unless you also decide tiles should shrink. Mixing full-size tiles + 60% grey glyphs is a look choice, not a bug.

Two clean contracts if that mix starts to bother:

- **Tile board** — pad always `letterScale`; letters fill the tile; score is color only.
- **Floating letters** — pad uses `displayScale()` too.

### 4. Cap backing-store DPR

`main.js` uses full `devicePixelRatio`. On 3× phones that is a lot of pixels for 96px art.

```js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
```

Keep the same cap in `GameView` so `this.g.dpr` matches the canvas.

### 5. Backdrop payload

`assets/images/wordcracker-bg-1.jpg` ~774KB. `bg.png` ~265KB is unused.

Re-encode the tall BG as WebP/AVIF ~100–150KB, or a shorter strip (`maxTravel / 20` steps). First paint on cellular is waiting on that JPEG, not on JS.

### 6. Resize without reallocating Letters

`GameView.resize` snapshots every cell, `resetSize()` builds new `Letter`s, remaps words / hints / connectors. Mobile Safari fires resize when the URL bar moves.

Prefer: keep the same Letter objects, write new `pos` / `baseScale`, move connector midpoints. The v0.6.15 scale fix does not remove this hitch.

`visualViewport` is the right listener if toolbar resize is still noisy.

### 7. Safe area

No `viewport-fit=cover`, no `env(safe-area-inset-*)`. Buttons at `bottom: 20px` and level number at `bottom: 12px` sit under the home indicator. `100%` height on `html, body` fights iOS chrome; `100dvh` + insets is the boring fix.

---

## Do not bother (this pass)

**Idle `requestAnimationFrame` / dirty flag.** Discussed. After the pad scale fix, not worth the complexity unless a phone profile shows the loop as the hot item. Tint cache first.

**HUD on canvas.** HTML overlay is not the cost. `updateHUD()` every frame + `innerHTML` on the word list is minor next to tint. Canvas HUD means you own wrapping, hit-tests, and safe-area. Keep SCORE/TIME/buttons in the DOM. Style the overlay if you want it painted on the art.

**Runtime blur.** None today. Do not add `filter` or `shadowBlur`.

**SoundManager.js** uses `export class` and is not in `index.html`. Leave it out or drop `export`. Do not break the no-modules rule in `dev_notes.md`.

---

## Optional later

- Pointer Events instead of mouse + touch twins (`sourceCapabilities` already filters the fake mouse).
- Bake `letters + fg` (and idle pad) at load so a cell is one `drawImage`.
- WOFF2 for Komika.
- Drop the `<meta Cache-Control>` tag; query params already bust JS/CSS.
- `createImageBitmap` / `img.decode()` so boot is not white-then-pop.
- Debounce `saveGame()` on pointer-up if a long drag ever hitchs on localStorage.
- Level gen (`fillLetterGrid`, 40 attempts) can stall a 5×6 board; yield if it shows up in traces.

---

## If you only do two things after this file

1. Cache `(bitmap, clip, tint)`.
2. Replace the double `shine_circle` with one layout-scaled `roundRect` fill.
