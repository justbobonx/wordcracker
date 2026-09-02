class Sprite {
  static _nextUid = 1;
  static _tintCanvas = null;
  static _tintCtx = null;

  constructor() {
    this.uid = Sprite._nextUid++;
    this.pos = new Coord(0, 0);
    this.bitmap = null;
    this.clipRect = null;
    this.bOffset = new Coord(0, 0);
    this.bSize = new Coord(0, 0);

    this.curGState = new GfxState();

    this.animating = false;
    this.animateStartTime = 0;
    this.animateDuration = 0;
    this.animateGfxStart = null;
    this.animateGfxTo = null;
    this.animatePosStart = null;
    this.animatePosTo = null;
    this.animateCurve = 'LINEAR';
    this.removeWhenDoneAnimating = false;
  }

  setBitmap(img) {
    this.bitmap = img;
    if (img) {
      this.bOffset = new Coord(img.width / 2, img.height / 2);
      this.bSize = new Coord(img.width, img.height);
    }
  }

  setClipRect(x, y, w, h) {
    this.clipRect = { x, y, w, h };
    this.bOffset = new Coord(w / 2, h / 2);
    this.bSize = new Coord(w, h);
  }

  setTint(tint) {
    this.curGState.tint = tint >>> 0;
  }

  getWidth() {
    return this.bSize.x * this.curGState.scale;
  }

  getHeight() {
    return this.bSize.y * this.curGState.scale;
  }

  interpolate(t, start, end) {
    if (this.animateCurve === 'EASE_IN') return (end - start) * (t * t) + start;
    if (this.animateCurve === 'EASE_OUT') {
      t = t - 1;
      return (end - start) * (-(t * t) + 1) + start;
    }
    return (end - start) * t + start;
  }

  updateAnimation(now) {
    if (!this.animating) return;
    const elapsed = now - this.animateStartTime;
    let t = elapsed / this.animateDuration;
    if (t > 1) t = 1;

    if (this.animateGfxStart && this.animateGfxTo) {
      this.curGState.alpha = this.interpolate(t, this.animateGfxStart.alpha, this.animateGfxTo.alpha);
      this.curGState.scale = this.interpolate(t, this.animateGfxStart.scale, this.animateGfxTo.scale);
      this.curGState.rotation = this.interpolate(t, this.animateGfxStart.getRotAs0to1(), this.animateGfxTo.getRotAs0to1()) * 360;
    }
    if (this.animatePosStart && this.animatePosTo) {
      this.pos.x = this.interpolate(t, this.animatePosStart.x, this.animatePosTo.x);
      this.pos.y = this.interpolate(t, this.animatePosStart.y, this.animatePosTo.y);
    }
    if (elapsed >= this.animateDuration) {
      this.animating = false;
      this.animateGfxStart = null;
      this.animateGfxTo = null;
      this.animatePosStart = null;
      this.animatePosTo = null;
    }
  }

  startAnimation() {
    this.animateStartTime = performance.now();
    if (this.animateGfxTo) this.animateGfxStart = this.curGState.clone();
    if (this.animatePosTo) this.animatePosStart = this.pos.clone();
    this.animating = true;
  }

  isAnimating() {
    return this.animating;
  }

  _getTintedImage() {
    if (!this.bitmap) return null;

    const tint = this.curGState.tint >>> 0;
    if (tint === 0xFFFFFFFF || tint === 0) return null;

    const r = (tint >> 16) & 0xff;
    const g = (tint >> 8) & 0xff;
    const b = tint & 0xff;

    if (r > 240 && g > 240 && b > 240) return null;

    if (!Sprite._tintCanvas) {
      Sprite._tintCanvas = document.createElement('canvas');
      Sprite._tintCtx = Sprite._tintCanvas.getContext('2d');
    }
    const tc = Sprite._tintCanvas;
    const tctx = Sprite._tintCtx;

    const srcW = this.clipRect ? this.clipRect.w : this.bitmap.width;
    const srcH = this.clipRect ? this.clipRect.h : this.bitmap.height;

    if (tc.width !== srcW || tc.height !== srcH) {
      tc.width = srcW;
      tc.height = srcH;
    }

    tctx.clearRect(0, 0, srcW, srcH);

    if (this.clipRect) {
      tctx.drawImage(
        this.bitmap,
        this.clipRect.x, this.clipRect.y, srcW, srcH,
        0, 0, srcW, srcH
      );
    } else {
      tctx.drawImage(this.bitmap, 0, 0);
    }

    tctx.globalCompositeOperation = 'multiply';
    tctx.fillStyle = `rgb(${r},${g},${b})`;
    tctx.fillRect(0, 0, srcW, srcH);

    tctx.globalCompositeOperation = 'destination-in';
    if (this.clipRect) {
      tctx.drawImage(
        this.bitmap,
        this.clipRect.x, this.clipRect.y, srcW, srcH,
        0, 0, srcW, srcH
      );
    } else {
      tctx.drawImage(this.bitmap, 0, 0);
    }

    tctx.globalCompositeOperation = 'source-over';
    return tc;
  }

  draw(ctx) {
    if (!this.bitmap) return;
    this.updateAnimation(performance.now());

    const s = this.curGState.scale;
    const dx = this.pos.x - this.bOffset.x * s;
    const dy = this.pos.y - this.bOffset.y * s;
    const dw = this.bSize.x * s;
    const dh = this.bSize.y * s;

    ctx.save();
    ctx.globalAlpha = this.curGState.alpha;

    if (this.curGState.rotation !== 0) {
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate((this.curGState.rotation * Math.PI) / 180);
      ctx.translate(-this.pos.x, -this.pos.y);
    }

    const tinted = this._getTintedImage();
    if (tinted) {
      ctx.drawImage(tinted, 0, 0, tinted.width, tinted.height, dx, dy, dw, dh);
    } else if (this.clipRect) {
      ctx.drawImage(
        this.bitmap,
        this.clipRect.x, this.clipRect.y, this.clipRect.w, this.clipRect.h,
        dx, dy, dw, dh
      );
    } else {
      ctx.drawImage(this.bitmap, dx, dy, dw, dh);
    }

    ctx.restore();
  }
}
