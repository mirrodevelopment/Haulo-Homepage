// Central reactive loading manager for HAULO 3D Hero readiness
class LoadingManager {
  constructor() {
    this.progress = 0;
    this.targetProgress = 0;
    this.stage = 'idle'; // 'idle' | 'downloading' | 'parsing' | 'compiling' | 'ready' | 'error'
    this.error = null;
    this.isReady = false;
    this.listeners = new Set();
    this.retryHandler = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[LoadingManager] Listener error:', err);
      }
    });
  }

  getState() {
    return {
      progress: this.progress,
      targetProgress: this.targetProgress,
      stage: this.stage,
      error: this.error,
      isReady: this.isReady,
    };
  }

  setProgress(target, stage = this.stage) {
    // Progress is monotonically increasing to avoid visual jumps
    this.targetProgress = Math.max(this.targetProgress, Math.min(1.0, target));
    this.stage = stage;
    this.notify();
  }

  setReady() {
    this.targetProgress = 1.0;
    this.progress = 1.0;
    this.stage = 'ready';
    this.isReady = true;
    this.notify();
  }

  setError(err) {
    this.error = err || new Error('Failed to load 3D experience');
    this.stage = 'error';
    this.notify();
  }

  registerRetryHandler(fn) {
    this.retryHandler = fn;
  }

  retry() {
    this.error = null;
    this.progress = 0;
    this.targetProgress = 0;
    this.isReady = false;
    this.stage = 'downloading';
    this.notify();
    if (typeof this.retryHandler === 'function') {
      this.retryHandler();
    }
  }
}

export const loadingManager = new LoadingManager();
