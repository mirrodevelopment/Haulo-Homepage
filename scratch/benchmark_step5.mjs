import fs from 'fs';
import sharp from 'sharp';

function getGLTF(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binOffset = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binOffset);
  const binData = buf.subarray(binOffset + 8, binOffset + 8 + binLen);
  return { gltf, binData, fileSize: buf.length };
}

async function benchmarkModel(name, filePath) {
  const { gltf, binData, fileSize } = getGLTF(filePath);

  let totalImageDiskBytes = 0;
  let totalVramBytes = 0;
  let largeVramBytes = 0;
  let total1x1Count = 0;
  let largeCount = 0;

  const textureDetails = [];

  const decodeStart = performance.now();
  for (let i = 0; i < gltf.images.length; i++) {
    const img = gltf.images[i];
    if (img.bufferView === undefined) continue;
    const bv = gltf.bufferViews[img.bufferView];
    const imgBuf = binData.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    totalImageDiskBytes += bv.byteLength;

    let width = 1;
    let height = 1;
    let format = 'PNG';

    if (imgBuf.toString('ascii', 1, 4) === 'PNG') {
      width = imgBuf.readUInt32BE(16);
      height = imgBuf.readUInt32BE(20);
      format = 'PNG';
    } else if (imgBuf.toString('ascii', 0, 4) === 'RIFF') {
      format = 'WebP';
      const meta = await sharp(imgBuf).metadata();
      width = meta.width;
      height = meta.height;
    }

    // RGBA8 with standard mipmap overhead (4/3 = 1.333333x)
    const vram = width * height * 4 * (4 / 3);
    totalVramBytes += vram;

    if (width > 1) {
      largeCount++;
      largeVramBytes += vram;
      textureDetails.push({
        index: i,
        name: img.name,
        width,
        height,
        format,
        diskBytes: bv.byteLength,
        vramBytes: vram
      });
    } else {
      total1x1Count++;
    }
  }
  const decodeDurationMs = performance.now() - decodeStart;

  // Simulate recolorRingTextureToEarColor CPU time on large textures
  // In Frog3DModel.jsx, 14 ring textures + 2 ear textures are recolored via 2D Canvas getImageData
  const recolorStart = performance.now();
  let recoloredPixels = 0;
  for (const td of textureDetails) {
    if (td.name.includes('Complete green rings') || td.name.includes('color baked')) {
      // Simulate iterating over width * height pixels
      const pixelCount = td.width * td.height;
      recoloredPixels += pixelCount;
    }
  }
  const recolorDurationEstimateMs = recoloredPixels / 2000000; // ~2M pixels/ms typical JS loop

  return {
    name,
    fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
    imageDiskKB: (totalImageDiskBytes / 1024).toFixed(1),
    totalTextures: gltf.images.length,
    textures1x1: total1x1Count,
    largeTextures: largeCount,
    totalVramMB: (totalVramBytes / (1024 * 1024)).toFixed(2),
    largeVramMB: (largeVramBytes / (1024 * 1024)).toFixed(2),
    recoloredPixels: recoloredPixels.toLocaleString(),
    decodeDurationMs: decodeDurationMs.toFixed(1),
    details: textureDetails
  };
}

const models = [
  { name: 'Original Desktop (FROG_3D.glb)', path: 'public/FROG_3D.glb' },
  { name: 'Experiment 1: Mobile Balanced (1024/512 PNG)', path: 'scratch/experiments/FROG_3D_mobile_1024_512.glb' },
  { name: 'Experiment 2: Mobile Ultra-light (512/256 PNG)', path: 'scratch/experiments/FROG_3D_mobile_512_256.glb' },
  { name: 'Experiment 3: Mobile WebP (1024/512 WebP)', path: 'scratch/experiments/FROG_3D_mobile_webp_1024_512.glb' }
];

console.log('Running Step 5 Texture & GPU Memory Benchmark...\n');
const results = [];
for (const m of models) {
  results.push(await benchmarkModel(m.name, m.path));
}

console.table(results.map(r => ({
  Model: r.name,
  'File Size': r.fileSizeMB + ' MB',
  'Image Data': r.imageDiskKB + ' KB',
  'Total Textures': r.totalTextures,
  'Large Textures': r.largeTextures,
  'Frog Texture VRAM': r.totalVramMB + ' MB',
  'Pixels to Recolor': r.recoloredPixels
})));

// Also inspect the 5 ring models
console.log('\n--- 5 Ring Models Texture Audit ---');
const ringFiles = [
  'HAULO_portfolio_ring.glb',
  'THEORY_OF_BLOOM-Ring.glb',
  'stakor-Ring.glb',
  'AWkN-Ring.glb',
  'TRULY_BARE_ring.glb'
];
const ringAudit = ringFiles.map(rf => {
  const { gltf, fileSize } = getGLTF('public/Models/' + rf);
  return {
    Ring: rf,
    'File Size': (fileSize / (1024 * 1024)).toFixed(2) + ' MB',
    Images: gltf.images ? gltf.images.length : 0,
    Textures: gltf.textures ? gltf.textures.length : 0,
    Materials: gltf.materials ? gltf.materials.length : 0,
    'Embedded VRAM': '0.00 MB'
  };
});
console.table(ringAudit);

// Also calculate dynamic runtime VRAM
console.log('\n--- Dynamic Runtime Textures Audit (Three.js WebGL) ---');
const dynamicTextures = [
  { Resource: 'Ring Lettering Panel (Desktop: 2560x512, x5 rings)', Width: 2560, Height: 512, Count: 5, VRAM_Per_Instance: (2560*512*4*1.333333/(1024*1024)).toFixed(2) + ' MB', Total_VRAM: (5*2560*512*4*1.333333/(1024*1024)).toFixed(2) + ' MB' },
  { Resource: 'Ring Lettering Panel (Mobile: 1280x256, x5 rings)', Width: 1280, Height: 256, Count: 5, VRAM_Per_Instance: (1280*256*4*1.333333/(1024*1024)).toFixed(2) + ' MB', Total_VRAM: (5*1280*256*4*1.333333/(1024*1024)).toFixed(2) + ' MB' },
  { Resource: 'Ring 4 Button Texture (Desktop: 1024x384)', Width: 1024, Height: 384, Count: 1, VRAM_Per_Instance: (1024*384*4*1.333333/(1024*1024)).toFixed(2) + ' MB', Total_VRAM: (1024*384*4*1.333333/(1024*1024)).toFixed(2) + ' MB' },
  { Resource: 'Ring 4 Button Texture (Mobile: 512x192)', Width: 512, Height: 192, Count: 1, VRAM_Per_Instance: (512*192*4*1.333333/(1024*1024)).toFixed(2) + ' MB', Total_VRAM: (512*192*4*1.333333/(1024*1024)).toFixed(2) + ' MB' },
  { Resource: 'Shared PMREM RoomEnvironment (1024x512 Half-Float CubeUV)', Width: 1024, Height: 512, Count: 1, VRAM_Per_Instance: (1024*512*8/(1024*1024)).toFixed(2) + ' MB', Total_VRAM: (1024*512*8/(1024*1024)).toFixed(2) + ' MB' }
];
console.table(dynamicTextures);
