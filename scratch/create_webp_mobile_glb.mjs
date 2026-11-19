import fs from 'fs';
import sharp from 'sharp';

async function buildWebPMobileGLB(inputPath, outputPath, earSize = 1024, ringSize = 512) {
  const raw = fs.readFileSync(inputPath);
  const jsonChunkLen = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.toString('utf8', 20, 20 + jsonChunkLen));

  const binChunkOffset = 20 + jsonChunkLen;
  const binChunkLen = raw.readUInt32LE(binChunkOffset);
  const binData = raw.subarray(binChunkOffset + 8, binChunkOffset + 8 + binChunkLen);

  const originalBufferViewsData = gltf.bufferViews.map((bv) => {
    const offset = bv.byteOffset || 0;
    const length = bv.byteLength;
    return binData.subarray(offset, offset + length);
  });

  const newBufferViewsData = [...originalBufferViewsData];
  let processedCount = 0;

  for (let imgIdx = 0; imgIdx < gltf.images.length; imgIdx++) {
    const img = gltf.images[imgIdx];
    if (img.bufferView === undefined) continue;

    const bvIdx = img.bufferView;
    const origBytes = originalBufferViewsData[bvIdx];

    let metadata;
    try {
      metadata = await sharp(origBytes).metadata();
    } catch (e) {
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
      const newBuf = await sharp(origBytes)
        .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
        .webp({ quality: 90, lossless: false })
        .toBuffer();

      newBufferViewsData[bvIdx] = newBuf;
      img.mimeType = 'image/webp';
      processedCount++;
    }
  }

  // Ensure EXT_texture_webp is registered
  if (!gltf.extensionsUsed) gltf.extensionsUsed = [];
  if (!gltf.extensionsUsed.includes('EXT_texture_webp')) {
    gltf.extensionsUsed.push('EXT_texture_webp');
  }

  // Update textures referencing webp images
  gltf.textures.forEach((tex) => {
    if (tex.source !== undefined) {
      const img = gltf.images[tex.source];
      if (img.mimeType === 'image/webp') {
        if (!tex.extensions) tex.extensions = {};
        tex.extensions['EXT_texture_webp'] = { source: tex.source };
      }
    }
  });

  // Pack bin chunk
  const packedBuffers = [];
  let currentOffset = 0;

  gltf.bufferViews.forEach((bv, bvIdx) => {
    const data = newBufferViewsData[bvIdx];
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

  const finalPad = (4 - (currentOffset % 4)) % 4;
  if (finalPad > 0) {
    packedBuffers.push(Buffer.alloc(finalPad));
    currentOffset += finalPad;
  }

  const newBinChunkData = Buffer.concat(packedBuffers);
  gltf.buffers[0].byteLength = newBinChunkData.length;

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
  jsonHeader.writeUInt32LE(0x4E4F534A, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(newBinChunkData.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4);

  const finalGLB = Buffer.concat([
    glbHeader,
    jsonHeader,
    Buffer.from(jsonStr, 'utf8'),
    binHeader,
    newBinChunkData
  ]);

  fs.writeFileSync(outputPath, finalGLB);
  console.log(`Saved WebP GLB: ${outputPath} (${(finalGLB.length / (1024*1024)).toFixed(2)} MB, processed ${processedCount} images)`);
}

await buildWebPMobileGLB('public/FROG_3D.glb', 'scratch/experiments/FROG_3D_mobile_webp_1024_512.glb', 1024, 512);
