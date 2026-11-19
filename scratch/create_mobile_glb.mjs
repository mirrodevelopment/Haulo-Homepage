import fs from 'fs';
import sharp from 'sharp';

async function buildMobileGLB(inputPath, outputPath, options = {}) {
  const {
    earSize = 1024,
    ringSize = 512,
    useWebP = false
  } = options;

  console.log(`\nBuilding mobile GLB from ${inputPath}...`);
  console.log(`Target ear size: ${earSize}x${earSize}, ring size: ${ringSize}x${ringSize}, format: ${useWebP ? 'WebP' : 'PNG'}`);

  const raw = fs.readFileSync(inputPath);
  const magic = raw.readUInt32LE(0);
  if (magic !== 0x46546C67) throw new Error('Not GLB');

  const jsonChunkLen = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.toString('utf8', 20, 20 + jsonChunkLen));

  const binChunkOffset = 20 + jsonChunkLen;
  const binChunkLen = raw.readUInt32LE(binChunkOffset);
  const binData = raw.subarray(binChunkOffset + 8, binChunkOffset + 8 + binChunkLen);

  // We want to preserve all bufferViews that are NOT images, and replace image bufferViews.
  // First, find which bufferViews belong to images.
  const imageBvMap = new Map();
  gltf.images.forEach((img, imgIdx) => {
    if (img.bufferView !== undefined) {
      imageBvMap.set(img.bufferView, imgIdx);
    }
  });

  // Extract each bufferView data
  const originalBufferViewsData = gltf.bufferViews.map((bv, bvIdx) => {
    const offset = bv.byteOffset || 0;
    const length = bv.byteLength;
    return binData.subarray(offset, offset + length);
  });

  // Process images
  const newBufferViewsData = [...originalBufferViewsData];
  let processedCount = 0;
  let originalImageBytes = 0;
  let newImageBytes = 0;

  for (let imgIdx = 0; imgIdx < gltf.images.length; imgIdx++) {
    const img = gltf.images[imgIdx];
    if (img.bufferView === undefined) continue;

    const bvIdx = img.bufferView;
    const origBytes = originalBufferViewsData[bvIdx];
    originalImageBytes += origBytes.length;

    // Check dimensions
    let metadata;
    try {
      metadata = await sharp(origBytes).metadata();
    } catch (e) {
      // 1x1 or unparseable by sharp
      newImageBytes += origBytes.length;
      continue;
    }

    let targetW = metadata.width;
    let targetH = metadata.height;
    let shouldResize = false;

    if (metadata.width === 2048 && metadata.height === 2048) {
      targetW = earSize;
      targetH = earSize;
      shouldResize = true;
    } else if (metadata.width === 1024 && metadata.height === 1024) {
      targetW = ringSize;
      targetH = ringSize;
      shouldResize = true;
    }

    if (shouldResize) {
      let pipeline = sharp(origBytes).resize(targetW, targetH, {
        kernel: sharp.kernel.lanczos3
      });

      let newBuf;
      if (useWebP) {
        newBuf = await pipeline.webp({ quality: 90 }).toBuffer();
        img.mimeType = 'image/webp';
      } else {
        newBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      }

      newBufferViewsData[bvIdx] = newBuf;
      newImageBytes += newBuf.length;
      processedCount++;
      console.log(`  [${imgIdx}] ${img.name}: ${metadata.width}x${metadata.height} (${(origBytes.length/1024).toFixed(1)} KB) -> ${targetW}x${targetH} (${(newBuf.length/1024).toFixed(1)} KB)`);
    } else {
      newImageBytes += origBytes.length;
    }
  }

  console.log(`Processed ${processedCount} images. Image bytes: ${(originalImageBytes/1024).toFixed(1)} KB -> ${(newImageBytes/1024).toFixed(1)} KB`);

  // Now pack the new binary chunk with 4-byte alignment
  const packedBuffers = [];
  let currentOffset = 0;

  gltf.bufferViews.forEach((bv, bvIdx) => {
    const data = newBufferViewsData[bvIdx];
    // Align offset to 4 bytes
    const pad = (4 - (currentOffset % 4)) % 4;
    if (pad > 0) {
      packedBuffers.push(Buffer.alloc(pad));
      currentOffset += pad;
    }
    bv.byteOffset = currentOffset;
    bv.byteLength = data.length;
    packedBuffers.push(data);
    currentOffset += data.length;
  });

  // Final alignment of binary chunk
  const finalPad = (4 - (currentOffset % 4)) % 4;
  if (finalPad > 0) {
    packedBuffers.push(Buffer.alloc(finalPad));
    currentOffset += finalPad;
  }

  const newBinChunkData = Buffer.concat(packedBuffers);
  gltf.buffers[0].byteLength = newBinChunkData.length;

  // JSON chunk with 4-byte padding using spaces (0x20)
  let jsonStr = JSON.stringify(gltf);
  let jsonPad = (4 - (Buffer.byteLength(jsonStr) % 4)) % 4;
  if (jsonPad > 0) {
    jsonStr += ' '.repeat(jsonPad);
  }
  const newJsonChunkLen = Buffer.byteLength(jsonStr);

  const totalLength = 12 + 8 + newJsonChunkLen + 8 + newBinChunkData.length;
  const glbHeader = Buffer.alloc(12);
  glbHeader.writeUInt32LE(0x46546C67, 0);
  glbHeader.writeUInt32LE(2, 4);
  glbHeader.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(newJsonChunkLen, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(newBinChunkData.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  const finalGLB = Buffer.concat([
    glbHeader,
    jsonHeader,
    Buffer.from(jsonStr, 'utf8'),
    binHeader,
    newBinChunkData
  ]);

  fs.writeFileSync(outputPath, finalGLB);
  console.log(`Saved: ${outputPath} (${(finalGLB.length / (1024*1024)).toFixed(2)} MB, was ${(raw.length / (1024*1024)).toFixed(2)} MB)`);
}

// Build Experiment 1: 1024x1024 ears, 512x512 rings (PNG)
await buildMobileGLB('public/FROG_3D.glb', 'scratch/experiments/FROG_3D_mobile_1024_512.glb', {
  earSize: 1024,
  ringSize: 512,
  useWebP: false
});

// Build Experiment 2: 512x512 ears, 256x256 rings (Aggressive mobile PNG)
await buildMobileGLB('public/FROG_3D.glb', 'scratch/experiments/FROG_3D_mobile_512_256.glb', {
  earSize: 512,
  ringSize: 256,
  useWebP: false
});
