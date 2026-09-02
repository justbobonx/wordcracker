/** Pointer input and word-highlight path building. */
class WordInput {
  constructor(game) {
    this.g = game;
  }

  handlePointer(type, x, y) {
    if (this.g.gameState !== 'InPlay') return;

    if (type === 'down') {
      this.g.lastPointerX = x;
      this.g.lastPointerY = y;
      const touched = this.goodLetterTouch(x, y);
      this.g.downLetter = touched;
      this.g.extendedDuringGesture = false;
      if (touched) this.startWordHl(touched);
      if (touched) this.g.lastTouchedLetter = touched;
      return;
    }

    if (type === 'move') {
      if (this.g.inHilite) {
        // Walk the stroke segment so fast moves still hit intermediate letters
        this.applyStrokeSegment(this.g.lastPointerX, this.g.lastPointerY, x, y);
      }
      this.g.lastPointerX = x;
      this.g.lastPointerY = y;
      return;
    }

    if (type === 'up') {
      if (this.g.inHilite) {
        // Final segment to release point
        this.applyStrokeSegment(this.g.lastPointerX, this.g.lastPointerY, x, y);

        const touched = this.goodLetterTouch(x, y);
        const elapsed = performance.now() - this.g.letterTouchDownTime;
        const isQuickTap =
          !this.g.extendedDuringGesture &&
          this.g.downLetter &&
          (touched === this.g.downLetter || touched == null) &&
          elapsed < 350;

        if (isQuickTap && this.g.downLetter.userLetterList && !this.g.downLetter.isLocked()) {
          this.cancelGestureAndRemoveLetter(this.g.downLetter);
        } else {
          this.finishWordHl();
        }
      }
      // Release always drops full-scale tip, even if finish/kill already ran
      this.clearAllTouched();
      this.g.downLetter = null;
      this.g.extendedDuringGesture = false;
      this.g.lastPointerX = x;
      this.g.lastPointerY = y;
    }
  }

  /**
   * Sample points along the pointer segment and feed distinct letters into contWordHl.
   * Covers sparse touchmove samples on fast mobile drags.
   */
  applyStrokeSegment(x0, y0, x1, y1) {
    if (!this.g.inHilite) return;

    const step = Math.max(4, (Letter.LETTER_SIZE * this.g.letterScale) * 0.25);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const n = dist < 1e-6 ? 1 : Math.max(1, Math.ceil(dist / step));

    for (let i = 1; i <= n; i++) {
      if (!this.g.inHilite) return; // path ended mid-stroke (e.g. hit locked)
      const t = i / n;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const letter = this.goodLetterTouch(px, py);
      if (!letter || letter === this.g.lastTouchedLetter) continue;
      if (this.contWordHl(letter)) {
        this.g.extendedDuringGesture = true;
        this.g.lastTouchedLetter = letter;
      } else if (!this.g.inHilite) {
        return;
      }
    }
  }

  clearAllTouched() {
    for (const l of this.g.letterGrid) {
      if (l) l.setUntouched();
    }
  }

  /** True if any letter in the list is hint-locked (must stay as a user word). */
  wordHasLocked(word) {
    if (!word) return false;
    for (const l of word) {
      if (l && l.locked) return true;
    }
    return false;
  }

  /**
   * Commit a path to userWords, or kill if too short and no locked letters.
   * Short paths that still contain hint-locked letters are always kept
   * (strip any unlocked junk via killWord, then re-push the remnant).
   */
  commitOrKillWord(word, allowShort = false) {
    if (!word) return;

    const hasLocked = this.wordHasLocked(word);
    const tooShort = word.length < 3;

    if (!allowShort && tooShort && !hasLocked) {
      this.g.board.killWord(word);
      const ui = this.g.userWords.indexOf(word);
      if (ui >= 0) this.g.userWords.splice(ui, 1);
      return;
    }

    if (!allowShort && tooShort && hasLocked) {
      // Drop unlocked letters only; locked remnant must remain listed
      this.g.board.killWord(word);
    }

    if (word.length > 0 && !this.g.userWords.includes(word)) {
      this.g.userWords.push(word);
    } else if (word.length === 0) {
      const ui = this.g.userWords.indexOf(word);
      if (ui >= 0) this.g.userWords.splice(ui, 1);
    }
  }

  cancelGestureAndRemoveLetter(letter) {
    if (this.g.curHLWord) {
      const list = letter.userLetterList;
      if (list && list === this.g.curHLWord) {
        this.commitOrKillWord(list, false);
      } else if (this.g.curHLWord.length > 0 && this.g.curHLWord !== list) {
        this.commitOrKillWord(this.g.curHLWord, false);
      }
    }

    this.g.inHilite = false;
    this.g.curHLWord = null;

    this.clearAllTouched();

    this.removeLetterFromUserWord(letter);
    this.g.view.updateHUD();
    if (this.g.gameState !== 'GaveUp') this.g.board.recalcBoardScore();
    this.g.save.saveGame();
  }

  removeLetterFromUserWord(letter) {
    if (!letter || !letter.userLetterList || letter.isLocked()) return;

    const oldList = letter.userLetterList;
    const oldPos = oldList.indexOf(letter);
    if (oldPos < 0) return;

    if (!this.g.userWords.includes(oldList)) this.g.userWords.push(oldList);

    if (oldPos > 0) {
      const prev = oldList[oldPos - 1];
      if (prev.userConnector) {
        const ci = this.g.connectorList.indexOf(prev.userConnector);
        if (ci >= 0) this.g.connectorList.splice(ci, 1);
        prev.userConnector = null;
      }
    }
    if (letter.userConnector) {
      const ci = this.g.connectorList.indexOf(letter.userConnector);
      if (ci >= 0) this.g.connectorList.splice(ci, 1);
      letter.userConnector = null;
    }

    const leftPart = new LetterList();
    leftPart.hlColor = oldList.hlColor;
    const rightPart = new LetterList();
    rightPart.hlColor = this.g.colors.next();

    for (let i = 0; i < oldPos; i++) {
      leftPart.push(oldList[i]);
      oldList[i].userLetterList = leftPart;
    }
    for (let i = oldPos + 1; i < oldList.length; i++) {
      rightPart.push(oldList[i]);
      oldList[i].userLetterList = rightPart;
      if (oldList[i].userConnector) oldList[i].userConnector.setTint(rightPart.hlColor);
      oldList[i].setTint(rightPart.hlColor);
    }

    const ui = this.g.userWords.indexOf(oldList);
    if (ui >= 0) this.g.userWords.splice(ui, 1);

    this.commitOrKillWord(leftPart, false);
    this.commitOrKillWord(rightPart, false);

    this.g.board.killLetter(letter);
  }

  /** Extract one letter from whatever user word it is in (split sides). Letter stays active for re-add. */
  extractLetterFromOtherWord(letter) {
    if (!letter || !letter.userLetterList) return;
    if (letter.userLetterList === this.g.curHLWord) return;
    if (letter.isLocked()) return;

    const oldList = letter.userLetterList;
    const oldPos = oldList.indexOf(letter);
    if (oldPos < 0) return;

    if (oldPos > 0) {
      const prev = oldList[oldPos - 1];
      if (prev.userConnector) {
        const ci = this.g.connectorList.indexOf(prev.userConnector);
        if (ci >= 0) this.g.connectorList.splice(ci, 1);
        prev.userConnector = null;
      }
    }
    if (letter.userConnector) {
      const ci = this.g.connectorList.indexOf(letter.userConnector);
      if (ci >= 0) this.g.connectorList.splice(ci, 1);
      letter.userConnector = null;
    }

    const leftPart = new LetterList();
    leftPart.hlColor = oldList.hlColor;
    const rightPart = new LetterList();
    rightPart.hlColor = this.g.colors.next();

    for (let i = 0; i < oldPos; i++) {
      leftPart.push(oldList[i]);
      oldList[i].userLetterList = leftPart;
    }
    for (let i = oldPos + 1; i < oldList.length; i++) {
      rightPart.push(oldList[i]);
      oldList[i].userLetterList = rightPart;
      if (oldList[i].userConnector) oldList[i].userConnector.setTint(rightPart.hlColor);
      oldList[i].setTint(rightPart.hlColor);
    }

    const ui = this.g.userWords.indexOf(oldList);
    if (ui >= 0) this.g.userWords.splice(ui, 1);

    this.commitOrKillWord(leftPart, false);
    this.commitOrKillWord(rightPart, false);

    letter.userLetterList = null;
    letter.setScore(0);
    letter.setUntouched();
  }

  /** Drop letters after index in curHLWord (turned off, not split into a new word). */
  truncateCurWordAfter(index) {
    const word = this.g.curHLWord;
    if (!word || index < 0 || index >= word.length - 1) return;

    // Remove connector from the tip into the dead tail
    const tip = word[index];
    if (tip.userConnector) {
      const ci = this.g.connectorList.indexOf(tip.userConnector);
      if (ci >= 0) this.g.connectorList.splice(ci, 1);
      tip.userConnector = null;
    }

    while (word.length > index + 1) {
      const dead = word.pop();
      // Never strip hint-locked letters via mid-path truncate
      if (dead.locked) {
        word.push(dead);
        break;
      }
      if (dead.userConnector) {
        const ci = this.g.connectorList.indexOf(dead.userConnector);
        if (ci >= 0) this.g.connectorList.splice(ci, 1);
        dead.userConnector = null;
      }
      dead.userLetterList = null;
      dead.setUntouched();
      dead.setTint(0xCCCCCC);
      dead.setScore(0);
    }
  }

  goodLetterTouch(px, py) {
    const scaledSize = Letter.LETTER_SIZE * this.g.letterScale;
    const tx = Math.floor((px - this.g.LEFT) / scaledSize);
    const ty = Math.floor((py - this.g.BOTTOM) / scaledSize);

    if (tx < 0 || ty < 0 || tx >= this.g.letterGrid.LETTER_GRID_W || ty >= this.g.letterGrid.LETTER_GRID_H) {
      return null;
    }

    const cx = this.g.LEFT + scaledSize / 2 + tx * scaledSize;
    const cy = this.g.BOTTOM + scaledSize / 2 + ty * scaledSize;
    const dist = Math.hypot(px - cx, py - cy);
    const touchR = Letter.LETTER_TOUCH_SIZE_DIV_2 * this.g.letterScale;
    if (dist > touchR) return null;

    const l = this.g.letterGrid.getLetter(tx, ty);
    // Fully solved (correct) never touchable. Hint-locked stay touchable.
    if (l.currentScore === 1) return null;
    return l;
  }

  startWordHl(l) {
    this.g.letterTouchDownTime = performance.now();

    // Already in a user word (including hint-locked chains): pick it up, same color.
    // First+last (1-letter hint remnant) is treated as the end — append, do not prepend.
    if (l.userLetterList) {
      const onlyEnd = l.isLastLetter();
      this.g.curTouch = (l.isFirstLetter() && !onlyEnd) ? 'ContBack' : 'ContForward';
      this.restartWordHl(l);
      return;
    }

    // Fresh letter → new highlight, new color
    this.g.curTouch = 'NewWord';
    this.startNewWordHl(l);
  }

  startNewWordHl(l, color) {
    this.g.inHilite = true;
    this.g.curHLWord = new LetterList();
    this.g.curHLWord.hlColor = color != null ? color : this.g.colors.next();
    this.appendLetterToCurWord(l);
    l.setTouched();
    this.rescoreCurWord();
    this.g.view.updateHUD();
  }

  restartWordHl(l) {
    this.g.inHilite = true;
    this.g.curHLWord = l.userLetterList;
    this.g.curHLWord.hlColor = l.userLetterList.hlColor;
    const idx = this.g.userWords.indexOf(this.g.curHLWord);
    if (idx >= 0) this.g.userWords.splice(idx, 1);
    // Only the pressed letter is full-scale; rest use live partial score
    for (const x of this.g.curHLWord) x.setUntouched();
    l.setTouched();
    this.rescoreCurWord();
    this.g.view.updateHUD();
  }

  contWordHl(l) {
    if (!this.g.inHilite || !this.g.curHLWord) return false;

    // Same word: just move the active tip (no path change)
    if (this.g.curHLWord.includes(l)) {
      if (this.g.lastTouchedLetter && this.g.lastTouchedLetter !== l) {
        this.g.lastTouchedLetter.setUntouched();
      }
      l.setTouched();
      this.rescoreCurWord();
      this.g.view.updateHUD();
      return true;
    }

    // Hint-locked letter not in our word: cannot steal — end gesture
    if (l.locked && l.userLetterList !== this.g.curHLWord) {
      this.finishWordHl();
      return false;
    }

    // isLocked also covers score===1, but those are already filtered in goodLetterTouch
    if (l.isLocked() && l.userLetterList !== this.g.curHLWord) {
      this.finishWordHl();
      return false;
    }

    const tip = this.currentTip();
    if (!tip) return false;
    if (!l.isANeighborOf(tip)) return false;

    // Steal from another active word if needed
    if (l.userLetterList && l.userLetterList !== this.g.curHLWord) {
      this.extractLetterFromOtherWord(l);
    }

    const tipPos = this.g.curHLWord.indexOf(tip);
    const isFirst = tipPos === 0;
    const isLast = tipPos === this.g.curHLWord.length - 1;

    // Last wins when first==last (1-letter path). Prepend only if first and not last.
    if (isLast || this.g.curTouch === 'NewWord') {
      this.appendLetterToCurWord(l);
      this.g.curTouch = 'ContForward';
    } else if (isFirst) {
      this.prependLetterToCurWord(l);
      this.g.curTouch = 'ContBack';
    } else {
      // Middle: drop everything after tip (off, not a split word), then extend from new end
      this.truncateCurWordAfter(tipPos);
      this.appendLetterToCurWord(l);
      this.g.curTouch = 'ContForward';
    }

    if (this.g.lastTouchedLetter && this.g.lastTouchedLetter !== l) {
      this.g.lastTouchedLetter.setUntouched();
    }
    l.setTouched();
    this.rescoreCurWord();
    this.g.view.updateHUD();
    return true;
  }

  currentTip() {
    if (this.g.lastTouchedLetter && this.g.curHLWord &&
        this.g.curHLWord.includes(this.g.lastTouchedLetter)) {
      return this.g.lastTouchedLetter;
    }
    if (!this.g.curHLWord || this.g.curHLWord.length === 0) return null;
    if (this.g.curTouch === 'ContBack') return this.g.curHLWord[0];
    return this.g.curHLWord[this.g.curHLWord.length - 1];
  }

  appendLetterToCurWord(newl) {
    this.g.curHLWord.push(newl);
    if (this.g.curHLWord.length > 1) {
      const prev = this.g.curHLWord[this.g.curHLWord.length - 2];
      this.addConnector(prev, newl, this.g.curHLWord.hlColor);
    }
    newl.userLetterList = this.g.curHLWord;
    newl.setTint(this.g.curHLWord.hlColor);
  }

  prependLetterToCurWord(newl) {
    this.g.curHLWord.unshift(newl);
    if (this.g.curHLWord.length > 1) {
      this.addConnector(newl, this.g.curHLWord[1], this.g.curHLWord.hlColor);
    }
    newl.userLetterList = this.g.curHLWord;
    newl.setTint(this.g.curHLWord.hlColor);
  }

  /** Live partial score so non-tip letters show path quality while drawing. */
  rescoreCurWord() {
    if (this.g.curHLWord && this.g.curHLWord.length > 0) {
      this.g.curHLWord.scoreWord();
    }
  }

  addConnector(leftl, rightl, color) {
    const bm = BitmapManager.getInstance();
    const newCon = new Sprite();

    if (leftl.pos.x === rightl.pos.x || leftl.pos.y === rightl.pos.y) {
      newCon.setBitmap(bm.get('letter_link_vert'));
      if (leftl.pos.y === rightl.pos.y) newCon.curGState.rotation = 90;
    } else {
      newCon.setBitmap(bm.get('letter_link_diag'));
      if ((rightl.pos.x < leftl.pos.x && rightl.pos.y < leftl.pos.y) ||
          (rightl.pos.x > leftl.pos.x && rightl.pos.y > leftl.pos.y)) {
        newCon.curGState.rotation = 90;
      }
    }

    newCon.setTint(color);
    newCon.curGState.alpha = 0.6;
    newCon.curGState.scale = this.g.letterScale;
    newCon.pos.x = (leftl.pos.x + rightl.pos.x) / 2;
    newCon.pos.y = (leftl.pos.y + rightl.pos.y) / 2;

    leftl.userConnector = newCon;
    this.g.connectorList.push(newCon);
  }

  finishWordHl(allowShort = false) {
    if (!this.g.inHilite || !this.g.curHLWord) return;
    this.g.inHilite = false;

    // Snapshot before any kill mutates the list — otherwise touched sticks
    const path = [...this.g.curHLWord];
    for (const l of path) l.setUntouched();

    this.commitOrKillWord(this.g.curHLWord, allowShort);

    this.g.curHLWord = null;
    this.clearAllTouched();

    this.g.view.updateHUD();
    if (this.g.gameState !== 'GaveUp') this.g.board.recalcBoardScore();
    this.g.save.saveGame();
  }
}
