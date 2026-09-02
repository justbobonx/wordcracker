/** Color palette for word highlights. */
class ColorWheel {
  constructor() {
    this.colors = [];
  }

  refill() {
    this.colors = [];
    for (let c = 0; c < 360; c += 30) {
      if (c === 90) continue;
      this.colors.push(ColorWheel.hsvToRgb(c / 360, 0.8, 1));
    }
  }

  /** Random color from the remaining wheel (removed when taken). */
  next() {
    if (this.colors.length === 0) return 0xFFAAAAAA;
    const i = Math.floor(Math.random() * this.colors.length);
    return this.colors.splice(i, 1)[0];
  }

  push(c) {
    if (c != null) this.colors.push(c);
  }

  toArray() {
    return this.colors.slice();
  }

  fromArray(arr) {
    this.colors = Array.isArray(arr) ? arr.slice() : [];
  }

  static hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);
    return (0xFF << 24) | (R << 16) | (G << 8) | B;
  }
}
