/** Builds letter grids and picks words for each level. */
class LevelBuilder {
  constructor(game) {
    this.g = game;
  }

  newLevel() {
    if (this.g.gameState === 'LevelBeat') {
      this.g.level++;
      this.g.el.levelNum.textContent = String(this.g.level);
    }

    this.g.gameState = 'NoDraw';
    this.g.connectorList = [];
    this.g.letterBgList = [];
    this.g.userWords = [];
    this.g.curCorrect = 0;
    this.g.maxCorrect = 0;
    this.g.levelScore = 0;
    this.g.maxLevelScore = 0;
    this.g.levelBonus = 3;
    this.g.hintsGiven = 0;
    this.g.hintedList = [];
    this.g.time = 0;
    this.g.levelStartTime = performance.now();
    this.g.timerPaused = false;
    this.g.inHilite = false;
    this.g.pointerDown = false;
    this.g.curHLWord = null;
    this.g.downLetter = null;
    this.g.extendedDuringGesture = false;

    this.fillLetterGrid();

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

    if (this.g.bgp && this.g.bgp.bitmap && this.g.width > 0) {
      const scale = this.g.width / this.g.bgp.bitmap.width;
      const scaledH = this.g.bgp.bitmap.height * scale;
      const baseY = this.g.height - scaledH / 2;
      const maxTravel = Math.max(1, scaledH - this.g.height);
      this.g.bgOffsetInc = maxTravel / 20;

      if (this.g.totScore === 0 && this.g.level <= 1) {
        this.g.bgCurrentY = baseY;
        this.g.bgOffset = baseY;
      } else {
        if (this.g.bgCurrentY == null || this.g.bgCurrentY < baseY) this.g.bgCurrentY = baseY;
        const maxY = baseY + maxTravel;
        if (this.g.bgCurrentY > maxY) this.g.bgCurrentY = maxY;
        this.g.bgOffset = this.g.bgCurrentY;
      }
      this.g.bgp.pos.y = this.g.bgCurrentY;
    }

    this.g.colors.refill();
    this.g.gameState = 'InPlay';
    this.g.view.updateHUD();
    this.g.save.saveGame();
}

  fillLetterGrid() {
    let maxLevelWordSize = 6;
    let bigSize = 7;
    let gw, gh;

    if (this.g.level <= 1) {
      gw = 3; gh = 3; this.g.timeToBeat = 240; maxLevelWordSize = 3;
    } else if (this.g.level <= 2) {
      gw = 3; gh = 3; this.g.timeToBeat = 240; maxLevelWordSize = 5;
    } else if (this.g.level <= 4) {
      gw = 3; gh = 4; this.g.timeToBeat = 300; maxLevelWordSize = 6; bigSize = 5;
    } else if (this.g.level <= 7) {
      gw = 4; gh = 4; this.g.timeToBeat = 360; maxLevelWordSize = 7; bigSize = 6;
    } else if (this.g.level <= 10) {
      gw = 4; gh = 5; this.g.timeToBeat = 420; maxLevelWordSize = 8; bigSize = 7;
    } else if (this.g.level <= 14) {
      gw = 5; gh = 5; this.g.timeToBeat = 480; maxLevelWordSize = 9; bigSize = 7;
    } else {
      gw = 5; gh = 6; this.g.timeToBeat = 540; maxLevelWordSize = 11; bigSize = 8;
    }

    let goodPlace = false;
    let attempts = 0;
    while (!goodPlace && attempts < 40) {
      attempts++;
      this.g.letterGrid.resetSize(gw, gh);
      this.g.letterGrid.clearToEmpty();
      this.g.curWordList = [];

      let placedABig = false;

      while (this.g.letterGrid.hasEmptySpaces()) {
        const emptySpaces = this.g.letterGrid.getBiggestEmptyList();
        const emptySize = emptySpaces.length;
        let wordSize = 0;

        if (emptySize < 6) {
          wordSize = emptySize;
        } else {
          let maxWordSize = Math.min(emptySize, maxLevelWordSize);
          if (placedABig) maxWordSize = Math.min(maxWordSize, bigSize - 1);

          let badSize = 2;
          if (emptySize - maxWordSize === 2) badSize = 3;
          else if (emptySize - maxWordSize < 2) badSize = 4;

          wordSize = Math.floor(Math.random() * (maxWordSize - badSize)) + 3;
          if (wordSize === maxWordSize - 2) wordSize = maxWordSize;
        }

        if (wordSize < 3) break;

        let theWord = '';
        let gotGood = false;
        let tries = 0;
        while (!gotGood && tries < 50) {
          tries++;
          theWord = this.getWordOfLength(wordSize);
          if (!theWord) break;
          gotGood = !this.g.curWordList.includes(theWord);
        }
        if (!gotGood || !theWord) break;

        if (wordSize >= bigSize) placedABig = true;
        this.g.curWordList.push(theWord);

        goodPlace = this.g.letterGrid.placeWord(theWord, emptySpaces);
        if (!goodPlace) break;
      }

      if (goodPlace && this.g.curWordList.length >= 2) break;
      goodPlace = false;      
    }

    for (const l of this.g.letterGrid) {
      l.updateLetterGfx();
      l.setScore(0);
    }

    this.g.letterGrid.computeMaxHints();

    console.log('Level', this.g.level, 'words:', this.g.curWordList, 'maxHints:', this.g.letterGrid.maxHints);
  }

  getWordOfLength(len) {
    if (len < 3 || len >= this.g.wordLists.length) return '';
      const list = this.g.wordLists[len];
    if (!list || list.length < len) return '';
      const ind = Math.floor(Math.random() * (list.length / len)) * len;
    return list.substring(ind, ind + len);
  }

}
