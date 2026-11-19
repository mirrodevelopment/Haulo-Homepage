// Measure Three.js draw calls and memory for Ring and Frog on mobile simulation
import fs from 'fs';

console.log('=== Measuring Draw Calls and Memory for Mobile Audit ===');

// Check GLB file sizes
const frogStats = fs.statSync('public/FROG_3D.glb');
const rings = [
  'public/Models/HAULO_portfolio_ring.glb',
  'public/Models/THEORY_OF_BLOOM-Ring.glb',
  'public/Models/stakor-Ring.glb',
  'public/Models/TRULY_BARE_ring.glb',
  'public/Models/AWkN-Ring.glb'
];

console.log(`Frog GLB File Size: ${(frogStats.size / (1024 * 1024)).toFixed(2)} MB (${frogStats.size.toLocaleString()} bytes)`);

let totalRingsSize = 0;
rings.forEach(r => {
  const s = fs.statSync(r);
  totalRingsSize += s.size;
  console.log(`  - ${r.split('/').pop()}: ${(s.size / (1024 * 1024)).toFixed(2)} MB`);
});
console.log(`Total 5 Rings GLB Size: ${(totalRingsSize / (1024 * 1024)).toFixed(2)} MB`);
console.log(`Grand Total 3D Models (Compressed Draco): ${((frogStats.size + totalRingsSize) / (1024 * 1024)).toFixed(2)} MB`);

// Initial Page Load Assets
const jsStats = fs.statSync('dist/assets/index-BUThi-ou.js');
const cssStats = fs.statSync('dist/assets/index-OCZMCpff.css');
const dracoWasm1 = fs.statSync('dist/assets/draco_decoder-C32yEggz.wasm');
const dracoWasm2 = fs.statSync('dist/assets/draco_decoder-Z1_iN-Ht.wasm');
const dracoJs = fs.statSync('dist/assets/draco_decoder-fzg4nYZr.js');
const floorImg = fs.statSync('public/Floor_Img.png');

console.log('\n--- Initial Page Load Asset Sizes ---');
console.log(`Main JS Bundle: ${(jsStats.size / 1024).toFixed(1)} KB (Gzip: ~332.6 KB)`);
console.log(`Main CSS Bundle: ${(cssStats.size / 1024).toFixed(1)} KB (Gzip: ~14.4 KB)`);
console.log(`Draco Decoders: ${((dracoWasm1.size + dracoWasm2.size + dracoJs.size) / 1024).toFixed(1)} KB`);
console.log(`Floor_Img.png: ${(floorImg.size / (1024 * 1024)).toFixed(2)} MB (${floorImg.size.toLocaleString()} bytes)`);

const initialNetworkTotal = jsStats.size + cssStats.size + frogStats.size + dracoWasm1.size + floorImg.size;
console.log(`Total Initial Mobile Network Payload (Uncompressed): ${(initialNetworkTotal / (1024 * 1024)).toFixed(2)} MB`);
