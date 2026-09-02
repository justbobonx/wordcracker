/** User words: kill/clear, hints, give up, scoring. */
class WordBoard {
  constructor(game) {
    this.g = game;
  }

  killWord(deadWord) {
    if (!deadWord || deadWord.length === 0) {
      if (deadWord && deadWord.hlColor != null) this.g.colors.push(deadWord.hlColor);
      return true;
    }

    // Kill and remove non-locked letters (iterate a copy; we mutate deadWord)
    for (const l of [...deadWord]) {
      if (l.locked || l.currentScore >= 1) continue;
      this.killLetter(l);
      const i = deadWord.indexOf(l);
      if (i >= 0) deadWord.splice(i, 1);
    }

    // Clear old connectors, then re-link whatever is left
    for (const l of deadWord) {
      if (l.userConnector) {
        const ci = this.g.connectorList.indexOf(l.userConnector);
        if (ci >= 0) this.g.connectorList.splice(ci, 1);
        l.userConnector = null;
      }
      l.userLetterList = deadWord;
      l.setTint(deadWord.hlColor);
      l.setUntouched();
    }
    for (let i = 0; i < deadWord.length - 1; i++) {
      this.g.input.addConnector(deadWord[i], deadWord[i + 1], deadWord.hlColor);
    }

    if (deadWord.length === 0) {
      this.g.colors.push(deadWord.hlColor);
      return true; // gone
    }
    return false; // locked remnant kept
  }

  killLetter(l) {
    if (l.locked || l.currentScore >= 1) return false;

    if (l.userConnector) {
      const ci = this.g.connectorList.indexOf(l.userConnector);
      if (ci >= 0) this.g.connectorList.splice(ci, 1);
      l.userConnector = null;
    }
    l.userLetterList = null;
    l.setTint(0xCCCCCC);
    l.setScore(0);
    l.setUntouched();
    return true;
  }

  clearWrongWords() {
    if (this.g.gameState !== 'InPlay') return;
    if (this.g.inHilite) this.g.input.finishWordHl();

    for (const w of [...this.g.userWords]) {
      if (w.currentScore >= 0.999) continue;
      // Drop score<1 letters; hinted words keep only locked cells
      if (this.killWord(w)) {
        const idx = this.g.userWords.indexOf(w);
        if (idx >= 0) this.g.userWords.splice(idx, 1);
      }
    }

    this.g.view.updateHUD();
    this.recalcBoardScore();
    this.g.save.saveGame();
  }

  recalcBoardScore() {
    let curScore = 0;
    this.g.curCorrect = 0;

    for (const uw of this.g.userWords) {
      const ws = uw.scoreWord();
      curScore += ws;
      if (ws >= 0.999) this.g.curCorrect++;
    }

    if (this.g.curCorrect > this.g.maxCorrect) {
      const gained = this.g.curCorrect - this.g.maxCorrect;
      this.g.bgOffset += gained * this.g.bgOffsetInc;
      this.g.maxCorrect = this.g.curCorrect;
    }

    const curScoreNormed = this.g.curWordList.length > 0 ? curScore / this.g.curWordList.length : 0;
    this.g.maxLevelScore = Math.max(this.g.maxLevelScore, curScoreNormed);

    if (this.g.curCorrect >= this.g.curWordList.length && this.g.curWordList.length > 0) {
      this.g.gameState = 'LevelBeat';
      this.g.levelScore = Math.floor(1000 * this.g.levelBonus);
      this.g.view.updateHUD(); // final correct count e.g. 5(5)/5
      this.endLevel();
    } else {
      this.g.levelScore = Math.floor(curScoreNormed * 100);
    }
  }

  giveUp() {
    this.g.levelScore = -10 * (100 - this.g.levelScore);
    this.g.gameState = 'GaveUp';

    const seen = new Set();
    const correctList = this.g.letterGrid.getShuffledCorrectList
      ? this.g.letterGrid.getShuffledCorrectList()
      : [];

    let words = correctList;
    if (!words || words.length === 0) {
      words = [];
      for (const l of this.g.letterGrid) {
        if (l.wordLetterList && !seen.has(l.wordLetterList.uid)) {
          seen.add(l.wordLetterList.uid);
          words.push(l.wordLetterList);
        }
      }
    }

    for (const correctWord of words) {
      if (!correctWord || correctWord.length === 0) continue;
      if (correctWord[0].currentScore >= 1) continue;

      const color = this.g.colors.next();
      this.g.curTouch = 'NewWord';
      for (let li = 0; li < correctWord.length; li++) {
        const l = correctWord[li];
        if (li === 0) this.g.input.startNewWordHl(l, color);
        else this.g.input.contWordHl(l);
      }
      this.g.input.finishWordHl(true);

      for (const l of correctWord) {
        l.setScore(1);
        l.setTint(color);
        if (l.userConnector) l.userConnector.setTint(color);
      }
    }

    this.g.curCorrect = this.g.curWordList.length;
    this.g.view.updateHUD();
    this.endLevel();
  }

  hintLimit(word) {
    return Math.ceil(word.length / 2);
  }

  hintedLetterCount(word) {
    let n = 0;
    for (const l of word) {
      if (l && l.locked) n++;
    }
    return n;
  }

  /**
   * Higher = more likely to receive the next hint letter. 0 = ineligible.
   * Grey unused cells (no user path, score 0) count as 2.
   * Locked / solved cells count as 0. Other highlighted cells: 1 - currentScore.
   * Averaged by length. Solved words and words at the hint cap are 0.
   */
  hintScore(word) {
    if (!word || word.length === 0) return 0;
    if (word[0].currentScore >= 1) return 0;
    if (this.hintedLetterCount(word) >= this.hintLimit(word)) return 0;

    let sum = 0;
    for (const l of word) {
      if (l.locked || l.currentScore === 1) {
        sum += 0;
      } else if (!l.userLetterList && l.currentScore === 0) {
        sum += 2;
      } else {
        sum += 1 - l.currentScore;
      }
    }
    return sum / word.length;
  }

  pickHintWord() {
    const scored = [];
    let total = 0;
    for (const w of this.g.letterGrid.correctList) {
      const s = this.hintScore(w);
      if (s <= 0) continue;
      scored.push({ w, s });
      total += s;
    }
    if (scored.length === 0 || total <= 0) return null;

    let r = Math.random() * total;
    for (const item of scored) {
      r -= item.s;
      if (r <= 0) return item.w;
    }
    return scored[scored.length - 1].w;
  }

  giveHint() {
    if (this.g.gameState !== 'InPlay') return;

    if (this.g.inHilite) this.g.input.finishWordHl();

    const correctWord = this.pickHintWord();
    if (!correctWord) return; // nothing left — no penalty

    let nexti = 0;
    while (nexti < correctWord.length && correctWord[nexti].locked) nexti++;
    if (nexti >= correctWord.length) return;
    if (nexti >= this.hintLimit(correctWord)) return;

    const gl = correctWord[nexti];
    if (gl.userLetterList) this.g.input.extractLetterFromOtherWord(gl);

    if (nexti === 0) {
      this.g.curTouch = 'NewWord';
      this.g.input.startNewWordHl(gl);
    } else {
      const prev = correctWord[nexti - 1];
      if (prev.userLetterList) this.killWord(prev.userLetterList);
      if (prev.userLetterList && prev.userLetterList.length) {
        this.g.lastTouchedLetter = prev;
        this.g.curTouch = 'ContForward';
        this.g.input.restartWordHl(prev);
        this.g.lastTouchedLetter = prev;
        this.g.input.contWordHl(gl);
      } else {
        this.g.curTouch = 'NewWord';
        this.g.input.startNewWordHl(correctWord[0]);
        for (let i = 1; i <= nexti; i++) this.g.input.contWordHl(correctWord[i]);
      }
    }
    this.g.input.finishWordHl(true);

    for (let i = 0; i <= nexti; i++) correctWord[i].locked = true;

    if (!this.g.hintedList.includes(correctWord)) this.g.hintedList.push(correctWord);
    this.g.hintsGiven++;
    this.g.save.saveGame();
  }

  endLevel() {
    this.g.totScore += this.g.levelScore;
    this.g.el.levelScore.textContent = String(this.g.levelScore);
    this.g.el.levelScore.classList.remove('hidden');
    this.g.el.giveupBtn.classList.add('hidden');
    this.g.el.clearBtn.classList.add('hidden');
    this.g.el.hintBtn.classList.add('hidden');
    this.g.el.nextBtn.innerHTML = this.g.gameState=='GaveUp' ? "Try Again" : "Next Level";
    this.g.el.nextBtn.classList.remove('hidden');
    this.g.save.saveGame();
  }
}
