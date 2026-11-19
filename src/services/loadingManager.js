// Central reactive loading manager for HAULO 3D Hero readiness
class LoadingManager {
  constructor() {
    this.progress = 0;
    this.targetProgress = 0;
    this.stage = 'idle'; // 'idle' | 'downloading' | 'parsing' | 'compiling' | 'ready' | 'error'
    this.isIndeterminate = true;
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
      isIndeterminate: this.isIndeterminate,
      error: this.error,
      isReady: this.isReady,
    };
  }

  setProgress(target, stage = this.stage, isIndeterminate = false) {
    this.isIndeterminate = isIndeterminate;
    // Cap progress at 0.99 prior to setReady() to ensure 100% is only shown when genuinely ready
    const safeTarget = Math.max(0, Math.min(0.99, target));
    this.targetProgress = Math.max(this.targetProgress, safeTarget);
    this.stage = stage;
    this.notify();
  }

  setIndeterminate(stage = this.stage) {
    this.isIndeterminate = true;
    this.stage = stage;
    this.notify();
  }

  setReady() {
    this.isIndeterminate = false;
    this.targetProgress = 1.0;
    this.progress = 1.0;
    this.stage = 'ready';
    this.isReady = true;
    this.notify();
  }

  setError(err) {
    this.error = err || new Error('Failed to load 3D experience');
    this.stage = 'error';
    this.isIndeterminate = false;
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
    this.isIndeterminate = true;
    this.stage = 'downloading';
    this.notify();
    if (typeof this.retryHandler === 'function') {
      try {
        this.retryHandler();
      } catch (err) {
        console.error('[LoadingManager] Retry handler error:', err);
        this.setError(err);
      }
    }
  }
}

export const loadingManager = new LoadingManager();
