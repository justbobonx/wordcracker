class GfxState {
  constructor() {
    this.alpha = 1;
    this.scale = 1;
    this.rotation = 0;
    this.tint = 0xFFFFFFFF;
  }

  clone() {
    const g = new GfxState();
    g.alpha = this.alpha;
    g.scale = this.scale;
    g.rotation = this.rotation;
    g.tint = this.tint;
    return g;
  }

  getRotAs0to1() {
    return this.rotation / 360;
  }
}
