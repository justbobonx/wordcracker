// Stub for now – original Android code had sound mostly commented out
export class SoundManager {
  static instance = null;

  static getInstance() {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  init() {}
  play() {}
  mute() {}
  unmute() {}
}
