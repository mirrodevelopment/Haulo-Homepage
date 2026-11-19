// HAULO Performance Diagnostics Service
// Accurate, development/debug-only performance tracking with zero extra WebGL contexts.

class PerfDiagnostics {
  constructor() {
    this.enabled = false;
    this.loadingTimings = {
      t_download_start: 0,
      t_download_end: 0,
      t_parse_start: 0,
      t_parse_end: 0,
      t_clone_start: 0,
      t_clone_end: 0,
      t_recolor_start: 0,
      t_recolor_end: 0,
      t_compile_start: 0,
      t_compile_end: 0,
      t_first_frame: 0,
      modelUrl: '',
      downloadCount: 0,
    };
    this.renderers = new Map();
    this.frameTimes = [];
    this.maxFrameHistory = 120;
    this.currentFps = 60;
    this.avgFrameTimeMs = 16.6;
    this.p95FrameTimeMs = 16.6;
    this.lastFrameTimestamp = 0;
    this.currentSection = 'Hero';
    this.lastAnimTimeMs = 0;
    this.subscribers = new Set();
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    // Enabled only via explicit query parameter (?perf=true or ?debug=1) or global window flag
    const searchParams = new URLSearchParams(window.location.search);
    this.enabled =
      searchParams.has('perf') ||
      searchParams.has('debug') ||
      window.__HAULO_PERF_OVERLAY__ === true ||
      import.meta.env.VITE_PERF_OVERLAY === 'true';

    if (this.enabled) {
      window.__hauloPerf = this;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  markLoadingStage(stage, meta = {}) {
    if (!this.enabled) return;
    const now = meta.t || performance.now();
    if (stage === 'download_start') {
      this.loadingTimings.t_download_start = now;
      this.loadingTimings.modelUrl = meta.url || '';
      this.loadingTimings.downloadCount += 1;
    } else if (stage === 'download_end') {
      this.loadingTimings.t_download_end = now;
    } else if (stage === 'parse_start') {
      this.loadingTimings.t_parse_start = now;
    } else if (stage === 'parse_end') {
      this.loadingTimings.t_parse_end = now;
    } else if (stage === 'clone_start') {
      this.loadingTimings.t_clone_start = now;
    } else if (stage === 'clone_end') {
      this.loadingTimings.t_clone_end = now;
    } else if (stage === 'recolor_start') {
      this.loadingTimings.t_recolor_start = now;
    } else if (stage === 'recolor_end') {
      this.loadingTimings.t_recolor_end = now;
    } else if (stage === 'compile_start') {
      this.loadingTimings.t_compile_start = now;
    } else if (stage === 'compile_end') {
      this.loadingTimings.t_compile_end = now;
    } else if (stage === 'first_frame') {
      this.loadingTimings.t_first_frame = now;
      this.notify();
    }
  }

  registerRenderer(id, renderer, name = 'Renderer') {
    if (!this.enabled || !renderer) return;
    this.renderers.set(id, {
      renderer,
      name,
      lastRenderTimestamp: 0,
      calls: 0,
      triangles: 0,
      width: renderer.domElement ? renderer.domElement.width : 0,
      height: renderer.domElement ? renderer.domElement.height : 0,
      dpr: typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1,
    });
    this.notify();
  }

  unregisterRenderer(id) {
    if (!this.enabled) return;
    this.renderers.delete(id);
    this.notify();
  }

  recordRender(id, renderer, name = 'Renderer') {
    if (!this.enabled || !renderer) return;
    const now = performance.now();
    const calls = (renderer.info && renderer.info.render) ? renderer.info.render.calls : 0;
    const triangles = (renderer.info && renderer.info.render) ? renderer.info.render.triangles : 0;
    this.renderers.set(id, {
      renderer,
      name,
      lastRenderTimestamp: now,
      calls,
      triangles,
      width: renderer.domElement ? renderer.domElement.width : 0,
      height: renderer.domElement ? renderer.domElement.height : 0,
      dpr: typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1,
    });
  }

  recordFrame(animDurationMs = 0, sectionName = null) {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.lastFrameTimestamp > 0) {
      const delta = now - this.lastFrameTimestamp;
      if (delta > 0 && delta < 1000) {
        this.frameTimes.push(delta);
        if (this.frameTimes.length > this.maxFrameHistory) {
          this.frameTimes.shift();
        }

        const sum = this.frameTimes.reduce((acc, v) => acc + v, 0);
        this.avgFrameTimeMs = sum / this.frameTimes.length;
        this.currentFps = Math.round(1000 / Math.max(1, this.avgFrameTimeMs));

        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p95Idx = Math.floor(sorted.length * 0.95);
        this.p95FrameTimeMs = sorted[p95Idx] || this.avgFrameTimeMs;
      }
    }
    this.lastFrameTimestamp = now;
    if (animDurationMs > 0) this.lastAnimTimeMs = animDurationMs;
    if (sectionName) this.currentSection = sectionName;
  }

  getSnapshot() {
    const now = performance.now();
    let activeDrawCalls = 0;
    let activeTriangles = 0;
    let activeContextsCount = 0;
    const allocatedContextsCount = this.renderers.size;
    const activeNames = [];
    let bufferRes = 'N/A';

    this.renderers.forEach((entry) => {
      // Actively rendering check: did this renderer execute within the last 150ms?
      const isActivelyRendering = (now - entry.lastRenderTimestamp) < 150;
      if (isActivelyRendering) {
        activeContextsCount++;
        activeDrawCalls += entry.calls;
        activeTriangles += entry.triangles;
        activeNames.push(`${entry.name} (${entry.calls}c, ${Math.round(entry.triangles / 1000)}k)`);
        if (bufferRes === 'N/A' && entry.width > 0) {
          bufferRes = `${entry.width}x${entry.height} (DPR ${entry.dpr.toFixed(1)})`;
        }
      }
    });

    // Fallback resolution from any allocated renderer if all are temporarily idle
    if (bufferRes === 'N/A') {
      this.renderers.forEach((entry) => {
        if (bufferRes === 'N/A' && entry.width > 0) {
          bufferRes = `${entry.width}x${entry.height} (DPR ${entry.dpr.toFixed(1)})`;
        }
      });
    }

    const t = this.loadingTimings;
    const downloadMs = (t.t_download_end && t.t_download_start) ? Math.max(0, t.t_download_end - t.t_download_start) : 0;
    const parseMs = (t.t_parse_end && t.t_parse_start) ? Math.max(0, t.t_parse_end - t.t_parse_start) : 0;
    const cloneMs = (t.t_clone_end && t.t_clone_start) ? Math.max(0, t.t_clone_end - t.t_clone_start) : 0;
    const recolorMs = (t.t_recolor_end && t.t_recolor_start) ? Math.max(0, t.t_recolor_end - t.t_recolor_start) : 0;
    const compileMs = (t.t_compile_end && t.t_compile_start) ? Math.max(0, t.t_compile_end - t.t_compile_start) : 0;
    const firstFrameMs = (t.t_first_frame && t.t_compile_end) ? Math.max(0, t.t_first_frame - t.t_compile_end) : 0;

    // Total from GLB download start to first frame rendered
    const pipelineTotalMs = (t.t_first_frame && t.t_download_start) ? Math.max(0, t.t_first_frame - t.t_download_start) : 0;
    // Total from navigation start (0ms) to first frame rendered
    const navToReadyMs = t.t_first_frame ? Math.max(0, t.t_first_frame) : 0;

    return {
      enabled: this.enabled,
      fps: this.currentFps,
      avgFrameTimeMs: Math.round(this.avgFrameTimeMs * 10) / 10,
      p95FrameTimeMs: Math.round(this.p95FrameTimeMs * 10) / 10,
      activeContextsCount,
      allocatedContextsCount,
      activeNames,
      totalDrawCalls: activeDrawCalls,
      totalTriangles: activeTriangles,
      bufferRes,
      currentSection: this.currentSection,
      animTimeMs: Math.round(this.lastAnimTimeMs * 10) / 10,
      loading: {
        modelUrl: t.modelUrl.split('/').pop() || 'None',
        downloadCount: t.downloadCount,
        downloadMs: Math.round(downloadMs),
        parseMs: Math.round(parseMs),
        cloneMs: Math.round(cloneMs),
        recolorMs: Math.round(recolorMs),
        compileMs: Math.round(compileMs),
        firstFrameMs: Math.round(firstFrameMs),
        pipelineTotalMs: Math.round(pipelineTotalMs),
        navToReadyMs: Math.round(navToReadyMs),
      },
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const snap = this.getSnapshot();
    this.subscribers.forEach((cb) => {
      try {
        cb(snap);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const perfDiagnostics = new PerfDiagnostics();
