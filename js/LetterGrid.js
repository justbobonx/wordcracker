class LetterGrid extends LetterList {
  constructor(view) {
    super();
    this.dadView = view;
    this.LETTER_GRID_W = 0;
    this.LETTER_GRID_H = 0;
    this.LETTER_GRID_SIZE = 0;
    this.emptySpaceLists = [];
    this.correctList = [];
    this.maxHints = 0;
  }

  computeMaxHints() {
    let n = 0;
    for (const w of this.correctList) {
      if (w && w.length) n += Math.ceil(w.length / 2);
    }
    this.maxHints = n;
    return n;
  }

  resetSize(width, height) {
    this.LETTER_GRID_W = width;
    this.LETTER_GRID_H = height;
    this.LETTER_GRID_SIZE = width * height;

    this.length = 0;
    this.emptySpaceLists = [];
    this.correctList = [];

    const view = this.dadView;
    const LS = Letter.LETTER_SIZE;

    const topMargin = 80;
    const bottomMargin = 130;
    const availableH = view.height - topMargin - bottomMargin;
    const availableW = view.width - 20;

    const gridW = width * LS;
    const gridH = height * LS;

    let scale = 1;
    if (gridW > availableW || gridH > availableH) {
      scale = Math.min(availableW / gridW, availableH / gridH);
    }

    view.letterScale = scale;
    const scaledSize = LS * scale;

    view.LEFT = (view.width - width * scaledSize) / 2;
    view.BOTTOM = topMargin + (availableH - height * scaledSize) / 2;
    view.RIGHT = view.LEFT + width * scaledSize;
    view.TOP = view.BOTTOM + height * scaledSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const l = new Letter();
        l.baseScale = scale;
        l.pos = new Coord(
          view.LEFT + scaledSize / 2 + x * scaledSize,
          view.BOTTOM + scaledSize / 2 + y * scaledSize
        );
        l.curGState.scale = scale;
        this.push(l);
      }
    }

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const l = this.getLetter(x, y);
        l.neighbors = [];
        const add = (nx, ny) => {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            l.addNeighbor(this.getLetter(nx, ny));
          }
        };
        add(x - 1, y - 1); add(x, y - 1); add(x + 1, y - 1);
        add(x - 1, y);                   add(x + 1, y);
        add(x - 1, y + 1); add(x, y + 1); add(x + 1, y + 1);
      }
    }
  }

  getLetter(x, y) {
    return this[y * this.LETTER_GRID_W + x];
  }

  clearToEmpty() {
    this.emptySpaceLists = [];
    this.correctList = [];
    const emptySpaces = new LetterList(this);
    this.emptySpaceLists.push(emptySpaces);

    for (const l of this) {
      l.clear();
      l.setEmptySpaceList(emptySpaces);
    }
  }

  hasEmptySpaces() {
    return this.emptySpaceLists.length > 0;
  }

  getBiggestEmptyList() {
    let longestLen = 0;
    let longestInd = 0;
    for (let i = 0; i < this.emptySpaceLists.length; i++) {
      if (this.emptySpaceLists[i].length > longestLen) {
        longestLen = this.emptySpaceLists[i].length;
        longestInd = i;
      }
    }
    return this.emptySpaceLists[longestInd];
  }

  placeWord(word, emptySpaceList) {
    const idx = this.emptySpaceLists.indexOf(emptySpaceList);
    if (idx >= 0) this.emptySpaceLists.splice(idx, 1);

    const emptyListCopy = new LetterList(emptySpaceList);
    const emptyListQueue = new LetterList(emptySpaceList);

    let goodPlace = false;
    let startLetter = null;

    while (!goodPlace && emptyListQueue.length > 0) {
      const starti = Math.floor(Math.random() * emptyListQueue.length);
      startLetter = emptyListQueue.splice(starti, 1)[0];
      goodPlace = startLetter.placeWord(word, 0);
    }

    if (goodPlace) {
      for (const el of emptyListCopy) {
        if (el.isEmpty()) {
          const newEmptyList = el.emptySpaceList;
          if (newEmptyList && !this.emptySpaceLists.includes(newEmptyList)) {
            this.emptySpaceLists.push(newEmptyList);
          }
        }
      }
      this.correctList.push(startLetter.wordLetterList);
    } else {
      for (const el of emptyListCopy) {
        el.setEmptySpaceList(emptyListCopy);
      }
    }

    return goodPlace;
  }

  getShuffledCorrectList() {
    const copy = this.correctList.slice();
    for (let i = 0; i < copy.length; i++) {
      const j = Math.floor(Math.random() * copy.length);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
}
