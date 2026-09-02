class LetterList extends Array {
  static _nextUid = 1;

  constructor(items) {
    if (typeof items === 'number') {
      super(items);
    } else {
      super();
      if (items) {
        for (const item of items) this.push(item);
      }
    }
    this.uid = LetterList._nextUid++;
    this.hlColor = 0xFFFFFFFF;
    this.currentScore = 0;
  }

  static get [Symbol.species]() {
    return LetterList;
  }

  clone() {
    return new LetterList(this);
  }

  scoreWord() {
    const scoringWords = [];
    const totalRightList = [];

    let lastl = null;

    for (let i = 0; i < this.length; i++) {
      const l = this[i];
      const realWord = l.wordLetterList;
      if (!realWord) continue;

      let totalRight = 0;
      let trli = 0;
      let found = false;

      for (let swi = 0; swi < scoringWords.length; swi++) {
        if (scoringWords[swi] === realWord || scoringWords[swi].uid === realWord.uid) {
          found = true;
          totalRight = totalRightList[swi];
          trli = swi;
          break;
        }
      }

      if (!found) {
        scoringWords.push(realWord);
        trli = scoringWords.length - 1;
        totalRight = 0;
        totalRightList.push(0);
      }

      const byPos = (i < realWord.length && l.getLetter() === realWord[i].getLetter());
      const bySeq = (l.wordPos() === 0 || (lastl != null && realWord[l.wordPos() - 1] === lastl));
      if (byPos || bySeq) {
        totalRight += 1;
      }

      totalRightList[trli] = totalRight;
      lastl = l;
    }

    let bestScore = 0.01;
    const guessSize = this.length;

    for (let swi = 0; swi < scoringWords.length; swi++) {
      let raw = totalRightList[swi];
      const scoreWordSize = scoringWords[swi].length;
      raw /= Math.max(guessSize, scoreWordSize);
      if (raw > bestScore) bestScore = raw;
    }

    for (const l of this) {
      l.setScore(bestScore);
    }

    this.currentScore = bestScore;
    return bestScore;
  }

  getWord() {
    return this.map(l => l.getLetter()).join('').toUpperCase();
  }

  getWordLetter(i) {
    return this[i].getLetter();
  }
}
