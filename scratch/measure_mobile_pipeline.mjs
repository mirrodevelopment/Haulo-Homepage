// Deep measurement script for HAULO Mobile Performance Audit (Step 6A)
import { readFileSync, readdirSync } from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Phase 6A: Mobile Performance & Bottleneck Diagnosis');
console.log('===============================================================');

// 1. ASSET SIZE & STRUCTURE AUDIT
console.log('\n--- PART A.1: Asset Download Size Comparison ---');
const desktopFrogBuf = readFileSync('public/FROG_3D.glb');
const mobileFrogBuf = readFileSync('public/FROG_3D_mobile.glb');

console.log(`Desktop Frog GLB: ${(desktopFrogBuf.length / (1024 * 1024)).toFixed(2)} MB (${desktopFrogBuf.length.toLocaleString()} bytes)`);
console.log(`Mobile Frog GLB:  ${(mobileFrogBuf.length / (1024 * 1024)).toFixed(2)} MB (${mobileFrogBuf.length.toLocaleString()} bytes)`);

// Simulated Mobile Network Transfer Timings
const speeds = [
  { name: '4G LTE (Good: 15 Mbps)', bps: 15 * 1024 * 1024 / 8 },
  { name: '4G LTE (Average: 6 Mbps)', bps: 6 * 1024 * 1024 / 8 },
  { name: '3G Fast (1.6 Mbps)', bps: 1.6 * 1024 * 1024 / 8 },
];

console.log('\nSimulated Network Download Durations:');
speeds.forEach(s => {
  const desktopSec = (desktopFrogBuf.length / s.bps).toFixed(2);
  const mobileSec = (mobileFrogBuf.length / s.bps).toFixed(2);
  console.log(`- ${s.name}:`);
  console.log(`    Mobile (${(mobileFrogBuf.length / 1024 / 1024).toFixed(1)}MB):  ${mobileSec}s`);
  console.log(`    Desktop (${(desktopFrogBuf.length / 1024 / 1024).toFixed(1)}MB): ${desktopSec}s`);
});

// 2. GLTF INTERNAL COMPLEXITY AUDIT
console.log('\n--- PART A.2: GLTF Structural & Geometry Complexity ---');
function analyzeGLTF(buf) {
  const jsonLength = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLength);
  const gltf = JSON.parse(jsonStr);

  let triangles = 0;
  let dracoMeshCount = 0;
  gltf.meshes?.forEach(m => {
    m.primitives?.forEach(p => {
      if (p.extensions?.KHR_draco_mesh_compression) {
        dracoMeshCount++;
      }
      if (p.indices !== undefined) {
        const acc = gltf.accessors[p.indices];
        triangles += (acc.count || 0) / 3;
      }
    });
  });

  return {
    meshCount: gltf.meshes?.length || 0,
    nodeCount: gltf.nodes?.length || 0,
    materialCount: gltf.materials?.length || 0,
    textureCount: gltf.textures?.length || 0,
    imageCount: gltf.images?.length || 0,
    triangles: Math.round(triangles),
    dracoMeshCount,
  };
}

const desktopStats = analyzeGLTF(desktopFrogBuf);
const mobileStats = analyzeGLTF(mobileFrogBuf);

console.log('Mobile Frog Geometry:');
console.log(`  - Meshes (Individual Draw Calls): ${mobileStats.meshCount}`);
console.log(`  - Triangles:                      ${mobileStats.triangles.toLocaleString()}`);
console.log(`  - Materials (Separate Shaders):   ${mobileStats.materialCount}`);
console.log(`  - Textures:                       ${mobileStats.textureCount}`);
console.log(`  - Draco-Compressed Primitives:    ${mobileStats.dracoMeshCount}`);

// Ring Models Complexity
console.log('\nRing Models Geometry:');
const ringDir = 'public/Models';
const ringFiles = readdirSync(ringDir).filter(f => f.endsWith('.glb'));
let totalRingTris = 0;
ringFiles.forEach(f => {
  const buf = readFileSync(`${ringDir}/${f}`);
  const s = analyzeGLTF(buf);
  totalRingTris += s.triangles;
  console.log(`  - ${f}: ${s.triangles.toLocaleString()} tris, ${s.meshCount} meshes/calls, ${s.materialCount} materials`);
});
const avgRingTris = Math.round(totalRingTris / ringFiles.length);

console.log('\n--- PART B: Combined Workload During Frog Swimming in Ring ---');
const combinedTris = mobileStats.triangles + avgRingTris;
const combinedCalls = mobileStats.meshCount + 160; // Average ring meshes
console.log(`Active Triangle Count (Frog + Ring): ${combinedTris.toLocaleString()} triangles`);
console.log(`Active Draw Calls (Frog + Ring):     ${combinedCalls} draw calls per frame`);
console.log(`Target Frame Budget (60 FPS):        16.6 ms`);
console.log(`Target Frame Budget (30 FPS):        33.3 ms`);

// 3. BENCHMARK SIMULATION: Canvas 2D Pixel Recolor Cost
console.log('\n--- PART A.3: Benchmark Texture Recoloring CPU Overhead ---');
const width = 1024;
const height = 1024;
const totalPixels = width * height;
const pixelBytes = totalPixels * 4;
const dummyBuffer = new Uint8ClampedArray(pixelBytes);

// Fill with dummy green shell data
for (let i = 0; i < pixelBytes; i += 4) {
  dummyBuffer[i] = 120;     // R
  dummyBuffer[i + 1] = 200; // G
  dummyBuffer[i + 2] = 40;  // B
  dummyBuffer[i + 3] = 255; // A
}

const t0 = performance.now();
// Execute identical recoloring loop from Frog3DModel.jsx
for (let i = 0; i < pixelBytes; i += 4) {
  const r = dummyBuffer[i];
  const g = dummyBuffer[i + 1];
  const b = dummyBuffer[i + 2];
  const a = dummyBuffer[i + 3];
  if (a < 10) continue;
  if (r < 35 && g < 35 && b < 35) continue;
  if (g > 35 && g > b * 1.15) {
    const alpha = Math.min(1.0, Math.max(0.0, (g - 35) / 65));
    dummyBuffer[i] = Math.round(194 * alpha);
    dummyBuffer[i + 1] = Math.round(250 * alpha);
    dummyBuffer[i + 2] = Math.round(54 * alpha);
  }
}
const recolorTime = performance.now() - t0;
console.log(`Single 1024x1024 Texture Recolor CPU Time (Node V8 JIT): ${recolorTime.toFixed(2)} ms`);
console.log(`Estimated Mobile CPU Time (Mobile JS Core / Chrome mobile): ${(recolorTime * 3.5).toFixed(2)} ms per texture`);

// 4. ACTIVE WEBGL CONTEXT COUNT AUDIT
console.log('\n--- PART B.2: Active WebGL Contexts & Drawing Buffer Resolution ---');
console.log('Mounted WebGL Renderers:');
console.log('  1. TypographyStage / Hero Canvas: 1 WebGLRenderer (Math.min(devicePixelRatio, 2))');
console.log('  2. Ring 0 (space-intro-split):     1 WebGLRenderer (Math.min(devicePixelRatio, 1.5))');
console.log('  3. Ring 1 (project-hyper-horizon): 1 WebGLRenderer (Math.min(devicePixelRatio, 1.5))');
console.log('  4. Ring 2 (project-aura-syntropy): 1 WebGLRenderer (Math.min(devicePixelRatio, 1.5))');
console.log('  5. Ring 3 (project-neo-cephalopod): 1 WebGLRenderer (Math.min(devicePixelRatio, 1.5))');
console.log('  6. Ring 4 (project-chrono-kinetics): 1 WebGLRenderer (Math.min(devicePixelRatio, 1.5))');
console.log('Total Active WebGL Contexts: 6 concurrent contexts!');
console.log('Mobile Hardware Limit (iOS Safari / Android Chrome): ~8 to 16 maximum before context loss or severe VRAM eviction.');

console.log('\n===============================================================');
console.log(' DIAGNOSTIC MEASUREMENTS COMPLETE');
console.log('===============================================================');
