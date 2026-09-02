class Letter extends Sprite {
  static LETTER_GFX_SIZE = 96;
  static LETTER_SIZE = 96;
  static LETTER_SIZE_DIV_2 = 48;
  static LETTER_TOUCH_SIZE = Math.floor(96 * 0.83);
  static LETTER_TOUCH_SIZE_DIV_2 = Math.floor(96 * 0.83 / 2);

  constructor() {
    super();
    this.word = '';
    this.wordPosition = -1;
    this.wordLetterList = null;
    this.userLetterList = null;
    this.userConnector = null;
    this.bg = null;
    this.shine = null;
    this.fg = null;
    this.currentScore = 0;
    this.touched = false;
    this.neighbors = [];
    this.emptySpaceList = null;
    this.baseScale = 1;
    this.locked = false;
  }

  set(word, wordPosition) {
    this.word = word;
    this.wordPosition = wordPosition;
    this.updateLetterGfx();
  }

  clear() {
    this.word = '';
    this.wordPosition = -1;
    this.currentScore = 0;
    this.wordLetterList = null;
    this.locked = false;
    this.touched = false;
    this.updateLetterGfx();
  }

  isEmpty() {
    return this.wordPosition === -1;
  }

  /** Solved or hint-locked: must not be cleared or pulled into another HL path. */
  isLocked() {
    return this.currentScore === 1 || this.locked;
  }

  getLetter() {
    if (this.wordPosition < 0) return '';
    return this.word.charAt(this.wordPosition);
  }

  wordPos() {
    return this.wordPosition;
  }

  addNeighbor(l) {
    this.neighbors.push(l);
  }

  isANeighborOf(l) {
    return this.neighbors.includes(l);
  }

  setEmptySpaceList(esl) {
    this.emptySpaceList = esl;
  }

  emptySpaceCount() {
    return this.emptySpaceList ? this.emptySpaceList.length : 0;
  }

  addToEmptyList(emptyList) {
    if (this.isEmpty() && !emptyList.includes(this)) {
      if (this.emptySpaceList) this.emptySpaceList.splice(this.emptySpaceList.indexOf(this), 1);
      emptyList.push(this);
      this.emptySpaceList = emptyList;

      for (const n of this.neighbors) {
        n.addToEmptyList(emptyList);
      }
    }
  }

  placeWord(newWord, pos) {
    if (this.wordPosition >= 0) return false;

    let success = true;
    this.word = newWord;
    this.wordPosition = pos;

    const oldEmpty = this.emptySpaceList ? new LetterList(this.emptySpaceList) : new LetterList();
    if (this.emptySpaceList) {
      const idx = this.emptySpaceList.indexOf(this);
      if (idx >= 0) this.emptySpaceList.splice(idx, 1);
    }

    const newEmptyListSet = [];
    while (this.emptySpaceList && this.emptySpaceList.length > 0) {
      const newEmptyList = new LetterList();
      this.emptySpaceList[0].addToEmptyList(newEmptyList);
      if (newEmptyList.length > 0) newEmptyListSet.push(newEmptyList);
    }

    let allBigEnough = true;
    let mustUseList = null;

    for (const el of newEmptyListSet) {
      if (el.length < 3) {
        if (this.containsANeighbor(el) && el.length === (newWord.length - 1 - pos)) {
          if (mustUseList == null) {
            mustUseList = el;
            continue;
          } else {
            allBigEnough = false;
            break;
          }
        } else {
          allBigEnough = false;
          break;
        }
      }
    }

    if (!allBigEnough) success = false;

    const atEndOfWord = this.wordPosition === newWord.length - 1;
    let neighbor = null;

    if (success && !atEndOfWord) {
      this.shuffleNeighborList();
      let goodPlace = false;

      for (const n of this.neighbors) {
        neighbor = n;
        if (mustUseList != null && !mustUseList.includes(neighbor)) continue;

        goodPlace = neighbor.placeWord(newWord, this.wordPosition + 1);
        if (goodPlace) break;
      }

      if (!goodPlace) success = false;
    }

    if (!success) {
      for (const o of oldEmpty) {
        o.setEmptySpaceList(oldEmpty);
      }
      this.emptySpaceList = oldEmpty;
      this.word = '';
      this.wordPosition = -1;
      return false;
    }

    if (atEndOfWord) {
      this.wordLetterList = new LetterList();
    } else {
      this.wordLetterList = neighbor.wordLetterList;
    }
    this.wordLetterList.unshift(this);

    this.updateLetterGfx();
    return true;
  }

  containsANeighbor(el) {
    for (const n of this.neighbors) {
      if (el.includes(n)) return true;
    }
    return false;
  }

  shuffleNeighborList() {
    for (let i = 0; i < this.neighbors.length; i++) {
      const j = Math.floor(Math.random() * this.neighbors.length);
      const tmp = this.neighbors[i];
      this.neighbors[i] = this.neighbors[j];
      this.neighbors[j] = tmp;
    }
  }

  /** Score is only the calculated word quality — never a touch visual. */
  setScore(score) {
    this.currentScore = score;
    if (score === 0) {
      this.setTint(0xFF999999);
    }
  }

  setTint(c) {
    super.setTint(c);
    if (this.shine) this.shine.setTint(c);
    if (this.userConnector) this.userConnector.setTint(c);
  }

  setTouched() {
    this.touched = true;
  }

  setUntouched() {
    this.touched = false;
  }

  /** Draw scale from score, or full size while this letter is the active press. */
  displayScale() {
    if (this.touched) return this.baseScale * 1.0;
    return this.baseScale * (0.6 + this.currentScore * 0.4);
  }

  isLastLetter() {
    return this.userLetterList && this.userLetterList[this.userLetterList.length - 1] === this;
  }

  isFirstLetter() {
    return this.userLetterList && this.userLetterList[0] === this;
  }

  applyLayoutScale() {
    const layout = this.baseScale;
    this.curGState.scale = layout;
    if (this.fg) this.fg.curGState.scale = layout;
    if (this.shine) this.shine.curGState.scale = layout;
    if (this.bg) this.bg.curGState.scale = layout;
  }

  updateLetterGfx() {
    const bm = BitmapManager.getInstance();
    const lettersImg = bm.get('letters');
    if (!lettersImg) return;

    if (!this.bitmap) {
      this.setBitmap(lettersImg);

      this.fg = new Sprite();
      this.fg.setBitmap(bm.get('letter_fg'));
      this.fg.pos = this.pos;

      this.shine = new Sprite();
      this.shine.setBitmap(bm.get('letter_shine'));
      this.shine.pos = this.pos;

      this.bg = new Sprite();
      this.bg.setBitmap(bm.get('shine_circle'));
      this.bg.pos = this.pos;
      this.bg.setTint(0xFF000000);
      this.bg.curGState.alpha = 0.5;
    }

    if (this.fg) this.fg.pos = this.pos;
    if (this.shine) this.shine.pos = this.pos;
    if (this.bg) this.bg.pos = this.pos;
    this.applyLayoutScale();

    let letterIndex = 27;
    if (this.wordPosition >= 0) {
      const ascii = this.word.charCodeAt(this.wordPosition);
      letterIndex = ascii - 0x61;
    }

    const size = Letter.LETTER_GFX_SIZE;
    const xPos = letterIndex % 7;
    const yPos = Math.floor(letterIndex / 7);

    this.setClipRect(xPos * size, yPos * size, size, size);
    if (this.fg) this.fg.setClipRect(xPos * size, yPos * size, size, size);
    if (this.shine) this.shine.setClipRect(xPos * size, yPos * size, size, size);
  }

  draw(ctx) {
    const s = this.displayScale();
    this.curGState.scale = s;
    if (this.fg) this.fg.curGState.scale = s;
    if (this.shine) this.shine.curGState.scale = s;
    // Pad follows layout scale only (grid / screen), not score shrink
    if (this.bg) this.bg.curGState.scale = this.baseScale;

    if (this.bg) this.bg.draw(ctx);

    if (this.currentScore === 1.0 && this.shine) {
      this.shine.draw(ctx);
    }
    super.draw(ctx);
    if (this.fg) this.fg.draw(ctx);
  }
}
