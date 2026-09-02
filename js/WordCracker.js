/**
 * WordCracker — game orchestrator.
 * Shared game state lives here; behavior is in collaborator objects.
 */
class WordCracker {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.letterGrid = new LetterGrid(this);

    this.gameState = 'Boot';
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.letterScale = 1;

    this.LEFT = 0;
    this.RIGHT = 0;
    this.TOP = 0;
    this.BOTTOM = 0;

    this.bgp = null;
    this.bgOffset = 0;
    this.bgCurrentY = null;
    this.bgOffsetInc = 0;
    this.maxLevelScore = 0;
    this.maxCorrect = 0;

    this.effects = [];
    this.connectorList = [];
    this.letterBgList = [];

    this.level = 0;
    this.totScore = 0;
    this.levelScore = 0;
    this.levelBonus = 1;
    this.time = 0;
    this.levelStartTime = 0;
    this.timeToBeat = 300;
    this.timerPaused = false;
    this.curCorrect = 0;
    this.hintsGiven = 0;

    this.wordLists = [];
    this.curWordList = [];
    this.userWords = [];
    this.hintedList = [];

    this.inHilite = false;
    this.pointerDown = false;
    this.curHLWord = null;
    this.lastTouchedLetter = null;
    this.downLetter = null;
    this.extendedDuringGesture = false;
    this.curTouch = 'NoTouch';
    this.letterTouchDownTime = 0;
    this.classicTouchMode = false;

    // Last pointer sample for stroke interpolation (CSS canvas coords)
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    this.assetsReady = false;

    this.el = {
      startScreen: document.getElementById('startScreen'),
      newGameBtn: document.getElementById('newGameButton'),
      continueBtn: document.getElementById('continueButton'),
      overlay: document.getElementById('overlay'),
      score: document.getElementById('ol_score'),
      time: document.getElementById('ol_time'),
      levelScore: document.getElementById('ol_levelScore'),
      numWords: document.getElementById('ol_numWords'),
      bonus: document.getElementById('ol_bonus'),
      wordList: document.getElementById('ol_wordList'),
      levelNum: document.getElementById('ol_levelNum'),
      nextBtn: document.getElementById('ol_nextButton'),
      giveupBtn: document.getElementById('ol_giveupButton'),
      clearBtn: document.getElementById('ol_clearButton'),
      hintBtn: document.getElementById('ol_hintButton'),
      container: document.getElementById('game-container')
    };

    this.colors = new ColorWheel();
    this.levels = new LevelBuilder(this);
    this.input = new WordInput(this);
    this.board = new WordBoard(this);
    this.save = new GameSave(this);
    this.view = new GameView(this);
  }

  async boot() {
    console.log('WordCracker loading assets...', VERSION);
    const bm = BitmapManager.getInstance();
    await bm.loadAll();
    await this.loadWordLists();

    this.bgp = new Sprite();
    this.bgp.setBitmap(bm.get('bg'));
    this.assetsReady = true;

    this.bindUI();
    this.bindInput();
    this.refreshContinueButton();

    this.gameState = 'Title';
    this.view.loop();
  }

  refreshContinueButton() {
    const btn = this.el.continueBtn;
    if (!btn) return;
    if (this.save.hasSave()) {
      btn.classList.remove('hidden');
      btn.disabled = false;
    } else {
      btn.classList.add('hidden');
      btn.disabled = true;
    }
  }

  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // Title stays windowed. New / Continue is a user gesture, so FS is legal here.
  // Target the container, not the canvas — HUD overlay lives outside the canvas.
  enterPlayFullscreen() {
    if (this.isFullscreen()) return;
    const el = this.el.container || this.canvas;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (!req) return;
    try {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.warn('Fullscreen request failed', err));
      }
    } catch (err) {
      console.warn('Fullscreen request failed', err);
    }
  }

  beginNewGame() {
    if (this.gameState !== 'Title') return;
    this.enterPlayFullscreen();
    this.save.clearSave();
    this.el.startScreen.classList.add('hidden');
    this.el.overlay.classList.remove('hidden');
    this.gameState = 'LevelBeat';
    this.level = 0;
    this.totScore = 0;
    this.maxCorrect = 0;
    this.bgCurrentY = null;
    this.bgOffset = 0;
    this.levels.newLevel();
    this.save.saveGame();
  }

  beginContinue() {
    if (this.gameState !== 'Title') return;
    this.enterPlayFullscreen();
    if (!this.save.loadGame()) {
      this.beginNewGame();
      return;
    }
  }

  async loadWordLists() {
    const res = await fetch('assets/data/letters.txt');
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    this.wordLists = ['', '', ''];
    for (const line of lines) {
      if (line.trim()) this.wordLists.push(line.trim());
    }
    console.log('Loaded word lists, max length =', this.wordLists.length - 1);
  }

  bindUI() {
    this.el.newGameBtn.addEventListener('click', () => this.beginNewGame());
    this.el.continueBtn.addEventListener('click', () => this.beginContinue());

    this.el.nextBtn.addEventListener('click', () => {
      this.levels.newLevel();
      this.el.levelScore.classList.add('hidden');
      this.el.nextBtn.classList.add('hidden');
      this.el.giveupBtn.classList.remove('hidden');
      this.el.clearBtn.classList.remove('hidden');
      this.el.hintBtn.classList.remove('hidden');
      this.save.saveGame();
    });
    this.el.giveupBtn.addEventListener('click', () => this.board.giveUp());
    this.el.hintBtn.addEventListener('click', () => this.board.giveHint());
    this.el.clearBtn.addEventListener('click', () => this.board.clearWrongWords());
  }

  bindInput() {
    const c = this.canvas;

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onDown = (e) => {
      if (this.gameState !== 'InPlay') return;
      // Ignore synthetic mouse after touch
      if (e.type === 'mousedown' && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      e.preventDefault();
      this.pointerDown = true;
      const p = getPos(e);
      this.input.handlePointer('down', p.x, p.y);
    };
    const onMove = (e) => {
      if (!this.pointerDown) return;
      e.preventDefault();
      const p = getPos(e);
      this.input.handlePointer('move', p.x, p.y);
    };
    const onUp = (e) => {
      if (!this.pointerDown && !this.inHilite) return;
      if (e.type === 'mouseup' && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      e.preventDefault();
      this.pointerDown = false;
      const p = getPos(e);
      this.input.handlePointer('up', p.x, p.y);
    };

    c.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // touchstart on canvas; move/end on window so fast drags off the canvas still track
    c.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: false });
    window.addEventListener('touchcancel', onUp, { passive: false });
  }

  saveGame() { this.save.saveGame(); }
  pauseTimer() { this.save.pauseTimer(); }
  resumeTimer() { this.save.resumeTimer(); }
  resize(w, h) { this.view.resize(w, h); }

}
