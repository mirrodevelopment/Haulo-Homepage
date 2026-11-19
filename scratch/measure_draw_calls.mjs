// Measure scene graph draw calls and vertex counts
import fs from 'fs';

function countDrawCalls(path) {
  const buf = fs.readFileSync(path);
  const chunkLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + chunkLen).toString('utf8'));
  
  let drawCalls = 0;
  let totalIndices = 0;
  let uniqueMaterials = new Set();
  
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      drawCalls++;
      if (prim.material !== undefined) uniqueMaterials.add(prim.material);
      if (prim.indices !== undefined) {
        const acc = gltf.accessors[prim.indices];
        totalIndices += acc.count;
      }
    }
  }
  return {
    meshes: gltf.meshes?.length || 0,
    primitives: drawCalls,
    triangles: Math.floor(totalIndices / 3),
    uniqueMaterials: uniqueMaterials.size
  };
}

console.log('--- Geometry & Draw Call Metrics ---');
const frog = countDrawCalls('public/FROG_3D.glb');
console.log(`FROG_3D.glb: Primitives (Draw Calls) = ${frog.primitives}, Triangles = ${frog.triangles.toLocaleString()}, Materials = ${frog.uniqueMaterials}`);

const rings = [
  'public/Models/HAULO_portfolio_ring.glb',
  'public/Models/THEORY_OF_BLOOM-Ring.glb',
  'public/Models/stakor-Ring.glb',
  'public/Models/TRULY_BARE_ring.glb',
  'public/Models/AWkN-Ring.glb'
];

rings.forEach(r => {
  const stats = countDrawCalls(r);
  console.log(`${r.split('/').pop()}: Primitives (Draw Calls) = ${stats.primitives}, Triangles = ${stats.triangles.toLocaleString()}, Materials = ${stats.uniqueMaterials}`);
});
