import React, { useEffect, useState } from 'react';
import { perfDiagnostics } from '../services/perfDiagnostics';

export function PerfDiagnosticsOverlay() {
  const [snapshot, setSnapshot] = useState(() => perfDiagnostics.getSnapshot());

  useEffect(() => {
    if (!perfDiagnostics.isEnabled()) return;

    // Refresh UI at 4Hz (every 250ms) with minimal overhead
    const interval = setInterval(() => {
      setSnapshot(perfDiagnostics.getSnapshot());
    }, 250);

    return () => clearInterval(interval);
  }, []);

  if (!snapshot.enabled) return null;

  const fpsColor = snapshot.fps >= 50 ? '#00FF66' : snapshot.fps >= 30 ? '#FFAA00' : '#FF3333';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        zIndex: 1000000,
        backgroundColor: 'rgba(10, 10, 14, 0.94)',
        color: '#E0E0E0',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: '1.45',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #3A3A40',
        boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        maxWidth: '360px',
        width: 'calc(100vw - 24px)',
        backdropFilter: 'blur(6px)',
      }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '6px' }}>
        <span style={{ fontWeight: 800, color: '#FFFFFF' }}>HAULO MOBILE GPU DIAGNOSTICS</span>
        <span style={{ color: fpsColor, fontWeight: 900 }}>{snapshot.fps} FPS</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
        <div>Frame: <strong style={{ color: '#FFF' }}>{snapshot.avgFrameTimeMs}ms</strong></div>
        <div>P95: <strong style={{ color: '#FFF' }}>{snapshot.p95FrameTimeMs}ms</strong></div>

        <div style={{ gridColumn: 'span 2' }}>Section: <strong style={{ color: '#FFF' }}>{snapshot.currentSection}</strong></div>

        <div>Active / Contexts: <strong style={{ color: snapshot.activeContextsCount > 2 ? '#FF4444' : '#00FF66' }}>{snapshot.activeContextsCount} / {snapshot.allocatedContextsCount}</strong></div>
        <div>Draw Calls: <strong style={{ color: snapshot.totalDrawCalls > 300 ? '#FF8800' : '#00FF66' }}>{snapshot.totalDrawCalls}</strong></div>

        <div>Triangles: <strong style={{ color: snapshot.totalTriangles > 450000 ? '#FF8800' : '#00FF66' }}>{Math.round(snapshot.totalTriangles / 1000)}k</strong></div>
        <div>Resolution: <strong style={{ color: '#FFF' }}>{snapshot.bufferRes}</strong></div>

        <div style={{ gridColumn: 'span 2' }}>Anim Tick CPU: <strong style={{ color: '#FFF' }}>{snapshot.animTimeMs}ms</strong></div>
      </div>

      {snapshot.activeNames && snapshot.activeNames.length > 0 && (
        <div style={{ marginTop: '4px', fontSize: '9.5px', color: '#999', borderTop: '1px dashed #333', paddingTop: '3px' }}>
          Rendering: {snapshot.activeNames.join(', ')}
        </div>
      )}

      <div style={{ marginTop: '6px', borderTop: '1px solid #444', paddingTop: '4px' }}>
        <div style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>
          Loading Pipeline ({snapshot.loading.modelUrl})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '10.5px' }}>
          <div>Download: <strong>{snapshot.loading.downloadMs}ms</strong></div>
          <div>Draco/Parse: <strong>{snapshot.loading.parseMs}ms</strong></div>
          <div>Clone: <strong>{snapshot.loading.cloneMs}ms</strong></div>
          <div>Recolor: <strong>{snapshot.loading.recolorMs}ms</strong></div>
          <div>Compile: <strong>{snapshot.loading.compileMs}ms</strong></div>
          <div>First Frame: <strong>{snapshot.loading.firstFrameMs}ms</strong></div>
        </div>
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', color: '#00FF66', fontSize: '10.5px', fontWeight: 700 }}>
          <span>Pipeline (DL-&gt;Ready): {snapshot.loading.pipelineTotalMs}ms</span>
          <span>Nav-&gt;Ready: {snapshot.loading.navToReadyMs}ms</span>
        </div>
      </div>
    </div>
  );
}
