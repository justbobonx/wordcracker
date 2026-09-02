/** Persist / restore game + timer pause while hidden. */
class GameSave {
  static SAVE_KEY = 'wordcracker_save_v1';

  constructor(game) {
    this.g = game;
  }

  hasSave() {
    try {
      return !!localStorage.getItem(GameSave.SAVE_KEY);
    } catch {
      return false;
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(GameSave.SAVE_KEY);
    } catch { /* ignore */ }
    this.g.refreshContinueButton();
  }

  saveGame() {
    if (this.g.gameState === 'Title' || this.g.gameState === 'Boot' || this.g.gameState === 'NoDraw') return;
    if (!this.g.letterGrid.LETTER_GRID_W) return;

    try {
      const idxOf = (l) => this.g.letterGrid.indexOf(l);

      const cells = this.g.letterGrid.map(l => ({
        word: l.word,
        wordPosition: l.wordPosition,
        currentScore: l.currentScore,
        tint: l.curGState.tint || 0,
        locked: !!l.locked
      }));

      const seen = new Set();
      const hiddenWords = [];
      for (const l of this.g.letterGrid) {
        if (l.wordLetterList && !seen.has(l.wordLetterList.uid)) {
          seen.add(l.wordLetterList.uid);
          hiddenWords.push([...l.wordLetterList].map(idxOf));
        }
      }

      const userWords = this.g.userWords.map(uw => ({
        indices: [...uw].map(idxOf),
        hlColor: uw.hlColor,
        currentScore: uw.currentScore
      }));

      const hintedList = this.g.hintedList.map(hw => [...hw].map(idxOf));

      const data = {
        appVersion: typeof VERSION !== 'undefined' ? VERSION : '',
        level: this.g.level,
        totScore: this.g.totScore,
        gameState: this.g.gameState,
        gridW: this.g.letterGrid.LETTER_GRID_W,
        gridH: this.g.letterGrid.LETTER_GRID_H,
        maxHints: this.g.letterGrid.maxHints || 0,
        curWordList: this.g.curWordList,
        cells,
        hiddenWords,
        userWords,
        hintedList,
        curCorrect: this.g.curCorrect,
        maxCorrect: this.g.maxCorrect,
        hintsGiven: this.g.hintsGiven,
        time: this.g.time,
        timeToBeat: this.g.timeToBeat,
        levelScore: this.g.levelScore,
        maxLevelScore: this.g.maxLevelScore,
        levelBonus: this.g.levelBonus,
        colorWheel: this.g.colors.toArray(),
        bgCurrentY: this.g.bgCurrentY,
        bgOffset: this.g.bgOffset
      };

      localStorage.setItem(GameSave.SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('saveGame failed', e);
    }
  }

  loadGame() {
    let data;
    try {
      const raw = localStorage.getItem(GameSave.SAVE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (e) {
      console.warn('loadGame parse failed', e);
      return false;
    }

    if (!data || !data.gridW || !data.cells || !data.cells.length) return false;

    this.g.el.startScreen.classList.add('hidden');
    this.g.el.overlay.classList.remove('hidden');

    this.g.level = data.level || 1;
    this.g.totScore = data.totScore || 0;
    this.g.curWordList = data.curWordList || [];
    this.g.curCorrect = data.curCorrect || 0;
    this.g.maxCorrect = data.maxCorrect || 0;
    this.g.hintsGiven = data.hintsGiven || 0;
    this.g.time = data.time || 0;
    this.g.timeToBeat = data.timeToBeat || 300;
    this.g.levelScore = data.levelScore || 0;
    this.g.maxLevelScore = data.maxLevelScore || 0;
    this.g.levelBonus = data.levelBonus != null ? data.levelBonus : 1;
    this.g.colors.fromArray(data.colorWheel);
    this.g.hintedList = [];
    this.g.userWords = [];
    this.g.connectorList = [];
    this.g.inHilite = false;
    this.g.curHLWord = null;
    this.g.timerPaused = false;

    this.g.el.levelNum.textContent = String(this.g.level);

    this.g.letterGrid.resetSize(data.gridW, data.gridH);

    for (let i = 0; i < this.g.letterGrid.length; i++) {
      const l = this.g.letterGrid[i];
      const c = data.cells[i];
      if (!c) continue;
      l.word = c.word || '';
      l.wordPosition = c.wordPosition != null ? c.wordPosition : -1;
      l.wordLetterList = null;
      l.userLetterList = null;
      l.userConnector = null;
      l.updateLetterGfx();
    }

    this.g.letterGrid.correctList = [];
    for (const indices of (data.hiddenWords || [])) {
      const list = new LetterList();
      for (const idx of indices) {
        const l = this.g.letterGrid[idx];
        if (!l) continue;
        list.push(l);
        l.wordLetterList = list;
      }
      if (list.length) this.g.letterGrid.correctList.push(list);
    }

    if (data.maxHints) this.g.letterGrid.maxHints = data.maxHints;
    else this.g.letterGrid.computeMaxHints();

    this.g.hintedList = [];
    for (const indices of (data.hintedList || [])) {
      const match = this.g.letterGrid.correctList.find(cl =>
        cl.length === indices.length &&
        indices.every((idx, i) => this.g.letterGrid[idx] === cl[i])
      );
      if (match) this.g.hintedList.push(match);
    }

    for (const uw of (data.userWords || [])) {
      const list = new LetterList();
      list.hlColor = uw.hlColor;
      list.currentScore = uw.currentScore || 0;
      for (const idx of uw.indices) {
        const l = this.g.letterGrid[idx];
        if (!l) continue;
        list.push(l);
        l.userLetterList = list;
        l.setTint(list.hlColor);
      }
      if (list.length === 0) continue;

      this.g.userWords.push(list);
      for (let i = 0; i < list.length - 1; i++) {
        this.g.input.addConnector(list[i], list[i + 1], list.hlColor);
      }
    }

    for (let i = 0; i < this.g.letterGrid.length; i++) {
      const l = this.g.letterGrid[i];
      const c = data.cells[i];
      if (!c) continue;
      l.locked = !!c.locked;
      l.setScore(c.currentScore || 0);
      if (c.tint) l.setTint(c.tint);
    }

    this.g.letterBgList = [];
    const bm = BitmapManager.getInstance();
    for (const l of this.g.letterGrid) {
      const lbg = new Sprite();
      lbg.setBitmap(bm.get('shine_circle'));
      lbg.pos = l.pos;
      lbg.setTint(0xFF000000);
      lbg.curGState.alpha = 0.45;
      lbg.curGState.scale = this.g.letterScale;
      this.g.letterBgList.push(lbg);
    }

    if (data.bgCurrentY != null) this.g.bgCurrentY = data.bgCurrentY;
    if (data.bgOffset != null) this.g.bgOffset = data.bgOffset;
    if (this.g.bgp && this.g.bgCurrentY != null) this.g.bgp.pos.y = this.g.bgCurrentY;

    this.g.levelStartTime = performance.now() - this.g.time * 1000;

    const state = data.gameState || 'InPlay';
    this.g.gameState = state;

    if (state === 'LevelBeat' || state === 'GaveUp') {
      this.g.el.levelScore.textContent = String(this.g.levelScore);
      this.g.el.levelScore.classList.remove('hidden');
      this.g.el.giveupBtn.classList.add('hidden');
      this.g.el.clearBtn.classList.add('hidden');
      this.g.el.hintBtn.classList.add('hidden');
      this.g.el.nextBtn.classList.remove('hidden');
    } else {
      this.g.el.levelScore.classList.add('hidden');
      this.g.el.nextBtn.classList.add('hidden');
      this.g.el.giveupBtn.classList.remove('hidden');
      this.g.el.clearBtn.classList.remove('hidden');
      this.g.el.hintBtn.classList.remove('hidden');
      this.g.gameState = 'InPlay';
    }

    this.g.view.updateHUD();
    if (this.g.width > 0) this.g.view.resize(this.g.width, this.g.height);
    return true;
  }

  pauseTimer() {
    if (this.g.gameState === 'InPlay' && !this.g.timerPaused) {
      this.g.time = Math.floor((performance.now() - this.g.levelStartTime) / 1000);
      this.g.timerPaused = true;
    }
  }

  resumeTimer() {
    if (this.g.timerPaused && this.g.gameState === 'InPlay') {
      this.g.levelStartTime = performance.now() - this.g.time * 1000;
      this.g.timerPaused = false;
    }
  }
}
