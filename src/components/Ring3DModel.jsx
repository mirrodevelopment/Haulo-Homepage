import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { perfDiagnostics } from '../services/perfDiagnostics';
import { getTargetDPR, getAntialiasSetting } from '../utils/mobileRenderingConfig';

// Synthesize satisfying high-tech mechanical button click audio
function playMechanicalClickSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.022);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.022);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.025);
  } catch (e) {
    // AudioContext blocked before first user gesture
  }
}

// Render razor-sharp, high-DPI texture for the 3D ring screen button
function drawButtonTexture(ctx, width, height, text, isHovered, isPressed, mobileLabel = false) {
  ctx.clearRect(0, 0, width, height);

  // 1. Sleek graphite dark screen background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isPressed) {
    bgGrad.addColorStop(0, '#040507');
    bgGrad.addColorStop(1, '#07080C');
  } else if (isHovered) {
    bgGrad.addColorStop(0, '#131822');
    bgGrad.addColorStop(1, '#0A0D13');
  } else {
    bgGrad.addColorStop(0, '#0C0E14');
    bgGrad.addColorStop(1, '#06070A');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle scanline / display texture (adds authentic sci-fi hardware feel)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
  for (let y = 0; y < height; y += 8) {
    ctx.fillRect(0, y, width, 2);
  }

  // 2. Bezel border & corner HUD brackets
  ctx.strokeStyle = isHovered ? '#D6E674' : (isPressed ? '#98A840' : 'rgba(255, 255, 255, 0.16)');
  ctx.lineWidth = isHovered ? 6 : 3;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  const cornerLen = 28;
  ctx.strokeStyle = isHovered ? '#D6E674' : 'rgba(196, 212, 100, 0.65)';
  ctx.lineWidth = 5;

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(10, 10 + cornerLen); ctx.lineTo(10, 10); ctx.lineTo(10 + cornerLen, 10);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(width - 10, height - 10 - cornerLen); ctx.lineTo(width - 10, height - 10); ctx.lineTo(width - 10 - cornerLen, height - 10);
  ctx.stroke();

  // 3. Electric Lime Bracket [ on the left (matches reference image exactly)
  const barX = 85;
  const barTop = 80;
  const barBottom = height - 80;
  const barThickness = 22;
  const tickLen = 42;

  ctx.save();
  ctx.shadowColor = '#C4D464';
  ctx.shadowBlur = isHovered ? 20 : (isPressed ? 10 : 12);
  ctx.fillStyle = isPressed ? '#98A840' : '#C4D464';

  // Vertical stem
  ctx.fillRect(barX, barTop, barThickness, barBottom - barTop);
  // Top horizontal tick
  ctx.fillRect(barX, barTop, tickLen, barThickness);
  // Bottom horizontal tick
  ctx.fillRect(barX, barBottom - barThickness, tickLen, barThickness);
  ctx.restore();

  // 4. Manually added button text - bold, crisp, razor-sharp typography
  const label = (text || 'VIEW PROJECT ↗').trim();
  if (label) {
    ctx.save();
    if (mobileLabel) {
      ctx.font = 'bold 154px Arial, sans-serif';
      ctx.fillStyle = isPressed ? '#A8F020' : isHovered ? '#C2FA36' : '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('VIEW', 568, 108);
      ctx.fillText('PROJECT ↗', 568, 269, 836);
      ctx.restore();
      return;
    }
    let fontSize = 84;
    ctx.font = `900 ${fontSize}px "Space Mono", "Roboto Mono", "Courier New", monospace, sans-serif`;
    ctx.textBaseline = 'middle';

    const textX = barX + tickLen + 38;
    const textY = height / 2;
    const maxTextW = width - textX - 32;
    const measuredW = ctx.measureText(label).width;

    if (measuredW > maxTextW && measuredW > 0) {
      fontSize = Math.floor(fontSize * (maxTextW / measuredW));
      ctx.font = `900 ${fontSize}px "Space Mono", "Roboto Mono", "Courier New", monospace, sans-serif`;
    }

    if (isHovered) {
      ctx.shadowColor = '#C2FA36';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#C2FA36';
    } else if (isPressed) {
      ctx.shadowColor = '#C2FA36';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#A8F020';
    } else {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FFFFFF';
    }

    ctx.fillText(label, textX, textY);
    ctx.restore();
  }
}

const DEFAULT_DESCRIPTIONS = {
  bloom: [
    'A premium beverage experience',
    'that transforms everyday moments',
    'into sensory journeys through art,',
    'interaction and digital storytelling.'
  ],
  stakor: [
    'A modular nutrition platform',
    'designed for clear customization,',
    'seamless shopping and an intelligent',
    'everyday product experience.'
  ],
  awkn: [
    'A thoughtful journey where ideas',
    'turn into plans, blending human',
    'creativity and intelligent',
    'technology.'
  ],
  truly: [
    'From concept to creation, we build',
    'digital experiences that are scalable,',
    'functional and future-ready.'
  ],
};

// Render razor-sharp, high-DPI 3D curved mesh for Column 2 Description text using Column 1 font ("Space Mono") and font size
function createDescriptionCurvedMesh(lines, minX, maxX, srvTop, srvBottom, srv1Height, renderer) {
  if (!lines || lines.length === 0) return null;

  const descW = Math.max(1.3, maxX - minX + 0.08);
  const startX = minX;
  const descH = 0.58;
  const descTop = srvTop !== -Infinity ? srvTop : 1.35;

  const canvas = document.createElement('canvas');
  canvas.width = 2560;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const pixelsPer3DUnit = 512 / descH;
  const letterHeight3D = srv1Height > 0 ? srv1Height : 0.079;
  // Account for font em-box (cap-height is ~0.65 of em font size) so rendered letter height matches Column 1 exactly
  const targetCapHeightPx = letterHeight3D * pixelsPer3DUnit;
  const fontSizePx = Math.round(targetCapHeightPx / 0.65);
  const linePitch3D = srvTop !== -Infinity && srvBottom !== -Infinity
    ? (srvTop - srvBottom) / 4.2
    : 0.138;
  const linePitchPx = Math.round(linePitch3D * pixelsPer3DUnit);

  const padLeft = 16;
  const startY = 8;
  const maxAvailableW = canvas.width - padLeft * 2;

  const renderText = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `700 ${fontSizePx}px "Space Mono", "Roboto Mono", "Courier New", monospace, sans-serif`;
    ctx.fillStyle = '#0A0A0A';
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 3.0;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    lines.forEach((line, index) => {
      const text = String(line || '');
      const y = startY + index * linePitchPx;
      const textW = ctx.measureText(text).width;
      if (textW > maxAvailableW && textW > 0) {
        const scaleFit = maxAvailableW / textW;
        ctx.save();
        ctx.translate(padLeft, y);
        ctx.scale(scaleFit, 1);
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        ctx.strokeText(text, padLeft, y);
        ctx.fillText(text, padLeft, y);
      }
    });
  };

  renderText();

  const mesh = createPanelLettering(canvas, startX, descTop, descW, descH, 6.095, renderer);
  if (document.fonts) {
    document.fonts.ready.then(() => {
      renderText();
      mesh.material.map.needsUpdate = true;
    });
  }
  return mesh;
}

function createMobilePanelCopy(content, left, divider, right, renderer) {
  const width = right - left;
  const height = 0.82;
  const canvas = document.createElement('canvas');
  canvas.height = 384;
  const density = canvas.height / height;
  canvas.width = Math.ceil(width * density);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Use the full height of the face and leave a gutter on both sides of the divider.
  const gutter = 0.045 * density;
  const split = (divider - left) * density;
  const row = canvas.height / 5;
  ctx.fillStyle = '#080808';
  ctx.textBaseline = 'middle';
  ctx.font = '600 ' + Math.round(row * 0.94) + 'px Arial, sans-serif';
  const serviceWidth = split - gutter * 2;
  content.services.forEach((line, i) => ctx.fillText(line, gutter, (i + 0.5) * row, serviceWidth));

  const descWidth = canvas.width - split - gutter * 2;
  // Leave the space below the paragraph free for the ring's slanted accent marks.
  const paragraph = content.description.join(' ').split(/\s+/);
  const availableHeight = canvas.height - row * 0.72;
  // Wrap by measured word width instead of squeezing each authored line independently.
  let lines;
  let fontSize = Math.round(row);
  for (; fontSize > 1; fontSize--) {
    ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    lines = [''];
    for (const word of paragraph) {
      const last = lines.length - 1;
      const next = lines[last] ? lines[last] + ' ' + word : word;
      if (lines[last] && ctx.measureText(next).width > descWidth) lines.push(word);
      else lines[last] = next;
    }
    if (lines.length * fontSize * 1.08 <= availableHeight) break;
  }
  lines.forEach((line, i) => ctx.fillText(line, split + gutter, (i + 0.5) * fontSize * 1.08));
  return createPanelLettering(canvas, left, 1.44, width, height, 6.115, renderer);
}

function createPanelLettering(canvas, startX, descTop, descW, descH, radius, renderer) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
  texture.anisotropy = Math.max(8, maxAniso);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const segmentsX = 24;
  const geo = new THREE.PlaneGeometry(descW, descH, segmentsX, 1);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + descW * 0.5) / descW;
    const v = (pos.getY(i) + descH * 0.5) / descH;

    const wx = startX + u * descW;
    const wy = (descTop - descH) + v * descH;
    const wz = Math.sqrt(Math.max(0, radius * radius - wx * wx));

    pos.setXYZ(i, wx, wy, wz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'RingDescriptionCurvedMesh';
  mesh.renderOrder = 25;
  mesh.userData.dispose = () => {
    texture.dispose();
    mat.dispose();
    geo.dispose();
  };
  return mesh;
}

// Composite the small print at display resolution while the phone's 3D canvas
// continues using its lower rendering budget. Follow the curved panel in strips.
function createPanelTextLayer(mesh, source = mesh.material.map.image) {
  const vertices = mesh.geometry.attributes.position;
  const segments = mesh.geometry.parameters.widthSegments;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden';
  layer.setAttribute('aria-hidden', 'true');
  const stripSegments = Math.min(6, segments);
  const strips = [];
  for (let start = 0; start < segments; start += stripSegments) {
    const strip = segments === 1 ? source : document.createElement('canvas');
    const left = Math.round(source.width * start / segments);
    if (strip !== source) {
      strip.width = Math.round(source.width * (start + stripSegments) / segments) - left;
      strip.height = source.height;
      strip.getContext('2d').drawImage(source, left, 0, strip.width, strip.height, 0, 0, strip.width, strip.height);
    }
    strip.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
    layer.appendChild(strip);
    strips.push(strip);
  }
  const points = Array.from({ length: 3 }, () => new THREE.Vector3());
  return {
    layer,
    update(camera, width, height) {
      strips.forEach((strip, i) => {
        const start = i * stripSegments;
        const indices = [start, start + stripSegments, segments + 1 + start];
        points.forEach((pt, j) => {
          pt.fromBufferAttribute(vertices, indices[j]).applyMatrix4(mesh.matrixWorld).project(camera);
          pt.x = (1 + pt.x) * width / 2;
          pt.y = (1 - pt.y) * height / 2;
        });
        const [a, b, c] = points;
        strip.style.transform = `matrix(${(b.x-a.x)/strip.width},${(b.y-a.y)/strip.width},${(c.x-a.x)/strip.height},${(c.y-a.y)/strip.height},${a.x},${a.y})`;
      });
    },
  };
}

// Multi-model cache to independently store and reuse loaded GLTF instances
const gltfCache = new Map();
const gltfPromises = new Map();

// Global shared DRACOLoader instance (reuses Web Worker pool across all models)
let sharedDracoLoader = null;
function getSharedDracoLoader() {
  if (!sharedDracoLoader) {
    try {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath('/draco/');
    } catch (e) {
      console.warn('Failed to initialize shared DRACOLoader:', e);
    }
  }
  return sharedDracoLoader;
}

// Global shared PBR materials (eliminates 3,600 duplicate material instances per ring)
const sharedBlackTextMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#0A0A0A'),
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
});

// Dedicated unclipped materials for HAULO wordmark, motto & H lime inlay
const sharedHauloTextMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#0A0A0A'),
  side: THREE.DoubleSide,
  depthTest: false,
  depthWrite: false,
  transparent: true,
});

const sharedHauloLimeInlayMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#C2FA36'),
  side: THREE.DoubleSide,
  depthTest: false,
  depthWrite: false,
  transparent: true,
  toneMapped: false,
});

const sharedWhiteDisplayTextMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#FFFFFF'),
  roughness: 0.15,
  metalness: 0.08,
  side: THREE.DoubleSide,
});

const sharedLimeGlowMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#C2FA36'),
  toneMapped: false,
});

const sharedCeramicArmorMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#E4E7EA'),
  roughness: 0.16,
  metalness: 0.02,
  clearcoat: 0.50,
  clearcoatRoughness: 0.10,
});

// The tilted intro panels face the key lights directly against a white backdrop.
const introCeramicArmorMaterial = sharedCeramicArmorMaterial.clone();
introCeramicArmorMaterial.color.set('#C8CBCF');
introCeramicArmorMaterial.roughness = 0.38;
introCeramicArmorMaterial.clearcoat = 0.18;

const sharedGraphiteChassisMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#4E5660'),
  roughness: 0.32,
  metalness: 0.75,
});

const sharedDarkRecessesMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#22262C'),
  roughness: 0.45,
  metalness: 0.20,
});

const sharedBrassFastenersMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#D8B349'),
  roughness: 0.22,
  metalness: 0.85,
});

const sharedTitaniumMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#DCE2EA'),
  roughness: 0.18,
  metalness: 0.88,
});

const sharedOliveHousingMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#5E6A2A'),
  emissive: new THREE.Color('#1F240A'),
  emissiveIntensity: 0.35,
  roughness: 0.35,
  metalness: 0.25,
});

export function preloadRingGLTF(url) {
  if (!url) return Promise.resolve(null);
  return loadRingGLTF(url);
}

export function usesMobileRingLoading() {
  return window.innerWidth <= 900 || window.innerWidth < window.innerHeight ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
}

function loadRingGLTF(url) {
  if (gltfCache.has(url)) {
    return Promise.resolve(gltfCache.get(url));
  }
  if (gltfPromises.has(url)) {
    return gltfPromises.get(url);
  }
  const loader = new GLTFLoader();
  const draco = getSharedDracoLoader();
  if (draco) {
    loader.setDRACOLoader(draco);
  }
  const promise = new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        gltfCache.set(url, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.warn('Failed to load Ring 3D GLB:', url, err);
        gltfPromises.delete(url);
        reject(err);
      }
    );
  });
  gltfPromises.set(url, promise);
  return promise;
}

/**
 * Procedural Glass Conduits & Collars
 * Matches the curved transparent glass conduits visible on the left and right flanks
 * of the mech rings in the studio reference renders.
 */
function createConduitsGroup() {
  const conduitsGroup = new THREE.Group();
  conduitsGroup.name = 'External_Conduits_And_Collars';

  // Glass physical material
  const outerGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F0F7FF'),
    transmission: 0.90,
    opacity: 0.65,
    transparent: true,
    roughness: 0.06,
    metalness: 0.04,
    ior: 1.48,
    reflectivity: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const innerCoreMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#94D0FF'),
    emissive: new THREE.Color('#1A4060'),
    emissiveIntensity: 0.35,
    transmission: 0.80,
    opacity: 0.55,
    transparent: true,
    roughness: 0.10,
    ior: 1.35,
    depthWrite: false,
  });

  const titaniumCollarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#CAD1DA'),
    roughness: 0.20,
    metalness: 0.88,
  });

  const brassRingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D8B349'),
    roughness: 0.22,
    metalness: 0.85,
  });

  const buildSideConduit = (isRight) => {
    const sign = isRight ? 1 : -1;
    const sideGroup = new THREE.Group();

    // Spline curve points extending from the ring outer casing towards the screen edge
    const p0 = new THREE.Vector3(sign * 5.92, 0.82, 0.05);
    const p1 = new THREE.Vector3(sign * 7.80, 0.64, 0.02);
    const p2 = new THREE.Vector3(sign * 10.60, 0.38, -0.05);
    const p3 = new THREE.Vector3(sign * 14.80, 0.12, -0.15);

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);

    // Outer transparent glass tube
    const outerGeom = new THREE.TubeGeometry(curve, 64, 0.27, 24, false);
    const outerMesh = new THREE.Mesh(outerGeom, outerGlassMaterial);
    sideGroup.add(outerMesh);

    // Inner fluid/refraction core
    const innerGeom = new THREE.TubeGeometry(curve, 64, 0.15, 16, false);
    const innerMesh = new THREE.Mesh(innerGeom, innerCoreMaterial);
    sideGroup.add(innerMesh);

    // Base collar at the ring mount
    const collarGeom = new THREE.CylinderGeometry(0.36, 0.38, 0.32, 24);
    const collarMesh = new THREE.Mesh(collarGeom, titaniumCollarMaterial);
    collarMesh.position.set(sign * 6.02, 0.81, 0.05);
    collarMesh.rotation.z = (sign * Math.PI) / 2;
    sideGroup.add(collarMesh);

    // Decorative brass lock rings on collar
    const brassRingGeom = new THREE.TorusGeometry(0.37, 0.03, 16, 24);
    const brassRing1 = new THREE.Mesh(brassRingGeom, brassRingMaterial);
    brassRing1.position.set(sign * 5.95, 0.81, 0.05);
    brassRing1.rotation.y = Math.PI / 2;
    sideGroup.add(brassRing1);

    const brassRing2 = new THREE.Mesh(brassRingGeom, brassRingMaterial);
    brassRing2.position.set(sign * 6.12, 0.81, 0.05);
    brassRing2.rotation.y = Math.PI / 2;
    sideGroup.add(brassRing2);

    // Secondary mid-span clamp collar
    const midPoint = curve.getPointAt(0.24);
    const midTangent = curve.getTangentAt(0.24).normalize();
    const midCollarGeom = new THREE.CylinderGeometry(0.33, 0.33, 0.18, 20);
    const midCollarMesh = new THREE.Mesh(midCollarGeom, titaniumCollarMaterial);
    midCollarMesh.position.copy(midPoint);
    midCollarMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), midTangent);
    sideGroup.add(midCollarMesh);

    return sideGroup;
  };

  conduitsGroup.add(buildSideConduit(false)); // Left
  conduitsGroup.add(buildSideConduit(true));  // Right

  return conduitsGroup;
}

/**
 * Procedural Hydraulic Struts
 * Matches the two upward-angled hydraulic struts extending from the rear top segments
 * of the mech rings in the studio reference render.
 */
function createHydraulicStrutsGroup() {
  const strutsGroup = new THREE.Group();
  strutsGroup.name = 'External_Hydraulic_Struts';

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.05,
    metalness: 0.98,
  });

  const graphiteBarrelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#22262B'),
    roughness: 0.28,
    metalness: 0.50,
  });

  const titaniumFittingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C8CFD7'),
    roughness: 0.20,
    metalness: 0.88,
  });

  const brassDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D8B349'),
    roughness: 0.22,
    metalness: 0.85,
  });

  const buildStrut = (isRight) => {
    const sign = isRight ? 1 : -1;
    const strut = new THREE.Group();

    const start = new THREE.Vector3(sign * 2.78, 2.05, -5.15);
    const end = new THREE.Vector3(sign * 4.55, 5.85, -7.80);
    const dir = new THREE.Vector3().subVectors(end, start);
    const fullLength = dir.length();
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );

    // 1. Mount base ball-socket & flange on ring chassis
    const baseFlangeGeom = new THREE.CylinderGeometry(0.38, 0.44, 0.22, 20);
    const baseFlangeMesh = new THREE.Mesh(baseFlangeGeom, titaniumFittingMaterial);
    baseFlangeMesh.position.copy(start);
    baseFlangeMesh.quaternion.copy(orientation);
    strut.add(baseFlangeMesh);

    // Decorative brass ring around mount
    const brassMountRingGeom = new THREE.TorusGeometry(0.42, 0.035, 16, 20);
    const brassMountRing = new THREE.Mesh(brassMountRingGeom, brassDetailMaterial);
    brassMountRing.position.copy(start);
    brassMountRing.quaternion.copy(orientation);
    brassMountRing.rotateX(Math.PI / 2);
    strut.add(brassMountRing);

    // 2. Main lower hydraulic cylinder barrel (graphite sleeve)
    const barrelLength = fullLength * 0.48;
    const barrelGeom = new THREE.CylinderGeometry(0.24, 0.24, barrelLength, 24);
    const barrelMesh = new THREE.Mesh(barrelGeom, graphiteBarrelMaterial);
    const barrelCenter = new THREE.Vector3().lerpVectors(start, end, 0.26);
    barrelMesh.position.copy(barrelCenter);
    barrelMesh.quaternion.copy(orientation);
    strut.add(barrelMesh);

    // 3. Cylinder barrel end collar bushing
    const bushingGeom = new THREE.CylinderGeometry(0.27, 0.27, 0.16, 24);
    const bushingMesh = new THREE.Mesh(bushingGeom, titaniumFittingMaterial);
    const bushingPos = new THREE.Vector3().lerpVectors(start, end, 0.49);
    bushingMesh.position.copy(bushingPos);
    bushingMesh.quaternion.copy(orientation);
    strut.add(bushingMesh);

    // 4. Mirror-polished chrome piston rod extending to top of screen
    const rodLength = fullLength * 0.65;
    const rodGeom = new THREE.CylinderGeometry(0.14, 0.14, rodLength, 24);
    const rodMesh = new THREE.Mesh(rodGeom, chromeMaterial);
    const rodCenter = new THREE.Vector3().lerpVectors(start, end, 0.72);
    rodMesh.position.copy(rodCenter);
    rodMesh.quaternion.copy(orientation);
    strut.add(rodMesh);

    return strut;
  };

  strutsGroup.add(buildStrut(false)); // Left rear strut
  strutsGroup.add(buildStrut(true));  // Right rear strut

  return strutsGroup;
}

export function Ring3DModel({
  enabled = true,
  glbUrl = '/Models/AWkN-Ring.glb',
  alt = 'HAULO Mech Ring 3D',
  className = '',
  variant = 'standard', // 'standard' | 'intro'
  enableAttachments = false,
  textContent = null,
  buttonText = 'VIEW PROJECT ↗',
  onButtonClick = null,
  onFrogSettledChange,
  projectUrl = '#',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const textOverlayRef = useRef(null);
  const onButtonClickRef = useRef(onButtonClick);
  onButtonClickRef.current = onButtonClick;
  const settledCallback = useRef(onFrogSettledChange);
  settledCallback.current = onFrogSettledChange;
  const restoreExpandedNodesRef = useRef(() => { });
  const setCanvasNode = useCallback((node) => {
    canvasRef.current = node;
    if (!node) restoreExpandedNodesRef.current();
  }, []);
  const setTextOverlayNode = useCallback((node) => {
    textOverlayRef.current = node;
    if (!node) restoreExpandedNodesRef.current();
  }, []);
  const [isReady, setIsReady] = useState(false);

  const isIntro = variant === 'intro';

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    let animationFrameId = null;
    let renderer = null;
    let scene = null;
    let camera = null;
    let ringPivot = null;
    let ringModelInstance = null;
    let mobileCopy = null;
    let mobileTextLayer = null;
    let mobileButtonLayer = null;
    const desktopCopy = [];
    const panelDividers = [];
    let sharedFrog = null;
    let sharedFrogMount = null;
    let sharedFrogHandoff = null;
    let sharedFrogScreenTarget = null;
    let approachOffsetNdcY = 0;
    let sharedFrogLockWeight = 1;
    let frogSettled = false;
    const reportSettled = (settled) => {
      if (settled === frogSettled) return;
      frogSettled = settled;
      settledCallback.current?.(settled);
    };
    let expandedForSharedFrog = false;
    let expandedCanvasLayer = null;
    let expandedNodeHomes = [];
    let placeholderNode = null;
    let frontArmorMesh = null;
    let canvas = null;
    let originalCanvasStyle = null;
    let originalOverlayStyle = null;
    const restoreExpandedNodes = () => {
      const hadExpandedNodes = expandedNodeHomes.length > 0 || !!expandedCanvasLayer;
      for (const home of [...expandedNodeHomes].reverse()) {
        if (!home.parent) continue;
        const reference = home.next?.parentNode === home.parent ? home.next : null;
        home.parent.insertBefore(home.node, reference);
      }
      expandedNodeHomes = [];
      if (placeholderNode && placeholderNode.parentNode) {
        placeholderNode.parentNode.removeChild(placeholderNode);
        placeholderNode = null;
      }
      expandedCanvasLayer?.remove();
      expandedCanvasLayer = null;
      // A component refresh can clean up while the shared-frog viewport is
      // active. Restore the original CSS dimensions as well as the DOM parent,
      // or the full-screen canvas will stretch the next ring render.
      if (hadExpandedNodes) {
        if (canvas && originalCanvasStyle !== null) {
          canvas.setAttribute('style', originalCanvasStyle);
          canvas.style.opacity = '1';
        }
        const overlay = textOverlayRef.current;
        if (overlay && originalOverlayStyle !== null) {
          overlay.setAttribute('style', originalOverlayStyle);
        }
        expandedForSharedFrog = false;
      }
    };
    restoreExpandedNodesRef.current = restoreExpandedNodes;
    // Keep the intro ring's authored transform; project rings use their
    // established widened scale when the shared swimmer enters.
    const baseRingScale = isIntro
      ? { x: 1, y: 1, z: 1 }
      : { x: 1.14, y: 1.02, z: 0.95 };
    let textOverlayLayoutDirty = true;
    const textAnchorMeshes = new Map();
    const textMeasureContext = document.createElement('canvas').getContext('2d');
    let mixer = null;
    let isModelRequested = false;
    let isVisible = false;
    let buttonBezelMesh = null;
    let buttonScreenMesh = null;
    let isButtonHovered = false;
    let isButtonPressed = false;
    let pressTween = null;
    let buttonCleanup = null;
    let descriptionMesh = null;

    const container = containerRef.current;
    canvas = canvasRef.current;
    if (!container || !canvas) return;
    originalCanvasStyle = (canvas.getAttribute('style') || '').replace(/opacity:\s*0(\.0*)?;?/, 'opacity: 1;');
    originalOverlayStyle = textOverlayRef.current?.getAttribute('style') || '';
    const parentRing = container.closest('.space-ring-item');
    let lastProjectedCx = NaN;
    let lastProjectedCy = NaN;
    let lastProjectedW = NaN;

    // ---- RENDERER SETUP (LOCKED 60 FPS OPTIMIZATION) ----
    const baseW = isIntro ? 1125 : 1536;
    const baseH = isIntro ? 941 : 1080;
    const baseFovDeg = isIntro ? 24 : 43.32;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: getAntialiasSetting(),
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(getTargetDPR());
      renderer.setClearColor(0x000000, 0); // Transparent background
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.10;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const ringId = 'ring-' + (glbUrl || '').split('/').pop();
      perfDiagnostics.registerRenderer(ringId, renderer, ringId);
    } catch (e) {
      console.warn('WebGL init error on Ring3DModel:', e);
      return;
    }

    const syncExpandedCameraToContainer = () => {
      if (!expandedForSharedFrog || !renderer || !camera || !container) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width <= 0 || height <= 0) return;

      const rect = container.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      // Keep the ring and projected fascia texts locked to the container's exact
      // spline rectangle in viewport coordinates while expanding the WebGL surface
      // so the frog remains unclipped above and below the ring.
      // Use the actual on-screen height, including the ring frame's CSS scale,
      // so the viewport camera reproduces the same visible model size.
      const visualHeight = rect.height || rect.width * (baseH / baseW);
      const unscaledVisualHeight = isIntro ? visualHeight : rect.width * (baseH / baseW);
      const cssScaleY = unscaledVisualHeight > 0 ? Math.max(0.5, Math.min(1.2, visualHeight / unscaledVisualHeight)) : 1;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const frogAspect = width / height;
      const isMobile = frogAspect < 1.0;
      const frogFovDeg = isMobile ? 44 + (1.0 - frogAspect) * 16 : 44;
      const frogCamZ = isMobile ? 2.12 * (1 + (1.0 - frogAspect) * 0.28) : 2.12;
      const worldVhFrog = 2 * frogCamZ * Math.tan((frogFovDeg * Math.PI) / 360);

      const dynamicFovRad = 2 * Math.atan((height / unscaledVisualHeight) * Math.tan((baseFovDeg * Math.PI) / 360));
      // In mobile portrait, match camera.fov directly to Frog3DModel's natural perspective (frogFovDeg)
      // completely eliminating fisheye elongation, stretching, and distortion.
      const activeFovRad = isMobile ? (frogFovDeg * Math.PI) / 180 : dynamicFovRad;
      camera.fov = (activeFovRad * 180) / Math.PI;
      camera.aspect = width / height;
      camera.setViewOffset(width, height, width * 0.5 - cx, height * 0.5 - cy, width, height);
      camera.updateProjectionMatrix();

      if (ringPivot) {
        // Proportionally scale ringPivot so the 3D ring maintains its exact authored on-screen pixel size and proportions
        const projectBoost = (!isIntro && isMobile) ? 1.14 : 1.0;
        const ringScaleFactor = (isMobile
          ? (unscaledVisualHeight / height) * (Math.tan(activeFovRad * 0.5) / Math.tan((baseFovDeg * Math.PI) / 360))
          : 1.0) * projectBoost;
        ringPivot.scale.set(baseRingScale.x * ringScaleFactor, baseRingScale.y * ringScaleFactor, baseRingScale.z * ringScaleFactor);
      }

      if (sharedFrogMount && ringPivot) {
        ringPivot.updateMatrixWorld(true);
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        const frogRefPos = sharedFrogMount.position;
        const actualDist = Math.max(1, frogRefPos.clone().sub(camera.position).dot(camForward));
        const targetMountScale = Math.max(2.0, Math.min(20.0, (2 * actualDist * Math.tan(activeFovRad * 0.5)) / worldVhFrog));
        sharedFrogMount.scale.setScalar(targetMountScale);
      }

      if (
        Math.abs(cx - lastProjectedCx) > 0.25 ||
        Math.abs(cy - lastProjectedCy) > 0.25 ||
        Math.abs(rect.width - lastProjectedW) > 0.25
      ) {
        lastProjectedCx = cx;
        lastProjectedCy = cy;
        lastProjectedW = rect.width;
        textOverlayLayoutDirty = true;
      }

      if (expandedCanvasLayer && parentRing) {
        expandedCanvasLayer.style.opacity = sharedFrog ? '1' : (parentRing.style.opacity !== '' ? parentRing.style.opacity : '1');
      }
      if (sharedFrog && canvas) {
        canvas.style.opacity = '1';
      }

      if (textOverlayRef.current && expandedForSharedFrog) {
        const textAlpha = sharedFrogLockWeight > 0.15 ? Math.min(1, (sharedFrogLockWeight - 0.15) / 0.5) : 0;
        textOverlayRef.current.style.opacity = `${textAlpha}`;
        textOverlayRef.current.style.pointerEvents = textAlpha > 0.5 ? 'auto' : 'none';
      }
    };

    const resizeExpandedCanvas = () => {
      if (expandedForSharedFrog && renderer && camera && ringPivot) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const targetDPR = getTargetDPR();
        if (renderer.getPixelRatio() !== targetDPR) {
          renderer.setPixelRatio(targetDPR);
        }
        renderer.setSize(width, height, false);
        if (expandedCanvasLayer) {
          expandedCanvasLayer.style.width = `${width}px`;
          expandedCanvasLayer.style.height = `${height}px`;
        }
        if (textOverlayRef.current) {
          textOverlayRef.current.style.width = `${width}px`;
          textOverlayRef.current.style.height = `${height}px`;
        }
        syncExpandedCameraToContainer();
        textOverlayLayoutDirty = true;
      }
    };

    const updateProjectRingHeight = () => {
      if (!isIntro && ringModelInstance) {
        const mobile = window.innerWidth <= 900;
        ringModelInstance.scale.y = mobile ? 1.18 : 1;
        if (mobile && !mobileCopy && textContent && panelDividers.length === 2) {
          mobileCopy = createMobilePanelCopy(textContent, panelDividers[0], panelDividers[1], 3.22, renderer);
          if (mobileCopy) ringModelInstance.add(mobileCopy);
        }
        if (mobileCopy) {
          if (!mobile) mobileTextLayer?.layer.remove();
          mobileCopy.visible = mobile;
          desktopCopy.forEach(mesh => { mesh.visible = !mobile; });
        }
      }
    };

    const updateRendererSize = () => {
      updateProjectRingHeight();
      if (!renderer || !container) return;
      if (expandedForSharedFrog) {
        resizeExpandedCanvas();
        return;
      }

      const rect = container.getBoundingClientRect();
      const displayW = Math.round(rect.width || container.clientWidth || baseW);
      if (displayW <= 0) return;

      const targetDPR = getTargetDPR();
      if (renderer.getPixelRatio() !== targetDPR) {
        renderer.setPixelRatio(targetDPR);
      }

      const targetW = Math.min(baseW, Math.max(280, displayW));
      const targetH = Math.round(targetW * (baseH / baseW));

      renderer.setSize(targetW, targetH, false);
      if (camera) {
        camera.aspect = baseW / baseH;
        camera.updateProjectionMatrix();
      }
    };

    const overlayResizeObserver = new ResizeObserver(() => {
      textOverlayLayoutDirty = true;
      updateRendererSize();
    });
    window.addEventListener('resize', updateRendererSize);
    overlayResizeObserver.observe(container);

    // Match the swimmer's hero scene, which uses studio lights alone.
    scene = new THREE.Scene();

    // Aspect ratio and camera setup
    const aspect = baseW / baseH;
    camera = new THREE.PerspectiveCamera(baseFovDeg, aspect, 0.1, 100);
    updateRendererSize();

    if (isIntro) {
      // Intro camera: centered view onto the slanting ring matching reference image
      camera.position.set(0, 0, 25.5);
      camera.lookAt(0, 0, 0);
    } else {
      const dist = 13.20;
      const tiltRad = (-11.5 * Math.PI) / 180;
      const target = new THREE.Vector3(0, 1.70, 0);
      camera.position.set(
        0,
        target.y + dist * Math.sin(tiltRad),
        target.z + dist * Math.cos(tiltRad)
      );
      camera.lookAt(target);
    }

    // ---- BALANCED STUDIO LIGHTING (Desktop: 8 DirectionalLights; Mobile: 4 DirectionalLights + Ambient) ----
    // Matched identically to Frog3DModel so shared frog preserves exact electric color and brightness across all sections
    const isMobile = window.innerWidth <= 900 || (window.innerWidth / (window.innerHeight || 1)) < 1.0;

    const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 0.95 : 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 7, 5);
    scene.add(keyLight);

    const bottomKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    bottomKeyLight.position.set(-3, -7, 5);
    scene.add(bottomKeyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    fillLight.position.set(-5, 6, 6);
    scene.add(fillLight);

    const bottomFillLight = new THREE.DirectionalLight(0xffffff, 1.1);
    bottomFillLight.position.set(5, -6, 6);
    scene.add(bottomFillLight);

    // Desktop auxiliary rim lights
    if (!isMobile) {
      const rimLight = new THREE.DirectionalLight(0xffffff, 1.3);
      rimLight.position.set(-4, 5, -3);
      scene.add(rimLight);

      const bottomRimLight = new THREE.DirectionalLight(0xffffff, 1.3);
      bottomRimLight.position.set(4, -5, -3);
      scene.add(bottomRimLight);

      const topRimLight = new THREE.DirectionalLight(0xffffff, 0.90);
      topRimLight.position.set(0, 6, -2);
      scene.add(topRimLight);

      const bottomTopRimLight = new THREE.DirectionalLight(0xffffff, 0.90);
      bottomTopRimLight.position.set(0, -6, -2);
      scene.add(bottomTopRimLight);
    }

    // Pivot group for orientation and pointer parallax
    ringPivot = new THREE.Group();
    ringPivot.rotation.order = 'XYZ';

    // Base rotation angles - calibrated for intro 1st ring: dynamic slanting angle (~44 deg tilt), HAULO text at ~11:30, bottom slanting toward bottom-left
    // Project rings (2-5) horizontally rotated to the left side (-0.22 rad / ~12.6 deg)
    const baseRotX = isIntro ? (-38.0 * Math.PI) / 180 : (15.0 * Math.PI) / 180;
    const baseRotY = isIntro ? (-14.0 * Math.PI) / 180 : -0.22;
    const baseRotZ = isIntro ? (-12.0 * Math.PI) / 180 : 0;

    const basePosX = isIntro ? -0.15 : -0.18;
    const basePosY = isIntro ? -1.15 : 0;
    const basePosZ = 0;

    ringPivot.position.set(basePosX, basePosY, basePosZ);
    ringPivot.rotation.set(baseRotX, baseRotY, baseRotZ);
    if (!isIntro) {
      // Widen the four project rings while retaining their existing depth.
      ringPivot.scale.set(1.14, 1.02, 0.95);
    }
    scene.add(ringPivot);

    const alignSharedFrogToOpening = (frogRoot, weight = 1) => {
      if (!frogRoot || !sharedFrogMount || !ringPivot || !scene) return;
      const torso = frogRoot.getObjectByName('BODY');
      if (!torso) return;

      ringPivot.updateWorldMatrix(true, false);
      const testDir = (!isIntro && frogRoot)
        ? new THREE.Vector3(1, 0, 0).applyQuaternion(frogRoot.quaternion)
        : null;
      const downFromQuat = testDir ? Math.max(0, Math.min(1, -testDir.y)) : 0;
      const downFromUserData = frogRoot?.userData?.spaceDirTurn || 0;
      const downTurn = (!isIntro && frogRoot) ? Math.max(downFromQuat, downFromUserData) : 0;

      // In project rings, when the frog is oriented downwards (staying / scroll up):
      // Move the frog forward to the FRONT rim of the aperture opening
      // so it rests right at the front fascia with its face, eyes, and markings clearly visible,
      // bringing the head in front of the ceramic armor panel.
      const isMobile = (window.innerWidth / (window.innerHeight || 1)) < 1.0;
      const baseRimZ = isMobile ? 3.40 : 4.00;
      const moveRimZ = isMobile ? baseRimZ : 0.00;
      const frontLocalZ = !isIntro ? (moveRimZ + downTurn * (baseRimZ - moveRimZ)) : 0;
      const frontLocalX = !isIntro ? frontLocalZ * 0.224 : 0;
      const frontLocalY = !isIntro ? (1.02 + downTurn * (isMobile ? 0.08 : 0.15)) : (isIntro ? 1.15 : 1.02);

      const openingWorld = ringPivot.localToWorld(
        new THREE.Vector3(frontLocalX, frontLocalY, frontLocalZ)
      );
      let targetWorld = openingWorld;
      if (sharedFrogScreenTarget && sharedFrogLockWeight < 1 && camera) {
        camera.updateMatrixWorld(true);
        const projectedOpening = openingWorld.clone().project(camera);
        const openingNdcZ = projectedOpening.z;
        if (approachOffsetNdcY) {
          projectedOpening.y += approachOffsetNdcY;
          openingWorld.copy(projectedOpening.unproject(camera));
        }
        const screenWorld = new THREE.Vector3(
          sharedFrogScreenTarget.x,
          sharedFrogScreenTarget.y,
          openingNdcZ
        ).unproject(camera);
        targetWorld = openingWorld.clone().lerp(screenWorld, 1 - sharedFrogLockWeight);
      }
      sharedFrogMount.updateWorldMatrix(true, true);
      const torsoWorld = torso.getWorldPosition(new THREE.Vector3());

      // Correct the mount by the torso-to-target difference, accounting for
      // the frog's current swim pose, rotation, scale, and vertical drift.
      sharedFrogMount.position.add(targetWorld.sub(torsoWorld).multiplyScalar(weight));
      if (camera) {
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        const actualDist = Math.max(1, sharedFrogMount.position.clone().sub(camera.position).dot(camForward));
        const width = window.innerWidth;
        const height = window.innerHeight;
        const activeFovRad = (camera.fov * Math.PI) / 180;
        const frogAspect = width / (height || 1);
        const frogFovDeg = frogAspect < 1.0 ? 44 + (1.0 - frogAspect) * 16 : 44;
        const frogCamZ = frogAspect < 1.0 ? 2.12 * (1 + (1.0 - frogAspect) * 0.28) : 2.12;
        const worldVhFrog = 2 * frogCamZ * Math.tan((frogFovDeg * Math.PI) / 360);
        const targetMountScale = Math.max(2.0, Math.min(20.0, (2 * actualDist * Math.tan(activeFovRad * 0.5)) / worldVhFrog));
        sharedFrogMount.scale.setScalar(targetMountScale);
      }
      sharedFrogMount.updateWorldMatrix(true, true);
    };

    container.setSharedFrogScreenTarget = (ndcX, ndcY, lockWeight = 1, entryOffsetY = 0) => {
      approachOffsetNdcY = entryOffsetY;
      if (Number.isFinite(ndcX) && Number.isFinite(ndcY)) {
        sharedFrogScreenTarget = { x: ndcX, y: ndcY };
      }
      sharedFrogLockWeight = Math.max(0, Math.min(1, lockWeight));
      if (textOverlayRef.current && expandedForSharedFrog) {
        const textAlpha = sharedFrogLockWeight > 0.15 ? Math.min(1, (sharedFrogLockWeight - 0.15) / 0.5) : 0;
        textOverlayRef.current.style.opacity = `${textAlpha}`;
        textOverlayRef.current.style.pointerEvents = textAlpha > 0.5 ? 'auto' : 'none';
      }
    };

    container.getSharedFrogScreenPosition = (frogRoot) => {
      if (!frogRoot || !camera || !scene) return null;
      const torso = frogRoot.getObjectByName('BODY');
      if (!torso) return null;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const screenPoint = torso.getWorldPosition(new THREE.Vector3()).project(camera);
      return Number.isFinite(screenPoint.x) && Number.isFinite(screenPoint.y) && Number.isFinite(screenPoint.z)
        ? { x: screenPoint.x, y: screenPoint.y, z: screenPoint.z }
        : null;
    };

    // Each ring can temporarily host the one existing animated frog during its
    // centered pass, preserving the actual front/back depth.
    container.mountSharedFrog = (frogRoot, handoffScreenPosition = null) => {
      if (!frogRoot || !ringPivot) return false;
      loadModel();
      startRenderLoop();
      if (!expandedForSharedFrog) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        // The canvas starts hidden while the GLB loads, then React reveals it
        // after `setIsReady(true)`. Refresh these snapshots now so restoring
        // the canvas after a ring pass does not reapply that stale loading
        // opacity and leave both the canvas and fallback image invisible.
        originalCanvasStyle = (canvas.getAttribute('style') || '').replace(/opacity:\s*0(\.0*)?;?/, 'opacity: 1;');
        originalOverlayStyle = textOverlayRef.current?.getAttribute('style') || '';
        // The ring sits inside CSS 3D-transformed ancestors. `position: fixed`
        // on a canvas inside that tree is fixed to the transformed ancestor,
        // not the viewport, which can crop the shared frog at the canvas edge.
        // Move only the existing canvas and text overlay into a viewport layer;
        // camera frustum offset keeps the ring and fascia texts at their exact
        // spline screen position and scale.
        expandedCanvasLayer = document.createElement('div');
        Object.assign(expandedCanvasLayer.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: `${width}px`,
          height: `${height}px`,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: '120',
        });
        document.body.appendChild(expandedCanvasLayer);
        expandedNodeHomes = [canvas, textOverlayRef.current]
          .filter(Boolean)
          .map((node) => ({ node, parent: node.parentNode, next: node.nextSibling }));
        if (container && !placeholderNode) {
          placeholderNode = document.createElement('div');
          placeholderNode.className = 'ring-3d-placeholder';
          Object.assign(placeholderNode.style, {
            width: '100%',
            height: '100%',
            aspectRatio: isIntro ? '1125 / 941' : '1024 / 720',
            pointerEvents: 'none',
            visibility: 'hidden',
          });
          container.appendChild(placeholderNode);
        }
        expandedCanvasLayer.appendChild(canvas);
        if (textOverlayRef.current) expandedCanvasLayer.appendChild(textOverlayRef.current);
        const curSize = renderer.getSize(new THREE.Vector2());
        if (Math.round(curSize.x) !== Math.round(width) || Math.round(curSize.y) !== Math.round(height)) {
          renderer.setSize(width, height, false);
        }
        ringPivot.scale.set(baseRingScale.x, baseRingScale.y, baseRingScale.z);
        Object.assign(canvas.style, {
          position: 'absolute',
          width: `${width}px`,
          height: `${height}px`,
          left: '0',
          top: '0',
          transform: 'none',
          opacity: '1',
        });
        canvas.style.zIndex = '2';
        canvas.style.opacity = '1';
        setIsReady(true);
        if (textOverlayRef.current) {
          Object.assign(textOverlayRef.current.style, {
            position: 'absolute',
            inset: '0',
            right: '0',
            bottom: '0',
            width: `${width}px`,
            height: `${height}px`,
            left: '0',
            top: '0',
            transform: 'none',
            zIndex: '3',
            opacity: '0',
          });
        }
        expandedForSharedFrog = true;
        lastProjectedCx = NaN;
        lastProjectedCy = NaN;
        lastProjectedW = NaN;
        syncExpandedCameraToContainer();
        textOverlayLayoutDirty = true;
      }
      let mountCreated = false;
      if (!sharedFrogMount) {
        sharedFrogMount = new THREE.Group();
        sharedFrogMount.rotation.x = isIntro ? 0 : (11.5 * Math.PI) / 180;
        scene.add(sharedFrogMount);
        mountCreated = true;
      }
      syncExpandedCameraToContainer();
      const needsMount = mountCreated || sharedFrog !== frogRoot || frogRoot.parent !== sharedFrogMount;
      if (needsMount) {
        // Initialize the host once when this ring takes over.
        const testDir = (!isIntro && frogRoot)
          ? new THREE.Vector3(1, 0, 0).applyQuaternion(frogRoot.quaternion)
          : null;
        const downFromQuat = testDir ? Math.max(0, Math.min(1, -testDir.y)) : 0;
        const downFromUserData = frogRoot?.userData?.spaceDirTurn || 0;
        const downTurn = (!isIntro && frogRoot) ? Math.max(downFromQuat, downFromUserData) : 0;

        const isMobile = (window.innerWidth / (window.innerHeight || 1)) < 1.0;
        const baseRimZ = isMobile ? 3.40 : 4.00;
        const moveRimZ = isMobile ? baseRimZ : 0.00;
        const frontLocalZ = !isIntro ? (moveRimZ + downTurn * (baseRimZ - moveRimZ)) : 0;
        const frontLocalX = !isIntro ? frontLocalZ * 0.224 : 0;
        const frontLocalY = !isIntro ? (1.02 + downTurn * (isMobile ? 0.08 : 0.15)) : (isIntro ? 1.15 : 1.02);

        ringPivot.updateWorldMatrix(true, false);
        ringPivot.localToWorld(
          sharedFrogMount.position.set(frontLocalX, frontLocalY, frontLocalZ)
        );
        if (camera) {
          const camForward = new THREE.Vector3();
          camera.getWorldDirection(camForward);
          const actualDist = Math.max(1, sharedFrogMount.position.clone().sub(camera.position).dot(camForward));
          const width = window.innerWidth;
          const height = window.innerHeight;
          const activeFovRad = (camera.fov * Math.PI) / 180;
          const frogAspect = width / (height || 1);
          const frogFovDeg = frogAspect < 1.0 ? 44 + (1.0 - frogAspect) * 16 : 44;
          const frogCamZ = frogAspect < 1.0 ? 2.12 * (1 + (1.0 - frogAspect) * 0.28) : 2.12;
          const worldVhFrog = 2 * frogCamZ * Math.tan((frogFovDeg * Math.PI) / 360);
          const targetMountScale = Math.max(2.0, Math.min(20.0, (2 * actualDist * Math.tan(activeFovRad * 0.5)) / worldVhFrog));
          sharedFrogMount.scale.setScalar(targetMountScale);
        }
        sharedFrog = frogRoot;
        sharedFrogMount.add(frogRoot);
        sharedFrogHandoff = null;
        alignSharedFrogToOpening(frogRoot, 1);
        if (renderer && scene && camera) {
          try {
            renderer.render(scene, camera);
          } catch (_) { }
        }
      }
      return true;
    };
    container.unmountSharedFrog = (frogRoot) => {
      reportSettled(false);
      if (sharedFrog && (!frogRoot || frogRoot === sharedFrog)) {
        if (sharedFrog.parent === sharedFrogMount) {
          sharedFrogMount.remove(sharedFrog);
        }
        sharedFrog = null;
        sharedFrogHandoff = null;
      }
      if (expandedForSharedFrog && renderer && camera && ringPivot) {
        // Keeping existing GPU renderbuffer avoids framebuffer re-allocation overhead
        camera.clearViewOffset();
        camera.fov = baseFovDeg;
        camera.aspect = baseW / baseH;
        camera.updateProjectionMatrix();
        ringPivot.scale.set(baseRingScale.x, baseRingScale.y, baseRingScale.z);
        // Return React-owned nodes to their original container before removing
        // the temporary viewport layer, so normal ring layout resumes cleanly.
        restoreExpandedNodes();
        Object.assign(canvas.style, {
          position: 'absolute', width: '100%', height: '100%', left: '0', top: '0',
          transform: '', zIndex: '', opacity: '1',
        });
        if (textOverlayRef.current) {
          Object.assign(textOverlayRef.current.style, {
            position: '', inset: '', right: '', bottom: '', width: '', height: '',
            left: '', top: '', transform: '', zIndex: '',
            opacity: '', pointerEvents: '',
          });
        }
        expandedForSharedFrog = false;
        if (mobileCopy) mobileCopy.visible = window.innerWidth <= 900;
        lastProjectedCx = NaN;
        lastProjectedCy = NaN;
        lastProjectedW = NaN;
        textOverlayLayoutDirty = true;
      }
      // Explicitly clear color, depth, and stencil buffers to transparent (0,0,0,0)
      // and redraw the ring so zero stale frog pixels remain in this ring's WebGL buffer
      if (renderer && scene && camera) {
        try {
          renderer.clear(true, true, true);
          renderer.render(scene, camera);
        } catch (_) { }
      }
    };

    let hasWarmedUpShaders = false;
    container.warmupWithSharedFrog = (frogRoot) => {
      loadModel();
      if (!frogRoot || !scene || !camera || !renderer) return;
      if (hasWarmedUpShaders) return;
      try {
        // Prepare the swimmer for this renderer while its current scene keeps drawing it.
        renderer.compile(frogRoot, camera, scene);
        hasWarmedUpShaders = true;
      } catch (_) { }
    };

    container.ensureModelLoaded = () => {
      loadModel();
      startRenderLoop();
    };

    // Procedural attachments (ONLY if explicitly enabled, never on pure models)
    if (enableAttachments) {
      const conduits = createConduitsGroup();
      ringPivot.add(conduits);
      const struts = createHydraulicStrutsGroup();
      ringPivot.add(struts);
    }

    const isAwknModel = glbUrl.toLowerCase().includes('awkn');
    const isTrulyBare = glbUrl.toLowerCase().includes('truly_bare') || glbUrl.toLowerCase().includes('trulybare');
    const isAwknOrTrulyBare = isAwknModel || isTrulyBare;
    const isStakor = glbUrl.toLowerCase().includes('stakor');
    const isTheoryOfBloom = glbUrl.toLowerCase().includes('bloom') || glbUrl.toLowerCase().includes('theory');

    // ---- LAZY MODEL LOADER (TRIGGERS ONLY WHEN PROXIMATE/VISIBLE) ----
    const loadModel = () => {
      if (isModelRequested) return;
      isModelRequested = true;

      loadRingGLTF(glbUrl)
        .then((gltf) => {
          if (!isMounted) return;

          // Clone scene so multiple instances don't collide
          const model = gltf.scene.clone(true);

          // Strip embedded Blender lights to prevent overexposure blowout
          const lightsToRemove = [];
          model.traverse((child) => {
            if (child.isLight) {
              lightsToRemove.push(child);
            }
          });
          lightsToRemove.forEach((light) => {
            if (light.parent) {
              light.parent.remove(light);
            }
          });

          // Setup built-in animations if available in GLB
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
          }

          // Precompute matrix transforms once to eliminate 4,500 node matrix updates per frame
          model.updateMatrixWorld(true);

          let projectNumberMesh = null;
          let projectWordmarkMesh = null;
          let descMinX = Infinity, descMaxX = -Infinity;
          let descMinY = Infinity, descMaxY = -Infinity;
          let srvMinY = Infinity, srvMaxY = -Infinity;
          let srv1Height = 0;

          model.traverse((child) => {
            const rawChildName = (child.name || '').toLowerCase();
            const cleanChildName = rawChildName.replace(/[^a-z0-9]/g, '');

            if (child.isMesh) {
              const rawName = rawChildName;
              const name = rawName;
              const cleanName = cleanChildName;
              const matName = (child.material && child.material.name ? child.material.name : '').toLowerCase();

              if (cleanName.includes('projectnumber') || (cleanName.includes('project') && cleanName.includes('number'))) {
                projectNumberMesh = child;
              }
              if (cleanName.includes('projectwordmark') || (cleanName.includes('project') && cleanName.includes('wordmark'))) {
                projectWordmarkMesh = child;
              }

              // Freeze static child matrix calculations
              if (
                !cleanName.includes('button') &&
                !cleanName.includes('display') &&
                !cleanName.includes('bezel') &&
                !cleanName.includes('verticalbar') &&
                !cleanName.includes('haulo') &&
                !cleanName.includes('wordmark')
              ) {
                child.matrixAutoUpdate = false;
              }

              const parentName = (child.parent && child.parent.name ? child.parent.name : '').toLowerCase();
              const cleanParentName = parentName.replace(/[^a-z0-9]/g, '');

              if (cleanName.includes('frontcontinuouscurvedwhitearmor') || cleanName === 'curvedwhitearmorpanel') {
                frontArmorMesh = child;
              }

              // Hide intrusive seam pistons / buttons poking out through the front armor panels
              if (
                cleanName.includes('seampiston') ||
                cleanName.includes('pistoncollar') ||
                cleanParentName.includes('seampiston') ||
                cleanParentName.includes('pistoncollar')
              ) {
                child.visible = false;
                return;
              }

              // 1. Right Screen display button:
              // Hide old blurry 3D text and old bar from Blender model
              if (
                cleanName.includes('displaytext') ||
                cleanName.includes('editabledisplaytext') ||
                (cleanName.includes('display') && cleanName.includes('text'))
              ) {
                child.visible = false;
                return;
              }

              if (
                cleanName.includes('displaylimeverticalbar') ||
                (cleanName.includes('display') && cleanName.includes('lime') && cleanName.includes('bar'))
              ) {
                child.visible = false;
                return;
              }

              if (
                cleanName.includes('blackrecesseddisplaybezel') ||
                rawName.includes('black recessed display bezel')
              ) {
                buttonBezelMesh = child;
                child.matrixAutoUpdate = true;
              }

              // Subtle vertical adjustment for text contents on the intro ref image ring
              const textOffsetY = isIntro ? -0.14 : 0;

              // 2. HAULO Wordmark (H, A, U, L, O) - lifted forward & depthTest:false to guarantee 100% full visibility without mesh clipping
              // Matches all 8 letter meshes: 'HAULO wordmark', 'HAULO wordmark.001' to '.007' regardless of Three.js name sanitization
              if (
                cleanName.includes('haulowordmark') ||
                (cleanName.includes('haulo') && cleanName.includes('wordmark')) ||
                rawName.includes('haulo wordmark')
              ) {
                if (child.geometry && !child.userData.hasOffset) {
                  child.geometry = child.geometry.clone();
                  child.geometry.translate(0, textOffsetY, 0.16);
                  child.userData.hasOffset = true;
                }
                child.matrixAutoUpdate = true;
                child.renderOrder = 100;
                child.material = sharedHauloTextMaterial;
                return;
              }

              // 2b. Lime green accent bar inside letter H
              if (
                cleanName.includes('hlimeinlay') ||
                (cleanName.includes('lime') && cleanName.includes('inlay')) ||
                rawName.includes('h lime inlay')
              ) {
                if (child.geometry && !child.userData.hasOffset) {
                  child.geometry = child.geometry.clone();
                  child.geometry.translate(0, textOffsetY, 0.17);
                  child.userData.hasOffset = true;
                }
                child.matrixAutoUpdate = true;
                child.renderOrder = 101;
                child.material = sharedHauloLimeInlayMaterial;
                return;
              }

              // 2c. Front motto, portfolio & edition typography on Nameplate
              if (
                cleanName.includes('haulomotto') ||
                (cleanName.includes('haulo') && cleanName.includes('motto')) ||
                cleanName === 'portfolio' ||
                cleanName === 'edition' ||
                cleanName.includes('mottohatch') ||
                rawName.includes('haulo motto') ||
                rawName === 'portfolio' ||
                rawName === 'edition' ||
                rawName.includes('motto hatch')
              ) {
                if (child.geometry && !child.userData.hasOffset) {
                  child.geometry = child.geometry.clone();
                  child.geometry.translate(0, textOffsetY, 0.15);
                  child.userData.hasOffset = true;
                }
                child.matrixAutoUpdate = true;
                child.renderOrder = 100;
                child.material = sharedHauloTextMaterial;
                return;
              }

              // 2d. Right module graphite ID plate white service inscriptions
              if (
                name.includes('service inscription') ||
                (name.includes('id hatch') && !name.includes('bed'))
              ) {
                if (child.geometry && !child.userData.hasOffset) {
                  child.geometry = child.geometry.clone();
                  child.geometry.translate(0, 0, 0.08);
                  child.userData.hasOffset = true;
                }
                child.renderOrder = 100;
                child.material = sharedWhiteDisplayTextMaterial;
                return;
              }

              // Hide old baked serif Description meshes and collect their bounding box
              if (
                cleanName.startsWith('description') ||
                name.startsWith('description') ||
                name.includes('description_')
              ) {
                if (child.geometry) {
                  if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                  const b = child.geometry.boundingBox;
                  if (b) {
                    descMinX = Math.min(descMinX, b.min.x);
                    descMaxX = Math.max(descMaxX, b.max.x);
                    descMinY = Math.min(descMinY, b.min.y);
                    descMaxY = Math.max(descMaxY, b.max.y);
                  }
                }
                child.visible = false;
                return;
              }

              // Collect Service 1..5 vertical bounds to match baseline and font metrics
              if (cleanName.startsWith('service') || name.startsWith('service')) {
                if (child.geometry) {
                  if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                  const b = child.geometry.boundingBox;
                  if (b) {
                    srvMinY = Math.min(srvMinY, b.min.y);
                    srvMaxY = Math.max(srvMaxY, b.max.y);
                    if (cleanName === 'service1') {
                      srv1Height = b.max.y - b.min.y;
                    }
                  }
                }
              }

              // 2e. All Ring Typography (Project #, Wordmark, Services, Dividers, Slanted Accents)
              const isRingTypography =
                cleanName.includes('projectnumber') ||
                cleanName.includes('projectwordmark') ||
                cleanName.startsWith('service') ||
                cleanName.includes('paneldivider') ||
                cleanName.includes('slantedaccent') ||
                cleanName.includes('slanted') ||
                name.includes('typography') ||
                name.includes('project_') ||
                (name.startsWith('project') && !name.includes('face') && !name.includes('panel')) ||
                (name.startsWith('service') && !name.includes('face') && !name.includes('panel') && !name.includes('inscription'));

              if (cleanName.startsWith('paneldivider')) {
                child.geometry.computeBoundingBox();
                panelDividers.push(child.geometry.boundingBox.max.x);
              }
              if (/^service[1-5]$/.test(cleanName)) {
                desktopCopy.push(child);
              }

              if (isRingTypography) {
                child.visible = true;
                child.renderOrder = 20;
                child.material = sharedBlackTextMaterial;
                return;
              }

              // 3. Display lime vertical bar & status indicators (inside and outside the ring)
              if (
                name.includes('lime') ||
                name.includes('indicator') ||
                name.includes('emitter') ||
                name.includes('luminous') ||
                matName.includes('lime') ||
                matName.includes('emission')
              ) {
                child.material = sharedLimeGlowMaterial;
                child.renderOrder = 10;
                return;
              }

              // 4. White ceramic armor panels, shoulders, beds & lettering panels (exclude graphite ID plate)
              if (
                (name.includes('nameplate') ||
                  name.includes('face') ||
                  name.includes('panel') ||
                  name.includes('hatch') ||
                  name.includes('armor') ||
                  name.includes('shoulder') ||
                  name.includes('strap') ||
                  name.includes('plate') ||
                  name.includes('bed') ||
                  matName.includes('ceramic') ||
                  matName.includes('white') ||
                  matName.includes('lettering panel')) &&
                !name.includes('graphite')
              ) {
                child.material = isIntro ? introCeramicArmorMaterial : sharedCeramicArmorMaterial;
                return;
              }

              // 5. Graphite chassis & dark recesses
              if (matName.includes('graphite') || matName.includes('chassis')) {
                child.material = sharedGraphiteChassisMaterial;
                return;
              }

              if (matName.includes('dark recesses') || matName.includes('recess')) {
                child.material = sharedDarkRecessesMaterial;
                return;
              }

              // 6. Brass fasteners & titanium couplings
              if (matName.includes('brass')) {
                child.material = sharedBrassFastenersMaterial;
                return;
              }

              if (matName.includes('titanium')) {
                child.material = sharedTitaniumMaterial;
                return;
              }

              // 7. Olive light housing & green lens gaskets
              if (
                matName.includes('olive') ||
                matName.includes('housing') ||
                name.includes('olive') ||
                name.includes('green lens')
              ) {
                child.material = sharedOliveHousingMaterial;
                return;
              }
            }
          });

          // Scale Project Number (01/, 02/, 03/, 04/) to equal Project Name size matching reference image
          if (projectNumberMesh && projectWordmarkMesh && projectNumberMesh.geometry && projectWordmarkMesh.geometry) {
            if (!projectNumberMesh.geometry.boundingBox) projectNumberMesh.geometry.computeBoundingBox();
            if (!projectWordmarkMesh.geometry.boundingBox) projectWordmarkMesh.geometry.computeBoundingBox();

            const numBox = projectNumberMesh.geometry.boundingBox;
            const wmBox = projectWordmarkMesh.geometry.boundingBox;

            const numH = numBox.max.y - numBox.min.y;
            const wmH = wmBox.max.y - wmBox.min.y;

            if (numH > 0 && wmH > 0) {
              const scaleY = wmH / numH;
              const numW = numBox.max.x - numBox.min.x;
              const targetW = Math.max(0.46, Math.min(0.50, numW * (scaleY * 0.80)));

              const numCenterY = (numBox.min.y + numBox.max.y) * 0.5;
              const wmCenterY = (wmBox.min.y + wmBox.max.y) * 0.5;

              const gap = 0.14;
              const newMaxX = wmBox.min.x - gap;

              const geo = projectNumberMesh.geometry.clone();
              const pos = geo.attributes.position;
              const origMinX = numBox.min.x;
              const origMaxX = numBox.max.x;

              for (let i = 0; i < pos.count; i++) {
                const ox = pos.getX(i);
                const oy = pos.getY(i);
                const oz = pos.getZ(i);

                const tX = origMaxX !== origMinX ? (ox - origMinX) / (origMaxX - origMinX) : 0;
                const nx = (newMaxX - targetW) + tX * targetW;
                const ny = wmCenterY + (oy - numCenterY) * scaleY;

                // Adjust Z along cylindrical radius R = sqrt(ox^2 + oz^2) to follow ring panel curvature
                const currentR = Math.sqrt(ox * ox + oz * oz);
                let nz = oz;
                if (currentR > 4.0 && currentR < 8.0) {
                  nz = Math.sqrt(Math.max(0, currentR * currentR - nx * nx));
                }

                pos.setXYZ(i, nx, ny, nz);
              }

              pos.needsUpdate = true;
              geo.computeVertexNormals();
              geo.computeBoundingBox();
              projectNumberMesh.geometry = geo;
            }
          }

          // Render Column 2 Description text using the exact same font ("Space Mono") and font size as Column 1
          if (descMinX !== Infinity && descMaxX !== -Infinity) {
            const linesToUse = (textContent && textContent.description && textContent.description.length > 0)
              ? textContent.description
              : (isTheoryOfBloom ? DEFAULT_DESCRIPTIONS.bloom
                : isStakor ? DEFAULT_DESCRIPTIONS.stakor
                  : isAwknModel ? DEFAULT_DESCRIPTIONS.awkn
                    : isTrulyBare ? DEFAULT_DESCRIPTIONS.truly
                      : DEFAULT_DESCRIPTIONS.bloom);

            descriptionMesh = createDescriptionCurvedMesh(
              linesToUse,
              descMinX,
              descMaxX,
              srvMaxY,
              srvMinY,
              srv1Height,
              renderer
            );
            if (descriptionMesh) {
              model.add(descriptionMesh);
              desktopCopy.push(descriptionMesh);
            }
          }

          model.updateMatrixWorld(true);

          if (buttonBezelMesh) {
            const buttonCanvas = document.createElement('canvas');
            buttonCanvas.width = 1024;
            buttonCanvas.height = 384;
            const buttonCtx = buttonCanvas.getContext('2d');
            const labelText = buttonText || (isIntro ? 'EXPLORE WORK ↗' : 'VIEW PROJECT ↗');
            let mobileButtonCanvas;
            const paintButton = (hovered, pressed) => {
              drawButtonTexture(buttonCtx, 1024, 384, labelText, hovered, pressed);
              if (mobileButtonCanvas) {
                drawButtonTexture(mobileButtonCanvas.getContext('2d'), 1024, 384, labelText, hovered, pressed, true);
              }
            };
            paintButton(false, false);

            const buttonTexture = new THREE.CanvasTexture(buttonCanvas);
            buttonTexture.colorSpace = THREE.SRGBColorSpace;
            const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
            buttonTexture.anisotropy = Math.max(8, maxAniso);
            buttonTexture.generateMipmaps = true;
            buttonTexture.minFilter = THREE.LinearMipmapLinearFilter;
            buttonTexture.magFilter = THREE.LinearFilter;

            const screenGeo = new THREE.PlaneGeometry(1.48, 0.58);
            screenGeo.rotateY(Math.PI);
            screenGeo.translate(0, 0, -0.051);

            const screenMat = new THREE.MeshBasicMaterial({
              map: buttonTexture,
              transparent: true,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            });

            buttonScreenMesh = new THREE.Mesh(screenGeo, screenMat);
            buttonScreenMesh.name = 'RingButtonScreenMesh';
            buttonBezelMesh.add(buttonScreenMesh);
            if (!isIntro) {
              buttonScreenMesh.userData.createMobileLayer = () => {
                mobileButtonCanvas = buttonCanvas.cloneNode();
                drawButtonTexture(mobileButtonCanvas.getContext('2d'), 1024, 384, labelText, isButtonHovered, isButtonPressed, true);
                return createPanelTextLayer(buttonScreenMesh, mobileButtonCanvas);
              };
            }

            const restPos = buttonBezelMesh.position.clone();
            const pressVec = new THREE.Vector3(0, 0, 0.048).applyQuaternion(buttonBezelMesh.quaternion);

            const pressButton = () => {
              playMechanicalClickSound();
              paintButton(true, true);
              buttonTexture.needsUpdate = true;

              if (pressTween) pressTween.kill();
              const anim = { t: 0 };
              pressTween = gsap.to(anim, {
                t: 1,
                duration: 0.07,
                ease: 'power2.in',
                onUpdate: () => {
                  buttonBezelMesh.position.copy(restPos).addScaledVector(pressVec, anim.t);
                },
                onComplete: () => {
                  pressTween = gsap.to(anim, {
                    t: 0,
                    duration: 0.35,
                    ease: 'elastic.out(1.2, 0.45)',
                    onUpdate: () => {
                      buttonBezelMesh.position.copy(restPos).addScaledVector(pressVec, anim.t);
                    },
                    onComplete: () => {
                      paintButton(isButtonHovered, false);
                      buttonTexture.needsUpdate = true;
                    }
                  });
                }
              });
            };

            container.pressRingButton = pressButton;

            // Interactive pointer / raycaster events
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();

            const checkHit = (e) => {
              if (!buttonBezelMesh || !camera) return false;
              const rect = canvas.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return false;
              mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              raycaster.setFromCamera(mouse, camera);
              const hits = raycaster.intersectObjects([buttonBezelMesh, buttonScreenMesh], true);
              return hits.length > 0;
            };

            const onPointerMove = (e) => {
              const hit = checkHit(e);
              if (hit !== isButtonHovered) {
                isButtonHovered = hit;
                canvas.style.cursor = hit ? 'pointer' : 'default';
                paintButton(isButtonHovered, isButtonPressed);
                buttonTexture.needsUpdate = true;
              }
            };

            const onPointerDown = (e) => {
              if (checkHit(e)) {
                isButtonPressed = true;
                pressButton();
              }
            };

            const onPointerUp = (e) => {
              if (isButtonPressed) {
                isButtonPressed = false;
                if (checkHit(e)) {
                  if (typeof onButtonClickRef.current === 'function') {
                    onButtonClickRef.current();
                  } else if (projectUrl && projectUrl !== '#') {
                    window.open(projectUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    window.__hauloScrollTo?.('work');
                  }
                }
              }
            };

            const onPointerLeave = () => {
              if (isButtonHovered || isButtonPressed) {
                isButtonHovered = false;
                isButtonPressed = false;
                canvas.style.cursor = 'default';
                paintButton(false, false);
                buttonTexture.needsUpdate = true;
              }
            };

            canvas.addEventListener('pointermove', onPointerMove, { passive: true });
            canvas.addEventListener('pointerdown', onPointerDown);
            canvas.addEventListener('pointerup', onPointerUp);
            canvas.addEventListener('pointerleave', onPointerLeave);

            buttonCleanup = () => {
              canvas.removeEventListener('pointermove', onPointerMove);
              canvas.removeEventListener('pointerdown', onPointerDown);
              canvas.removeEventListener('pointerup', onPointerUp);
              canvas.removeEventListener('pointerleave', onPointerLeave);
              if (pressTween) pressTween.kill();
              buttonTexture.dispose();
              screenMat.dispose();
              screenGeo.dispose();
            };
          }
          panelDividers.sort((a, b) => a - b);
          ringModelInstance = model;
          updateProjectRingHeight();
          ringPivot.add(model);
          setIsReady(true);
          if (renderer && scene && camera) {
            try {
              renderer.compile(scene, camera);
            } catch (_) { }
          }
        })
        .catch((err) => {
          console.warn('Error loading Ring 3D model:', glbUrl, err);
        });
    };

    // Progressive/viewport-based lazy loading: loadModel is triggered via
    // IntersectionObserver, ensureModelLoaded, mountSharedFrog, or scroll preloading.

    // ---- PAUSABLE RENDER LOOP (FREEZES GPU WHEN OFF-SCREEN OR HIDDEN) ----
    let lastRenderTime = performance.now();

    const startRenderLoop = () => {
      if (animationFrameId || !isMounted) return;
      lastRenderTime = performance.now();

      const render = () => {
        // Stop scheduling RAF callbacks completely if parent container was marked hidden by GSAP
        // and does NOT host the shared frog. Completely drops inactive ring RAF callbacks to 0.
        if (parentRing && !sharedFrog && !expandedForSharedFrog && (parentRing.style.visibility === 'hidden' || parentRing.style.opacity === '0')) {
          animationFrameId = null;
          return;
        }

        animationFrameId = requestAnimationFrame(render);

        const now = performance.now();
        const dt = Math.min(Math.max(0, (now - lastRenderTime) / 1000), 0.1);
        lastRenderTime = now;

        if (expandedForSharedFrog) {
          syncExpandedCameraToContainer();
        }

        if (sharedFrog) {
          if (typeof sharedFrog.tickFrogAnimation === 'function') {
            sharedFrog.tickFrogAnimation(dt, now, sharedFrogLockWeight);
          }
          if (expandedForSharedFrog) {
            alignSharedFrogToOpening(sharedFrog, 1);
          }
        }

        if (mixer) {
          mixer.update(dt);
        }

        // Keep 3D ring completely static - eliminates all shaking/wobbling when scrolling over the model
        if (ringPivot) {
          ringPivot.position.x = basePosX;
          ringPivot.position.y = basePosY;
          ringPivot.position.z = basePosZ;
          ringPivot.rotation.x = baseRotX;
          ringPivot.rotation.y = baseRotY;
          ringPivot.rotation.z = baseRotZ;
        }

        if (textOverlayLayoutDirty) {
          textOverlayLayoutDirty = false;
        }

        if (renderer && scene && camera) {
          if (!isIntro && buttonScreenMesh && window.innerWidth <= 900 && expandedForSharedFrog && expandedCanvasLayer) {
            mobileButtonLayer ??= buttonScreenMesh.userData.createMobileLayer();
            if (mobileButtonLayer.layer.parentNode !== expandedCanvasLayer) expandedCanvasLayer.appendChild(mobileButtonLayer.layer);
            buttonScreenMesh.updateWorldMatrix(true, false);
            mobileButtonLayer.update(camera, window.innerWidth, window.innerHeight);
          } else if (mobileButtonLayer?.layer.parentNode) {
            mobileButtonLayer.layer.remove();
          }
          if (mobileCopy && window.innerWidth <= 900) {
            const useLayer = expandedForSharedFrog && expandedCanvasLayer;
            if (useLayer) {
              mobileTextLayer ??= createPanelTextLayer(mobileCopy);
              if (mobileTextLayer.layer.parentNode !== expandedCanvasLayer) expandedCanvasLayer.appendChild(mobileTextLayer.layer);
              mobileCopy.updateWorldMatrix(true, false);
              mobileTextLayer.update(camera, window.innerWidth, window.innerHeight);
            } else {
              mobileTextLayer?.layer.remove();
            }
            mobileCopy.visible = !useLayer;
          }
          renderer.render(scene, camera);
          reportSettled(Boolean(!isIntro && ringModelInstance && expandedForSharedFrog &&
            sharedFrog && sharedFrog.parent === sharedFrogMount && sharedFrogLockWeight === 1));
          const ringName = (glbUrl || '').split('/').pop() || 'Ring';
          perfDiagnostics.recordRender(`ring-${ringName}`, renderer, `Ring (${ringName})`);
          perfDiagnostics.recordFrame(0, 'Ring Section: ' + ringName);
          if (!container.hasLoggedCalls && renderer.info.render.calls > 0) {
            container.hasLoggedCalls = true;
            console.log(`[Three.js Telemetry] ${glbUrl.split('/').pop()} -> Actual Draw Calls: ${renderer.info.render.calls}, Triangles: ${renderer.info.render.triangles.toLocaleString()}`);
          }
        }
      };
      render();
    };

    const stopRenderLoop = () => {
      if (!isMounted) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }
      if (sharedFrog || expandedForSharedFrog) return;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    container.startRenderLoop = startRenderLoop;
    container.stopRenderLoop = stopRenderLoop;
    if (parentRing && usesMobileRingLoading()) loadModel();

    // ---- INTERSECTION OBSERVER FOR LAZY LOADING & GPU PAUSING ----
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          loadModel();
          startRenderLoop();
        } else {
          if (!sharedFrog && !expandedForSharedFrog) {
            stopRenderLoop();
          }
        }
      },
      {
        rootMargin: '600px 0px 600px 0px',
        threshold: 0.01,
      }
    );
    intersectionObserver.observe(container);

    return () => {
      reportSettled(false);
      isMounted = false;
      const ringId = 'ring-' + (glbUrl || '').split('/').pop();
      perfDiagnostics.unregisterRenderer(ringId);
      stopRenderLoop();
      if (buttonCleanup) buttonCleanup();
      mobileCopy?.userData.dispose();
      if (descriptionMesh && descriptionMesh.userData.dispose) descriptionMesh.userData.dispose();
      if (container.mountSharedFrog) delete container.mountSharedFrog;
      if (container.unmountSharedFrog) delete container.unmountSharedFrog;
      if (container.ensureModelLoaded) delete container.ensureModelLoaded;
      delete container.warmupWithSharedFrog;
      if (container.startRenderLoop) delete container.startRenderLoop;
      if (container.stopRenderLoop) delete container.stopRenderLoop;
      // Also restore the React-owned canvas if this component unmounts mid-pass.
      restoreExpandedNodes();
      restoreExpandedNodesRef.current = () => { };
      intersectionObserver.disconnect();
      overlayResizeObserver.disconnect();
      window.removeEventListener('resize', updateRendererSize);
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [enabled, glbUrl, variant, enableAttachments, textContent, buttonText, projectUrl]);

  return (
    <div
      ref={containerRef}
      className={`ring-3d-model-container ${isIntro ? 'ring-3d-model-container--intro' : ''} ${className}`}
      style={{
        position: 'relative',
        display: 'block',
        width: isIntro ? '100%' : 'var(--project-ring-width, clamp(540px, 82vw, 1400px))',
        maxWidth: isIntro ? '100%' : 'var(--project-ring-max-width, min(96vw, 1400px))',
        height: isIntro ? '100%' : 'auto',
        aspectRatio: isIntro ? '1125 / 941' : '1024 / 720',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Real-time 3D Canvas matching reference image exactly */}
      <canvas
        ref={setCanvasNode}
        aria-label={alt}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: 'auto',
          touchAction: 'pan-y',
        }}
      />
      {textContent && !isIntro && (
        <div
          ref={setTextOverlayNode}
          className="ring-text-overlay"
          aria-hidden="true"
          style={{ display: 'none' }}
        >
          <span className="ring-text-overlay__line" data-ring-text-key="title">
            <span>{textContent.title}</span>
          </span>
          {textContent.services?.map((line, index) => (
            <span className="ring-text-overlay__line" data-ring-text-key={`service${index + 1}`} key={`service-${index}`}>
              <span>{line}</span>
            </span>
          ))}
          {textContent.description?.map((line, index) => (
            <span className="ring-text-overlay__line" data-ring-text-key={`description${index + 1}`} key={`description-${index}`}>
              <span>{line}</span>
            </span>
          ))}
          <div className="ring-text-overlay__divider ring-text-overlay__divider--left" data-ring-divider="left" />
          <div className="ring-text-overlay__divider ring-text-overlay__divider--right" data-ring-divider="right" />
        </div>
      )}
    </div>
  );
}

export default Ring3DModel;
