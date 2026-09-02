class BitmapManager {
  static instance = null;

  constructor() {
    this.cache = new Map();
  }

  static getInstance() {
    if (!BitmapManager.instance) {
      BitmapManager.instance = new BitmapManager();
    }
    return BitmapManager.instance;
  }

  async load(name, url) {
    if (this.cache.has(name)) return this.cache.get(name);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(name, img);
        resolve(img);
      };
      img.onerror = (e) => {
        console.error('Failed to load', name, url, e);
        reject(e);
      };
      img.src = url;
    });
  }

  async loadAll() {
    const base = 'assets/images/';
    const files = {
      letters: 'letters.png',
      letter_fg: 'letter_fg.png',
      letter_shine: 'letter_shine.png',
      shine_circle: 'shine_circle.png',
      letter_link_vert: 'letter_link_vert.png',
      letter_link_diag: 'letter_link_diag.png',
      bg: 'wordcracker-bg-1.jpg',
      icon: 'icon.png'
    };

    const promises = Object.entries(files).map(([name, file]) =>
      this.load(name, base + file)
    );
    await Promise.all(promises);
    return this;
  }

  get(name) {
    return this.cache.get(name) || null;
  }
}
