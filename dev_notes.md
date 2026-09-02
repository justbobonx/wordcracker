# WordCracker — dev notes


---

## Versioning cache-bust update VERSION in index


1. Bump `window.VERSION` in that inline script.

**Save key** is not versioned with the app label: `GameSave.SAVE_KEY = 'wordcracker_save_v1'` (static on the class).

---

## Script load order (`index.html`)

1. Inline `window.VERSION`
2. `Coord.js`
3. `GfxState.js`
4. `BitmapManager.js`
5. `Sprite.js`
6. `LetterList.js`
7. `Letter.js`
8. `LetterGrid.js`
9. `ColorWheel.js`
10. `LevelBuilder.js`
11. `WordInput.js`
12. `WordBoard.js`
13. `GameSave.js`
14. `GameView.js`
15. `WordCracker.js`
16. `main.js`

---

## Important runtime lists

| Name | Role |
|------|------|
| `curWordList` | Solution strings for the current level |
| `letterGrid.correctList` | Solution words as letter chains on the board |
| `userWords` | Player highlight chains |
| `hintedList` | Correct chains that have received at least one hint letter (persisted) |
| `letter.wordLetterList` | Which solution chain a cell belongs to |
| `letter.userLetterList` | Which player word a cell is in |

`hintedList` is saved as letter-index arrays and rematched to `correctList` on load/resize.

---

## Hints + locks

- One hint button = one more **prefix** letter on one solution word.
- **Hint limit** per word: `ceil(length / 2)` (3–4 → 2, 5–6 → 3, …).
- **hintScore** (weight): 0 if first letter `currentScore >= 1` or locked count ≥ limit. Else average over letters of `1 - (1 if locked/solved else currentScore)`. Weighted random among score > 0.
- Place the next unlocked prefix letter. Peel it off any existing user path first. If a locked prefix already exists as a user word, append to that word.
- `Letter.isLocked()` → `currentScore === 1 || locked` (cannot clear or steal into another path).
- Hint-locked letters stay touchable so the player can continue that word (any position). Fully solved (`score === 1`) are not touchable.
- Move onto a **locked** letter that is **not** in the current path ends the gesture (commit/kill current word); further moves ignored until next down.
- No eligible word → return with **no** `hintsGiven` penalty. Each placed letter increments `hintsGiven`.

---

## Score vs touch visual

- **`currentScore`** is only calculated word quality (`setScore`). Do not use it to fake a press highlight.
- **`touched`** is a flag (`setTouched` / `setUntouched`).
- **`displayScale()`** at draw time: full size if touched, else `baseScale * (0.6 + score * 0.4)`.
- Only the **currently pressed** letter is full scale during a drag; the rest of the path uses live partial `scoreWord()` while highlighting.

---

## Scoring (high level)

- Mid-level progress: average of `userWords` `scoreWord()` results ÷ solution count, × 100 → `levelScore` (often HUD-hidden).
- Clear board: `levelScore = floor(1000 * levelBonus)`; `totScore += levelScore` in `endLevel`.
- `levelBonus` updates live from time left and hints; applied on beat.
- Give up: `levelScore = -10 * (100 - levelScore)` then `endLevel`.
- BG steps only when `curCorrect` increases (full correct words). Cap travel to image top; keep **one** formula for play and load (avoid resize re-applying progress).

---

## Save / load / resize pitfalls

1. **`LetterGrid.resetSize` creates new `Letter` instances.** Always remap `userWords`, `correctList`, and `hintedList` by **letter indices**, never keep old object refs in those lists.
2. **`GameView.resize` must snapshot `locked`** (and scores, tints, words) or locks vanish after load/resize.
3. **`LetterList` extends `Array`** — constructor must accept numeric length from `splice`/`map` species.
4. Do not use `bgCurrentY = 0` as the start pose; use layout `baseY`.
5. Start screen exists so boot runs after the canvas has real dimensions.

---

## Input / selection (current)

- Path is 8-way neighbors only.
- Down on an unhighlighted letter: new word, new color.
- Down on a letter already in a user word (including hint-locked): pick up that word/color; tip is the pressed letter.
- Quick tap (down+up, no move) on a non-locked letter in a word: remove it and split; keep each side only if length ≥ 3.
- Move onto a letter already in the current path: only retarget the tip (no path change).
- Move onto a locked letter not in the current path: finish the current word; ignore further moves until next down.
- Move onto any other neighbor: steal it from another word if needed (split that word), then:
  - tip is last → append
  - tip is first → prepend
  - tip is middle → drop letters after tip (turned off, not a new word), then append
- Release commits (≥ 3) or kills short chains.
- Clear removes incomplete (non-correct) user words; locked remnants of hints are kept.

---

## Assets (quick)

| Path | Role |
|------|------|
| `assets/images/wordcracker-bg-1.jpg` | Active tall BG (`bg` in BitmapManager) |
| `assets/images/letters.png` | 7×4 sheet, 96px cells |
| `assets/images/letter_*.png`, `shine_circle.png` | Layers / connectors |
| `assets/data/letters.txt` | Packed words by length (one line per length) |
| `assets/fonts/komika.ttf` | UI font |

---

Original Android port reference (names only): `WordCrackerActivity`, `WordCrackerMainView`, `LetterGrid`, `LetterList`, `Letter`, `Sprite`, `GfxState`, `BitmapManager`, `Coord`.

## Previous Change Log

- Edit dev notes
- Use one-var VERSION cache busting like BloXoR
- Enter fullscreen on New Game / Continue; title stays windowed
- Update optimize_notes.md
- Update optimize_notes.md
- Add optimize_notes.md from render/mobile review
- Fix letter pad scale to follow grid/screen letterScale
- Keep wordlist vert size on empty
- Word list panel shrink-to-fit, min 100px, centered
- Word list HUD: rounded 60% black panel, no words: label
- Color update
- Simplify second hint: killWord strip then restart/append
- 1-letter grab is forward; hint strips then uses isLast-append
- Second hint strips extras then appends in solution order
- HUD word colors: two-span hinted prefix, static HUD_* colors
- Clear strips incomplete hinted words down to locked letters
- Word list view empty on empty; next level or try again on button
- Save/load maxHints; bump to 0.6.8
- Persist maxHints and apply 1.333 bonus divisor
- Wire maxHints into fill/save/bonus and grey hintScore
- Grey-cell hint weight 2; bonus uses LetterGrid.maxHints * 1.333
- One-letter hints with hintscore weighted pick and ceil(n/2) cap
- Fix hint on already-highlighted letters by peeling them first
- Removed unneeded bg black clear
- Format cleanup
- Sample stroke between pointer samples; window-level touch move/up for mobile
- Keep short hint-locked paths in userWords; never clear or orphan locked remnants
- Always clear touched on release/kill so short paths drop off full scale
- Rewrite highlight path rules: live partial score, tip-only full scale, mid-path truncate, same-word slide, ignore correct letters
- Removed comment
- New icon
- Better drag select
- Update dev_notes.md
- Update README.md
- Slim README; point developers at dev_notes.md
- Add dev_notes.md for new conversation onboarding
- Remove version.js; VERSION is inline in index.html, SAVE_KEY on GameSave
- VERSION lives in HTML only; drop version.js script tag
- Move SAVE_KEY to GameSave.SAVE_KEY static; read VERSION from window
- Separate score from touch visual; scale only at draw time
- Only scale the currently pressed letter during highlight
- Fixed tab formatting
- Fixed word score format
- Word list colors
- Format word list: bold white correct, dim wrong, - if hinted
- Remap hintedList across resize with correctList
- Persist hintedList across save/load
- giveHint: only unguessed unhinted words; no penalty if none left
- Resize: remap userWords/correctList to new Letter instances by index
- Preserve letter.locked across GameView.resize (fixes load lose lock)
- Use Letter.isLocked() in killWord/killLetter
- Use Letter.isLocked() for remove/steal/quick-tap; keep locked ends continuable
- Rename isFixed to isLocked (score==1 or locked flag)
- Reverted to smaller WordCracker.js
- Use Letter.isFixed() for kill/steal/remove; allow continue from locked hint ends
- Add Letter.isFixed() for score==1 or locked checks
- Added more OOs
- Update index.html to new objects
- WordInput: locked letters cannot be stolen by highlight path
- Bump version to 0.6.0 for OO split
- Add ColorWheel class (OO split)
- Simpler load word in load
- Update for hint locking
- Reverted WordCracker.js
- WordCracker: random colors, wheel-color locked hints, safer clear/kill
- Reverted
- Restore full WordCracker.js: random colors, locked hints, non-mutating shuffle support
- Restore WordCracker.js with color/hint/lock fixes
- WordCracker: random colors, normal-color locked hints, safer kill/clear
- Random color picks; hints use wheel colors and lock permanently; shuffle returns a copy
- WordCracker.js: final HUD on beat, live curHLWord in wordlist, full-size HL letters, timer pause/resume, bg scroll 0.2
- Fix final HUD on level beat, halve bg scroll speed, correct letter scale/spacing on higher levels, show live curHLWord in wordlist + full-size highlight letters, pause level timer when app not visible
- Update README.md
- Document architecture, versioning, bg/gesture notes for future sessions
- v0.5.0: WordCracker as classic global class (no import/export)
- v0.5.0: convert Sprite, Letter, LetterGrid to classic globals
- v0.5.0: classic global scripts (no ES modules) — load order in index.html
- v=4.3
- v=4.3
- v4.3
- v0.4.3: unify all module ?v= so BitmapManager is a single singleton (fixes missing letters)
- v0.4.2 cache-bust labels for bg grass fix
- Fix bg start: force grass baseY (never leave at 0 when baseY is negative)
- Bump to 0.4.2 (bg grass position fix)
- Back to last bg
- Updated bg
- Restore WordCracker.js to v0.4.0
- Revert to v0.4.0 (last working build before HUD/bg regression)
- v0.4.1: smart HUD updates; slow bidirectional score-driven background
- v0.4.1 main import cache-bust
- v0.4.1 cache-bust labels
- Bump version to 0.4.1
- Update index.html for full x name
- v0.4.0: version-query nested JS imports for cache bust
- v0.4.0: implement localStorage save/load and New/Continue flow
- v0.4.0: localStorage save/continue, start screen New/Continue, X link, version + cache-bust
- Add new bg
- Update BitmapManager.js
- Give-up: color each revealed word; retry same level (no advance)
- Add start screen; defer game init; fix resize letter gfx; bg only rises on correct words
- Quick-tap remove letter on release; clear-wrong button; track gesture extension
- Quick-tap removes letter from partial words; add clear-wrong button; keep perfect words locked
- Fix pointer handling: only start highlight on mouse/touch down, not on hover
- Fix LetterList constructor for Array subclass species path (splice crash)
- Add basic color tint for highlighted letters and connectors
- Full game logic: background crop, word grid generation, touch/mouse highlighting, scoring
- Implement core loading, Sprite drawing, and basic game shell
- Added letter data
- Added font
- Added image files
- Initial project skeleton for HTML5/JS port of WordCracker
- Initial commit
