/** Layout, HUD, frame update and canvas draw. */
class GameView {
  static HUD_RIGHT = '#ffffff';
  static HUD_WRONG = '#ffc4bb';
  static HUD_HINT = '#7eb6ff';

  constructor(game) {
    this.g = game;
  }

  bgGrassY() {
    if (!this.g.bgp || !this.g.bgp.bitmap || this.g.width <= 0 || this.g.height <= 0) return 0;
    const scale = this.g.width / this.g.bgp.bitmap.width;
    const scaledH = this.g.bgp.bitmap.height * scale;
    return this.g.height - scaledH / 2;
  }

  resize(cssW, cssH) {
    this.g.width = cssW;
    this.g.height = cssH;
    this.g.dpr = window.devicePixelRatio || 1;

    if (this.g.bgp && this.g.bgp.bitmap && cssW > 0 && cssH > 0) {
      const scale = cssW / this.g.bgp.bitmap.width;
      this.g.bgp.curGState.scale = scale;
      this.g.bgp.pos.x = cssW / 2;

      const scaledH = this.g.bgp.bitmap.height * scale;
      const maxTravel = Math.max(1, scaledH - cssH);
      const baseY = cssH - scaledH / 2;
      this.g.bgOffsetInc = maxTravel / 20;

      const progress = this.g.maxCorrect > 0 && this.g.curWordList.length > 0
        ? this.g.maxCorrect / Math.max(this.g.curWordList.length, 1)
        : 0;

      if (this.g.gameState === 'Title' || this.g.gameState === 'Boot') {
        this.g.bgOffset = baseY;
        this.g.bgCurrentY = baseY;
      } else {
        this.g.bgOffset = baseY + progress * maxTravel;
        if (this.g.bgCurrentY == null) this.g.bgCurrentY = baseY;
        if (this.g.bgCurrentY < baseY) this.g.bgCurrentY = baseY;
        const maxY = baseY + maxTravel;
        if (this.g.bgCurrentY > maxY) this.g.bgCurrentY = maxY;
      }
      this.g.bgp.pos.y = this.g.bgCurrentY;
    }

    if (this.g.letterGrid.LETTER_GRID_W > 0 && this.g.gameState !== 'Title' && this.g.gameState !== 'Boot') {
      const gw = this.g.letterGrid.LETTER_GRID_W;
      const gh = this.g.letterGrid.LETTER_GRID_H;
      const idxOf = (l) => this.g.letterGrid.indexOf(l);
      const savedMaxHints = this.g.letterGrid.maxHints || 0;

      // Snapshot by index — resetSize creates brand-new Letter instances
      const cells = this.g.letterGrid.map(l => ({
        word: l.word,
        wordPosition: l.wordPosition,
        currentScore: l.currentScore,
        tint: l.curGState.tint,
        locked: !!l.locked
      }));

      const userWordMeta = this.g.userWords.map(uw => ({
        indices: [...uw].map(idxOf),
        hlColor: uw.hlColor,
        currentScore: uw.currentScore
      }));

      const hiddenWords = [];
      const seen = new Set();
      for (const l of this.g.letterGrid) {
        if (l.wordLetterList && !seen.has(l.wordLetterList.uid)) {
          seen.add(l.wordLetterList.uid);
          hiddenWords.push([...l.wordLetterList].map(idxOf));
        }
      }

      const hintedIndices = this.g.hintedList.map(hw => [...hw].map(idxOf));

      this.g.letterGrid.resetSize(gw, gh);

      for (let i = 0; i < this.g.letterGrid.length; i++) {
        const l = this.g.letterGrid[i];
        const c = cells[i];
        if (!c) continue;
        l.word = c.word;
        l.wordPosition = c.wordPosition;
        l.wordLetterList = null;
        l.userLetterList = null;
        l.userConnector = null;
        l.updateLetterGfx();
        l.locked = !!c.locked;
        l.setScore(c.currentScore);
        if (c.tint) l.setTint(c.tint);
      }

      this.g.letterGrid.correctList = [];
      for (const indices of hiddenWords) {
        const list = new LetterList();
        for (const idx of indices) {
          const l = this.g.letterGrid[idx];
          if (!l) continue;
          list.push(l);
          l.wordLetterList = list;
        }
        if (list.length) this.g.letterGrid.correctList.push(list);
      }

      this.g.letterGrid.maxHints = savedMaxHints;
      if (!this.g.letterGrid.maxHints) this.g.letterGrid.computeMaxHints();

      this.g.hintedList = [];
      for (const indices of hintedIndices) {
        const match = this.g.letterGrid.correctList.find(cl =>
          cl.length === indices.length &&
          indices.every((idx, i) => this.g.letterGrid[idx] === cl[i])
        );
        if (match) this.g.hintedList.push(match);
      }

      this.g.userWords = [];
      for (const meta of userWordMeta) {
        const list = new LetterList();
        list.hlColor = meta.hlColor;
        list.currentScore = meta.currentScore || 0;
        for (const idx of meta.indices) {
          const l = this.g.letterGrid[idx];
          if (!l) continue;
          list.push(l);
          l.userLetterList = list;
          l.setTint(list.hlColor);
        }
        if (list.length === 0) continue;
        this.g.userWords.push(list);
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

      this.g.connectorList = [];
      for (const l of this.g.letterGrid) l.userConnector = null;
      for (const uw of this.g.userWords) {
        for (let i = 0; i < uw.length - 1; i++) {
          this.g.input.addConnector(uw[i], uw[i + 1], uw.hlColor);
        }
      }
    }
  }

  formatWordSpan(w) {
    const correct = (w.currentScore || 0) >= 0.999;
    const weight = correct ? 'bold' : 'normal';
    const restColor = correct ? GameView.HUD_RIGHT : GameView.HUD_WRONG;
    const word = w.getWord();

    let hintLen = 0;
    while (hintLen < w.length && w[hintLen] && w[hintLen].locked) hintLen++;

    if (hintLen === 0) {
      return `<span style="color:${restColor};font-weight:${weight}">${word}</span>`;
    }

    const hintPart = word.slice(0, hintLen);
    const restPart = word.slice(hintLen);
    let html = `<span style="color:${GameView.HUD_HINT};font-weight:${weight}">${hintPart}</span>`;
    if (restPart) {
      html += `<span style="color:${restColor};font-weight:${weight}">${restPart}</span>`;
    }
    return html;
  }

  updateHUD() {
    this.g.el.score.textContent = `SCORE: ${this.g.totScore}`;
    const m = Math.floor(this.g.time / 60);
    const s = this.g.time % 60;
    this.g.el.time.textContent = `TIME: ${m}:${String(s).padStart(2, '0')}`;
    this.g.el.bonus.textContent = `x${this.g.levelBonus.toFixed(2)}`;
    this.g.el.numWords.textContent = `${this.g.userWords.length}(${this.g.curCorrect})/${this.g.curWordList.length}`;

    const parts = this.g.userWords.map(w => this.formatWordSpan(w));
    if (this.g.inHilite && this.g.curHLWord && this.g.curHLWord.length > 0) {
      parts.push(this.formatWordSpan(this.g.curHLWord));
    }
    this.g.el.wordList.innerHTML = parts.length ? parts.join(',  ') : ' &nbsp; ';
  }

  update() {
    if (this.g.gameState === 'InPlay' && !this.g.timerPaused) {
      this.g.time = Math.floor((performance.now() - this.g.levelStartTime) / 1000);
      this.g.levelBonus = 1 + 2 * Math.max((this.g.timeToBeat - this.g.time) / this.g.timeToBeat, 0);
      const maxHints = this.g.letterGrid.maxHints || 1;
      this.g.levelBonus *= 1 - (this.g.hintsGiven / (maxHints * 1.333));
      this.g.levelBonus = Math.max(this.g.levelBonus, 0);
      this.updateHUD();
    }

    if (this.g.bgp && this.g.bgCurrentY != null) {
      if (this.g.bgCurrentY < this.g.bgOffset) {
        this.g.bgCurrentY += 0.2;
        if (this.g.bgCurrentY > this.g.bgOffset) this.g.bgCurrentY = this.g.bgOffset;
        this.g.bgp.pos.y = this.g.bgCurrentY;
      }
    }
  }

  draw() {
    const ctx = this.g.ctx;
    const dpr = this.g.dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.g.bgp) this.g.bgp.draw(ctx);

    if (this.g.gameState === 'Title' || this.g.gameState === 'Boot' || this.g.gameState === 'NoDraw') return;

    for (const bg of this.g.letterBgList) bg.draw(ctx);
    for (const c of this.g.connectorList) c.draw(ctx);
    for (const l of this.g.letterGrid) l.draw(ctx);
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}
